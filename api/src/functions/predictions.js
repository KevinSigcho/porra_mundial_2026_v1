const { app } = require('@azure/functions');
const { readJson, ok, fail, errorResponse } = require('../lib/response');
const { getEntity, upsertEntity } = require('../lib/storage');
const { requirePlayer } = require('../lib/auth');
const { normalizeScores, normalizeKnockout, countComplete } = require('../lib/validation');
const { getSettings } = require('../lib/settings');
const { parseJson } = require('../lib/scoring');

const ROUND_OF_32_MATCH_IDS = [
  'M74', 'M77', 'M73', 'M75',
  'M83', 'M84', 'M81', 'M82',
  'M76', 'M78', 'M79', 'M80',
  'M86', 'M88', 'M85', 'M87'
];

function safeJsonParse(value, fallback) {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

app.http('getPredictions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'predictions',
  handler: async (request) => {
    try {
      const currentPlayer = await requirePlayer(request);
      const settings = await getSettings();

      const entity = await getEntity('prediction', String(currentPlayer.rowKey));
      const predictions = parseJson(entity?.predictions, {});
      const knockout = parseJson(entity?.knockout, {});

      return ok({
        player: {
          id: String(currentPlayer.rowKey),
          name: String(currentPlayer.name || '')
        },
        predictions,
        knockout,
        locked: Boolean(settings.locked),
        knockoutLocked: Boolean(settings.knockoutLocked),
        updatedAt: entity?.updatedAt || null
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
});

app.http('savePredictions', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'predictions',
  handler: async (request) => {
    try {
      const currentPlayer = await requirePlayer(request);
      const settings = await getSettings();

      const body = await readJson(request);

      // Merge: se actualiza solo la fase incluida en el body (grupos y/o eliminatoria).
      const update = {
        partitionKey: 'prediction',
        rowKey: String(currentPlayer.rowKey),
        playerName: String(currentPlayer.name || ''),
        updatedAt: new Date().toISOString()
      };

      const response = { saved: true };

      if (body?.predictions !== undefined) {
        if (settings.locked) {
          return fail(423, 'La porra está cerrada. Pide al admin que la reabra si necesitas corregir algo.');
        }
        const predictions = normalizeScores(body.predictions || {});
        const completeCount = countComplete(predictions);
        update.predictions = JSON.stringify(predictions);
        update.completeCount = Number(completeCount);
        response.predictions = predictions;
        response.completeCount = completeCount;
      }

      if (body?.knockout !== undefined) {
        if (settings.knockoutLocked) {
          return fail(423, 'La porra de eliminatorias está cerrada. Pide al admin que la abra.');
        }
        const knockout = normalizeKnockout(body.knockout || {});
        const knockoutCompleteCount = countComplete(knockout);
        update.knockout = JSON.stringify(knockout);
        update.knockoutCompleteCount = Number(knockoutCompleteCount);
        response.knockout = knockout;
        response.knockoutCompleteCount = knockoutCompleteCount;
      }

      await upsertEntity(update, 'Merge');

      return ok(response);
    } catch (error) {
      return errorResponse(error);
    }
  }
});
