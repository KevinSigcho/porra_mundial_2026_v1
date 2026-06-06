const { app } = require('@azure/functions');
const { ok, errorResponse } = require('../lib/response');
const { listByPartition, getEntity } = require('../lib/storage');
const { parseJson, computePlayerScore } = require('../lib/scoring');
const { countComplete } = require('../lib/validation');
const fixtureData = require('../data/fixtures.json');

const ENTRY_FEE = 5;

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function isConfirmed(player) {
  return player?.paymentStatus === 'confirmed' || player?.paymentConfirmed === true;
}

app.http('leaderboard', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'leaderboard',
  handler: async () => {
    try {
      const players = await listByPartition('player');
      const predictionEntities = await listByPartition('prediction');
      const resultEntity = await getEntity('result', 'groupStage');
      const results = parseJson(resultEntity?.results, {});
      const predictionsByPlayer = new Map(predictionEntities.map((entity) => [entity.rowKey, entity]));

      const rows = players.map((player) => {
        const entity = predictionsByPlayer.get(player.rowKey);
        const predictions = parseJson(entity?.predictions, {});
        const score = computePlayerScore(predictions, results);
        const paymentConfirmed = isConfirmed(player);

        return {
          playerId: player.rowKey,
          name: player.name,
          phone: player.phone || '',
          avatarId: player.avatarId || 'football-1',
          avatarUrl: player.avatarUrl || '',
          paymentAmount: Number(player.paymentAmount || ENTRY_FEE),
          paymentStatus: paymentConfirmed ? 'confirmed' : 'pending',
          paymentConfirmed,
          paymentConfirmedAt: player.paymentConfirmedAt || null,
          points: score.points,
          groupWinnersCorrect: score.groupWinnersCorrect,
          groupRunnersCorrect: score.groupRunnersCorrect,
          thirdsCorrect: score.thirdsCorrect,
          exactScores: score.exactScores,
          correctOutcomes: score.correctOutcomes,
          exactGoalDifferences: score.exactGoalDifferences,
          predictionsMade: countComplete(predictions),
          updatedAt: entity?.updatedAt || null
        };
      }).sort((a, b) => {
        if (a.paymentConfirmed !== b.paymentConfirmed) return a.paymentConfirmed ? -1 : 1;
        if (b.points !== a.points) return b.points - a.points;
        if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
        if (b.exactGoalDifferences !== a.exactGoalDifferences) return b.exactGoalDifferences - a.exactGoalDifferences;
        if (b.correctOutcomes !== a.correctOutcomes) return b.correctOutcomes - a.correctOutcomes;
        if (b.predictionsMade !== a.predictionsMade) return b.predictionsMade - a.predictionsMade;
        return a.name.localeCompare(b.name, 'es');
      });

      const playerCount = players.length;
      const confirmedPlayerCount = rows.filter((row) => row.paymentConfirmed).length;
      const pendingPlayerCount = playerCount - confirmedPlayerCount;
      const prizePool = money(confirmedPlayerCount * ENTRY_FEE);
      const prizes = {
        first: money(prizePool * 0.5),
        second: money(prizePool * 0.3),
        third: money(prizePool * 0.2)
      };

      return ok({
        rows,
        playerCount,
        confirmedPlayerCount,
        pendingPlayerCount,
        entryFee: ENTRY_FEE,
        prizePool,
        prizes,
        resultCount: Object.keys(results).length,
        fixtureCount: fixtureData.fixtures.length,
        scoring: {
          groupWinner: 5,
          groupRunner: 3,
          groupThirdQualified: 1,
          description: 'Fase de grupos: 5 pts por acertar el 1º, 3 pts por acertar el 2º y 1 pt por acertar el 3º que entra a eliminatorias.'
        },
        tieBreakers: [
          'Puntos totales',
          'Marcadores exactos acertados',
          'Diferencias de goles exactas acertadas',
          'Signos acertados',
          'Pronósticos completados',
          'Orden alfabético'
        ],
        resultsUpdatedAt: resultEntity?.updatedAt || null
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
});
