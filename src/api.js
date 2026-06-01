export async function apiFetch(path, { method = 'GET', token, adminCode, body } = {}) {
  const headers = { Accept: 'application/json' };
  const options = { method, headers };

  if (token) headers['x-porra-token'] = token;
  if (adminCode) headers['x-admin-code'] = adminCode;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(path, options);
  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || `Error HTTP ${response.status}`);
  }
  return data;
}
