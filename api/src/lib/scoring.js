const fixtureData = require('../data/fixtures.json');

const GROUP_WINNER_POINTS = 5;
const GROUP_RUNNER_POINTS = 3;
const GROUP_THIRD_QUALIFIED_POINTS = 1;

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function isCompleteScore(score) {
  if (!score) return false;
  const homeGoals = Number(score.homeGoals);
  const awayGoals = Number(score.awayGoals);
  return Number.isInteger(homeGoals) && Number.isInteger(awayGoals) && homeGoals >= 0 && awayGoals >= 0;
}

function outcome(score) {
  if (score.homeGoals > score.awayGoals) return 'H';
  if (score.homeGoals < score.awayGoals) return 'A';
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
    const score = scoreMap?.[fixture.id];
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
      a.team.localeCompare(b.team, 'es')
    );
  }

  return tables;
}

function getQualifiedTeams(groupTables) {
  const thirds = [];

  for (const [group, rows] of Object.entries(groupTables || {})) {
    if (rows[2]) {
      thirds.push({ ...rows[2], group });
    }
  }

  thirds.sort((a, b) =>
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.team.localeCompare(b.team, 'es')
  );

  return {
    thirdQualifiedTeams: new Set(thirds.slice(0, 8).map((row) => row.team)),
    thirdQualifiedGroups: new Set(thirds.slice(0, 8).map((row) => row.group))
  };
}

function groupIsComplete(scoreMap, group) {
  const groupFixtures = fixtureData.fixtures.filter((fixture) => fixture.group === group);
  return groupFixtures.every((fixture) => isCompleteScore(scoreMap?.[fixture.id]));
}

function computeTieBreakers(predictions, results) {
  let exactScores = 0;
  let correctOutcomes = 0;
  let exactGoalDifferences = 0;

  for (const fixture of fixtureData.fixtures || []) {
    const prediction = predictions?.[fixture.id];
    const result = results?.[fixture.id];
    if (!isCompleteScore(prediction) || !isCompleteScore(result)) continue;

    if (prediction.homeGoals === result.homeGoals && prediction.awayGoals === result.awayGoals) {
      exactScores += 1;
    }

    if (outcome(prediction) === outcome(result)) {
      correctOutcomes += 1;
    }

    if ((prediction.homeGoals - prediction.awayGoals) === (result.homeGoals - result.awayGoals)) {
      exactGoalDifferences += 1;
    }
  }

  return { exactScores, correctOutcomes, exactGoalDifferences };
}

function computePlayerScore(predictions, results) {
  const predictedTables = buildGroupTables(predictions);
  const actualTables = buildGroupTables(results);
  const actualQualified = getQualifiedTeams(actualTables);
  const tieBreakers = computeTieBreakers(predictions, results);

  let points = 0;
  let groupWinnersCorrect = 0;
  let groupRunnersCorrect = 0;
  let thirdsCorrect = 0;
  const groupBreakdown = {};

  for (const group of Object.keys(fixtureData.groups || {})) {
    const predictionReady = groupIsComplete(predictions, group);
    const resultReady = groupIsComplete(results, group);
    const predicted = predictedTables[group] || [];
    const actual = actualTables[group] || [];
    let groupPoints = 0;

    if (predictionReady && resultReady) {
      if (predicted[0]?.team && predicted[0].team === actual[0]?.team) {
        points += GROUP_WINNER_POINTS;
        groupPoints += GROUP_WINNER_POINTS;
        groupWinnersCorrect += 1;
      }

      if (predicted[1]?.team && predicted[1].team === actual[1]?.team) {
        points += GROUP_RUNNER_POINTS;
        groupPoints += GROUP_RUNNER_POINTS;
        groupRunnersCorrect += 1;
      }

      const actualThird = actual[2]?.team;
      const actualThirdQualified = actualThird && actualQualified.thirdQualifiedTeams.has(actualThird);
      if (actualThirdQualified && predicted[2]?.team === actualThird) {
        points += GROUP_THIRD_QUALIFIED_POINTS;
        groupPoints += GROUP_THIRD_QUALIFIED_POINTS;
        thirdsCorrect += 1;
      }
    }

    groupBreakdown[group] = {
      points: groupPoints,
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
    groupBreakdown,
    rules: {
      groupWinner: GROUP_WINNER_POINTS,
      groupRunner: GROUP_RUNNER_POINTS,
      groupThirdQualified: GROUP_THIRD_QUALIFIED_POINTS
    }
  };
}

module.exports = {
  parseJson,
  computePlayerScore,
  buildGroupTables,
  getQualifiedTeams
};
