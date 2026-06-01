const { app } = require('@azure/functions');
const { ok } = require('../lib/response');
const fixtureData = require('../data/fixtures.json');

app.http('fixtures', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'fixtures',
  handler: async () => ok(fixtureData)
});
