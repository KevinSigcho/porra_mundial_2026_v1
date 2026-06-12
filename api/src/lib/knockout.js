const fixtureData = require('../data/fixtures.json');

const knockoutFixtures = fixtureData.knockout || [];
const knockoutById = new Map(knockoutFixtures.map((fixture) => [fixture.id, fixture]));

// Mejores 8 terceros que clasifican, mismo criterio que la fase de grupos.
function rankThirds(thirds) {
  return [...thirds].sort((a, b) =>
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.goalsAgainst - b.goalsAgainst ||
    a.team.localeCompare(b.team, 'es')
  );
}

// A partir de las tablas de grupo ya ordenadas, mapea cada seed (1A, 2B, 3ABCDF...) a un equipo.
function buildSeedResolver(groupTables) {
  const bySeed = {};
  const thirds = [];

  for (const [group, rows] of Object.entries(groupTables || {})) {
    if (rows[0]) bySeed[`1${group}`] = rows[0].team;
    if (rows[1]) bySeed[`2${group}`] = rows[1].team;
    if (rows[2]) thirds.push({ ...rows[2], group });
  }

  const qualifiedThirds = rankThirds(thirds).slice(0, 8);
  const thirdByGroup = {};
  for (const third of qualifiedThirds) {
    thirdByGroup[third.group] = third.team;
  }

  return function resolveSeed(seed) {
    if (bySeed[seed]) return bySeed[seed];

    if (typeof seed === 'string' && seed.startsWith('3')) {
      const groups = seed.slice(1).split('');
      const match = groups.map((group) => thirdByGroup[group]).find(Boolean);
      return match || null;
    }

    return null;
  };
}

function hasScore(entry) {
  return (
    entry &&
    Number.isInteger(Number(entry.homeGoals)) &&
    Number.isInteger(Number(entry.awayGoals))
  );
}

// Resuelve el cuadro completo: participantes y quién pasa en cada cruce.
// `knockoutMap` = { matchId: { homeGoals, awayGoals, advance? } }
// `groupTables` = tablas de grupo ya ordenadas (de buildGroupTables).
// Devuelve { [matchId]: { homeTeam, awayTeam, advancerTeam, loserTeam } } (null si no se puede determinar).
function resolveBracket(knockoutMap, groupTables) {
  const resolveSeed = buildSeedResolver(groupTables);
  const memo = new Map();
  const scores = knockoutMap || {};

  function resolveSide(source) {
    if (!source) return { team: null, advancer: null };

    if (source.seed) {
      return { team: resolveSeed(source.seed), advancer: null };
    }
    if (source.winnerOf) {
      const prev = resolveMatch(source.winnerOf);
      return { team: prev.advancerTeam, advancer: prev };
    }
    if (source.loserOf) {
      const prev = resolveMatch(source.loserOf);
      return { team: prev.loserTeam, advancer: prev };
    }
    return { team: null, advancer: null };
  }

  function resolveMatch(matchId) {
    if (memo.has(matchId)) return memo.get(matchId);

    // Pre-set para cortar recursión accidental (el cuadro es un DAG, no debería pasar).
    const pending = { homeTeam: null, awayTeam: null, advancerTeam: null, loserTeam: null };
    memo.set(matchId, pending);

    const fixture = knockoutById.get(matchId);
    if (!fixture) return pending;

    const homeTeam = resolveSide(fixture.home).team;
    const awayTeam = resolveSide(fixture.away).team;

    let advancerTeam = null;
    let loserTeam = null;

    const entry = scores[matchId];
    if (hasScore(entry)) {
      const homeGoals = Number(entry.homeGoals);
      const awayGoals = Number(entry.awayGoals);

      let advanceSide = null;
      if (homeGoals > awayGoals) advanceSide = 'home';
      else if (homeGoals < awayGoals) advanceSide = 'away';
      else if (entry.advance === 'home' || entry.advance === 'away') advanceSide = entry.advance;

      if (advanceSide === 'home') {
        advancerTeam = homeTeam;
        loserTeam = awayTeam;
      } else if (advanceSide === 'away') {
        advancerTeam = awayTeam;
        loserTeam = homeTeam;
      }
    }

    const resolved = { homeTeam, awayTeam, advancerTeam, loserTeam };
    memo.set(matchId, resolved);
    return resolved;
  }

  const bracket = {};
  for (const fixture of knockoutFixtures) {
    bracket[fixture.id] = resolveMatch(fixture.id);
  }
  return bracket;
}

module.exports = { resolveBracket, knockoutFixtures };
