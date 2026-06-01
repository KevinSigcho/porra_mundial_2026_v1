const { app } = require('@azure/functions');
const { readJson, ok, errorResponse } = require('../lib/response');
const { getEntity, upsertEntity } = require('../lib/storage');
const { requireAdmin } = require('../lib/auth');
const { normalizeScores, countComplete } = require('../lib/validation');
const { parseJson } = require('../lib/scoring');

app.http('getResults', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'results',
  handler: async () => {
    try {
      const entity = await getEntity('result', 'groupStage');
      return ok({ results: parseJson(entity?.results, {}), updatedAt: entity?.updatedAt || null });
    } catch (error) {
      return errorResponse(error);
    }
  }
});

app.http('saveResults', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'admin/results',
  handler: async (request) => {
    try {
      requireAdmin(request);
      const body = await readJson(request);
      const results = normalizeScores(body.results);
      await upsertEntity({
        partitionKey: 'result',
        rowKey: 'groupStage',
        results: JSON.stringify(results),
        completeCount: countComplete(results),
        updatedAt: new Date().toISOString()
      }, 'Replace');
      return ok({ saved: true, completeCount: countComplete(results), results });
    } catch (error) {
      return errorResponse(error);
    }
  }
});
