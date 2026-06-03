const { app } = require('@azure/functions');
const { readJson, ok, errorResponse } = require('../lib/response');
const { upsertEntity } = require('../lib/storage');
const { requireAdmin } = require('../lib/auth');
const { getSettings } = require('../lib/settings');

app.http('settings', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'settings',
  handler: async (request) => {
    try {
      if (request.method === 'GET') {
        return ok(await getSettings());
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
