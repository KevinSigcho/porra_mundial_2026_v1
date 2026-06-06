const { app } = require('@azure/functions');
const { ok, fail, errorResponse, readJson } = require('../lib/response');
const { listByPartition, getEntity, upsertEntity } = require('../lib/storage');
const { requireAdmin } = require('../lib/auth');

const ENTRY_FEE = 5;

function isConfirmed(player) {
  return player?.paymentStatus === 'confirmed' || player?.paymentConfirmed === true;
}

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function mapPlayer(player) {
  const confirmed = isConfirmed(player);
  return {
    playerId: player.rowKey,
    name: player.name || player.rowKey,
    phone: player.phone || '',
    avatarId: player.avatarId || 'football-1',
    avatarUrl: player.avatarUrl || '',
    paymentAmount: Number(player.paymentAmount || ENTRY_FEE),
    paymentStatus: confirmed ? 'confirmed' : 'pending',
    paymentConfirmed: confirmed,
    paymentConfirmedAt: player.paymentConfirmedAt || null,
    createdAt: player.createdAt || null
  };
}

async function paymentSnapshot() {
  const players = await listByPartition('player');
  const mapped = players.map(mapPlayer).sort((a, b) => {
    if (a.paymentConfirmed !== b.paymentConfirmed) return a.paymentConfirmed ? -1 : 1;
    return a.name.localeCompare(b.name, 'es');
  });
  const confirmedCount = mapped.filter((player) => player.paymentConfirmed).length;
  const prizePool = money(confirmedCount * ENTRY_FEE);

  return {
    players: mapped,
    playerCount: mapped.length,
    confirmedCount,
    pendingCount: mapped.length - confirmedCount,
    entryFee: ENTRY_FEE,
    prizePool,
    prizes: {
      first: money(prizePool * 0.5),
      second: money(prizePool * 0.3),
      third: money(prizePool * 0.2)
    }
  };
}

app.http('adminPayments', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'admin-payments',
  handler: async (request) => {
    try {
      requireAdmin(request);

      if (request.method === 'GET') {
        return ok(await paymentSnapshot());
      }

      const body = await readJson(request);
      const playerId = String(body.playerId || '').trim();
      const nextStatus = String(body.paymentStatus || '').trim();

      if (!playerId) {
        return fail(400, 'Falta el jugador que quieres actualizar.');
      }

      if (!['confirmed', 'pending'].includes(nextStatus)) {
        return fail(400, 'Estado de pago no válido. Usa confirmed o pending.');
      }

      const player = await getEntity('player', playerId);
      if (!player) {
        return fail(404, 'Jugador no encontrado.');
      }

      await upsertEntity({
        partitionKey: 'player',
        rowKey: playerId,
        paymentAmount: Number(player.paymentAmount || ENTRY_FEE),
        paymentStatus: nextStatus,
        paymentConfirmed: nextStatus === 'confirmed',
        paymentConfirmedAt: nextStatus === 'confirmed' ? new Date().toISOString() : '',
        updatedAt: new Date().toISOString()
      }, 'Merge');

      return ok(await paymentSnapshot());
    } catch (error) {
      return errorResponse(error);
    }
  }
});
