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
          points: score.points,
          exactScores: score.exactScores,
          correctOutcomes: score.correctOutcomes,
          predictionsMade: countComplete(predictions),
          updatedAt: entity?.updatedAt || null
        };
      }).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
        return a.name.localeCompare(b.name, 'es');
      });

      return ok({
        rows,
        resultCount: Object.keys(results).length,
        fixtureCount: fixtureData.fixtures.length,
        scoring: fixtureData.rules,
        resultsUpdatedAt: resultEntity?.updatedAt || null
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
});
