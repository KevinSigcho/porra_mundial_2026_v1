const { app } = require('@azure/functions');
const { ok, errorResponse } = require('../lib/response');
const { getEntity } = require('../lib/storage');
const { parseJson } = require('../lib/scoring');

app.http('results', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'results',
  handler: async () => {
    try {
      const entity = await getEntity('result', 'groupStage');

      return ok({
        results: parseJson(entity?.results, {}),
        updatedAt: entity?.updatedAt || null
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
});
