const { getEntity } = require('./storage');
const fixtureData = require('../data/fixtures.json');

async function getSettings() {
  const entity = await getEntity('settings', 'global');
  return {
    locked: entity ? entity.locked === true || entity.locked === 'true' : false,
    scoring: fixtureData.rules
  };
}

module.exports = { getSettings };
