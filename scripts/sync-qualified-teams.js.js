const APP_URL = process.env.PORRA_APP_URL;
const ADMIN_CODE = process.env.PORRA_ADMIN_CODE;
const DRY_RUN = String(process.env.DRY_RUN || 'false').toLowerCase() === 'true';

function required(value, name) {
  if (!value) throw new Error(`Falta la variable ${name}.`);
  return value;
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(`Error ${response.status} en ${url}: ${text}`);
  }

  return data;
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

function buildGroupTables(fixtures, groups, results) {
  const tables = {};

  for (const [group, teams] of Object.entries(groups || {})) {
    tables[group] = teams.map(emptyStanding);
  }

  const byTeam = {};

  for (const [group, rows] of Object.entries(tables)) {
    byTeam[group] = Object.fromEntries(rows.map((row) => [row.team, row]));
  }

  for (const fixture of fixtures || []) {
    const score = results?.[fixture.id];
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

function groupFixtures(fixtures, group) {
  return fixtures.filter((fixture) => fixture.group === group);
}

function groupIsComplete(fixtures, results, group) {
  const matches = groupFixtures(fixtures, group);
  if (!matches.length) return false;

  return matches.every((fixture) => isCompleteScore(results?.[fixture.id]));
}

function remainingMatchesForTeam(fixtures, results, group, team) {
  return groupFixtures(fixtures, group).filter((fixture) => {
    if (isCompleteScore(results?.[fixture.id])) return false;
    return fixture.home === team || fixture.away === team;
  }).length;
}

function maxPossiblePoints(row, fixtures, results, group) {
  return row.points + remainingMatchesForTeam(fixtures, results, group, row.team) * 3;
}

function markGroupRows(fixtures, results, group, rows, complete) {
  if (complete) {
    return rows.map((row, index) => {
      const position = index + 1;

      return {
        ...row,
        group,
        position,
        seed: position <= 3 ? `${position}${group}` : null,
        status: position <= 3 ? 'confirmed' : 'eliminated',
        qualificationStatus:
          position <= 2 ? 'qualified' :
          position === 3 ? 'third-ranking' :
          'eliminated',
        slotStatus:
          position <= 2 ? 'confirmed' :
          position === 3 ? 'pending-third-ranking' :
          'eliminated'
      };
    });
  }

  return rows.map((row, index) => {
    const others = rows.filter((other) => other.team !== row.team);

    const teamsThatCanReachOrPass = others.filter(
      (other) => maxPossiblePoints(other, fixtures, results, group) >= row.points
    ).length;

    const guaranteedTopTwo = teamsThatCanReachOrPass <= 1;
    const guaranteedFirst = others.every(
      (other) => maxPossiblePoints(other, fixtures, results, group) < row.points
    );

    if (guaranteedFirst) {
      return {
        ...row,
        group,
        position: 1,
        seed: `1${group}`,
        status: 'confirmed',
        qualificationStatus: 'qualified',
        slotStatus: 'confirmed'
      };
    }

    if (guaranteedTopTwo) {
      return {
        ...row,
        group,
        position: index + 1,
        seed: null,
        status: 'qualified-pending-position',
        qualificationStatus: 'qualified',
        slotStatus: 'pending-position'
      };
    }

    return {
      ...row,
      group,
      position: index + 1,
      seed: null,
      status: 'pending',
      qualificationStatus: 'pending',
      slotStatus: 'pending'
    };
  });
}

function rankThirds(markedGroups) {
  const thirds = [];

  for (const [group, groupData] of Object.entries(markedGroups)) {
    const third = groupData.rows[2];

    if (third) {
      thirds.push({
        ...third,
        group,
        seed: `3${group}`,
        position: 3
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
    qualifiedThirds: thirds.slice(0, 8),
    eliminatedThirds: thirds.slice(8),
    allThirds: thirds
  };
}

function buildSeedMap(markedGroups, qualifiedThirds) {
  const bySeed = {};

  for (const [group, groupData] of Object.entries(markedGroups)) {
    for (const row of groupData.rows) {
      if (!row.seed) continue;
      if (row.status !== 'confirmed') continue;

      bySeed[row.seed] = {
        team: row.team,
        group,
        seed: row.seed,
        position: row.position,
        status: row.status,
        qualificationStatus: row.qualificationStatus,
        slotStatus: row.slotStatus
      };
    }
  }

  for (const row of qualifiedThirds) {
    bySeed[`3${row.group}`] = {
      team: row.team,
      group: row.group,
      seed: `3${row.group}`,
      position: 3,
      status: 'qualified-pending-slot',
      qualificationStatus: 'qualified',
      slotStatus: 'pending-opponent'
    };
  }

  return bySeed;
}

function resolveSlot(seed, bySeed, qualifiedThirdGroups) {
  if (bySeed[seed]) {
    return {
      seed,
      team: bySeed[seed].team,
      group: bySeed[seed].group,
      status: bySeed[seed].slotStatus || 'confirmed'
    };
  }

  if (String(seed || '').startsWith('3')) {
    const allowedGroups = seed.slice(1).split('');
    const matchingGroups = allowedGroups.filter((group) => qualifiedThirdGroups.has(group));

    if (matchingGroups.length === 1) {
      const resolvedSeed = `3${matchingGroups[0]}`;
      const resolved = bySeed[resolvedSeed];

      if (resolved) {
        return {
          seed,
          resolvedSeed,
          team: resolved.team,
          group: resolved.group,
          status: 'qualified-pending-slot'
        };
      }
    }

    return {
      seed,
      team: null,
      status: 'pending',
      candidates: allowedGroups.map((group) => `3${group}`)
    };
  }

  return {
    seed,
    team: null,
    status: 'pending'
  };
}

function sourceSeed(source) {
  return source?.seed || null;
}

function buildBracketMatches(knockoutFixtures, bySeed, qualifiedThirds) {
  const qualifiedThirdGroups = new Set(qualifiedThirds.map((row) => row.group));
  const matches = {};

  for (const fixture of knockoutFixtures || []) {
    if (fixture.round !== 'roundOf32') continue;

    const homeSeed = sourceSeed(fixture.home);
    const awaySeed = sourceSeed(fixture.away);

    matches[fixture.id] = {
      id: fixture.id,
      matchNo: fixture.matchNo,
      round: fixture.round,
      date: fixture.date,
      time: fixture.time,
      side: fixture.side,
      home: resolveSlot(homeSeed, bySeed, qualifiedThirdGroups),
      away: resolveSlot(awaySeed, bySeed, qualifiedThirdGroups)
    };
  }

  return matches;
}

async function saveKnockoutData(knockoutData) {
  return getJson(`${APP_URL}/api/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-code': ADMIN_CODE
    },
    body: JSON.stringify({
      action: 'saveKnockoutData',
      knockoutData
    })
  });
}

async function main() {
  required(APP_URL, 'PORRA_APP_URL');
  required(ADMIN_CODE, 'PORRA_ADMIN_CODE');

  console.log(`Sincronizando clasificados reales. DRY_RUN=${DRY_RUN}`);

  const fixtureData = await getJson(`${APP_URL}/fixtures.json`);
  const resultData = await getJson(`${APP_URL}/api/results`);

  const fixtures = fixtureData.fixtures || [];
  const knockoutFixtures = fixtureData.knockout || [];
  const groups = fixtureData.groups || {};
  const results = resultData.results || {};

  const tables = buildGroupTables(fixtures, groups, results);
  const markedGroups = {};

  for (const [group, rows] of Object.entries(tables)) {
    const complete = groupIsComplete(fixtures, results, group);

    markedGroups[group] = {
      group,
      complete,
      rows: markGroupRows(fixtures, results, group, rows, complete)
    };
  }

  const thirdData = rankThirds(markedGroups);
  const bySeed = buildSeedMap(markedGroups, thirdData.qualifiedThirds);
  const bracketMatches = buildBracketMatches(knockoutFixtures, bySeed, thirdData.qualifiedThirds);

  const knockoutData = {
    updatedAt: new Date().toISOString(),
    source: 'sync-qualified-teams',
    groups: markedGroups,
    bySeed,
    qualifiedTeams: Object.values(bySeed).sort((a, b) =>
      String(a.seed).localeCompare(String(b.seed), 'es')
    ),
    thirdRanking: thirdData,
    bracketMatches
  };

  console.log(`Grupos calculados: ${Object.keys(markedGroups).length}`);
  console.log(`Seeds confirmados/provisionales: ${Object.keys(bySeed).length}`);
  console.log(`Cruces de dieciseisavos calculados: ${Object.keys(bracketMatches).length}`);

  if (DRY_RUN) {
    console.log('DRY_RUN activo. No se guarda knockoutData.');
    console.log(JSON.stringify(knockoutData, null, 2));
    return;
  }

  const saved = await saveKnockoutData(knockoutData);

  console.log('knockoutData guardado correctamente.');
  console.log(saved);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});