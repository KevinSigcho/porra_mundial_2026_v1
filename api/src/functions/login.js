const { app } = require('@azure/functions');
const crypto = require('crypto');
const { readJson, ok, created, fail, errorResponse } = require('../lib/response');
const { listByPartition, upsertEntity } = require('../lib/storage');
const { normalizeName, publicName, randomSalt, hashPin, verifyPin, createToken } = require('../lib/auth');

app.http('login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'login',
  handler: async (request) => {
    try {
      const body = await readJson(request);
      const expectedJoinCode = process.env.PUBLIC_JOIN_CODE || 'amigos2026';
      const joinCode = String(body.joinCode || '').trim();
      if (!joinCode || joinCode !== expectedJoinCode) {
        return fail(401, 'Código de invitación incorrecto.');
      }

      const name = publicName(body.name);
      const nameKey = normalizeName(name);
      const pin = String(body.pin || '').trim();
      if (!name || name.length < 2 || !nameKey) {
        return fail(400, 'Escribe un nombre válido.');
      }
      if (pin.length < 4 || pin.length > 20) {
        return fail(400, 'El PIN debe tener entre 4 y 20 caracteres.');
      }

      const players = await listByPartition('player');
      let player = players.find((item) => item.nameKey === nameKey);
      let isNew = false;

      if (player) {
        if (!verifyPin(pin, player.pinSalt, player.pinHash)) {
          return fail(401, 'El PIN no coincide con ese nombre.');
        }
      } else {
        const pinSalt = randomSalt();
        player = {
          partitionKey: 'player',
          rowKey: crypto.randomUUID(),
          name,
          nameKey,
          pinSalt,
          pinHash: hashPin(pin, pinSalt),
          createdAt: new Date().toISOString()
        };
        await upsertEntity(player, 'Replace');
        isNew = true;
      }

      const token = createToken(player);
      const bodyOut = {
        token,
        player: { id: player.rowKey, name: player.name },
        isNew
      };
      return isNew ? created(bodyOut) : ok(bodyOut);
    } catch (error) {
      return errorResponse(error);
    }
  }
});
