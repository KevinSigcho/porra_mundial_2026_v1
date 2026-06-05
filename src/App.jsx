import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from './api.js';

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

  return {
    winners,
    runners,
    thirds: thirds.slice(0, 8),
    allThirds: thirds,
    qualified: [...winners, ...runners, ...thirds.slice(0, 8)]
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

export default function App() {
  const [fixtureData, setFixtureData] = useState(null);
  const [token, setToken] = useState(localStorage.getItem(STORAGE_TOKEN) || '');
  const [player, setPlayer] = useState(readStoredPlayer());
  const [tab, setTab] = useState('predictions');
  const [predictions, setPredictions] = useState({});
  const [results, setResults] = useState({});
  const [leaderboard, setLeaderboard] = useState(null);
  const [settings, setSettings] = useState({ locked: false, scoring: null });
  const [groupFilter, setGroupFilter] = useState('A');
  const [status, setStatus] = useState('');
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
      setResults(resultData.results || {});
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
          <p className="eyebrow">Porra 2026</p>
          <h1>Mundial 2026: fase de grupos</h1>
          <p>Pronostica el marcador de los {fixtures.length} partidos de grupos. Juega como <strong>{player.name}</strong>.</p>
        </div>
        <button className="secondary" onClick={logout}>Salir</button>
      </header>

      {status && <div className="notice">{status}</div>}

      <nav className="tabs" aria-label="Secciones">
        <button className={tab === 'predictions' ? 'active' : ''} onClick={() => setTab('predictions')}>Mis pronósticos</button>
        <button className={tab === 'liveGroups' ? 'active' : ''} onClick={() => { setTab('liveGroups'); refreshPrivateData(); }}>Grupos actualizados</button>
        <button className={tab === 'myBracket' ? 'active' : ''} onClick={() => { setTab('myBracket'); refreshPrivateData(); }}>Mi eliminatoria</button>
        <button className={tab === 'leaderboard' ? 'active' : ''} onClick={() => { setTab('leaderboard'); refreshPrivateData(); }}>Clasificación porra</button>
        <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>Admin</button>
      </nav>

      {tab === 'predictions' && (
        <section className="panel predictionsPanel">
          <div className="toolbar predictionsTopBar">
            <div>
              <h2>Mis pronósticos</h2>
              <p className="muted">Puntuación: {fixtureData.rules.description}</p>
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

          <PredictionStandingsPreview
            fixtures={fixtures}
            groups={groups}
            scores={predictions}
            groupFilter={activeGroup}
          />

          <FixtureList
            fixtures={filteredFixtures}
            scores={predictions}
            results={results}
            groups={groups}
            onChange={(matchId, field, value) => updateScore(setPredictions, matchId, field, value)}
            disabled={settings.locked}
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

      {tab === 'myBracket' && (
        <MyKnockoutPanel
          fixtures={fixtures}
          groups={groups}
          predictions={predictions}
          fixtureCount={fixtures.length}
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
          locked={settings.locked}
          onStatus={setStatus}
          onSaved={async () => {
            await refreshPrivateData();
            setTab('leaderboard');
          }}
        />
      )}
    </main>
  );
}

function Hero({ fixtureCount }) {
  return (
    <header className="loginHero">
      <div className="tournamentBadge">
        <span className="badgeBall">⚽</span>
        <span>FIFA World Cup 2026</span>
      </div>
      <h1>Porra Mundial 2026</h1>
      <p>Inicia sesión si ya tienes cuenta o regístrate con el código de invitación. Pronostica los {fixtureCount} partidos y compite con tus amigos.</p>
    </header>
  );
}

function LoginForm({ onLoggedIn }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [avatarId, setAvatarId] = useState('football-1');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    if (nextMode === 'login') {
      setJoinCode('');
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
              <label>
                Código de invitación
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
        <span>{formatDate(fixture.date)}</span>
        <span>{fixture.venue}</span>
      </div>
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
  const pairings = useMemo(() => makeKnockoutPairings(qualifiedData), [qualifiedData]);
  const completed = countCompletedScores(predictions);
  const isComplete = completed === fixtureCount;

  return (
    <section className="panel">
      <div className="toolbar">
        <div>
          <h2>Mi eliminatoria proyectada</h2>
          <p className="muted">Cuadro calculado con tus marcadores de fase de grupos. Si aciertas todo, esta sería tu foto estimada de clasificados.</p>
          <p className="muted small">Pronósticos completos: {completed}/{fixtureCount}</p>
        </div>
      </div>

      <div className="notice bracketWarning">
        Aviso: este cuadro no es oficial. Es una proyección privada basada en tus pronósticos y puede cambiar hasta que se disputen y carguen todos los partidos de la fase de grupos. Los cruces son orientativos para visualizar la porra.
      </div>

      {!isComplete && (
        <div className="notice softNotice">
          Todavía te faltan {fixtureCount - completed} partidos por pronosticar. El cuadro se irá rellenando mejor cuando completes todos los marcadores.
        </div>
      )}

      <div className="bracketSummary">
        <section className="standingCard">
          <div className="standingHeader">
            <p className="eyebrow">Clasificados por tu porra</p>
            <span className="qualificationHint">Primeros, segundos y mejores terceros</span>
          </div>
          <div className="qualifiedLists">
            <QualifiedList title="Primeros" teams={qualifiedData.winners} />
            <QualifiedList title="Segundos" teams={qualifiedData.runners} />
            <QualifiedList title="Mejores terceros" teams={qualifiedData.thirds} />
          </div>
        </section>
      </div>

      <div className="bracketBoard">
        <div className="bracketTitle">Cuadro oficial · Ronda de 32</div>
        <div className="officialBracketNotice">
          Cruces oficiales por posición de grupo. Los equipos mostrados salen de tus pronósticos, por eso siguen siendo una proyección hasta que termine la fase de grupos.
        </div>

        <div className="bracketColumns officialBracketColumns">
          <div className="bracketSide">
            {pairings
              .filter((pairing) => pairing.side === 'left')
              .map((pairing) => <BracketMatch key={pairing.id} pairing={pairing} />)}
          </div>
          <div className="bracketCenter">
            <span>Camino a la final</span>
            <small>Los ganadores avanzarán a octavos, cuartos, semifinales y final.</small>
          </div>
          <div className="bracketSide">
            {pairings
              .filter((pairing) => pairing.side === 'right')
              .map((pairing) => <BracketMatch key={pairing.id} pairing={pairing} />)}
          </div>
        </div>
      </div>

      <GroupStandingsPanel
        title="Tablas según tus pronósticos"
        description="Orden provisional de cada grupo si tus resultados fueran correctos."
        fixtures={fixtures}
        groups={groups}
        scores={predictions}
        emptyMessage="Todavía no hay pronósticos para calcular las tablas."
      />
    </section>
  );
}

function QualifiedList({ title, teams }) {
  return (
    <div className="qualifiedList">
      <h3>{title}</h3>
      {teams.map((team) => (
        <div className="qualifiedItem" key={`${team.seed}-${team.team}`}>
          <span className="seedBadge">{team.seed}</span>
          <TeamFlag team={team.team} />
          <span>{team.team}</span>
        </div>
      ))}
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
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const podiumOrder = [1, 0, 2].filter((index) => podium[index]);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <section className="panel leaderboardPanel">
      <div className="toolbar">
        <div>
          <h2>Clasificación porra</h2>
          <p className="muted">Resultados reales cargados: {data?.resultCount || 0}/{data?.fixtureCount || 72}</p>
        </div>
        <button className="secondary" onClick={onRefresh}>Actualizar</button>
      </div>

      {rows.length === 0 ? (
        <div className="notice softNotice">Todavía no hay jugadores con pronósticos.</div>
      ) : (
        <>
          <div className="podium" aria-label="Podio de la porra">
            {podiumOrder.map((podiumIndex) => {
              const row = podium[podiumIndex];
              const rank = podiumIndex + 1;
              return (
                <article key={row.playerId} className={`podiumCard podiumRank${rank}`}>
                  <div className="podiumMedal">{medals[podiumIndex]}</div>
                  <PlayerAvatar player={row} size="xl" rank={rank} />
                  <h3>{row.name}</h3>
                  <p className="podiumPoints">{row.points} pts</p>
                  <div className="podiumStats">
                    <span>{row.exactScores} exactos</span>
                    <span>{row.correctOutcomes} signos</span>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="tableWrap leaderboardTableWrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th>Puntos</th>
                  <th>Exactos</th>
                  <th>Signos</th>
                  <th>Pronósticos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.playerId}>
                    <td>{index + 1}</td>
                    <td>
                      <span className="leaderboardPlayer">
                        <PlayerAvatar player={row} size="sm" />
                        <span>{row.name}</span>
                      </span>
                    </td>
                    <td><strong>{row.points}</strong></td>
                    <td>{row.exactScores}</td>
                    <td>{row.correctOutcomes}</td>
                    <td>{row.predictionsMade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function AdminPanel({ fixtures, groups, initialResults, locked, onStatus, onSaved }) {
  const [adminCode, setAdminCode] = useState(localStorage.getItem(STORAGE_ADMIN) || '');
  const [results, setResults] = useState(initialResults || {});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setResults(initialResults || {});
  }, [initialResults]);

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

  return (
    <section className="panel">
      <div className="toolbar">
        <div>
          <h2>Admin</h2>
          <p className="muted">Usa esta zona para cerrar la porra y cargar resultados reales.</p>
        </div>
        <label>
          Código admin
          <input value={adminCode} onChange={(event) => setAdminCode(event.target.value)} type="password" placeholder="ADMIN_CODE" />
        </label>
      </div>

      <div className="adminActions">
        <button className="secondary" onClick={() => setLocked(true)} disabled={busy || locked}>Cerrar porra</button>
        <button className="secondary" onClick={() => setLocked(false)} disabled={busy || !locked}>Reabrir porra</button>
        <span className={locked ? 'locked pill' : 'pill'}>{locked ? 'Cerrada' : 'Abierta'}</span>
      </div>

      <FixtureList fixtures={fixtures} scores={results} results={{}} groups={groups} onChange={updateResult} disabled={false} />

      <div className="stickyActions">
        <button onClick={saveResults} disabled={busy}>{busy ? 'Guardando...' : 'Guardar resultados reales'}</button>
      </div>
    </section>
  );
}
