const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');
const { ok, errorResponse } = require('../lib/response');
const { parseJson, computePlayerScore, normalizeScoreMap } = require('../lib/scoring');
const { countComplete } = require('../lib/validation');
const fixtureData = require('../data/fixtures.json');

const ENTRY_FEE = 5;

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function getConnectionString() {
  const value =
    process.env.STORAGE_CONNECTION_STRING ||
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
    process.env.AzureWebJobsStorage;

  if (!value) {
    const error = new Error('Falta la variable STORAGE_CONNECTION_STRING en Azure.');
    error.status = 500;
    throw error;
  }

  return value;
}

function getTableName() {
  return process.env.STORAGE_TABLE_NAME || process.env.TABLE_NAME || 'PorraMundial2026';
}

function getTableClient() {
  return TableClient.fromConnectionString(getConnectionString(), getTableName());
}

async function listByPartition(partitionKey) {
  const client = getTableClient();
  const rows = [];

  for await (const entity of client.listEntities({
    queryOptions: {
      filter: `PartitionKey eq '${partitionKey}'`
    }
  })) {
    rows.push(entity);
  }

  return rows;
}

async function getEntity(partitionKey, rowKey) {
  const client = getTableClient();

  try {
    return await client.getEntity(partitionKey, rowKey);
  } catch (error) {
    if (error.statusCode === 404) return null;
    throw error;
  }
}

function isConfirmed(player) {
  const status = String(player?.paymentStatus || '').trim().toLowerCase();
  return status === 'confirmed' || player?.paymentConfirmed === true;
}

function isCompleteScore(score) {
  if (!score) return false;

  const homeGoals = Number(score.homeGoals);
  const awayGoals = Number(score.awayGoals);

  return (
    Number.isInteger(homeGoals) &&
    Number.isInteger(awayGoals) &&
    homeGoals >= 0 &&
    awayGoals >= 0
  );
}

function sameScore(a, b) {
  return (
    isCompleteScore(a) &&
    isCompleteScore(b) &&
    Number(a.homeGoals) === Number(b.homeGoals) &&
    Number(a.awayGoals) === Number(b.awayGoals)
  );
}

function outcome(score) {
  const homeGoals = Number(score.homeGoals);
  const awayGoals = Number(score.awayGoals);

  if (homeGoals > awayGoals) return 'H';
  if (homeGoals < awayGoals) return 'A';
  return 'D';
}

// Acertar el signo del partido (1, X o 2); el empate también cuenta.
function correctOutcome(prediction, result) {
  if (!isCompleteScore(prediction) || !isCompleteScore(result)) return false;

  return outcome(prediction) === outcome(result);
}

function publicPlayer(player) {
  const paymentConfirmed = isConfirmed(player);

  return {
    playerId: player.rowKey,
    name: player.name || player.rowKey,
    phone: player.phone || player.bizumPhone || '',
    avatarId: player.avatarId || player.avatarPreset || 'football-1',
    avatarUrl: player.avatarUrl || player.profileImage || '',
    paymentAmount: Number(player.paymentAmount || ENTRY_FEE),
    paymentStatus: paymentConfirmed ? 'confirmed' : 'pending',
    paymentConfirmed,
    paymentConfirmedAt: player.paymentConfirmedAt || player.paymentUpdatedAt || null,
    createdAt: player.createdAt || null,
    updatedAt: player.updatedAt || null
  };
}

