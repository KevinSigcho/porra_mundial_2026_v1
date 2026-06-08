const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');
const { readJson, ok, errorResponse } = require('../lib/response');
const { requireAdmin } = require('../lib/auth');

const ENTRY_FEE = 5;

function getConnectionString() {
  const value =
    process.env.STORAGE_CONNECTION_STRING ||
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
    process.env.AzureWebJobsStorage;

  if (!value) {
    const error = new Error('Falta la variable STORAGE_CONNECTION_STRING en Azure.');
    error.status = 500;
    throw error;
  }

  return value;
}

function getTableName() {
  return process.env.STORAGE_TABLE_NAME || process.env.TABLE_NAME || 'PorraMundial2026';
}

function getTableClient() {
  return TableClient.fromConnectionString(getConnectionString(), getTableName());
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase() === 'confirmed' ? 'confirmed' : 'pending';
}

function isPaymentConfirmed(player) {
  return normalizeStatus(player.paymentStatus) === 'confirmed' || player.paymentConfirmed === true;
}

function publicPlayer(player) {
  const paymentStatus = isPaymentConfirmed(player) ? 'confirmed' : 'pending';

  return {
    playerId: player.rowKey,
    id: player.rowKey,
    name: player.name || player.rowKey,
    phone: player.phone || player.bizumPhone || '',
    avatarId: player.avatarId || player.avatarPreset || 'football-1',
    avatarUrl: player.avatarUrl || player.profileImage || '',
    paymentAmount: Number(player.paymentAmount || ENTRY_FEE),
    paymentStatus,
    paymentConfirmed: paymentStatus === 'confirmed',
    createdAt: player.createdAt || null,
    updatedAt: player.updatedAt || null,
    paymentUpdatedAt: player.paymentUpdatedAt || null
  };
}

async function listPlayers() {
  const client = getTableClient();
  const players = [];

  for await (const entity of client.listEntities({
    queryOptions: {
      filter: "PartitionKey eq 'player'"
    }
  })) {
    players.push(publicPlayer(entity));
  }

  players.sort((a, b) => {
    if (a.paymentConfirmed !== b.paymentConfirmed) {
      return a.paymentConfirmed ? -1 : 1;
    }

    return String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' });
  });

  return players;
}

function paymentSummary(players) {
  const playerCount = players.length;
  const confirmedCount = players.filter((player) => player.paymentConfirmed).length;
  const pendingCount = playerCount - confirmedCount;
  const prizePool = confirmedCount * ENTRY_FEE;

  return {
    players,
    playerCount,
    confirmedCount,
    pendingCount,
    entryFee: ENTRY_FEE,
    prizePool,
    prizes: {
      first: Math.round(prizePool * 0.5 * 100) / 100,
      second: Math.round(prizePool * 0.3 * 100) / 100,
      third: Math.round(prizePool * 0.2 * 100) / 100
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
        const players = await listPlayers();
        return ok(paymentSummary(players));
      }

      const body = await readJson(request);
      const playerId = String(body.playerId || body.id || '').trim();
      const paymentStatus = normalizeStatus(body.paymentStatus || body.status);

      if (!playerId) {
        return {
          status: 400,
          jsonBody: {
            error: 'Falta playerId.'
          }
        };
      }

      const client = getTableClient();

      await client.upsertEntity({
        partitionKey: 'player',
        rowKey: playerId,
        paymentStatus,
        paymentAmount: ENTRY_FEE,
        paymentUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, 'Merge');

      const players = await listPlayers();

      return ok({
        saved: true,
        updatedPlayerId: playerId,
        updatedPaymentStatus: paymentStatus,
        ...paymentSummary(players)
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
});
