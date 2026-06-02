const { app } = require('@azure/functions');
const { ok, errorResponse } = require('../lib/response');
const { getSettings } = require('../lib/settings');

app.http('settings', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'settings',
  handler: async () => {
    try {
      return ok(await getSettings());
    } catch (error) {
      return errorResponse(error);
    }
  }
});
