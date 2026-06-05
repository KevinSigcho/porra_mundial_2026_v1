const { app } = require('@azure/functions');
const crypto = require('crypto');
const { readJson, ok, created, fail, errorResponse } = require('../lib/response');
const { listByPartition, upsertEntity } = require('../lib/storage');
const { normalizeName, publicName, randomSalt, hashPin, verifyPin, createToken } = require('../lib/auth');

const ALLOWED_AVATAR_IDS = new Set([
  'football-1', 'football-2', 'football-3', 'football-4',
  'shiba-1', 'shiba-2',
  'hero-1', 'hero-2', 'hero-3',
  'space-1', 'gaming-1', 'fire-1', 'crown-1', 'ninja-1', 'robot-1'
]);

function cleanAvatarId(value) {
  const avatarId = String(value || 'football-1').trim();
  return ALLOWED_AVATAR_IDS.has(avatarId) ? avatarId : 'football-1';
}

function cleanAvatarUrl(value) {
  const avatarUrl = String(value || '').trim();
  if (!avatarUrl) return '';

  // La imagen se redimensiona en frontend antes de enviarse.
  // Dejamos margen suficiente para un avatar pequeño sin comprometer Table Storage.
  if (!avatarUrl.startsWith('data:image/') || avatarUrl.length > 180000) {
    return '';
  }

  return avatarUrl;
}

app.http('login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'login',
  handler: async (request) => {
    try {
      const body = await readJson(request);
      const mode = String(body.mode || 'login').trim();
      const name = publicName(body.name);
      const nameKey = normalizeName(name);
      const pin = String(body.pin || '').trim();

      if (!name || name.length < 2 || !nameKey) {
        return fail(400, 'Escribe un usuario válido.');
      }

      if (pin.length < 4 || pin.length > 20) {
        return fail(400, 'La contraseña/PIN debe tener entre 4 y 20 caracteres.');
      }

      const players = await listByPartition('player');
      let player = players.find((item) => item.nameKey === nameKey);
      let isNew = false;

      if (player) {
        if (!verifyPin(pin, player.pinSalt, player.pinHash)) {
          return fail(401, 'La contraseña/PIN no coincide con ese usuario.');
        }
      } else {
        const expectedJoinCode = process.env.PUBLIC_JOIN_CODE || 'amigos2026';
        const joinCode = String(body.joinCode || '').trim();

        if (mode !== 'register') {
          return fail(404, 'Este usuario no existe. Pulsa Registrarme y usa el código de invitación.');
        }

        if (!joinCode || joinCode !== expectedJoinCode) {
          return fail(401, 'Código de invitación incorrecto. Es obligatorio para registrarte.');
        }

        const pinSalt = randomSalt();
        player = {
          partitionKey: 'player',
          rowKey: crypto.randomUUID(),
          name,
          nameKey,
          avatarId: cleanAvatarId(body.avatarId),
          avatarUrl: cleanAvatarUrl(body.avatarUrl),
          pinSalt,
          pinHash: hashPin(pin, pinSalt),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await upsertEntity(player, 'Replace');
        isNew = true;
      }

      const token = createToken(player);
      const bodyOut = {
        token,
        player: {
          id: player.rowKey,
          name: player.name,
          avatarId: player.avatarId || 'football-1',
          avatarUrl: player.avatarUrl || ''
        },
        isNew
      };

      return isNew ? created(bodyOut) : ok(bodyOut);
    } catch (error) {
      return errorResponse(error);
    }
  }
});
