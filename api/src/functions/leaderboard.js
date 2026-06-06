const { app } = require('@azure/functions');
const { ok, errorResponse } = require('../lib/response');
const { listByPartition, getEntity } = require('../lib/storage');
const { parseJson, computePlayerScore } = require('../lib/scoring');
const { countComplete } = require('../lib/validation');
const fixtureData = require('../data/fixtures.json');

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

        return {
          playerId: player.rowKey,
          name: player.name,
          avatarId: player.avatarId || 'football-1',
          avatarUrl: player.avatarUrl || '',
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
        if (b.points !== a.points) return b.points - a.points;
        if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
        if (b.exactGoalDifferences !== a.exactGoalDifferences) return b.exactGoalDifferences - a.exactGoalDifferences;
        if (b.correctOutcomes !== a.correctOutcomes) return b.correctOutcomes - a.correctOutcomes;
        if (b.predictionsMade !== a.predictionsMade) return b.predictionsMade - a.predictionsMade;
        return a.name.localeCompare(b.name, 'es');
      });

      return ok({
        rows,
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
