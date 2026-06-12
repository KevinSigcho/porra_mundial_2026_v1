// Resolutor del cuadro de eliminatoria en cliente. Misma lógica que api/src/lib/knockout.js.
// Trabaja con las tablas de grupo ya ordenadas (de buildGroupTables) y el mapa de predicciones/resultados.

export const ROUND_LABELS = {
  roundOf32: 'Dieciseisavos',
  roundOf16: 'Octavos',
  quarter: 'Cuartos',
  semi: 'Semifinales',
  third: 'Tercer puesto',
  final: 'Final'
};

export const ROUND_ORDER = ['roundOf32', 'roundOf16', 'quarter', 'semi', 'third', 'final'];

function rankThirds(thirds) {
  return [...thirds].sort((a, b) =>
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.goalsAgainst - b.goalsAgainst ||
    a.team.localeCompare(b.team, 'es')
  );
}

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
      return groups.map((group) => thirdByGroup[group]).find(Boolean) || null;
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

export function resolveBracket(knockoutFixtures, knockoutMap, groupTables) {
  const resolveSeed = buildSeedResolver(groupTables);
  const byId = new Map((knockoutFixtures || []).map((f) => [f.id, f]));
  const memo = new Map();
  const scores = knockoutMap || {};

  function resolveSide(source) {
    if (!source) return null;
    if (source.seed) return resolveSeed(source.seed);
    if (source.winnerOf) return resolveMatch(source.winnerOf).advancerTeam;
    if (source.loserOf) return resolveMatch(source.loserOf).loserTeam;
    return null;
  }

  function resolveMatch(matchId) {
    if (memo.has(matchId)) return memo.get(matchId);
    const pending = { homeTeam: null, awayTeam: null, advancerTeam: null, loserTeam: null };
    memo.set(matchId, pending);

    const fixture = byId.get(matchId);
    if (!fixture) return pending;

    const homeTeam = resolveSide(fixture.home);
    const awayTeam = resolveSide(fixture.away);

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
  for (const fixture of knockoutFixtures || []) {
    bracket[fixture.id] = resolveMatch(fixture.id);
  }
  return bracket;
}
