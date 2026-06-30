const fixtureData = require('../data/fixtures.json');
const { knockoutFixtures } = require('./knockout');

const GROUP_WINNER_POINTS = 5;
const GROUP_RUNNER_POINTS = 3;
const GROUP_THIRD_POINTS = 1;
const MATCH_OUTCOME_POINTS = 2;
const EXACT_SCORE_POINTS = 1;
const KNOCKOUT_WINNER_POINTS = 5;
const KNOCKOUT_EXACT_POINTS = 2;

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;

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

    // Acertar el signo del partido (1, X o 2); el empate también cuenta.
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

function sameScore(a, b) {
  return (
    a && b &&
    Number(a.homeGoals) === Number(b.homeGoals) &&
    Number(a.awayGoals) === Number(b.awayGoals)
  );
}

// Devuelve 'home' o 'away' según quién avanza, o null si no hay suficiente dato.
// - Si homeGoals > awayGoals → 'home'; si awayGoals > homeGoals → 'away'.
// - En empate se usa el campo `advance` (penaltis).
function getAdvanceSide(entry) {
  if (!entry) return null;
  const h = Number(entry.homeGoals);
  const a = Number(entry.awayGoals);
  if (Number.isInteger(h) && Number.isInteger(a) && h >= 0 && a >= 0) {
    if (h > a) return 'home';
    if (a > h) return 'away';
  }
  if (entry.advance === 'home' || entry.advance === 'away') return entry.advance;
  return null;
}

// Construye el cuadro equipo a equipo a partir de knockoutData (equipos reales R32)
// y un mapa de resultados/predicciones (para propagar ganadores a rondas siguientes).
function buildTeamBracket(knockoutData, scores) {
  const bracket = {};
  for (const fixture of knockoutFixtures) {
    const id = fixture.id;
    let homeTeam = null;
    let awayTeam = null;

    if (fixture.home?.seed) {
      homeTeam = knockoutData?.bracketMatches?.[id]?.home?.team || null;
    } else if (fixture.home?.winnerOf) {
      homeTeam = bracket[fixture.home.winnerOf]?.winnerTeam || null;
    } else if (fixture.home?.loserOf) {
      homeTeam = bracket[fixture.home.loserOf]?.loserTeam || null;
    }

    if (fixture.away?.seed) {
      awayTeam = knockoutData?.bracketMatches?.[id]?.away?.team || null;
    } else if (fixture.away?.winnerOf) {
      awayTeam = bracket[fixture.away.winnerOf]?.winnerTeam || null;
    } else if (fixture.away?.loserOf) {
      awayTeam = bracket[fixture.away.loserOf]?.loserTeam || null;
    }

    let winnerTeam = null;
    let loserTeam = null;
    const entry = (scores || {})[id];
    if (entry && homeTeam && awayTeam) {
      const advanceSide = getAdvanceSide(entry);
      if (advanceSide === 'home') { winnerTeam = homeTeam; loserTeam = awayTeam; }
      else if (advanceSide === 'away') { winnerTeam = awayTeam; loserTeam = homeTeam; }
    }

    bracket[id] = { homeTeam, awayTeam, winnerTeam, loserTeam };
  }
  return bracket;
}

