import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from './api.js';
import { resolveBracket, ROUND_LABELS, ROUND_ORDER } from './lib/knockout.js';

const STORAGE_TOKEN = 'porra2026.token';
const STORAGE_PLAYER = 'porra2026.player';
const STORAGE_ADMIN = 'porra2026.adminCode';

const AVATAR_PRESETS = [
  { id: 'football-1', label: 'Balón clásico', emoji: '⚽', theme: 'green' },
  { id: 'football-2', label: 'Bota dorada', emoji: '👟', theme: 'gold' },
  { id: 'football-3', label: 'Copa', emoji: '🏆', theme: 'gold' },
  { id: 'football-4', label: 'Portero', emoji: '🧤', theme: 'blue' },
  { id: 'shiba-1', label: 'Shiba feliz', emoji: '🐕', theme: 'orange' },
  { id: 'shiba-2', label: 'Shiba pro', emoji: '🦊', theme: 'orange' },
  { id: 'hero-1', label: 'Superhéroe', emoji: '🦸', theme: 'red' },
  { id: 'hero-2', label: 'Rayo', emoji: '⚡', theme: 'purple' },
  { id: 'hero-3', label: 'Escudo', emoji: '🛡️', theme: 'blue' },
  { id: 'space-1', label: 'Galaxia', emoji: '🚀', theme: 'purple' },
  { id: 'gaming-1', label: 'Gamer', emoji: '🎮', theme: 'cyan' },
  { id: 'fire-1', label: 'Fuego', emoji: '🔥', theme: 'red' },
  { id: 'crown-1', label: 'Rey de la porra', emoji: '👑', theme: 'gold' },
  { id: 'ninja-1', label: 'Ninja', emoji: '🥷', theme: 'dark' },
  { id: 'robot-1', label: 'Robot', emoji: '🤖', theme: 'cyan' }
];

function getAvatarPreset(id) {
  return AVATAR_PRESETS.find((avatar) => avatar.id === id) || AVATAR_PRESETS[0];
}

function PlayerAvatar({ player, size = 'md', rank = null }) {
  const avatarUrl = player?.avatarUrl || player?.profileImage || '';
  const preset = getAvatarPreset(player?.avatarId || player?.avatarPreset || 'football-1');

  return (
    <span className={`playerAvatar playerAvatar-${size} avatarTheme-${preset.theme}`} aria-hidden="true">
      {avatarUrl ? <img src={avatarUrl} alt="" loading="lazy" /> : <span>{preset.emoji}</span>}
      {rank && <span className="avatarRankBadge">{rank}</span>}
    </span>
  );
}



const GROUP_SCORING_SUMMARY = 'Fase de grupos: 5/3/1 pts por acertar el 1º, 2º y 3º de grupo. Por partido: 2 pts por el resultado (1, X o 2) y 1 pt extra por el marcador exacto (3 pts en total).';

const KNOCKOUT_AVAILABLE_DATE = '27 de junio de 2026';
const KNOCKOUT_START_DATE = '28 de junio de 2026';

const RULE_SECTIONS = [
  {
    title: 'Fase de grupos',
    items: [
      "5 puntos si aciertas el equipo que queda 1º de cada grupo.",
      "3 puntos si aciertas el equipo que queda 2º de cada grupo.",
      "1 punto si aciertas el equipo que queda 3º de cada grupo.",
      "2 puntos por cada partido en el que aciertes el resultado (1, X o 2); el empate también cuenta.",
      "1 punto extra si además aciertas el marcador exacto del partido (3 pts en total).",
    ],
  },
  {
    title: 'Fase de eliminatorias',
    items: [
      "Cuando termine la fase de grupos se abre el cuadro y rellenas toda la eliminatoria de una vez; tus ganadores avanzan solos a la ronda siguiente.",
      "5 puntos por acertar el equipo que pasa cada cruce, incluyendo prórroga o penaltis.",
      "2 puntos extra si aciertas el marcador exacto del partido antes de la tanda de penaltis.",
      "No hay empates: si tu marcador acaba en empate, eliges qué equipo pasa en penaltis.",
    ]
  },
  {
    title: 'Desempates de la porra',
    items: [
      "1º: más puntos totales.",
      "2º: más partidos con marcador exacto acertado.",
      "3º: más partidos con diferencia de goles exacta acertada.",
    ],
  },
 
];

const OFFICIAL_KNOCKOUT_BRACKET = {
  left: [
    {
      title: 'Dieciseisavos',
      matches: [
        { id: 'M74', date: '29/06/2026', time: '22:30', label: '1º Grupo E', other: '3º A/B/C/D/F' },
        { id: 'M77', date: '30/06/2026', time: '23:00', label: '1º Grupo I', other: '3º C/D/F/G/H' },
        { id: 'M73', date: '28/06/2026', time: '21:00', label: '2º Grupo A', other: '2º Grupo B' },
        { id: 'M75', date: '30/06/2026', time: '03:00', label: '1º Grupo F', other: '2º Grupo C' },
        { id: 'M83', date: '03/07/2026', time: '01:00', label: '2º Grupo K', other: '2º Grupo L' },
        { id: 'M84', date: '02/07/2026', time: '21:00', label: '1º Grupo H', other: '2º Grupo J' },
        { id: 'M81', date: '02/07/2026', time: '02:00', label: '1º Grupo D', other: '3º B/E/F/I/J' },
        { id: 'M82', date: '01/07/2026', time: '22:00', label: '1º Grupo G', other: '3º A/E/H/I/J' }
      ]
    },
    {
      title: 'Octavos',
      matches: [
        { id: 'M89', date: '04/07/2026', time: '23:00', label: 'Ganador M74', other: 'Ganador M77' },
        { id: 'M90', date: '04/07/2026', time: '19:00', label: 'Ganador M73', other: 'Ganador M75' },
        { id: 'M93', date: '06/07/2026', time: '21:00', label: 'Ganador M83', other: 'Ganador M84' },
        { id: 'M94', date: '07/07/2026', time: '02:00', label: 'Ganador M81', other: 'Ganador M82' }
      ]
    },
    {
      title: 'Cuartos',
      matches: [
        { id: 'M97', date: '09/07/2026', time: '22:00', label: 'Ganador M89', other: 'Ganador M90' },
        { id: 'M98', date: '10/07/2026', time: '21:00', label: 'Ganador M93', other: 'Ganador M94' }
      ]
    },
    {
      title: 'Semis',
      matches: [
        { id: 'M101', date: '14/07/2026', time: '21:00', label: 'Ganador M97', other: 'Ganador M98' }
      ]
    }
  ],
  right: [
    {
      title: 'Semis',
      matches: [
        { id: 'M102', date: '15/07/2026', time: '21:00', label: 'Ganador M99', other: 'Ganador M100' }
      ]
    },
    {
      title: 'Cuartos',
      matches: [
        { id: 'M99', date: '11/07/2026', time: '23:00', label: 'Ganador M91', other: 'Ganador M92' },
        { id: 'M100', date: '12/07/2026', time: '03:00', label: 'Ganador M95', other: 'Ganador M96' }
      ]
    },
    {
      title: 'Octavos',
      matches: [
        { id: 'M91', date: '05/07/2026', time: '22:00', label: 'Ganador M76', other: 'Ganador M78' },
        { id: 'M92', date: '06/07/2026', time: '02:00', label: 'Ganador M79', other: 'Ganador M80' },
        { id: 'M95', date: '07/07/2026', time: '18:00', label: 'Ganador M86', other: 'Ganador M88' },
        { id: 'M96', date: '07/07/2026', time: '22:00', label: 'Ganador M85', other: 'Ganador M87' }
      ]
    },
    {
      title: 'Dieciseisavos',
      matches: [
        { id: 'M76', date: '29/06/2026', time: '19:00', label: '1º Grupo C', other: '2º Grupo F' },
        { id: 'M78', date: '30/06/2026', time: '19:00', label: '2º Grupo E', other: '2º Grupo I' },
        { id: 'M79', date: '01/07/2026', time: '03:00', label: '1º Grupo A', other: '3º C/E/F/H/I' },
        { id: 'M80', date: '01/07/2026', time: '18:00', label: '1º Grupo L', other: '3º E/H/J/K' },
        { id: 'M86', date: '04/07/2026', time: '00:00', label: '1º Grupo J', other: '2º Grupo H' },
        { id: 'M88', date: '03/07/2026', time: '20:00', label: '2º Grupo D', other: '2º Grupo G' },
        { id: 'M85', date: '03/07/2026', time: '05:00', label: '1º Grupo B', other: '3º E/F/G/I/J' },
        { id: 'M87', date: '04/07/2026', time: '03:30', label: '1º Grupo K', other: '3º D/E/I/J/L' }
      ]
    }
  ],
  final: { id: 'M104', date: '19/07/2026', time: '21:00', label: 'Ganador M101', other: 'Ganador M102' },
  thirdPlace: { id: 'M103', date: '18/07/2026', time: '23:00', label: 'Perdedor M101', other: 'Perdedor M102' }
};

const TEAM_FLAG_CODES = {
  'México': 'mx',
  'Corea del Sur': 'kr',
  'Chequia': 'cz',
  'Sudáfrica': 'za',
  'Canadá': 'ca',
  'Bosnia y Herzegovina': 'ba',
  'Qatar': 'qa',
  'Suiza': 'ch',
  'Brasil': 'br',
  'Marruecos': 'ma',
  'Haití': 'ht',
  'Escocia': 'gb-sct',
  'Estados Unidos': 'us',
  'Turquía': 'tr',
  'Australia': 'au',
  'Paraguay': 'py',
  'Alemania': 'de',
  'Ecuador': 'ec',
  'Costa de Marfil': 'ci',
  'Curazao': 'cw',
  'Países Bajos': 'nl',
  'Japón': 'jp',
  'Suecia': 'se',
  'Túnez': 'tn',
  'Bélgica': 'be',
  'Egipto': 'eg',
  'Irán': 'ir',
  'Nueva Zelanda': 'nz',
  'España': 'es',
  'Cabo Verde': 'cv',
  'Arabia Saudí': 'sa',
  'Uruguay': 'uy',
  'Francia': 'fr',
  'Senegal': 'sn',
  'Irak': 'iq',
  'Noruega': 'no',
  'Argentina': 'ar',
  'Argelia': 'dz',
  'Austria': 'at',
  'Jordania': 'jo',
  'Portugal': 'pt',
  'RD Congo': 'cd',
  'Uzbekistán': 'uz',
  'Colombia': 'co',
  'Inglaterra': 'gb-eng',
  'Croacia': 'hr',
  'Ghana': 'gh',
  'Panamá': 'pa'
};

