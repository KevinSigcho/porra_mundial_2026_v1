import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from './api.js';

const STORAGE_TOKEN = 'porra2026.token';
const STORAGE_PLAYER = 'porra2026.player';
const STORAGE_ADMIN = 'porra2026.adminCode';

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

export default function App() {
  const [fixtureData, setFixtureData] = useState(null);
  const [token, setToken] = useState(localStorage.getItem(STORAGE_TOKEN) || '');
  const [player, setPlayer] = useState(readStoredPlayer());
  const [tab, setTab] = useState('predictions');
  const [predictions, setPredictions] = useState({});
  const [results, setResults] = useState({});
  const [leaderboard, setLeaderboard] = useState(null);
  const [settings, setSettings] = useState({ locked: false, scoring: null });
  const [groupFilter, setGroupFilter] = useState('TODOS');
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
  const filteredFixtures = useMemo(() => {
    if (groupFilter === 'TODOS') return fixtures;
    return fixtures.filter((fixture) => fixture.group === groupFilter);
  }, [fixtures, groupFilter]);

  const completedPredictions = Object.keys(normalizeForSave(predictions)).length;

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
          <p className="eyebrow">Porra privada</p>
          <h1>Mundial 2026: fase de grupos</h1>
          <p>Pronostica el marcador de los {fixtures.length} partidos de grupos. Juega como <strong>{player.name}</strong>.</p>
        </div>
        <button className="secondary" onClick={logout}>Salir</button>
      </header>

      {status && <div className="notice">{status}</div>}

      <nav className="tabs" aria-label="Secciones">
        <button className={tab === 'predictions' ? 'active' : ''} onClick={() => setTab('predictions')}>Mis pronósticos</button>
        <button className={tab === 'leaderboard' ? 'active' : ''} onClick={() => { setTab('leaderboard'); refreshPrivateData(); }}>Clasificación</button>
        <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>Admin</button>
      </nav>

      {tab === 'predictions' && (
        <section className="panel">
          <div className="toolbar">
            <div>
              <h2>Mis pronósticos</h2>
              <p className="muted">Completados: {completedPredictions}/{fixtures.length}. Puntuación: {fixtureData.rules.description}</p>
              {settings.locked && <p className="locked">La porra está cerrada. Puedes ver tus pronósticos, pero no guardarlos.</p>}
            </div>
            <label>
              Grupo
              <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
                <option value="TODOS">Todos</option>
                {Object.keys(groups).map((group) => <option key={group} value={group}>Grupo {group}</option>)}
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

          <div className="stickyActions">
            <button onClick={savePredictions} disabled={busy || settings.locked}>{busy ? 'Guardando...' : 'Guardar mis pronósticos'}</button>
            <button className="secondary" onClick={refreshPrivateData}>Recargar</button>
          </div>
        </section>
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
    <header className="hero">
      <div>
        <p className="eyebrow">Mundial 2026</p>
        <h1>Porra de fase de grupos</h1>
        <p>Cada amigo entra con nombre, PIN y código de invitación. Después selecciona marcadores para los {fixtureCount} partidos.</p>
      </div>
    </header>
  );
}

function LoginForm({ onLoggedIn }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await apiFetch('/api/login', {
        method: 'POST',
        body: { name, pin, joinCode }
      });
      onLoggedIn(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel loginPanel">
      <h2>Entrar en la porra</h2>
      <form onSubmit={submit} className="formGrid">
        <label>
          Nombre
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Carlos" required />
        </label>
        <label>
          PIN personal
          <input value={pin} onChange={(event) => setPin(event.target.value)} placeholder="4 dígitos o más" type="password" required />
        </label>
        <label>
          Código de invitación
          <input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Te lo pasa el admin" required />
        </label>
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{busy ? 'Entrando...' : 'Entrar / crear jugador'}</button>
      </form>
      <p className="muted small">La primera vez se crea tu usuario. Después entra con el mismo nombre y PIN.</p>
    </section>
  );
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

function Leaderboard({ data, onRefresh }) {
  return (
    <section className="panel">
      <div className="toolbar">
        <div>
          <h2>Clasificación</h2>
          <p className="muted">Resultados reales cargados: {data?.resultCount || 0}/{data?.fixtureCount || 72}</p>
        </div>
        <button className="secondary" onClick={onRefresh}>Actualizar</button>
      </div>
      <div className="tableWrap">
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
            {(data?.rows || []).map((row, index) => (
              <tr key={row.playerId}>
                <td>{index + 1}</td>
                <td>{row.name}</td>
                <td><strong>{row.points}</strong></td>
                <td>{row.exactScores}</td>
                <td>{row.correctOutcomes}</td>
                <td>{row.predictionsMade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
