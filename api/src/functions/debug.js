const { app } = require('@azure/functions');

app.http('debug', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'debug',
  handler: async () => {
    return {
      status: 200,
      jsonBody: {
        version: 'debug-guardar-predictions-v2',
        time: new Date().toISOString()
      }
    };
  }
});
