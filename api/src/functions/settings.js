const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');
const { readJson, ok, errorResponse } = require('../lib/response');
const { upsertEntity } = require('../lib/storage');
const { requireAdmin } = require('../lib/auth');
const { getSettings } = require('../lib/settings');

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

function normalizePaymentStatus(value) {
  return String(value || '').trim().toLowerCase() === 'confirmed' ? 'confirmed' : 'pending';
}

function isPaymentConfirmed(player) {
  return normalizePaymentStatus(player.paymentStatus) === 'confirmed' || player.paymentConfirmed === true;
}

function publicPaymentPlayer(player) {
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

async function listPaymentPlayers() {
  const client = getTableClient();
  const players = [];

  for await (const entity of client.listEntities({
    queryOptions: {
      filter: "PartitionKey eq 'player'"
    }
  })) {
    players.push(publicPaymentPlayer(entity));
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

async function listPaymentsResponse() {
  const players = await listPaymentPlayers();
  return ok(paymentSummary(players));
}

async function updatePaymentResponse(body) {
  const playerId = String(body.playerId || body.id || '').trim();
  const paymentStatus = normalizePaymentStatus(body.paymentStatus || body.status);

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

  const players = await listPaymentPlayers();

  return ok({
    saved: true,
    updatedPlayerId: playerId,
    updatedPaymentStatus: paymentStatus,
    ...paymentSummary(players)
  });
}

app.http('settings', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'settings',
  handler: async (request) => {
    try {
      if (request.method === 'GET') {
        return ok(await getSettings());
      }

      requireAdmin(request);
      const body = await readJson(request);
      const action = String(body?.action || '').trim();

      if (action === 'verify') {
        return ok({
          ok: true,
          admin: true
        });
      }

      if (action === 'listPayments') {
        return await listPaymentsResponse();
      }

      if (action === 'updatePayment') {
        return await updatePaymentResponse(body);
      }
      
      if (action === 'saveKnockoutData') {
        const knockoutData = body.knockoutData || null;

        if (!knockoutData || typeof knockoutData !== 'object') {
          return {
            status: 400,
            jsonBody: {
              error: 'Falta knockoutData válido.'
            }
          };
        }

        const knockoutUpdatedAt = new Date().toISOString();

        await upsertEntity({
          partitionKey: 'settings',
          rowKey: 'global',
          knockoutData: JSON.stringify(knockoutData),
          knockoutUpdatedAt,
          updatedAt: knockoutUpdatedAt
        }, 'Merge');

        return ok({
          ok: true,
          knockoutData,
          knockoutUpdatedAt
        });
      }

      if (action === 'clearKnockoutData') {
        const knockoutUpdatedAt = new Date().toISOString();

        await upsertEntity({
          partitionKey: 'settings',
          rowKey: 'global',
          knockoutData: '',
          knockoutUpdatedAt,
          updatedAt: knockoutUpdatedAt
        }, 'Merge');

        return ok({
          ok: true,
          knockoutData: null,
          knockoutUpdatedAt
        });
      }

      if (action === 'clearKnockoutData') {
        const knockoutUpdatedAt = new Date().toISOString();

        await upsertEntity({
          partitionKey: 'settings',
          rowKey: 'global',
          knockoutData: '',
          knockoutUpdatedAt,
          updatedAt: knockoutUpdatedAt
        }, 'Merge');

        return ok({
          ok: true,
          knockoutData: null,
          knockoutUpdatedAt
        });
      }
      // Merge: solo se tocan los flags presentes en el body, sin pisar el otro.
      const update = {
        partitionKey: 'settings',
        rowKey: 'global',
        updatedAt: new Date().toISOString()
      };
      if (typeof body.locked === 'boolean') update.locked = body.locked;
      if (typeof body.knockoutLocked === 'boolean') update.knockoutLocked = body.knockoutLocked;

      await upsertEntity(update, 'Merge');

      return ok(await getSettings());
    } catch (error) {
      return errorResponse(error);
    }
  }
});

