const crypto = require('crypto');
const { getEntity } = require('./storage');

function tokenSecret() {
  return process.env.TOKEN_SECRET || 'local-dev-secret-change-me';
}

function normalizeName(name) {
  return String(name || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function publicName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
}

function randomSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPin(pin, salt) {
  return crypto
    .createHash('sha256')
    .update(`${salt}:${pin}:${tokenSecret()}`)
    .digest('hex');
}

function verifyPin(pin, salt, expectedHash) {
  const actual = hashPin(pin, salt);
  const a = Buffer.from(actual);
  const b = Buffer.from(expectedHash || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function signPayload(payload) {
  return crypto.createHmac('sha256', tokenSecret()).update(payload).digest('base64url');
}

function createToken(player) {
  const payload = Buffer.from(JSON.stringify({
    sub: player.rowKey,
    name: player.name,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 45
  })).toString('base64url');
  return `${payload}.${signPayload(payload)}`;
}

function verifyToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) {
    const error = new Error('Sesión no válida.');
    error.status = 401;
    throw error;
  }
  const expected = signPayload(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const error = new Error('Sesión no válida.');
    error.status = 401;
    throw error;
  }
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!decoded.exp || decoded.exp < Date.now()) {
    const error = new Error('Sesión caducada. Vuelve a entrar.');
    error.status = 401;
    throw error;
  }
  return decoded;
}

async function requirePlayer(request) {
  const customToken = request.headers.get('x-porra-token') || '';
  const header = request.headers.get('authorization') || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  const token = customToken || bearerToken;
  const decoded = verifyToken(token);
  if (!player) {
    const error = new Error('Jugador no encontrado.');
    error.status = 401;
    throw error;
  }
  return player;
}

function requireAdmin(request) {
  const adminCode = process.env.ADMIN_CODE || 'admin2026-cambialo';
  const supplied = request.headers.get('x-admin-code') || '';
  if (!supplied || supplied !== adminCode) {
    const error = new Error('Código admin incorrecto.');
    error.status = 401;
    throw error;
  }
}

module.exports = {
  normalizeName,
  publicName,
  randomSalt,
  hashPin,
  verifyPin,
  createToken,
  requirePlayer,
  requireAdmin
};
