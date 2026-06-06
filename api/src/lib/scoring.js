const fixtureData = require('../data/fixtures.json');

const GROUP_WINNER_POINTS = 5;
const GROUP_RUNNER_POINTS = 3;
const GROUP_THIRD_POINTS = 1;

function parseJson(value, fallback = {}) {
  if (!value) return fallback;

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function normalizeMatchId(id) {
  const raw = String(id || '').trim().toUpperCase();
  const match = raw.match(/^M0*(\d+)$/);

  if (!match) {
    return raw;
  }

  return `M${String(Number(match[1])).padStart(2, '0')}`;
}

function normalizeScoreMap(scoreMap) {
  const normalized = {};

  for (const [rawId, rawScore] of Object.entries(scoreMap || {})) {
    const id = normalizeMatchId(rawId);
    const homeGoals = Number(rawScore?.homeGoals);
    const awayGoals = Number(rawScore?.awayGoals);

    if (
      Number.isInteger(homeGoals) &&
      Number.isInteger(awayGoals) &&
      homeGoals >= 0 &&
      awayGoals >= 0
    ) {
      normalized[id] = {
        homeGoals,
        awayGoals
      };
    }
  }

  return normalized;
}

function isCompleteScore(score) {
  if (!score) return false;

  const homeGoals = Number(score.homeGoals);
  const awayGoals = Number(score.awayGoals);

  return (
    Number.isInteger(homeGoals) &&
    Number.isInteger(awayGoals) &&
    homeGoals >= 0 &&
    awayGoals >= 0
  );
}

function outcome(score) {
  const homeGoals = Number(score.homeGoals);
  const awayGoals = Number(score.awayGoals);

  if (homeGoals > awayGoals) return 'H';
  if (homeGoals < awayGoals) return 'A';
  return 'D';
}

function emptyStanding(team) {
  return {
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0
  };
}

function getFixtureScore(scoreMap, fixture) {
  const normalized = normalizeScoreMap(scoreMap);

  const byFixtureId = normalized[normalizeMatchId(fixture.id)];
  if (byFixtureId) return byFixtureId;

  const byMatchNo = normalized[normalizeMatchId(`M${fixture.matchNo}`)];
  if (byMatchNo) return byMatchNo;

  return null;
}

function buildGroupTables(scoreMap) {
  const tables = {};

  for (const [group, teams] of Object.entries(fixtureData.groups || {})) {
    tables[group] = teams.map(emptyStanding);
  }

  const byTeam = {};

  for (const [group, rows] of Object.entries(tables)) {
    byTeam[group] = Object.fromEntries(rows.map((row) => [row.team, row]));
  }

  for (const fixture of fixtureData.fixtures || []) {
    const score = getFixtureScore(scoreMap, fixture);

    if (!isCompleteScore(score)) continue;

    const home = byTeam[fixture.group]?.[fixture.home];
    const away = byTeam[fixture.group]?.[fixture.away];

    if (!home || !away) continue;

    const homeGoals = Number(score.homeGoals);
    const awayGoals = Number(score.awayGoals);

    home.played += 1;
    away.played += 1;

    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;

    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;

    if (homeGoals > awayGoals) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
    } else if (homeGoals < awayGoals) {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }

    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;
  }

  for (const group of Object.keys(tables)) {
    tables[group].sort((a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.goalsAgainst - b.goalsAgainst ||
      a.team.localeCompare(b.team, 'es')
    );
  }

  return tables;
}

function groupFixtures(group) {
  return (fixtureData.fixtures || []).filter((fixture) => fixture.group === group);
}

function groupIsComplete(scoreMap, group) {
  const fixtures = groupFixtures(group);

  if (!fixtures.length) {
    return false;
  }

  return fixtures.every((fixture) => isCompleteScore(getFixtureScore(scoreMap, fixture)));
}

function countCompleteGroups(scoreMap) {
  return Object.keys(fixtureData.groups || {}).filter((group) => groupIsComplete(scoreMap, group)).length;
}

function computeTieBreakers(predictions, results) {
  let exactScores = 0;
  let correctOutcomes = 0;
  let exactGoalDifferences = 0;

  for (const fixture of fixtureData.fixtures || []) {
    const prediction = getFixtureScore(predictions, fixture);
    const result = getFixtureScore(results, fixture);

    if (!isCompleteScore(prediction) || !isCompleteScore(result)) {
      continue;
    }

    const predictionHome = Number(prediction.homeGoals);
    const predictionAway = Number(prediction.awayGoals);
    const resultHome = Number(result.homeGoals);
    const resultAway = Number(result.awayGoals);

    if (predictionHome === resultHome && predictionAway === resultAway) {
      exactScores += 1;
    }

    if (outcome(prediction) === outcome(result)) {
      correctOutcomes += 1;
    }

    if ((predictionHome - predictionAway) === (resultHome - resultAway)) {
      exactGoalDifferences += 1;
    }
  }

  return {
    exactScores,
    correctOutcomes,
    exactGoalDifferences
  };
}

function computePlayerScore(predictions, results) {
  const normalizedPredictions = normalizeScoreMap(predictions);
  const normalizedResults = normalizeScoreMap(results);

  const predictedTables = buildGroupTables(normalizedPredictions);
  const actualTables = buildGroupTables(normalizedResults);
  const tieBreakers = computeTieBreakers(normalizedPredictions, normalizedResults);

  let points = 0;
  let groupWinnersCorrect = 0;
  let groupRunnersCorrect = 0;
  let thirdsCorrect = 0;

  const groupBreakdown = {};

  for (const group of Object.keys(fixtureData.groups || {})) {
    const predictionReady = groupIsComplete(normalizedPredictions, group);
    const resultReady = groupIsComplete(normalizedResults, group);

    const predicted = predictedTables[group] || [];
    const actual = actualTables[group] || [];

    let groupPoints = 0;
    let winnerPoints = 0;
    let runnerPoints = 0;
    let thirdPoints = 0;

    if (predictionReady && resultReady) {
      if (predicted[0]?.team && predicted[0].team === actual[0]?.team) {
        winnerPoints = GROUP_WINNER_POINTS;
        groupPoints += winnerPoints;
        groupWinnersCorrect += 1;
      }

      if (predicted[1]?.team && predicted[1].team === actual[1]?.team) {
        runnerPoints = GROUP_RUNNER_POINTS;
        groupPoints += runnerPoints;
        groupRunnersCorrect += 1;
      }

      if (predicted[2]?.team && predicted[2].team === actual[2]?.team) {
        thirdPoints = GROUP_THIRD_POINTS;
        groupPoints += thirdPoints;
        thirdsCorrect += 1;
      }
    }

    points += groupPoints;

    groupBreakdown[group] = {
      points: groupPoints,
      winnerPoints,
      runnerPoints,
      thirdPoints,
      predictionReady,
      resultReady,
      predictedFirst: predicted[0]?.team || null,
      actualFirst: actual[0]?.team || null,
      predictedSecond: predicted[1]?.team || null,
      actualSecond: actual[1]?.team || null,
      predictedThird: predicted[2]?.team || null,
      actualThird: actual[2]?.team || null
    };
  }

  return {
    points,
    groupWinnersCorrect,
    groupRunnersCorrect,
    thirdsCorrect,
    exactScores: tieBreakers.exactScores,
    correctOutcomes: tieBreakers.correctOutcomes,
    exactGoalDifferences: tieBreakers.exactGoalDifferences,
    completeResultGroups: countCompleteGroups(normalizedResults),
    completePredictionGroups: countCompleteGroups(normalizedPredictions),
    groupBreakdown,
    rules: {
      groupWinner: GROUP_WINNER_POINTS,
      groupRunner: GROUP_RUNNER_POINTS,
      groupThird: GROUP_THIRD_POINTS
    }
  };
}

function getQualifiedTeams(groupTables) {
  const thirds = [];

  for (const [group, rows] of Object.entries(groupTables || {})) {
    if (rows[2]) {
      thirds.push({
        ...rows[2],
        group
      });
    }
  }

  thirds.sort((a, b) =>
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.goalsAgainst - b.goalsAgainst ||
    a.team.localeCompare(b.team, 'es')
  );

  return {
    thirdQualifiedTeams: new Set(thirds.slice(0, 8).map((row) => row.team)),
    thirdQualifiedGroups: new Set(thirds.slice(0, 8).map((row) => row.group))
  };
}

module.exports = {
  parseJson,
  computePlayerScore,
  buildGroupTables,
  getQualifiedTeams,
  normalizeScoreMap,
  groupIsComplete
};
