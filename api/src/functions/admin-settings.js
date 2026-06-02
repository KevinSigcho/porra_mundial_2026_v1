const { app } = require('@azure/functions');
const { readJson, ok, errorResponse } = require('../lib/response');
const { upsertEntity } = require('../lib/storage');
const { requireAdmin } = require('../lib/auth');
const { getSettings } = require('../lib/settings');

app.http('adminSettings', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'admin-settings',
  handler: async (request) => {
    try {
      if (request.method === 'GET') {
        return ok({
          alive: true,
          route: '/api/admin-settings',
          version: 'admin-settings-v1'
        });
      }

      requireAdmin(request);

      const body = await readJson(request);
      const locked = body.locked === true;

      await upsertEntity({
        partitionKey: 'settings',
        rowKey: 'global',
        locked,
        updatedAt: new Date().toISOString()
      }, 'Merge');

      return ok(await getSettings());
    } catch (error) {
      return errorResponse(error);
    }
  }
});
