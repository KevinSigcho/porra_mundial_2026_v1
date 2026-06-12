const APP_URL = process.env.PORRA_APP_URL;
const ADMIN_CODE = process.env.PORRA_ADMIN_CODE;
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const COMPETITION = process.env.FOOTBALL_DATA_COMPETITION || 'WC';

const DRY_RUN = String(process.env.DRY_RUN || 'false').toLowerCase() === 'true';
const DELAY_AFTER_KICKOFF_HOURS = Number(process.env.DELAY_AFTER_KICKOFF_HOURS || 3);

const TEAM_NAME_ALIASES = {
  'Mexico': 'México',
  'Korea Republic': 'Corea del Sur',
  'South Korea': 'Corea del Sur',
  'Czechia': 'Chequia',
  'Czech Republic': 'Chequia',
  'South Africa': 'Sudáfrica',
  'Bosnia-Herzegovina': 'Bosnia y Herzegovina',
  'Bosnia and Herzegovina': 'Bosnia y Herzegovina',
  'Switzerland': 'Suiza',
  'Brazil': 'Brasil',
  'Morocco': 'Marruecos',
  'Haiti': 'Haití',
  'Scotland': 'Escocia',
  'United States': 'Estados Unidos',
  'USA': 'Estados Unidos',
  'Türkiye': 'Turquía',
  'Turkey': 'Turquía',
  'Australia': 'Australia',
  'Paraguay': 'Paraguay',
  'Germany': 'Alemania',
  'Ecuador': 'Ecuador',
  "Côte d'Ivoire": 'Costa de Marfil',
  'Ivory Coast': 'Costa de Marfil',
  'Curacao': 'Curazao',
  'Curaçao': 'Curazao',
  'Netherlands': 'Países Bajos',
  'Japan': 'Japón',
  'Sweden': 'Suecia',
  'Tunisia': 'Túnez',
  'Belgium': 'Bélgica',
  'Egypt': 'Egipto',
  'Iran': 'Irán',
  'New Zealand': 'Nueva Zelanda',
  'Spain': 'España',
  'Cape Verde': 'Cabo Verde',
  'Saudi Arabia': 'Arabia Saudí',
  'Uruguay': 'Uruguay',
  'France': 'Francia',
  'Senegal': 'Senegal',
  'Iraq': 'Irak',
  'Norway': 'Noruega',
  'Argentina': 'Argentina',
  'Algeria': 'Argelia',
  'Austria': 'Austria',
  'Jordan': 'Jordania',
  'Portugal': 'Portugal',
  'DR Congo': 'RD Congo',
  'Congo DR': 'RD Congo',
  'Uzbekistan': 'Uzbekistán',
  'Colombia': 'Colombia',
  'England': 'Inglaterra',
  'Croatia': 'Croacia',
  'Ghana': 'Ghana',
  'Panama': 'Panamá'
};

function required(value, name) {
  if (!value) {
    throw new Error(`Falta la variable ${name}.`);
  }

  return value;
}