// Puntúa la eliminatoria por cruce:
//   5 pts si el jugador acertó qué lado (local/visitante) pasa el cruce
//   Y los equipos del cruce coinciden con los que el jugador predijo.
//   +2 pts extra si además el marcador antes de penaltis coincide exactamente.
function computeKnockoutScore(knockoutPred, knockoutResults, knockoutData) {
  let knockoutPoints = 0;
  let knockoutWinnersCorrect = 0;
  let knockoutExactCorrect = 0;
  let roundOf32Points = 0;
  let roundOf16Points = 0;
  let quarterPoints = 0;
  let semiPoints = 0;
  let thirdPlacePoints = 0;
  let finalPoints = 0;
  const knockoutBreakdown = {};

  const realBracket = buildTeamBracket(knockoutData, knockoutResults);
  const predBracket = buildTeamBracket(knockoutData, knockoutPred);

  for (const fixture of knockoutFixtures) {
    const id = fixture.id;
    const realEntry = (knockoutResults || {})[id];
    const predEntry = (knockoutPred || {})[id];

    const realSide = getAdvanceSide(realEntry);
    const predSide = getAdvanceSide(predEntry);

    // Los equipos del cruce real deben coincidir con los que el jugador predijo
    const rt = realBracket[id];
    const pt = predBracket[id];
    const teamsMatch = Boolean(
      rt?.homeTeam && rt?.awayTeam &&
      pt?.homeTeam && pt?.awayTeam &&
      rt.homeTeam === pt.homeTeam &&
      rt.awayTeam === pt.awayTeam
    );

    let winnerPoints = 0;
    let exactPoints = 0;
    const winnerCorrect = Boolean(teamsMatch && realSide && predSide && realSide === predSide);

    if (winnerCorrect) {
      winnerPoints = KNOCKOUT_WINNER_POINTS;
      knockoutWinnersCorrect += 1;

      if (sameScore(predEntry, realEntry)) {
        exactPoints = KNOCKOUT_EXACT_POINTS;
        knockoutExactCorrect += 1;
      }
    }

    const matchPoints = winnerPoints + exactPoints;
    knockoutPoints += matchPoints;
    if (fixture.round === 'roundOf32') roundOf32Points += matchPoints;
    if (fixture.round === 'roundOf16') roundOf16Points += matchPoints;
    if (fixture.round === 'quarter') quarterPoints += matchPoints;
    if (fixture.round === 'semi') semiPoints += matchPoints;
    if (fixture.round === 'third') thirdPlacePoints += matchPoints;
    if (fixture.round === 'final') finalPoints += matchPoints;

    knockoutBreakdown[id] = {
      round: fixture.round,
      points: matchPoints,
      winnerCorrect,
      exactCorrect: exactPoints > 0,
      predictedSide: predSide || null,
      actualSide: realSide || null
    };
  }

  return { knockoutPoints, knockoutWinnersCorrect, knockoutExactCorrect, knockoutBreakdown, roundOf32Points, roundOf16Points, quarterPoints, semiPoints, thirdPlacePoints, finalPoints };
}

function computePlayerScore(predictions, results, knockoutPredictions, knockoutResults, knockoutData) {
  const normalizedPredictions = normalizeScoreMap(predictions);
  const normalizedResults = normalizeScoreMap(results);

  const predictedTables = buildGroupTables(normalizedPredictions);
  const actualTables = buildGroupTables(normalizedResults);
  const tieBreakers = computeTieBreakers(normalizedPredictions, normalizedResults);

  const knockout = computeKnockoutScore(knockoutPredictions, knockoutResults, knockoutData);

  let groupPositionPoints = 0;
  let matchOutcomePoints = tieBreakers.correctOutcomes * MATCH_OUTCOME_POINTS;
  let exactScorePoints = tieBreakers.exactScores * EXACT_SCORE_POINTS;
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

    groupPositionPoints += groupPoints;

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

  const points =
    groupPositionPoints + matchOutcomePoints + exactScorePoints + knockout.knockoutPoints;

  return {
    points,
    groupPositionPoints,
    matchOutcomePoints,
    exactScorePoints,
    knockoutPoints: knockout.knockoutPoints,
    knockoutWinnersCorrect: knockout.knockoutWinnersCorrect,
    knockoutExactCorrect: knockout.knockoutExactCorrect,
    roundOf32Points: knockout.roundOf32Points,
    roundOf16Points: knockout.roundOf16Points,
    quarterPoints: knockout.quarterPoints,
    semiPoints: knockout.semiPoints,
    thirdPlacePoints: knockout.thirdPlacePoints,
    finalPoints: knockout.finalPoints,
    groupWinnersCorrect,
    groupRunnersCorrect,
    thirdsCorrect,
    exactScores: tieBreakers.exactScores,
    correctOutcomes: tieBreakers.correctOutcomes,
    exactGoalDifferences: tieBreakers.exactGoalDifferences,
    completeResultGroups: countCompleteGroups(normalizedResults),
    completePredictionGroups: countCompleteGroups(normalizedPredictions),
    groupBreakdown,
    knockoutBreakdown: knockout.knockoutBreakdown,
    rules: {
      groupWinner: GROUP_WINNER_POINTS,
      groupRunner: GROUP_RUNNER_POINTS,
      groupThird: GROUP_THIRD_POINTS,
      matchOutcome: MATCH_OUTCOME_POINTS,
      exactScore: EXACT_SCORE_POINTS,
      knockoutWinner: KNOCKOUT_WINNER_POINTS,
      knockoutExactBonus: KNOCKOUT_EXACT_POINTS
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
  computeKnockoutScore,
  buildGroupTables,
  getQualifiedTeams,
  normalizeScoreMap,
  groupIsComplete
};
