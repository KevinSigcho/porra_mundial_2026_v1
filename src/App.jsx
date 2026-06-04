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
  qualifiedData.thirds.forEach((team, index) => {
    bySeed[`T${index + 1}`] = {
      ...team,
      label: `${index + 1}º mejor tercero, Grupo ${team.group}`
    };
  });

  const seedPairs = [
    ['1A', 'T8'], ['2B', '2C'], ['1D', 'T7'], ['1E', '2F'],
    ['1G', 'T6'], ['2H', '2I'], ['1J', 'T5'], ['1K', '2L'],
    ['1B', 'T4'], ['2A', '2D'], ['1C', 'T3'], ['1F', '2E'],
    ['1H', 'T2'], ['2G', '2J'], ['1I', 'T1'], ['1L', '2K']
  ];

  return seedPairs.map(([homeSeed, awaySeed], index) => ({
    id: `R32-${index + 1}`,
    homeSeed,
    awaySeed,
    home: bySeed[homeSeed] || null,
    away: bySeed[awaySeed] || null
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
        <button className={tab === 'liveGroups' ? 'active' : ''} onClick={() => { setTab('liveGroups'); refreshPrivateData(); }}>Grupos actualizados</button>
        <button className={tab === 'myBracket' ? 'active' : ''} onClick={() => { setTab('myBracket'); refreshPrivateData(); }}>Mi eliminatoria</button>
        <button className={tab === 'leaderboard' ? 'active' : ''} onClick={() => { setTab('leaderboard'); refreshPrivateData(); }}>Clasificación porra</button>
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
        <div className="bracketTitle">Ronda de 32 · proyección</div>
        <div className="bracketColumns">
          <div className="bracketSide">
            {pairings.slice(0, 8).map((pairing) => <BracketMatch key={pairing.id} pairing={pairing} />)}
          </div>
          <div className="bracketCenter">
            <span>Camino a la final</span>
            <small>La siguiente fase se podrá añadir después con predicción de ganadores.</small>
          </div>
          <div className="bracketSide">
            {pairings.slice(8).map((pairing) => <BracketMatch key={pairing.id} pairing={pairing} />)}
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
    <article className="bracketMatch">
      <BracketTeam team={pairing.home} seed={pairing.homeSeed} />
      <div className="bracketLine" aria-hidden="true" />
      <BracketTeam team={pairing.away} seed={pairing.awaySeed} />
    </article>
  );
}

function BracketTeam({ team, seed }) {
  return (
    <div className={team ? 'bracketTeam' : 'bracketTeam pendingTeam'}>
      <span className="seedBadge">{seed}</span>
      {team ? <TeamFlag team={team.team} /> : <span className="flagFallback" aria-hidden="true">?</span>}
      <span>{team ? team.team : 'Pendiente'}</span>
    </div>
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