function normalizeTeamName(value) {
  const mapped = TEAM_NAME_ALIASES[value] || value;

  return String(mapped || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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

function kickoffTimestamp(fixture) {
  if (fixture.kickoffAtSpain) {
    return new Date(fixture.kickoffAtSpain).getTime();
  }

  if (fixture.kickoffDateSpain && fixture.kickoffTimeSpain) {
    return new Date(`${fixture.kickoffDateSpain}T${fixture.kickoffTimeSpain}:00+02:00`).getTime();
  }

  return new Date(`${fixture.date}T12:00:00Z`).getTime();
}

function shouldCheckFixture(fixture, existingResults, now) {
  if (isCompleteScore(existingResults[fixture.id])) {
    return false;
  }

  const kickoff = kickoffTimestamp(fixture);

  if (!Number.isFinite(kickoff)) {
    console.log(`Fecha inválida para ${fixture.id}: ${fixture.home} vs ${fixture.away}`);
    return false;
  }

  const readyAt = kickoff + DELAY_AFTER_KICKOFF_HOURS * 60 * 60 * 1000;

  const shouldCheck = now >= readyAt;

  if (!shouldCheck && Number(fixture.matchNo || 0) <= 5) {
    console.log(
      `Todavía no revisa ${fixture.id}. Ahora=${new Date(now).toISOString()} ReadyAt=${new Date(readyAt).toISOString()} Kickoff=${new Date(kickoff).toISOString()}`
    );
  }

  return shouldCheck;
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

async function fetchFixtures() {
  return getJson(`${APP_URL}/fixtures.json`);
}

async function fetchCurrentResults() {
  const data = await getJson(`${APP_URL}/api/results`);
  return data.results || {};
}

async function fetchApiMatches() {
  const url = `https://api.football-data.org/v4/competitions/${COMPETITION}/matches`;

  const data = await getJson(url, {
    headers: {
      'X-Auth-Token': API_KEY
    }
  });

  return data.matches || [];
}

function getApiTeamName(team) {
  return team?.name || team?.shortName || team?.tla || '';
}

function getApiScore(match) {
  const homeGoals = match?.score?.fullTime?.home;
  const awayGoals = match?.score?.fullTime?.away;

  if (!Number.isInteger(homeGoals) || !Number.isInteger(awayGoals)) {
    return null;
  }

  return {
    homeGoals,
    awayGoals
  };
}

function findFinishedApiMatchForFixture(fixture, apiMatches) {
  const localHome = normalizeTeamName(fixture.home);
  const localAway = normalizeTeamName(fixture.away);

  return apiMatches.find((match) => {
    if (match.status !== 'FINISHED') return false;

    const apiHome = normalizeTeamName(getApiTeamName(match.homeTeam));
    const apiAway = normalizeTeamName(getApiTeamName(match.awayTeam));

    return apiHome === localHome && apiAway === localAway;
  });
}

async function saveResults(results) {
  return getJson(`${APP_URL}/api/results`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-code': ADMIN_CODE
    },
    body: JSON.stringify({ results })
  });
}

async function main() {
  required(APP_URL, 'PORRA_APP_URL');
  required(ADMIN_CODE, 'PORRA_ADMIN_CODE');
  required(API_KEY, 'FOOTBALL_DATA_API_KEY');

  console.log(`Sincronizando resultados. DRY_RUN=${DRY_RUN}`);
  console.log(`APP_URL=${APP_URL}`);
  console.log(`COMPETITION=${COMPETITION}`);
  console.log(`DELAY_AFTER_KICKOFF_HOURS=${DELAY_AFTER_KICKOFF_HOURS}`);
  
  const fixtureData = await fetchFixtures();
  const fixtures = fixtureData.fixtures || [];
  const currentResults = await fetchCurrentResults();
  const apiMatches = await fetchApiMatches();

  const now = Date.now();
  const nextResults = { ...currentResults };

  console.log(`Fixtures cargados: ${fixtures.length}`);
  console.log(`Resultados actuales cargados: ${Object.keys(currentResults || {}).length}`);
  console.log(`Partidos recibidos de la API: ${apiMatches.length}`);
  console.log(`Hora actual GitHub runner: ${new Date(now).toISOString()}`);

  for (const fixture of fixtures.slice(0, 5)) {
    const kickoff = kickoffTimestamp(fixture);
    const readyAt = kickoff + DELAY_AFTER_KICKOFF_HOURS * 60 * 60 * 1000;

    console.log(
      `Fixture ${fixture.id} #${fixture.matchNo}: ${fixture.home} vs ${fixture.away} | kickoff=${new Date(kickoff).toISOString()} | readyAt=${new Date(readyAt).toISOString()}`
    );
  }

 
  let checked = 0;
  let updated = 0;
  let notFound = 0;

  for (const fixture of fixtures) {
    if (!shouldCheckFixture(fixture, currentResults, now)) {
      continue;
    }

    checked += 1;

    const apiMatch = findFinishedApiMatchForFixture(fixture, apiMatches);

    if (!apiMatch) {
      notFound += 1;
      console.log(`No encontrado o no finalizado: ${fixture.id} ${fixture.home} vs ${fixture.away}`);
      continue;
    }

    const score = getApiScore(apiMatch);

    if (!score) {
      console.log(`Sin marcador válido: ${fixture.id} ${fixture.home} vs ${fixture.away}`);
      continue;
    }

    nextResults[fixture.id] = score;
    updated += 1;

    console.log(`Actualizado: ${fixture.id} ${fixture.home} ${score.homeGoals}-${score.awayGoals} ${fixture.away}`);
  }

  console.log(`Partidos revisados: ${checked}`);
  console.log(`Resultados nuevos/actualizados: ${updated}`);
  console.log(`No encontrados/no finalizados: ${notFound}`);

  if (updated === 0) {
    console.log('No hay cambios que guardar.');
    return;
  }

  if (DRY_RUN) {
    console.log('DRY_RUN activo. No se guardan resultados.');
    console.log(JSON.stringify(nextResults, null, 2));
    return;
  }

  const saved = await saveResults(nextResults);

  console.log('Resultados guardados en /api/results.');
  console.log(saved);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});