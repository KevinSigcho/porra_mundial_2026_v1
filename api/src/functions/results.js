const { app } = require('@azure/functions');
const { readJson, ok, errorResponse } = require('../lib/response');
const { getEntity, upsertEntity } = require('../lib/storage');
const { requireAdmin } = require('../lib/auth');
const { normalizeScores, countComplete } = require('../lib/validation');
const { parseJson } = require('../lib/scoring');

app.http('results', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'results',
  handler: async (request) => {
    try {
      if (request.method === 'GET') {
        const entity = await getEntity('result', 'groupStage');
        return ok({
          results: parseJson(entity?.results, {}),
          updatedAt: entity?.updatedAt || null
        });
      }

      requireAdmin(request);
      const body = await readJson(request);
      const results = normalizeScores(body.results || {});
      const completeCount = countComplete(results);

      await upsertEntity({
        partitionKey: 'result',
        rowKey: 'groupStage',
        results: JSON.stringify(results),
        completeCount,
        updatedAt: new Date().toISOString()
      }, 'Merge');

      return ok({
        saved: true,
        completeCount,
        results
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
});
