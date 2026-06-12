const { app } = require('@azure/functions');
const { readJson, ok, errorResponse } = require('../lib/response');
const { getEntity, upsertEntity } = require('../lib/storage');
const { requireAdmin } = require('../lib/auth');
const { normalizeScores, normalizeKnockout, countComplete } = require('../lib/validation');
const { parseJson } = require('../lib/scoring');

app.http('results', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'results',
  handler: async (request) => {
    try {
      if (request.method === 'GET') {
        const groupEntity = await getEntity('result', 'groupStage');
        const knockoutEntity = await getEntity('result', 'knockout');
        return ok({
          results: parseJson(groupEntity?.results, {}),
          updatedAt: groupEntity?.updatedAt || null,
          knockout: parseJson(knockoutEntity?.results, {}),
          knockoutUpdatedAt: knockoutEntity?.updatedAt || null
        });
      }

      requireAdmin(request);
      const body = await readJson(request);
      const phase = body.phase === 'knockout' ? 'knockout' : 'groupStage';

      const results =
        phase === 'knockout'
          ? normalizeKnockout(body.results || {})
          : normalizeScores(body.results || {});
      const completeCount = countComplete(results);

      await upsertEntity({
        partitionKey: 'result',
        rowKey: phase,
        results: JSON.stringify(results),
        completeCount,
        updatedAt: new Date().toISOString()
      }, 'Merge');

      return ok({
        saved: true,
        phase,
        completeCount,
        results
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
});