function flagSrc(team) {
  const code = TEAM_FLAG_CODES[team];
  return code ? `https://flagcdn.com/${code}.svg` : '';
}

function TeamFlag({ team }) {
  const src = flagSrc(team);
  if (!src) {
    return <span className="flagFallback" aria-hidden="true">🏳️</span>;
  }

  return (
    <img
      className="flagImg"
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
    />
  );
}


function formatDate(date) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatFixtureDateSpain(fixture) {
  if (fixture?.kickoffDateSpain) {
    return formatDate(fixture.kickoffDateSpain);
  }

  if (fixture?.kickoffAtSpain) {
    return new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid',
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    }).format(new Date(fixture.kickoffAtSpain));
  }

  return formatDate(fixture.date);
}

function formatDateTimeSpain(value) {
  if (!value) return 'pendiente';

  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function kickoffSpainLabel(fixture) {
  if (fixture?.kickoffTimeSpain) {
    return `${fixture.kickoffTimeSpain} h España`;
  }

  if (fixture?.kickoffAtSpain) {
    return `${new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(fixture.kickoffAtSpain))} h España`;
  }

  return 'Hora pendiente';
}

function readStoredPlayer() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PLAYER) || 'null');
  } catch (_) {
    return null;
  }
}

function scoreValue(value) {
  if (value === '' || value === null || value === undefined) return '';
  return String(value);
}

function normalizeForSave(scores) {
  const out = {};
  for (const [matchId, score] of Object.entries(scores || {})) {
    if (score?.homeGoals === '' || score?.awayGoals === '') continue;
    const homeGoals = Number(score?.homeGoals);
    const awayGoals = Number(score?.awayGoals);
    if (Number.isInteger(homeGoals) && Number.isInteger(awayGoals) && homeGoals >= 0 && awayGoals >= 0) {
      out[matchId] = { homeGoals, awayGoals };
    }
  }
  return out;
}

function isCompleteScore(score) {
  if (!score) return false;
  const homeGoals = Number(score.homeGoals);
  const awayGoals = Number(score.awayGoals);
  return Number.isInteger(homeGoals) && Number.isInteger(awayGoals) && homeGoals >= 0 && awayGoals >= 0;
}

