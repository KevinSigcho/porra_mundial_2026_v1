const { app } = require('@azure/functions');
const { readJson, ok, fail, errorResponse } = require('../lib/response');
const { getEntity, upsertEntity } = require('../lib/storage');
const {
  normalizeName,
  publicName,
  randomSalt,
  hashPin,
  verifyPin,
  createToken
} = require('../lib/auth');

app.http('login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'login',
  handler: async (request) => {
    try {
      const body = await readJson(request);

      const name = publicName(body.name);
      const pin = String(body.pin || '').trim();
      const joinCode = String(body.joinCode || '').trim();

      if (!name) {
        return fail(400, 'Introduce tu nombre.');
      }

      if (!pin || pin.length < 4) {
        return fail(400, 'Introduce un PIN de al menos 4 caracteres.');
      }

      const rowKey = normalizeName(name);

      if (!rowKey) {
        return fail(400, 'El nombre no es válido.');
      }

      const existingPlayer = await getEntity('player', rowKey);

      if (existingPlayer) {
        const pinIsValid = verifyPin(pin, existingPlayer.pinSalt, existingPlayer.pinHash);

        if (!pinIsValid) {
          return fail(401, 'PIN incorrecto para este jugador.');
        }

        const token = createToken(existingPlayer);

        return ok({
          token,
          player: {
            id: existingPlayer.rowKey,
            name: existingPlayer.name
          },
          created: false,
          message: 'Sesión iniciada.'
        });
      }

      const expectedJoinCode = process.env.PUBLIC_JOIN_CODE || 'amigos2026';

      if (!joinCode || joinCode !== expectedJoinCode) {
        return fail(401, 'Código de invitación incorrecto. Solo es necesario la primera vez que creas tu jugador.');
      }

      const pinSalt = randomSalt();
      const pinHash = hashPin(pin, pinSalt);

      const player = {
        partitionKey: 'player',
        rowKey,
        name,
        pinSalt,
        pinHash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await upsertEntity(player, 'Merge');

      const token = createToken(player);

      return ok({
        token,
        player: {
          id: player.rowKey,
          name: player.name
        },
        created: true,
        message: 'Jugador creado correctamente.'
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
});
