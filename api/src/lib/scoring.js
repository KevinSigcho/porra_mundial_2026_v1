const fixtureData = require('../data/fixtures.json');

const EXACT_SCORE_POINTS = fixtureData.rules.exactScore;
const CORRECT_OUTCOME_POINTS = fixtureData.rules.correctOutcome;

function parseJson(value, fallback = {}) {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function outcome(score) {
  if (score.homeGoals > score.awayGoals) return 'H';
  if (score.homeGoals < score.awayGoals) return 'A';
  return 'D';
}

function computePlayerScore(predictions, results) {
  let points = 0;
  let exactScores = 0;
  let correctOutcomes = 0;
  const matchPoints = {};

  for (const fixture of fixtureData.fixtures) {
    const prediction = predictions[fixture.id];
    const result = results[fixture.id];
    if (!prediction || !result) {
      continue;
    }

    const exact = prediction.homeGoals === result.homeGoals && prediction.awayGoals === result.awayGoals;
    if (exact) {
      points += EXACT_SCORE_POINTS;
      exactScores += 1;
      matchPoints[fixture.id] = EXACT_SCORE_POINTS;
      continue;
    }

    if (outcome(prediction) === outcome(result)) {
      points += CORRECT_OUTCOME_POINTS;
      correctOutcomes += 1;
      matchPoints[fixture.id] = CORRECT_OUTCOME_POINTS;
    } else {
      matchPoints[fixture.id] = 0;
    }
  }

  return { points, exactScores, correctOutcomes, matchPoints };
}

module.exports = { parseJson, computePlayerScore };