// Como normalizeForSave pero conserva `advance` ('home'|'away') para los cruces de eliminatoria.
function normalizeKnockoutForSave(scores) {
  const out = {};
  for (const [matchId, score] of Object.entries(scores || {})) {
    if (score?.homeGoals === '' || score?.awayGoals === '') continue;
    const homeGoals = Number(score?.homeGoals);
    const awayGoals = Number(score?.awayGoals);
    if (Number.isInteger(homeGoals) && Number.isInteger(awayGoals) && homeGoals >= 0 && awayGoals >= 0) {
      const entry = { homeGoals, awayGoals };
      if (score.advance === 'home' || score.advance === 'away') entry.advance = score.advance;
      out[matchId] = entry;
    }
  }
  return out;
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

function buildGroupTables(fixtures, groups, scoreMap) {
  const tables = {};

  for (const [group, teams] of Object.entries(groups || {})) {
    tables[group] = teams.map(emptyStanding);
  }

  const byTeam = {};
  for (const [group, rows] of Object.entries(tables)) {
    byTeam[group] = Object.fromEntries(rows.map((row) => [row.team, row]));
  }

  for (const fixture of fixtures || []) {
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

function countCompletedScores(scoreMap) {
  return Object.values(scoreMap || {}).filter(isCompleteScore).length;
}

function getQualifiedTeams(groupTables) {
  const groupEntries = Object.entries(groupTables || {}).sort(([a], [b]) => a.localeCompare(b));
  const winners = [];
  const runners = [];
  const thirds = [];

  for (const [group, rows] of groupEntries) {
    if (rows[0]) winners.push({ ...rows[0], group, seed: `1${group}`, label: `1º Grupo ${group}` });
    if (rows[1]) runners.push({ ...rows[1], group, seed: `2${group}`, label: `2º Grupo ${group}` });
    if (rows[2]) thirds.push({ ...rows[2], group, seed: `3${group}`, label: `3º Grupo ${group}` });
  }

  thirds.sort((a, b) =>
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.team.localeCompare(b.team, 'es')
  );

  const qualifiedThirds = thirds.slice(0, 8);
  const eliminatedThirds = thirds.slice(8);

  return {
    winners,
    runners,
    thirds: qualifiedThirds,
    eliminatedThirds,
    allThirds: thirds,
    qualified: [...winners, ...runners, ...qualifiedThirds]
  };
}

function makeKnockoutPairings(qualifiedData) {
  const bySeed = {};

  for (const team of [...qualifiedData.winners, ...qualifiedData.runners]) {
    bySeed[team.seed] = team;
  }

  const thirdByGroup = {};
  for (const team of qualifiedData.thirds || []) {
    thirdByGroup[team.group] = team;
  }

  function resolveSeed(seed) {
    if (bySeed[seed]) return bySeed[seed];

    if (seed.startsWith('3')) {
      const possibleGroups = seed.slice(1).split('');
      const matchedThird = possibleGroups
        .map((group) => thirdByGroup[group])
        .find(Boolean);

      if (matchedThird) {
        return {
          ...matchedThird,
          seed,
          label: `3º Grupo ${matchedThird.group}`
        };
      }

      return {
        team: `3º ${possibleGroups.join('/')}`,
        seed,
        label: `3º de ${possibleGroups.join(', ')}`,
        isPlaceholder: true
      };
    }

    return null;
  }

  const officialRoundOf32 = [
    { id: 'M74', homeSeed: '1E', awaySeed: '3ABCDF', date: '29/06/2026', time: '22:30', side: 'left' },
    { id: 'M77', homeSeed: '1I', awaySeed: '3CDFGH', date: '30/06/2026', time: '23:00', side: 'left' },
    { id: 'M73', homeSeed: '2A', awaySeed: '2B', date: '28/06/2026', time: '21:00', side: 'left' },
    { id: 'M75', homeSeed: '1F', awaySeed: '2C', date: '30/06/2026', time: '03:00', side: 'left' },
    { id: 'M83', homeSeed: '2K', awaySeed: '2L', date: '03/07/2026', time: '01:00', side: 'left' },
    { id: 'M84', homeSeed: '1H', awaySeed: '2J', date: '02/07/2026', time: '21:00', side: 'left' },
    { id: 'M81', homeSeed: '1D', awaySeed: '3BEFIJ', date: '02/07/2026', time: '02:00', side: 'left' },
    { id: 'M82', homeSeed: '1G', awaySeed: '3AEHIJ', date: '01/07/2026', time: '22:00', side: 'left' },

    { id: 'M76', homeSeed: '1C', awaySeed: '2F', date: '29/06/2026', time: '19:00', side: 'right' },
    { id: 'M78', homeSeed: '2E', awaySeed: '2I', date: '30/06/2026', time: '19:00', side: 'right' },
    { id: 'M79', homeSeed: '1A', awaySeed: '3CEFIH', date: '01/07/2026', time: '03:00', side: 'right' },
    { id: 'M80', homeSeed: '1L', awaySeed: '3EHJK', date: '01/07/2026', time: '18:00', side: 'right' },
    { id: 'M86', homeSeed: '1J', awaySeed: '2H', date: '04/07/2026', time: '00:00', side: 'right' },
    { id: 'M88', homeSeed: '2D', awaySeed: '2G', date: '03/07/2026', time: '20:00', side: 'right' },
    { id: 'M85', homeSeed: '1B', awaySeed: '3EFGIJ', date: '03/07/2026', time: '05:00', side: 'right' },
    { id: 'M87', homeSeed: '1K', awaySeed: '3DEIJL', date: '04/07/2026', time: '03:30', side: 'right' }
  ];

  return officialRoundOf32.map((match) => ({
    ...match,
    home: resolveSeed(match.homeSeed),
    away: resolveSeed(match.awaySeed)
  }));
}


function findQualifiedByGroup(list, group) {
  return (list || []).find((team) => team.group === group) || null;
}

function resolveOfficialSlot(label, qualifiedData) {
  const text = String(label || '');

  const firstMatch = text.match(/^1º Grupo ([A-L])$/);
  if (firstMatch) {
    return findQualifiedByGroup(qualifiedData.winners, firstMatch[1]);
  }

  const secondMatch = text.match(/^2º Grupo ([A-L])$/);
  if (secondMatch) {
    return findQualifiedByGroup(qualifiedData.runners, secondMatch[1]);
  }

  const thirdMatch = text.match(/^3º ([A-L](?:\/[A-L])*)$/);
  if (thirdMatch) {
    const allowedGroups = new Set(thirdMatch[1].split('/'));
    return (qualifiedData.thirds || []).find((team) => allowedGroups.has(team.group)) || null;
  }

  return null;
}

function decorateOfficialMatch(match, qualifiedData) {
  return {
    ...match,
    labelTeam: resolveOfficialSlot(match.label, qualifiedData),
    otherTeam: resolveOfficialSlot(match.other, qualifiedData)
  };
}

function buildProjectedOfficialBracket(qualifiedData) {
  return {
    left: OFFICIAL_KNOCKOUT_BRACKET.left.map((column) => ({
      ...column,
      matches: column.matches.map((match) => decorateOfficialMatch(match, qualifiedData))
    })),
    right: OFFICIAL_KNOCKOUT_BRACKET.right.map((column) => ({
      ...column,
      matches: column.matches.map((match) => decorateOfficialMatch(match, qualifiedData))
    }))
  };
}

export default function App() {
  const [fixtureData, setFixtureData] = useState(null);
  const [token, setToken] = useState(localStorage.getItem(STORAGE_TOKEN) || '');
  const [player, setPlayer] = useState(readStoredPlayer());
  const [tab, setTab] = useState('predictions');
  const [predictions, setPredictions] = useState({});
  const [results, setResults] = useState({});
  const [knockoutPredictions, setKnockoutPredictions] = useState({});
  const [knockoutResults, setKnockoutResults] = useState({});
  const [leaderboard, setLeaderboard] = useState(null);
  const [settings, setSettings] = useState({ locked: false, knockoutLocked: true, scoring: null });
  const [groupFilter, setGroupFilter] = useState('A');
  const [status, setStatus] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/fixtures.json')
      .then((response) => response.json())
      .then(setFixtureData)
      .catch(() => setStatus('No se pudo cargar el calendario de partidos.'));
  }, []);

  useEffect(() => {
    if (!token) return;
    refreshPrivateData();
  }, [token]);

  async function refreshPrivateData() {
    try {
      const [predictionData, resultData, settingsData, leaderboardData] = await Promise.all([
        apiFetch('/api/predictions', { token }),
        apiFetch('/api/results'),
        apiFetch('/api/settings'),
        apiFetch('/api/leaderboard')
      ]);
      setPredictions(predictionData.predictions || {});
      setKnockoutPredictions(predictionData.knockout || {});
      setResults(resultData.results || {});
      setKnockoutResults(resultData.knockout || {});
      setSettings(settingsData);
      setLeaderboard(leaderboardData);
    } catch (error) {
      setStatus(error.message);
    }
  }

  function onLoggedIn(data) {
    localStorage.setItem(STORAGE_TOKEN, data.token);
    localStorage.setItem(STORAGE_PLAYER, JSON.stringify(data.player));
    setToken(data.token);
    setPlayer(data.player);
    setStatus(data.isNew ? 'Jugador creado. Ya puedes rellenar tus pronósticos.' : 'Sesión iniciada.');
  }

  function logout() {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_PLAYER);
    setToken('');
    setPlayer(null);
    setPredictions({});
    setKnockoutPredictions({});
    setStatus('');
  }

  function updateScore(setter, matchId, field, rawValue) {
    const value = rawValue === '' ? '' : Math.max(0, Math.min(99, Number(rawValue)));
    setter((current) => ({
      ...current,
      [matchId]: {
        homeGoals: current[matchId]?.homeGoals ?? '',
        awayGoals: current[matchId]?.awayGoals ?? '',
        ...current[matchId],
        [field]: value
      }
    }));
  }

  async function savePredictions() {
    setBusy(true);
    setStatus('');
    try {
      const payload = normalizeForSave(predictions);
      const data = await apiFetch('/api/predictions', {
        method: 'POST',
        token,
        body: { predictions: payload }
      });
      setPredictions(data.predictions || payload);
      setStatus(`Guardado: ${data.completeCount} de ${fixtureData.fixtures.length} partidos.`);
      await refreshPrivateData();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  function setKnockoutAdvance(matchId, advance) {
    setKnockoutPredictions((current) => ({
      ...current,
      [matchId]: {
        homeGoals: current[matchId]?.homeGoals ?? '',
        awayGoals: current[matchId]?.awayGoals ?? '',
        ...current[matchId],
        advance
      }
    }));
  }

  async function saveKnockout() {
    setBusy(true);
    setStatus('');
    try {
      const payload = normalizeKnockoutForSave(knockoutPredictions);
      const data = await apiFetch('/api/predictions', {
        method: 'POST',
        token,
        body: { knockout: payload }
      });
      setKnockoutPredictions(data.knockout || payload);
      setStatus(`Eliminatoria guardada: ${data.knockoutCompleteCount} de ${(fixtureData.knockout || []).length} cruces.`);
      await refreshPrivateData();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  const fixtures = fixtureData?.fixtures || [];
  const groups = fixtureData?.groups || {};
  const groupKeys = useMemo(() => Object.keys(groups).sort((a, b) => a.localeCompare(b, 'es')), [groups]);
  const activeGroup = groupKeys.includes(groupFilter) ? groupFilter : groupKeys[0] || 'A';
  const activeGroupIndex = Math.max(0, groupKeys.indexOf(activeGroup));
  const filteredFixtures = useMemo(
    () => fixtures.filter((fixture) => fixture.group === activeGroup),
    [fixtures, activeGroup]
  );

  useEffect(() => {
    if (groupKeys.length && !groupKeys.includes(groupFilter)) {
      setGroupFilter(groupKeys[0]);
    }
  }, [groupKeys, groupFilter]);

  const completedPredictions = Object.keys(normalizeForSave(predictions)).length;
  const predictionPercent = fixtures.length ? Math.round((completedPredictions / fixtures.length) * 100) : 0;
  const currentGroupCompleted = filteredFixtures.filter((fixture) => isCompleteScore(predictions[fixture.id])).length;
  const currentGroupPercent = filteredFixtures.length ? Math.round((currentGroupCompleted / filteredFixtures.length) * 100) : 0;

  function goToGroup(offset) {
    if (!groupKeys.length) return;
    const nextIndex = (activeGroupIndex + offset + groupKeys.length) % groupKeys.length;
    setGroupFilter(groupKeys[nextIndex]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!fixtureData) {
    return <main className="page"><div className="panel">Cargando calendario...</div></main>;
  }

  if (!token || !player) {
    return (
      <main className="page">
        <Hero fixtureCount={fixtures.length} />
        <LoginForm onLoggedIn={onLoggedIn} />
      </main>
    );
  }

  return (
    <main className="page">
      <header className="hero">
        <div>
          <h1>Porra Mundial 2026</h1>
          <p>Juega como <strong>{player.name}</strong>.</p>
        </div>
        <button className="secondary" onClick={logout}>Salir</button>
      </header>

      {status && <div className="notice">{status}</div>}

      <DesktopModeBanner />

      <RulesBanner showRules={showRules} onToggle={() => setShowRules((value) => !value)} />

      <nav className="tabs" aria-label="Secciones principales">
        <button className={tab === 'predictions' ? 'active' : ''} onClick={() => setTab('predictions')}>Pronósticos fase de grupos</button>
        <button className={tab === 'calendar' ? 'active' : ''} onClick={() => { setTab('calendar'); refreshPrivateData(); }}>Calendario partidos</button>
        <button className={tab === 'myBracket' ? 'active' : ''} onClick={() => { setTab('myBracket'); refreshPrivateData(); }}>Mi eliminatoria</button>
        <button className={tab === 'knockouts' ? 'active' : ''} onClick={() => setTab('knockouts')}>Pronósticos fase eliminatorias</button>
        <button className={tab === 'leaderboard' ? 'active' : ''} onClick={() => { setTab('leaderboard'); refreshPrivateData(); }}>Clasificación porra</button>
      </nav>

      {tab === 'predictions' && (
        <section className="panel predictionsPanel">
          <div className="toolbar predictionsTopBar">
            <div>
              <h2>Pronósticos fase de grupos</h2>
              <p className="muted">Puntuación: {GROUP_SCORING_SUMMARY}</p>
              {settings.locked && <p className="locked">La porra está cerrada. Puedes ver tus pronósticos, pero no guardarlos.</p>}
            </div>
            <div className="overallProgressCard" aria-label="Progreso total de pronósticos">
              <span className="progressNumber">{predictionPercent}%</span>
              <span className="progressText">{completedPredictions}/{fixtures.length} partidos</span>
              <div className="progressTrack" aria-hidden="true">
                <div className="progressFill" style={{ width: `${predictionPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="groupStepper">
            <button className="secondary" onClick={() => goToGroup(-1)} disabled={!groupKeys.length}>← Grupo anterior</button>
            <div className="currentGroupCard">
              <span className="eyebrow">Grupo {activeGroup}</span>
              <strong>{activeGroupIndex + 1}/{groupKeys.length}</strong>
              <span>{currentGroupCompleted}/{filteredFixtures.length} partidos · {currentGroupPercent}% completado</span>
            </div>
            <button className="secondary" onClick={() => goToGroup(1)} disabled={!groupKeys.length}>Siguiente grupo →</button>
            <label className="groupJump">
              Ir a grupo
              <select value={activeGroup} onChange={(event) => setGroupFilter(event.target.value)}>
                {groupKeys.map((group) => <option key={group} value={group}>Grupo {group}</option>)}
              </select>
            </label>
          </div>

          <FixtureList
            fixtures={filteredFixtures}
            scores={predictions}
            results={results}
            groups={groups}
            onChange={(matchId, field, value) => updateScore(setPredictions, matchId, field, value)}
            disabled={settings.locked}
          />

          <PredictionStandingsPreview
            fixtures={fixtures}
            groups={groups}
            scores={predictions}
            groupFilter={activeGroup}
          />

          <div className="stickyActions predictionActions">
            <button className="secondary" onClick={() => goToGroup(-1)} disabled={!groupKeys.length}>← Grupo anterior</button>
            <button onClick={savePredictions} disabled={busy || settings.locked}>{busy ? 'Guardando...' : 'Guardar mis pronósticos'}</button>
            <button className="secondary" onClick={refreshPrivateData}>Recargar</button>
            <button className="secondary" onClick={() => goToGroup(1)} disabled={!groupKeys.length}>Siguiente grupo →</button>
          </div>
        </section>
      )}

      {tab === 'liveGroups' && (
        <GroupStandingsPanel
          title="Grupos actualizados"
          description="Clasificación temporal calculada con los resultados reales que el admin haya cargado. Mientras falten partidos, es provisional."
          fixtures={fixtures}
          groups={groups}
          scores={results}
          emptyMessage="Todavía no hay resultados reales cargados."
        />
      )}

      {tab === 'calendar' && (
        <MatchCalendarPanel
          fixtures={fixtures}
          results={results}
          predictions={predictions}
          onRefresh={refreshPrivateData}
        />
      )}

      {tab === 'myBracket' && (
        <MyKnockoutPanel
          fixtures={fixtures}
          groups={groups}
          predictions={predictions}
          fixtureCount={fixtures.length}
        />
      )}

      {tab === 'knockouts' && (
        <KnockoutPredictionsPanel
          knockoutFixtures={fixtureData.knockout || []}
          fixtures={fixtures}
          groups={groups}
          groupPredictions={predictions}
          knockoutPredictions={knockoutPredictions}
          knockoutResults={knockoutResults}
          locked={settings.knockoutLocked}
          busy={busy}
          onScore={(matchId, field, value) => updateScore(setKnockoutPredictions, matchId, field, value)}
          onAdvance={setKnockoutAdvance}
          onSave={saveKnockout}
          onRefresh={refreshPrivateData}
        />
      )}

      {tab === 'leaderboard' && (
        <Leaderboard data={leaderboard} onRefresh={refreshPrivateData} />
      )}

      {tab === 'admin' && (
        <AdminPanel
          fixtures={fixtures}
          groups={groups}
          initialResults={results}
          knockoutFixtures={fixtureData.knockout || []}
          initialKnockoutResults={knockoutResults}
          locked={settings.locked}
          knockoutLocked={settings.knockoutLocked}
          onStatus={setStatus}
          onSaved={async () => {
            await refreshPrivateData();
            setTab('leaderboard');
          }}
        />
      )}

      {tab !== 'admin' && (
        <div className="adminEntryFooter">
          <button className="adminEntryButton" type="button" onClick={() => { setStatus(''); setTab('admin'); }}>
            Admin
          </button>
        </div>
      )}
    </main>
  );
}



function DesktopModeBanner() {
  return (
    <div className="desktopModeBanner" role="note">
      <strong>Consejo para móvil:</strong> para ver la porra con el mismo formato que en ordenador, activa la opción <strong>“Vista de ordenador”</strong> en el navegador.
    </div>
  );
}

function RulesBanner({ showRules, onToggle }) {
  return (
    <section className="rulesBanner" aria-label="Reglas de puntuación">
      <div>
        <p className="eyebrow">Reglas de la porra</p>
        <strong>Fase de grupos: 5/3/1 pts por 1º, 2º y 3º de grupo · 2 pts por acertar el resultado de cada partido (1, X o 2) y 1 pt extra por marcador exacto.</strong>
        <p>Después se abrirá la porra de eliminatorias con 5 pts por acertar quién pasa cada cruce y 2 pts extra por el marcador exacto previo a la tanda de penaltis.</p>
      </div>
      <button className="secondary rulesButton" type="button" onClick={onToggle}>{showRules ? 'Ocultar reglas' : 'Ver reglas completas'}</button>
      {showRules && <RulesPanel />}
    </section>
  );
}

function RulesPanel() {
  return (
    <div className="rulesPanel">
      {RULE_SECTIONS.map((section) => (
        <article key={section.title}>
          <h3>{section.title}</h3>
          <ul>
            {section.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </article>
      ))}
    </div>
  );
}

function OfficialKnockoutStagePanel() {
  return (
    <section className="panel knockoutStagePanel">
      <div className="toolbar">
        <div>
          <h2>Fase de eliminatorias</h2>
          <p className="muted">Cuadro oficial de cruces por posición. Los equipos concretos quedan pendientes hasta terminar la fase de grupos.</p>
          <p className="muted small">Pendiente de definir: {KNOCKOUT_AVAILABLE_DATE}. La ronda de 32 empieza el {KNOCKOUT_START_DATE}.</p>
        </div>
      </div>

      <div className="notice bracketWarning">
        Este cuadro muestra el camino oficial por posiciones de grupo. Cuando finalice la fase de grupos se cargarán los equipos clasificados y se abrirá la porra de eliminatorias.
      </div>

      <div className="fullBracketBoard">
        <div className="fullBracketHeader">
          <span>Dieciseisavos</span>
          <span>Octavos</span>
          <span>Cuartos</span>
          <span>Semis</span>
          <strong>Final</strong>
          <span>Semis</span>
          <span>Cuartos</span>
          <span>Octavos</span>
          <span>Dieciseisavos</span>
        </div>
        <div className="fullBracketGrid">
          <BracketColumn columns={OFFICIAL_KNOCKOUT_BRACKET.left} side="left" />
          <div className="finalColumn">
            <div className="tournamentLogoMini">🏆</div>
            <p className="eyebrow">Final</p>
            <OfficialBracketBox match={OFFICIAL_KNOCKOUT_BRACKET.final} />
            <p className="championLabel">Campeón</p>
            <div className="championPlaceholder">Pendiente</div>
            <p className="eyebrow thirdPlaceTitle">Tercer puesto</p>
            <OfficialBracketBox match={OFFICIAL_KNOCKOUT_BRACKET.thirdPlace} />
          </div>
          <BracketColumn columns={OFFICIAL_KNOCKOUT_BRACKET.right} side="right" />
        </div>
      </div>
    </section>
  );
}

function BracketColumn({ columns, side }) {
  return (
    <div className={`knockoutColumns knockoutColumns-${side}`}>
      {columns.map((column) => (
        <div className="knockoutRound" key={`${side}-${column.title}`}>
          <h3>{column.title}</h3>
          <div className="knockoutMatches">
            {column.matches.map((match) => <OfficialBracketBox key={match.id} match={match} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function OfficialBracketBox({ match }) {
  const meta = [match.id, match.date, match.time].filter(Boolean).join(' · ');

  return (
    <article className="officialSeedBox">
      <div className="officialSeedMeta">{meta}</div>
      <OfficialSeedTeamLine label={match.label} team={match.labelTeam} />
      <OfficialSeedTeamLine label={match.other} team={match.otherTeam} />
      <div className="officialSeedPass">Pasa: <span>—</span></div>
    </article>
  );
}

function OfficialSeedTeamLine({ label, team }) {
  return (
    <div className={team ? 'officialSeedTeam officialSeedTeamProjected' : 'officialSeedTeam'}>
      <span className="officialSeedLabel">{label}</span>
      {team && (
        <span className="officialProjectedTeam">
          <TeamFlag team={team.team} />
          <strong>{team.team}</strong>
        </span>
      )}
    </div>
  );
}

// Etiqueta legible de un origen de cruce (seed de grupo o ganador/perdedor de otro cruce).
function knockoutSourceLabel(source) {
  if (!source) return '—';
  if (source.winnerOf) return `Ganador ${source.winnerOf}`;
  if (source.loserOf) return `Perdedor ${source.loserOf}`;
  if (source.seed) {
    const seed = source.seed;
    const pos = seed[0];
    const rest = seed.slice(1);
    if (pos === '1') return `1º Grupo ${rest}`;
    if (pos === '2') return `2º Grupo ${rest}`;
    if (pos === '3') return `3º (${rest.split('').join('/')})`;
    return seed;
  }
  return '—';
}

function formatKnockoutDate(date) {
  if (!date) return '';
  const parts = String(date).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return date;
}

function KnockoutPredictionsPanel({
  knockoutFixtures,
  fixtures,
  groups,
  groupPredictions,
  knockoutPredictions,
  knockoutResults,
  locked,
  busy,
  onScore,
  onAdvance,
  onSave,
  onRefresh
}) {
  const groupTables = useMemo(
    () => buildGroupTables(fixtures, groups, groupPredictions),
    [fixtures, groups, groupPredictions]
  );
  const bracket = useMemo(
    () => resolveBracket(knockoutFixtures, knockoutPredictions, groupTables),
    [knockoutFixtures, knockoutPredictions, groupTables]
  );

  const byRound = useMemo(() => {
    const map = {};
    for (const fixture of knockoutFixtures) {
      (map[fixture.round] ||= []).push(fixture);
    }
    return map;
  }, [knockoutFixtures]);

  const total = knockoutFixtures.length;
  const completed = knockoutFixtures.filter((fixture) => isCompleteScore(knockoutPredictions[fixture.id])).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  return (
    <section className="panel knockoutStagePanel">
      <div className="toolbar">
        <div>
          <h2>Pronósticos fase de eliminatorias</h2>
          <p className="muted">5 pts por acertar el equipo que pasa cada cruce y 2 pts extra por el marcador exacto previo a penaltis. Tus ganadores avanzan solos a la ronda siguiente.</p>
          {locked
            ? <p className="locked">La eliminatoria está cerrada. Se abrirá cuando termine la fase de grupos.</p>
            : <p className="muted small">Rellena el cuadro con los equipos que proyectan tus pronósticos de grupos. Si pones empate, elige quién pasa en penaltis.</p>}
        </div>
        <div className="overallProgressCard" aria-label="Progreso de la eliminatoria">
          <span className="progressNumber">{percent}%</span>
          <span className="progressText">{completed}/{total} cruces</span>
          <div className="progressTrack" aria-hidden="true">
            <div className="progressFill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      {ROUND_ORDER.filter((round) => byRound[round]?.length).map((round) => (
        <div className="knockoutRoundBlock" key={round}>
          <h3>{ROUND_LABELS[round]}</h3>
          <div className="knockoutCaptureGrid">
            {byRound[round].map((fixture) => (
              <KnockoutMatchCard
                key={fixture.id}
                fixture={fixture}
                teams={bracket[fixture.id]}
                pick={knockoutPredictions[fixture.id]}
                result={knockoutResults[fixture.id]}
                disabled={locked}
                onScore={onScore}
                onAdvance={onAdvance}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="stickyActions predictionActions">
        <button onClick={onSave} disabled={busy || locked}>{busy ? 'Guardando...' : 'Guardar mi eliminatoria'}</button>
        <button className="secondary" onClick={onRefresh}>Recargar</button>
      </div>
    </section>
  );
}

function KnockoutMatchCard({ fixture, teams, pick, result, disabled, onScore, onAdvance }) {
  const homeTeam = teams?.homeTeam || null;
  const awayTeam = teams?.awayTeam || null;
  const homeLabel = homeTeam || knockoutSourceLabel(fixture.home);
  const awayLabel = awayTeam || knockoutSourceLabel(fixture.away);

  const homeGoals = pick?.homeGoals ?? '';
  const awayGoals = pick?.awayGoals ?? '';
  const isDraw =
    homeGoals !== '' && awayGoals !== '' && Number(homeGoals) === Number(awayGoals);

  const meta = [fixture.id, formatKnockoutDate(fixture.date), fixture.time].filter(Boolean).join(' · ');
  const hasResult = isCompleteScore(result);

  return (
    <article className="matchCard matchCardEnhanced knockoutMatchCard">
      <div className="matchMeta">{meta}</div>
      <div className="scoreRow scoreRowEnhanced">
        <span className="team home">
          {homeTeam && <TeamFlag team={homeTeam} />}
          {homeLabel}
        </span>
        <input
          type="number"
          min="0"
          max="99"
          value={homeGoals}
          disabled={disabled}
          onChange={(event) => onScore(fixture.id, 'homeGoals', event.target.value)}
        />
        <span className="dash">-</span>
        <input
          type="number"
          min="0"
          max="99"
          value={awayGoals}
          disabled={disabled}
          onChange={(event) => onScore(fixture.id, 'awayGoals', event.target.value)}
        />
        <span className="team away">
          {awayLabel}
          {awayTeam && <TeamFlag team={awayTeam} />}
        </span>
      </div>

      {isDraw && (
        <div className="knockoutAdvance">
          <span>Pasa en penaltis:</span>
          <label>
            <input
              type="radio"
              name={`advance-${fixture.id}`}
              checked={pick?.advance === 'home'}
              disabled={disabled}
              onChange={() => onAdvance(fixture.id, 'home')}
            />
            {homeLabel}
          </label>
          <label>
            <input
              type="radio"
              name={`advance-${fixture.id}`}
              checked={pick?.advance === 'away'}
              disabled={disabled}
              onChange={() => onAdvance(fixture.id, 'away')}
            />
            {awayLabel}
          </label>
        </div>
      )}

      {!isDraw && teams?.advancerTeam && (
        <div className="officialSeedPass">Pasa: <span>{teams.advancerTeam}</span></div>
      )}

      {hasResult && (
        <p className="actualResult">
          Resultado real: {result.homeGoals}-{result.awayGoals}
          {Number(result.homeGoals) === Number(result.awayGoals) && result.advance
            ? ` (pasa ${result.advance === 'home' ? 'local' : 'visitante'} en penaltis)`
            : ''}
        </p>
      )}
    </article>
  );
}

function Hero({ fixtureCount }) {
  return (
    <header className="loginHero">
      <div className="tournamentBadge">
        <span className="badgeBall">⚽</span>
        <span>FIFA World Cup 2026</span>
      </div>
      <h1>PORRA MUNDIAL 2026</h1>
      <p>Inicia sesión si ya tienes cuenta o regístrate con el código de invitación. Pronostica los {fixtureCount} partidos y compite con tus amigos.</p>
    </header>
  );
}

function LoginForm({ onLoggedIn }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarId, setAvatarId] = useState('football-1');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    if (nextMode === 'login') {
      setJoinCode('');
      setPhone('');
    }
  }

  async function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen.');
      return;
    }

    try {
      const resized = await resizeImageToDataUrl(file, 160, 0.82);
      setAvatarUrl(resized);
    } catch (_) {
      setError('No se pudo cargar la imagen. Prueba con otra foto.');
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await apiFetch('/api/login', {
        method: 'POST',
        body: {
          mode,
          name,
          pin,
          joinCode: mode === 'register' ? joinCode : '',
          phone: mode === 'register' ? phone : undefined,
          avatarId: mode === 'register' ? avatarId : undefined,
          avatarUrl: mode === 'register' ? avatarUrl : undefined
        }
      });
      onLoggedIn(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="authShell">
      <div className="authCard">
        <div className="authTabs" role="tablist" aria-label="Acceso a la porra">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Iniciar sesión</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Registrarme</button>
        </div>

        <form onSubmit={submit} className="authForm">
          <label>
            Usuario
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="ej. gonzalez" autoComplete="username" required />
          </label>
          <label>
            Contraseña / PIN
            <input value={pin} onChange={(event) => setPin(event.target.value)} placeholder="4 caracteres o más" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
          </label>

          {mode === 'register' && (
            <>
              <div className="paymentRegisterBox">
                <strong>Pago de inscripción: 5 €</strong>
                <span>Introduce tu teléfono para que el admin pueda enviarte o comprobar el Bizum.</span>
              </div>

              <label className="phoneBizumField">
                Teléfono para Bizum <span className="requiredMark">*</span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Ej. 600 123 456"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                />
                <span className="fieldHint">Solo se usará para identificar el pago de la porra.</span>
              </label>

              <label>
                Código de invitación <span className="requiredMark">*</span>
                <input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Código que te pasa el admin" required />
              </label>

              <div className="avatarSection">
                <div>
                  <h3>Elige tu foto de perfil</h3>
                  <p className="muted small">Puedes subir una foto o escoger uno de los iconos predeterminados.</p>
                </div>

                <div className="avatarUploadRow">
                  <PlayerAvatar player={{ avatarId, avatarUrl }} size="xl" />
                  <label className="uploadButton">
                    Subir imagen
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} />
                  </label>
                  {avatarUrl && <button type="button" className="secondary miniButton" onClick={() => setAvatarUrl('')}>Quitar foto</button>}
                </div>

                <div className="avatarGrid" aria-label="Iconos predeterminados">
                  {AVATAR_PRESETS.map((avatar) => (
                    <button
                      type="button"
                      key={avatar.id}
                      className={`avatarChoice avatarTheme-${avatar.theme} ${avatarId === avatar.id && !avatarUrl ? 'selected' : ''}`}
                      onClick={() => { setAvatarId(avatar.id); setAvatarUrl(''); }}
                      title={avatar.label}
                    >
                      <span>{avatar.emoji}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {mode === 'login' && (
            <p className="authHelp">Si ya estás registrado, no necesitas código de invitación. Entra con el mismo usuario y PIN.</p>
          )}

          {error && <p className="error">{error}</p>}
          <button disabled={busy}>{busy ? 'Entrando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
        </form>
      </div>
    </section>
  );
}

function resizeImageToDataUrl(file, maxSize = 160, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const context = canvas.getContext('2d');
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function FixtureList({ fixtures, scores, results, onChange, disabled, groups = {} }) {
  const groupOrder = Object.keys(groups).length
    ? Object.keys(groups)
    : [...new Set(fixtures.map((fixture) => fixture.group))].sort();

  const fixturesByGroup = fixtures.reduce((acc, fixture) => {
    acc[fixture.group] ||= [];
    acc[fixture.group].push(fixture);
    return acc;
  }, {});

  return groupOrder
    .filter((group) => fixturesByGroup[group]?.length)
    .map((group) => (
      <section className="groupBlock" key={group}>
        <div className="groupHeader">
          <div>
            <p className="eyebrow">Grupo {group}</p>
            <div className="groupTeamsSummary">
              {(groups[group] || []).map((team) => (
                <span className="groupTeamName" key={team}>
                  <TeamFlag team={team} />
                  <span>{team}</span>
                </span>
              ))}
            </div>
          </div>
          <span className="groupCount">{fixturesByGroup[group].length} partidos</span>
        </div>

        <div className="teamStrip">
          {(groups[group] || []).map((team) => (
            <TeamBadge key={team} team={team} />
          ))}
        </div>

        <div className="matches groupMatches">
          {fixturesByGroup[group]
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date) || a.matchNo - b.matchNo)
            .map((fixture) => (
              <MatchCard
                key={fixture.id}
                fixture={fixture}
                score={scores[fixture.id] || {}}
                result={results[fixture.id]}
                onChange={onChange}
                disabled={disabled}
              />
            ))}
        </div>
      </section>
    ));
}

function TeamBadge({ team }) {
  return (
    <span className="teamBadge">
      <TeamFlag team={team} />
      <span>{team}</span>
    </span>
  );
}

function MatchCard({ fixture, score, result, onChange, disabled }) {
  return (
    <article className="matchCard matchCardEnhanced">
      <div className="matchMeta">
        <span>#{fixture.matchNo}</span>
        <span>{formatFixtureDateSpain(fixture)}</span>
        <span>{kickoffSpainLabel(fixture)}</span>
        <span>{fixture.venue}</span>
      </div>

      {fixture.lockAtSpain && (
        <p className="matchTimingNote">
          Cierre pronóstico: {formatDateTimeSpain(fixture.lockAtSpain)} h España
        </p>
      )}

      <div className="scoreRow scoreRowEnhanced">
        <span className="team home">
          <span className="teamName">{fixture.home}</span>
          <TeamFlag team={fixture.home} />
        </span>
        <input
          type="number"
          min="0"
          max="99"
          inputMode="numeric"
          value={scoreValue(score.homeGoals)}
          onChange={(event) => onChange(fixture.id, 'homeGoals', event.target.value)}
          disabled={disabled}
          aria-label={`Goles de ${fixture.home}`}
        />
        <span className="dash">-</span>
        <input
          type="number"
          min="0"
          max="99"
          inputMode="numeric"
          value={scoreValue(score.awayGoals)}
          onChange={(event) => onChange(fixture.id, 'awayGoals', event.target.value)}
          disabled={disabled}
          aria-label={`Goles de ${fixture.away}`}
        />
        <span className="team away">
          <TeamFlag team={fixture.away} />
          <span className="teamName">{fixture.away}</span>
        </span>
      </div>
      {result && <p className="actualResult">Resultado real: {result.homeGoals}-{result.awayGoals}</p>}
    </article>
  );
}



function resultText(result) {
  if (!isCompleteScore(result)) return 'Pendiente';
  return `${result.homeGoals}-${result.awayGoals}`;
}

function isExactPrediction(prediction, result) {
  if (!isCompleteScore(prediction) || !isCompleteScore(result)) {
    return false;
  }

  return (
    Number(prediction.homeGoals) === Number(result.homeGoals) &&
    Number(prediction.awayGoals) === Number(result.awayGoals)
  );
}

function matchTimestamp(fixture) {
  if (fixture?.kickoffAtSpain) {
    return new Date(fixture.kickoffAtSpain).getTime();
  }

  if (fixture?.kickoffDateSpain && fixture?.kickoffTimeSpain) {
    return new Date(`${fixture.kickoffDateSpain}T${fixture.kickoffTimeSpain}:00+02:00`).getTime();
  }

  return new Date(`${fixture.date}T12:00:00Z`).getTime();
}

function MatchCalendarPanel({ fixtures, results, predictions, onRefresh }) {
  const sortedFixtures = useMemo(() => {
    return fixtures.slice().sort((a, b) => {
      const byDate = matchTimestamp(a) - matchTimestamp(b);
      if (byDate !== 0) return byDate;
      return Number(a.matchNo || 0) - Number(b.matchNo || 0);
    });
  }, [fixtures]);

  const resultCount = Object.values(results || {}).filter(isCompleteScore).length;

  return (
    <section className="panel matchCalendarPanel">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Calendario completo</p>
          <h2>Partidos del Mundial en orden cronológico</h2>
          <p className="muted">
            Horarios en España peninsular y resultado real cargado por el admin.
          </p>
          <p className="muted small">
            Resultados cargados: {resultCount}/{fixtures.length}
          </p>
        </div>

        <button className="secondary" type="button" onClick={onRefresh}>
          Actualizar
        </button>
      </div>

      <div className="tableWrap matchCalendarTableWrap">
        <table className="matchCalendarTable">
          <thead>
            <tr>
              <th>#</th>
              <th>Fecha</th>
              <th>Hora España</th>
              <th>Grupo</th>
              <th>Partido</th>
              <th>Sede</th>
              <th>Resultado real</th>
              <th>Mi pronóstico</th>
              <th>Exacto</th>
            </tr>
          </thead>

          <tbody>
            {sortedFixtures.map((fixture) => {
              const result = results?.[fixture.id];
              const prediction = predictions?.[fixture.id];
              const hasResult = isCompleteScore(result);
              const hasPrediction = isCompleteScore(prediction);
              const exact = isExactPrediction(prediction, result);

              return (
                <tr key={fixture.id}>
                  <td>
                    <strong>{fixture.matchNo}</strong>
                  </td>

                  <td>{formatFixtureDateSpain(fixture)}</td>

                  <td>
                    <strong>{kickoffSpainLabel(fixture)}</strong>
                  </td>

                  <td>Grupo {fixture.group}</td>

                  <td>
                    <span className="calendarMatchTeams">
                      <span>
                        <TeamFlag team={fixture.home} />
                        {fixture.home}
                      </span>

                      <span className="dash">-</span>

                      <span>
                        <TeamFlag team={fixture.away} />
                        {fixture.away}
                      </span>
                    </span>
                  </td>

                  <td>{fixture.venue}</td>

                  <td>
                    {hasResult ? (
                      <span className="realResultBadge">
                        {resultText(result)}
                      </span>
                    ) : (
                      <span className="muted">Pendiente</span>
                    )}
                  </td>

                  <td>
                    {hasPrediction ? (
                      <span className="predictionResultBadge">
                        {resultText(prediction)}
                      </span>
                    ) : (
                      <span className="muted">Sin pronóstico</span>
                    )}
                  </td>

                  <td>
                    {!hasResult ? (
                      <span className="muted">Pendiente</span>
                    ) : !hasPrediction ? (
                      <span className="exactIcon exactIconEmpty" title="Sin pronóstico">—</span>
                    ) : exact ? (
                      <span className="exactIcon exactIconOk" title="Resultado exacto acertado">✅ +1</span>
                    ) : (
                      <span className="exactIcon exactIconKo" title="No acertado">❌</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GroupStandingsPanel({ title, description, fixtures, groups, scores, emptyMessage }) {
  const groupTables = useMemo(() => buildGroupTables(fixtures, groups, scores), [fixtures, groups, scores]);
  const completed = countCompletedScores(scores);

  return (
    <section className="panel">
      <div className="toolbar">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
          <p className="muted small">Partidos con marcador: {completed}/{fixtures.length}</p>
        </div>
      </div>

      {completed === 0 && <div className="notice softNotice">{emptyMessage}</div>}

      <div className="standingsGrid">
        {Object.entries(groupTables).map(([group, rows]) => (
          <section className="standingCard" key={group}>
            <div className="standingHeader">
              <p className="eyebrow">Grupo {group}</p>
              <span className="qualificationHint">1º y 2º avanzan · 3º pendiente de ranking</span>
            </div>
            <StandingsTable rows={rows} />
          </section>
        ))}
      </div>
    </section>
  );
}

function StandingsTable({ rows }) {
  return (
    <div className="tableWrap standingsTableWrap">
      <table className="standingsTable">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Equipo</th>
            <th>Pts</th>
            <th>PJ</th>
            <th>DG</th>
            <th>GF</th>
            <th>GC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.team} className={index < 2 ? 'qualifiedRow' : index === 2 ? 'thirdRow' : ''}>
              <td>{index + 1}</td>
              <td>
                <span className="standingTeam">
                  <TeamFlag team={row.team} />
                  <span>{row.team}</span>
                </span>
              </td>
              <td><strong>{row.points}</strong></td>
              <td>{row.played}</td>
              <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
              <td>{row.goalsFor}</td>
              <td>{row.goalsAgainst}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PredictionStandingsPreview({ fixtures, groups, scores, groupFilter }) {
  const groupTables = useMemo(() => buildGroupTables(fixtures, groups, scores), [fixtures, groups, scores]);
  const completed = countCompletedScores(scores);
  const visibleGroups = Object.entries(groupTables)
    .filter(([group]) => groupFilter === 'TODOS' || group === groupFilter);

  return (
    <section className="predictionStandingsPreview">
      <div className="previewHeading">
        <div>
          <h3>Así quedan los grupos con tus pronósticos</h3>
          <p className="muted small">Se actualiza mientras completas marcadores. Guarda tus pronósticos para que quede registrado en la porra.</p>
        </div>
        <span className="pill">{completed}/{fixtures.length} partidos</span>
      </div>

      {completed === 0 && (
        <div className="notice softNotice">
          Rellena algún marcador para ver cómo se ordena cada grupo.
        </div>
      )}

      <div className="standingsGrid compactStandingsGrid">
        {visibleGroups.map(([group, rows]) => (
          <section className="standingCard compactStandingCard" key={group}>
            <div className="standingHeader">
              <p className="eyebrow">Grupo {group}</p>
              <span className="qualificationHint">1º y 2º avanzan · 3º depende del ranking</span>
            </div>
            <StandingsTable rows={rows} />
          </section>
        ))}
      </div>
    </section>
  );
}

function MyKnockoutPanel({ fixtures, groups, predictions, fixtureCount }) {
  const groupTables = useMemo(() => buildGroupTables(fixtures, groups, predictions), [fixtures, groups, predictions]);
  const qualifiedData = useMemo(() => getQualifiedTeams(groupTables), [groupTables]);
  const completed = countCompletedScores(predictions);
  const isComplete = completed === fixtureCount;

  return (
    <section className="panel myBracketPanel">
      <div className="toolbar">
        <div>
          <h2>Mi eliminatoria proyectada</h2>
          <p className="muted">Clasificados y cuadro calculados con tus marcadores de fase de grupos.</p>
          <p className="muted small">Pronósticos completos: {completed}/{fixtureCount}</p>
        </div>
      </div>

      <div className="notice bracketWarning">
        Aviso: este cuadro no es oficial. Es una proyección privada basada en tus pronósticos y puede cambiar hasta que se disputen y carguen todos los partidos de la fase de grupos.
      </div>

      {!isComplete && (
        <div className="notice softNotice">
          Todavía te faltan {fixtureCount - completed} partidos por pronosticar. El cuadro usará tus clasificados provisionales hasta que completes todos los marcadores.
        </div>
      )}

      <div className="bracketSummary">
        <section className="standingCard qualifiedCardWide">
          <div className="standingHeader">
            <p className="eyebrow">Clasificados por tu porra</p>
            <span className="qualificationHint">Primeros, segundos, mejores terceros y terceros eliminados</span>
          </div>
          <div className="qualifiedLists">
            <QualifiedList title="Primeros" teams={qualifiedData.winners} />
            <QualifiedList title="Segundos" teams={qualifiedData.runners} />
            <QualifiedList title="Mejores terceros clasificados" teams={qualifiedData.thirds} />
            <QualifiedList
              title="Terceros eliminados"
              teams={qualifiedData.eliminatedThirds || []}
              emptyMessage="Aún no hay terceros eliminados."
              variant="eliminated"
            />
          </div>
        </section>
      </div>

      <ProjectedOfficialBracketBoard qualifiedData={qualifiedData} />
    </section>
  );
}


function MobileProjectedBracket({ qualifiedData }) {
  const projectedBracket = useMemo(() => buildProjectedOfficialBracket(qualifiedData), [qualifiedData]);
  const roundOf32 = [
    ...(projectedBracket.left?.[0]?.matches || []),
    ...(projectedBracket.right?.[3]?.matches || [])
  ];
  const roundOf16 = [
    ...(projectedBracket.left?.[1]?.matches || []),
    ...(projectedBracket.right?.[2]?.matches || [])
  ];
  const visibleRoundOf32 = roundOf32.slice(0, 6);
  const visibleRoundOf16 = roundOf16.slice(0, 3);

  return (
    <section className="mobileBracketCard" aria-label="Cuadro de eliminatorias móvil">
      <div className="mobileBracketHero">
        <div className="mobileBracketIcon">⇄</div>
        <div>
          <h3>Cruces generados según tu fase de grupos</h3>
          <p>Los equipos salen de tus pronósticos. El cuadro usa los cruces oficiales por posición.</p>
        </div>
      </div>

      <div className="mobilePhaseTabs" aria-label="Fases del cuadro">
        <button type="button" className="active">Dieciseisavos</button>
        <button type="button">Octavos</button>
        <button type="button">Cuartos</button>
        <button type="button">Final</button>
      </div>

      <div className="mobileBracketGrid">
        <div className="mobileBracketRound">
          <h4>Dieciseisavos · Ronda de 32</h4>
          {visibleRoundOf32.map((match) => (
            <article className="mobileBracketMatch" key={match.id}>
              <div className="mobileBracketMatchId">{match.id}</div>
              <MobileBracketTeam seed={match.label} team={match.labelTeam} />
              <MobileBracketTeam seed={match.other} team={match.otherTeam} />
            </article>
          ))}
        </div>

        <div className="mobileBracketRound mobileBracketRoundNext">
          <h4>Octavos</h4>
          {visibleRoundOf16.map((match) => (
            <article className="mobileBracketPlaceholder" key={match.id}>
              <span className="trophyIcon">🏆</span>
              <div><strong>{match.id}</strong><br />{match.label}</div>
              <div>{match.other}</div>
            </article>
          ))}
        </div>
      </div>

      <div className="mobileInfoNote">ℹ️ En móvil se muestra una vista compacta. Desliza el cuadro completo en escritorio o tablet para ver todos los cruces.</div>
    </section>
  );
}

function MobileBracketTeam({ seed, team }) {
  return (
    <div className="mobileBracketTeam">
      <span className="seedBadge">{seed}</span>
      {team ? <TeamFlag team={team.team} /> : <span className="flagFallback" aria-hidden="true">?</span>}
      <strong>{team ? team.team : 'Pendiente'}</strong>
    </div>
  );
}

function ProjectedOfficialBracketBoard({ qualifiedData }) {
  const projectedBracket = useMemo(() => buildProjectedOfficialBracket(qualifiedData), [qualifiedData]);

  return (
    <div className="fullBracketScrollWrap projectedBracketWrap">
      <div className="fullBracketBoard projectedFullBracketBoard">
        <div className="fullBracketHeader">
          <span>Dieciseisavos</span>
          <span>Octavos</span>
          <span>Cuartos</span>
          <span>Semis</span>
          <strong>Final</strong>
          <span>Semis</span>
          <span>Cuartos</span>
          <span>Octavos</span>
          <span>Dieciseisavos</span>
        </div>
        <div className="fullBracketGrid">
          <BracketColumn columns={projectedBracket.left} side="left" />
          <div className="finalColumn">
            <div className="tournamentLogoMini">🏆</div>
            <p className="eyebrow">Final</p>
            <OfficialBracketBox match={OFFICIAL_KNOCKOUT_BRACKET.final} />
            <p className="championLabel">Campeón</p>
            <div className="championPlaceholder">Pendiente</div>
            <p className="eyebrow thirdPlaceTitle">Tercer puesto</p>
            <OfficialBracketBox match={OFFICIAL_KNOCKOUT_BRACKET.thirdPlace} />
          </div>
          <BracketColumn columns={projectedBracket.right} side="right" />
        </div>
      </div>
    </div>
  );
}

function QualifiedList({ title, teams, emptyMessage = 'Pendiente', variant = '' }) {
  const safeTeams = teams || [];

  return (
    <div className={`qualifiedList ${variant ? `qualifiedList-${variant}` : ''}`}>
      <h3>{title}</h3>
      {safeTeams.length === 0 ? (
        <div className="qualifiedItem qualifiedItemEmpty">
          <span className="seedBadge">—</span>
          <span>{emptyMessage}</span>
        </div>
      ) : (
        safeTeams.map((team) => (
          <div className={`qualifiedItem ${variant === 'eliminated' ? 'qualifiedItemEliminated' : ''}`} key={`${team.seed}-${team.team}`}>
            <span className="seedBadge">{team.seed}</span>
            <TeamFlag team={team.team} />
            <span>{team.team}</span>
          </div>
        ))
      )}
    </div>
  );
}

function BracketMatch({ pairing }) {
  return (
    <article className="bracketMatch officialBracketMatch">
      <div className="officialMatchMeta">
        <span>{pairing.id}</span>
        <span>{pairing.date}</span>
        <span>{pairing.time}</span>
      </div>
      <BracketTeam team={pairing.home} seed={pairing.homeSeed} />
      <div className="bracketLine" aria-hidden="true" />
      <BracketTeam team={pairing.away} seed={pairing.awaySeed} />
    </article>
  );
}

function BracketTeam({ team, seed }) {
  const isPlaceholder = !team || team.isPlaceholder;

  return (
    <div className={isPlaceholder ? 'bracketTeam pendingTeam' : 'bracketTeam'}>
      <span className="seedBadge">{seed}</span>
      {team && !team.isPlaceholder ? (
        <TeamFlag team={team.team} />
      ) : (
        <span className="flagFallback" aria-hidden="true">?</span>
      )}
      <span>{team ? team.team : 'Pendiente'}</span>
    </div>
  );
}

function Leaderboard({ data, onRefresh }) {
  const rows = data?.rows || [];
  const confirmedRows = rows.filter((row) => row.paymentConfirmed);
  const pendingRows = rows.filter((row) => !row.paymentConfirmed);
  const confirmedPlayerCount = data?.confirmedPlayerCount ?? confirmedRows.length;
  const playerCount = data?.playerCount || rows.length;
  const entryFee = data?.entryFee || 5;
  const prizePool = data?.prizePool ?? confirmedPlayerCount * entryFee;
  const prizes = data?.prizes || {
    first: Math.round(prizePool * 0.5 * 100) / 100,
    second: Math.round(prizePool * 0.3 * 100) / 100,
    third: Math.round(prizePool * 0.2 * 100) / 100
  };
  const medals = ['🏆', '🥈', '🥉'];

  function euro(value) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
  }

  function prizeForRank(rank, row) {
    if (!row?.paymentConfirmed) return 0;
    if (rank === 1) return prizes.first;
    if (rank === 2) return prizes.second;
    if (rank === 3) return prizes.third;
    return 0;
  }

  return (
    <section className="panel leaderboardPanel mobileCardPanel">
      <div className="mobileSectionPill">🏆 Clasificación general</div>

      <div className="leaderboardSummaryCard">
        <div>
          <span className="summaryLabel">Participantes confirmados</span>
          <strong>{confirmedPlayerCount}/{playerCount}</strong>
        </div>
        <div>
          <span className="summaryLabel">Bote actual</span>
          <strong>{euro(prizePool)}</strong>
        </div>
        <button className="secondary" onClick={onRefresh}>Actualizar</button>
      </div>

      <div className="prizeCards" aria-label="Reparto de premios">
        <article className="prizeCard prizeGold">
          <span>1º</span>
          <strong>{euro(prizes.first)}</strong>
          <small>50% del bote confirmado</small>
        </article>
        <article className="prizeCard prizeSilver">
          <span>2º</span>
          <strong>{euro(prizes.second)}</strong>
          <small>30% del bote confirmado</small>
        </article>
        <article className="prizeCard prizeBronze">
          <span>3º</span>
          <strong>{euro(prizes.third)}</strong>
          <small>20% del bote confirmado</small>
        </article>
      </div>

      <p className="muted small leaderboardMeta">
        Resultados reales cargados: {data?.resultCount || 0}/{data?.fixtureCount || 72}. Entrada: {euro(entryFee)} por jugador. Los usuarios pendientes de Bizum aparecen en gris y no suman al bote.
      </p>

      {rows.length === 0 ? (
        <div className="notice softNotice">Todavía no hay jugadores con pronósticos.</div>
      ) : (
        <>
          <div className="mobileRankingList" aria-label="Clasificación de la porra">
            {rows.map((row, index) => {
              const rank = index + 1;
              const prize = prizeForRank(rank, row);
              return (
                <article key={row.playerId} className={`rankingRowCard ${!row.paymentConfirmed ? 'rankingPendingPayment' : ''} ${rank <= 3 && row.paymentConfirmed ? `rankingTop rankingTop${rank}` : ''}`}>
                  <div className="rankingPosition">{row.paymentConfirmed ? `${rank}º` : '—'}</div>
                  <div className="rankingMedal">{rank <= 3 && row.paymentConfirmed ? medals[index] : '⚠️'}</div>
                  <PlayerAvatar player={row} size="md" />
                  <div className="rankingPlayerInfo">
                    <strong>{row.name}</strong>
                    <span>{row.groupWinnersCorrect || 0} primeros · {row.groupRunnersCorrect || 0} segundos · {row.thirdsCorrect || 0} terceros</span>
                    {!row.paymentConfirmed && <em className="pendingPaymentText">Pendiente confirmar Bizum</em>}
                  </div>
                  <div className="rankingPoints">
                    <strong>{row.points}</strong>
                    <span>pts</span>
                    {prize > 0 && <small>{euro(prize)}</small>}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="tableWrap leaderboardTableWrap desktopOnlyTable">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th>Bizum</th>
                  <th>Puntos</th>
                  <th>Premio</th>
                  <th>1º grupo</th>
                  <th>2º grupo</th>
                  <th>3º grupo</th>
                  <th title="Partidos con resultado (1, X o 2) acertado">Signos (1/X/2)</th>
                  <th>Exactos</th>
                  <th>DG</th>
                  <th>Pronósticos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.playerId} className={!row.paymentConfirmed ? 'rankingPendingPaymentRow' : ''}>
                    <td>{row.paymentConfirmed ? index + 1 : '—'}</td>
                    <td>
                      <span className="leaderboardPlayer">
                        <PlayerAvatar player={row} size="sm" />
                        <span>{row.name}</span>
                      </span>
                    </td>
                    <td>{row.paymentConfirmed ? 'Confirmado' : '⚠️ Pendiente Bizum'}</td>
                    <td><strong>{row.points}</strong></td>
                    <td>{prizeForRank(index + 1, row) ? euro(prizeForRank(index + 1, row)) : '—'}</td>
                    <td>{row.groupWinnersCorrect || 0}</td>
                    <td>{row.groupRunnersCorrect || 0}</td>
                    <td>{row.thirdsCorrect || 0}</td>
                    <td>{row.correctOutcomes || 0}</td>
                    <td>{row.exactScores || 0}</td>
                    <td>{row.exactGoalDifferences || 0}</td>
                    <td>{row.predictionsMade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="notice softNotice rankingInfo">
            Bote actual: {euro(prizePool)} calculado con {confirmedPlayerCount} pagos confirmados de {euro(entryFee)}. Pendientes de Bizum: {pendingRows.length}.
          </div>
        </>
      )}
    </section>
  );
}

function AdminPanel({ fixtures, groups, initialResults, knockoutFixtures = [], initialKnockoutResults, locked, knockoutLocked, onStatus, onSaved }) {
  const [adminCode, setAdminCode] = useState(localStorage.getItem(STORAGE_ADMIN) || '');
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(initialResults || {});
  const [knockoutResults, setKnockoutResults] = useState(initialKnockoutResults || {});
  const [paymentRows, setPaymentRows] = useState([]);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [paymentsBusy, setPaymentsBusy] = useState(false);

  useEffect(() => {
    setResults(initialResults || {});
  }, [initialResults]);

  useEffect(() => {
    setKnockoutResults(initialKnockoutResults || {});
  }, [initialKnockoutResults]);

  const knockoutBracket = useMemo(
    () => resolveBracket(knockoutFixtures, knockoutResults, buildGroupTables(fixtures, groups, results)),
    [knockoutFixtures, knockoutResults, fixtures, groups, results]
  );

  const knockoutByRound = useMemo(() => {
    const map = {};
    for (const fixture of knockoutFixtures) {
      (map[fixture.round] ||= []).push(fixture);
    }
    return map;
  }, [knockoutFixtures]);

  async function unlockAdmin(event) {
    if (event) {
      event.preventDefault();
    }

    setBusy(true);
    onStatus('');

    try {
      localStorage.setItem(STORAGE_ADMIN, adminCode);

      await apiFetch('/api/settings', {
        method: 'POST',
        adminCode,
        body: {
          action: 'verify'
        }
      });

      setAdminUnlocked(true);
      onStatus('Panel admin desbloqueado.');
    } catch (error) {
      setAdminUnlocked(false);
      onStatus(error.message || 'Código admin incorrecto.');
    } finally {
      setBusy(false);
    }
  }
  function PlayerDetailModal({ player, matchDetails, onClose }) {
    const matches = matchDetails.filter(m => m.hasResult);
    return (
      <dialog open className="playerModal">
        <h3>{player.name}</h3>
        <table>
          <thead><tr><th>Partido</th><th>Pronóstico</th><th>Real</th><th>Pts</th></tr></thead>
          <tbody>
            {matches.map(m => {
              const pred = m.predictions.find(p => p.playerId === player.playerId);
              return (
                <tr key={m.id}>
                  <td>{m.home} - {m.away}</td>
                  <td>{pred?.hasPrediction ? `${pred.prediction.homeGoals}-${pred.prediction.awayGoals}` : '—'}</td>
                  <td>{m.result.homeGoals}-{m.result.awayGoals}</td>
                  <td>{pred?.matchPoints || 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button onClick={onClose}>Cerrar</button>
      </dialog>
    );
  }
  function lockAdmin() {
    setAdminUnlocked(false);
    setAdminCode('');
    setPaymentRows([]);
    setPaymentsLoaded(false);
    localStorage.removeItem(STORAGE_ADMIN);
    onStatus('');
  }

  function updateResult(matchId, field, value) {
    const clean = value === '' ? '' : Math.max(0, Math.min(99, Number(value)));
    setResults((current) => ({
      ...current,
      [matchId]: {
        homeGoals: current[matchId]?.homeGoals ?? '',
        awayGoals: current[matchId]?.awayGoals ?? '',
        ...current[matchId],
        [field]: clean
      }
    }));
  }

  async function saveResults() {
    setBusy(true);
    onStatus('');
    try {
      localStorage.setItem(STORAGE_ADMIN, adminCode);
      const payload = normalizeForSave(results);
      const data = await apiFetch('/api/results', {
        method: 'POST',
        adminCode,
        body: { results: payload }
      });
      onStatus(`Resultados guardados: ${data.completeCount}/${fixtures.length}.`);
      await onSaved();
    } catch (error) {
      onStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function setLocked(nextLocked) {
    setBusy(true);
    onStatus('');
    try {
      localStorage.setItem(STORAGE_ADMIN, adminCode);
      await apiFetch('/api/settings', {
        method: 'POST',
        adminCode,
        body: { locked: nextLocked }
      });
      onStatus(nextLocked ? 'Porra cerrada.' : 'Porra abierta.');
      await onSaved();
    } catch (error) {
      onStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  function updateKnockoutResult(matchId, field, value) {
    const clean = value === '' ? '' : Math.max(0, Math.min(99, Number(value)));
    setKnockoutResults((current) => ({
      ...current,
      [matchId]: {
        homeGoals: current[matchId]?.homeGoals ?? '',
        awayGoals: current[matchId]?.awayGoals ?? '',
        ...current[matchId],
        [field]: clean
      }
    }));
  }

  function setKnockoutResultAdvance(matchId, advance) {
    setKnockoutResults((current) => ({
      ...current,
      [matchId]: {
        homeGoals: current[matchId]?.homeGoals ?? '',
        awayGoals: current[matchId]?.awayGoals ?? '',
        ...current[matchId],
        advance
      }
    }));
  }

  async function saveKnockoutResults() {
    setBusy(true);
    onStatus('');
    try {
      localStorage.setItem(STORAGE_ADMIN, adminCode);
      const payload = normalizeKnockoutForSave(knockoutResults);
      const data = await apiFetch('/api/results', {
        method: 'POST',
        adminCode,
        body: { phase: 'knockout', results: payload }
      });
      onStatus(`Resultados de eliminatoria guardados: ${data.completeCount}/${knockoutFixtures.length} cruces.`);
      await onSaved();
    } catch (error) {
      onStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function setKnockoutLocked(nextLocked) {
    setBusy(true);
    onStatus('');
    try {
      localStorage.setItem(STORAGE_ADMIN, adminCode);
      await apiFetch('/api/settings', {
        method: 'POST',
        adminCode,
        body: { knockoutLocked: nextLocked }
      });
      onStatus(nextLocked ? 'Eliminatoria cerrada.' : 'Eliminatoria abierta.');
      await onSaved();
    } catch (error) {
      onStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadPayments() {
    setPaymentsBusy(true);
    onStatus('');
    try {
      localStorage.setItem(STORAGE_ADMIN, adminCode);
      const data = await apiFetch('/api/settings', {
        method: 'POST',
        adminCode,
        body: {
          action: 'listPayments'
        }
      });
      setPaymentRows(data.players || []);
      setPaymentsLoaded(true);
      onStatus(`Pagos cargados: ${data.confirmedCount}/${data.playerCount} confirmados. Bote: ${data.prizePool} €.`);
    } catch (error) {
      onStatus(error.message);
    } finally {
      setPaymentsBusy(false);
    }
  }

  async function updatePayment(playerId, confirmed) {
    setPaymentsBusy(true);
    onStatus('');
    try {
      localStorage.setItem(STORAGE_ADMIN, adminCode);
      const data = await apiFetch('/api/settings', {
        method: 'POST',
        adminCode,
        body: {
          action: 'updatePayment',
          playerId,
          paymentStatus: confirmed ? 'confirmed' : 'pending'
        }
      });
      setPaymentRows(data.players || []);
      setPaymentsLoaded(true);
      onStatus(confirmed ? 'Bizum confirmado. El jugador ya cuenta para el bote.' : 'Jugador marcado como pendiente de Bizum.');
      await onSaved();
    } catch (error) {
      onStatus(error.message);
    } finally {
      setPaymentsBusy(false);
    }
  }

  function euro(value) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
  }

  const confirmedCount = paymentRows.filter((row) => row.paymentConfirmed).length;
  const prizePool = confirmedCount * 5;

  if (!adminUnlocked) {
    return (
      <section className="panel adminGatePanel">
        <form className="adminGateCard" onSubmit={unlockAdmin}>
          <div className="adminGateIcon" aria-hidden="true">🔐</div>
          <p className="eyebrow">Zona privada</p>
          <h2>Acceso admin</h2>
          <p className="muted">
            Introduce el código de administrador para ver la gestión de resultados,
            pagos y cierre de porra.
          </p>

          <label>
            Código admin
            <input
              value={adminCode}
              onChange={(event) => setAdminCode(event.target.value)}
              type="password"
              placeholder="Introduce tu ADMIN_CODE"
              autoComplete="off"
              autoFocus
            />
          </label>

          <button type="submit" disabled={busy || !adminCode.trim()}>
            {busy ? 'Comprobando...' : 'Entrar al panel admin'}
          </button>

          <p className="muted small">
            Si no tienes el código, no podrás ver ni modificar ninguna información de administración.
          </p>
        </form>
      </section>
    );
  }

  return (
    <section className="panel adminPanelUnlocked">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Panel privado</p>
          <h2>Admin</h2>
          <p className="muted">Usa esta zona para cerrar la porra, cargar resultados reales y confirmar pagos por Bizum.</p>
        </div>
        <div className="adminSessionBox">
          <span className="paymentBadge confirmed">Admin verificado</span>
          <button className="secondary" type="button" onClick={lockAdmin}>Bloquear panel</button>
        </div>
      </div>

      <div className="adminActions">
        <button className="secondary" onClick={() => setLocked(true)} disabled={busy || locked}>Cerrar porra grupos</button>
        <button className="secondary" onClick={() => setLocked(false)} disabled={busy || !locked}>Reabrir porra grupos</button>
        <span className={locked ? 'locked pill' : 'pill'}>Grupos: {locked ? 'Cerrada' : 'Abierta'}</span>
      </div>

      <div className="adminActions">
        <button className="secondary" onClick={() => setKnockoutLocked(false)} disabled={busy || !knockoutLocked}>Abrir eliminatoria</button>
        <button className="secondary" onClick={() => setKnockoutLocked(true)} disabled={busy || knockoutLocked}>Cerrar eliminatoria</button>
        <span className={knockoutLocked ? 'locked pill' : 'pill'}>Eliminatoria: {knockoutLocked ? 'Cerrada' : 'Abierta'}</span>
      </div>

      <section className="adminPaymentPanel">
        <div className="paymentPanelHeader">
          <div>
            <h3>Confirmación de Bizum</h3>
            <p className="muted small">Marca quién ha pagado los 5 €. Solo los confirmados cuentan para el bote y aparecen activos en la clasificación.</p>
          </div>
          <button className="secondary" type="button" onClick={loadPayments} disabled={paymentsBusy || !adminCode}>
            {paymentsBusy ? 'Cargando...' : paymentsLoaded ? 'Actualizar pagos' : 'Cargar jugadores'}
          </button>
        </div>

        {paymentsLoaded && (
          <>
            <div className="paymentSummaryCards">
              <article>
                <span>Confirmados</span>
                <strong>{confirmedCount}/{paymentRows.length}</strong>
              </article>
              <article>
                <span>Bote actual</span>
                <strong>{euro(prizePool)}</strong>
              </article>
              <article>
                <span>Premios</span>
                <strong>{euro(prizePool * 0.5)} · {euro(prizePool * 0.3)} · {euro(prizePool * 0.2)}</strong>
              </article>
            </div>

            <div className="paymentList">
              {paymentRows.map((row) => (
                <article key={row.playerId} className={`paymentRow ${!row.paymentConfirmed ? 'paymentPending' : ''}`}>
                  <PlayerAvatar player={row} size="sm" />
                  <div className="paymentPlayerInfo">
                    <strong>{row.name}</strong>
                    <span>{row.phone || 'Sin teléfono registrado'}</span>
                    {!row.paymentConfirmed && <em>⚠️ Pendiente confirmar Bizum</em>}
                  </div>
                  <div className="paymentActions">
                    <span className={row.paymentConfirmed ? 'paymentBadge confirmed' : 'paymentBadge pending'}>
                      {row.paymentConfirmed ? 'Confirmado' : 'Pendiente'}
                    </span>
                    {row.paymentConfirmed ? (
                      <button className="secondary" type="button" onClick={() => updatePayment(row.playerId, false)} disabled={paymentsBusy}>Marcar pendiente</button>
                    ) : (
                      <button type="button" onClick={() => updatePayment(row.playerId, true)} disabled={paymentsBusy}>Confirmar Bizum</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <FixtureList fixtures={fixtures} scores={results} results={{}} groups={groups} onChange={updateResult} disabled={false} />

      <div className="stickyActions">
        <button onClick={saveResults} disabled={busy}>{busy ? 'Guardando...' : 'Guardar resultados reales'}</button>
      </div>

      {knockoutFixtures.length > 0 && (
        <section className="adminKnockoutPanel">
          <h3>Resultados de eliminatoria</h3>
          <p className="muted small">Mete el marcador previo a penaltis de cada cruce. Si hay empate, elige qué equipo pasa en penaltis. Los equipos se calculan con los resultados reales de grupos y los ganadores de cruces anteriores.</p>

          {ROUND_ORDER.filter((round) => knockoutByRound[round]?.length).map((round) => (
            <div className="knockoutRoundBlock" key={round}>
              <h4>{ROUND_LABELS[round]}</h4>
              <div className="knockoutCaptureGrid">
                {knockoutByRound[round].map((fixture) => (
                  <KnockoutMatchCard
                    key={fixture.id}
                    fixture={fixture}
                    teams={knockoutBracket[fixture.id]}
                    pick={knockoutResults[fixture.id]}
                    disabled={false}
                    onScore={updateKnockoutResult}
                    onAdvance={setKnockoutResultAdvance}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="stickyActions">
            <button onClick={saveKnockoutResults} disabled={busy}>{busy ? 'Guardando...' : 'Guardar resultados de eliminatoria'}</button>
          </div>
        </section>
      )}
    </section>
  );
}