function buildMatchDetails(fixtures, players, predictionsByPlayer, results) {
  const normalizedResults = normalizeScoreMap(results);

  return (fixtures || []).map((fixture) => {
    const result = normalizedResults[fixture.id] || null;
    const hasResult = isCompleteScore(result);

    const predictions = (players || []).map((player) => {
      const predictionEntity = predictionsByPlayer.get(player.rowKey);
      const playerPredictions = normalizeScoreMap(parseJson(predictionEntity?.predictions, {}));
      const prediction = playerPredictions[fixture.id] || null;
      const hasPrediction = isCompleteScore(prediction);
      const exactScoreBonus = hasResult && hasPrediction && sameScore(prediction, result);
      const outcomeBonus = hasResult && hasPrediction && correctOutcome(prediction, result);
      const outcomePoints = outcomeBonus ? 2 : 0;
      const exactScorePoints = exactScoreBonus ? 1 : 0;

      return {
        ...publicPlayer(player),
        prediction,
        hasPrediction,
        outcomeBonus,
        outcomePoints,
        exactScoreBonus,
        exactScorePoints,
        matchPoints: outcomePoints + exactScorePoints,
        predictionUpdatedAt: predictionEntity?.updatedAt || null
      };
    }).sort((a, b) => {
      if (a.paymentConfirmed !== b.paymentConfirmed) return a.paymentConfirmed ? -1 : 1;
      if (a.hasPrediction !== b.hasPrediction) return a.hasPrediction ? -1 : 1;
      return String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' });
    });

    return {
      id: fixture.id,
      matchNo: fixture.matchNo,
      group: fixture.group,
      date: fixture.date,
      kickoffDateSpain: fixture.kickoffDateSpain || null,
      kickoffTimeSpain: fixture.kickoffTimeSpain || null,
      kickoffAtSpain: fixture.kickoffAtSpain || null,
      lockAtSpain: fixture.lockAtSpain || null,
      home: fixture.home,
      away: fixture.away,
      venue: fixture.venue,
      result,
      hasResult,
      predictions
    };
  });
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

      const predictionsByPlayer = new Map(
        predictionEntities.map((entity) => [entity.rowKey, entity])
      );

      const rows = players.map((player) => {
        const entity = predictionsByPlayer.get(player.rowKey);
        const predictions = parseJson(entity?.predictions, {});
        const score = computePlayerScore(predictions, results);
        const paymentConfirmed = isConfirmed(player);

        return {
          ...publicPlayer(player),
          points: score.points,
          groupWinnersCorrect: score.groupWinnersCorrect,
          groupRunnersCorrect: score.groupRunnersCorrect,
          thirdsCorrect: score.thirdsCorrect,
          exactScores: score.exactScores,
          correctOutcomes: score.correctOutcomes,
          matchOutcomePoints: score.matchOutcomePoints,
          exactScorePoints: score.exactScorePoints,
          exactGoalDifferences: score.exactGoalDifferences,
          predictionsMade: countComplete(predictions),
          updatedAt: entity?.updatedAt || player.updatedAt || null,
          paymentStatus: paymentConfirmed ? 'confirmed' : 'pending',
          paymentConfirmed
        };
      }).sort((a, b) => {
        if (a.paymentConfirmed !== b.paymentConfirmed) return a.paymentConfirmed ? -1 : 1;
        if (b.points !== a.points) return b.points - a.points;
        if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
        if (b.exactGoalDifferences !== a.exactGoalDifferences) return b.exactGoalDifferences - a.exactGoalDifferences;
        if (b.correctOutcomes !== a.correctOutcomes) return b.correctOutcomes - a.correctOutcomes;
        if (b.predictionsMade !== a.predictionsMade) return b.predictionsMade - a.predictionsMade;
        return String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' });
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

      const normalizedResults = normalizeScoreMap(results);
      const resultCount = Object.keys(normalizedResults).length;
      const fixtureCount = fixtureData.fixtures.length;

      const matchDetails = buildMatchDetails(
        fixtureData.fixtures || [],
        players,
        predictionsByPlayer,
        results
      );

      return ok({
        rows,
        matchDetails,
        playerCount,
        confirmedPlayerCount,
        pendingPlayerCount,
        entryFee: ENTRY_FEE,
        prizePool,
        prizes,
        resultCount,
        fixtureCount,
        scoring: {
          groupWinner: 5,
          groupRunner: 3,
          groupThirdQualified: 1,
          matchOutcome: 2,
          exactScoreBonus: 1,
          description: 'Fase de grupos: 5 pts por acertar el 1º, 3 pts por acertar el 2º y 1 pt por acertar el 3º de cada grupo. En cada partido: 2 pts por acertar el resultado (1, X o 2, incluido el empate) y 1 pt extra por el marcador exacto (3 pts en total).'
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