const { app } = require('@azure/functions');
const { readJson, ok, errorResponse } = require('../lib/response');
const { upsertEntity } = require('../lib/storage');
const { requireAdmin } = require('../lib/auth');
const { normalizeScores, countComplete } = require('../lib/validation');
const { getSettings } = require('../lib/settings');

app.http('admin', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'admin',
  handler: async (request) => {
    try {
      if (request.method === 'GET') {
        return ok({
          alive: true,
          route: '/api/admin',
          version: 'admin-v1'
        });
      }

      requireAdmin(request);

      const body = await readJson(request);
      const action = String(body?.action || '').trim();

      if (action === 'verify') {
        return ok({
          ok: true,
          admin: true
        });
      }

      if (action === 'setLocked') {
        const locked = body.locked === true;

        await upsertEntity({
          partitionKey: 'settings',
          rowKey: 'global',
          locked,
          updatedAt: new Date().toISOString()
        }, 'Merge');

        return ok(await getSettings());
      }

      if (action === 'saveResults') {
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
      }

      return {
        status: 400,
        jsonBody: {
          error: 'Acción admin no reconocida.'
        }
      };
    } catch (error) {
      return errorResponse(error);
    }
  }
});
