const { getEntity } = require('./storage');
const fixtureData = require('../data/fixtures.json');

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

async function getSettings() {
  const entity = await getEntity('settings', 'global');
  return {
    locked: entity ? entity.locked === true || entity.locked === 'true' : false,
    // La eliminatoria está cerrada por defecto hasta que el admin la abra.
    knockoutLocked: entity
      ? !(entity.knockoutLocked === false || entity.knockoutLocked === 'false')
      : true,
    scoring: fixtureData.rules,

    // Nuevo: datos reales/provisionales del cuadro oficial.
    knockoutData: parseJson(entity?.knockoutData, null),
    knockoutUpdatedAt: entity?.knockoutUpdatedAt || null
  };
}

module.exports = { getSettings };
