const data = require('../data/fixtures.json');

const fixtureIds = new Set(data.fixtures.map((fixture) => fixture.id));
const knockoutIds = new Set((data.knockout || []).map((fixture) => fixture.id));

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

// Predicción/resultado de eliminatoria: marcador obligatorio (previo a penaltis)
// + `advance` ('home'|'away') solo relevante cuando el marcador es empate.
function normalizeKnockout(input) {
  const normalized = {};
  const source = input && typeof input === 'object' ? input : {};
  for (const [matchId, value] of Object.entries(source)) {
    if (!knockoutIds.has(matchId)) {
      continue;
    }
    const homeGoals = toScore(value?.homeGoals);
    const awayGoals = toScore(value?.awayGoals);
    if (homeGoals === null || awayGoals === null) {
      continue;
    }
    const entry = { homeGoals, awayGoals };
    if (value?.advance === 'home' || value?.advance === 'away') {
      entry.advance = value.advance;
    }
    if (typeof value?.homeTeam === 'string' && value.homeTeam) entry.homeTeam = String(value.homeTeam).slice(0, 60);
    if (typeof value?.awayTeam === 'string' && value.awayTeam) entry.awayTeam = String(value.awayTeam).slice(0, 60);
    normalized[matchId] = entry;
  }
  return normalized;
}

module.exports = { normalizeScores, normalizeKnockout, countComplete };
