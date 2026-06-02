const { app } = require('@azure/functions');
const { readJson, ok, errorResponse } = require('../lib/response');
const { upsertEntity } = require('../lib/storage');
const { requireAdmin } = require('../lib/auth');
const { normalizeScores, countComplete } = require('../lib/validation');

app.http('adminResults', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'admin-results',
  handler: async (request) => {
    try {
      if (request.method === 'GET') {
        return ok({
          alive: true,
          route: '/api/admin-results',
          version: 'admin-results-v1'
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
