const data = require('../data/fixtures.json');

const fixtureIds = new Set(data.fixtures.map((fixture) => fixture.id));

function toScore(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 99) {
    return null;
  }
  return number;
}

function normalizeScores(input) {
  const normalized = {};
  const source = input && typeof input === 'object' ? input : {};
  for (const [matchId, value] of Object.entries(source)) {
    if (!fixtureIds.has(matchId)) {
      continue;
    }
    const homeGoals = toScore(value?.homeGoals);
    const awayGoals = toScore(value?.awayGoals);
    if (homeGoals === null || awayGoals === null) {
      continue;
    }
    normalized[matchId] = { homeGoals, awayGoals };
  }
  return normalized;
}

function countComplete(scores) {
  return Object.keys(scores || {}).length;
}

module.exports = { normalizeScores, countComplete };
