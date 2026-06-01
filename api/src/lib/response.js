async function readJson(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}

function json(status, body) {
  return {
    status,
    jsonBody: body,
    headers: {
      'Cache-Control': 'no-store'
    }
  };
}

function ok(body) {
  return json(200, body);
}

function created(body) {
  return json(201, body);
}

function fail(status, message) {
  return json(status, { error: message });
}

function errorResponse(error) {
  const status = error.status || error.statusCode || 500;
  const message = status >= 500 ? 'Error interno del servidor.' : error.message;
  return fail(status, message);
}

module.exports = { readJson, ok, created, fail, errorResponse };
