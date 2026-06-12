const { getEntity } = require('./storage');
const fixtureData = require('../data/fixtures.json');

async function getSettings() {
  const entity = await getEntity('settings', 'global');
  return {
    locked: entity ? entity.locked === true || entity.locked === 'true' : false,
    // La eliminatoria está cerrada por defecto hasta que el admin la abra.
    knockoutLocked: entity
      ? !(entity.knockoutLocked === false || entity.knockoutLocked === 'false')
      : true,
    scoring: fixtureData.rules
  };
}

module.exports = { getSettings };
