const { app } = require('@azure/functions');
const { readJson, ok, fail, errorResponse } = require('../lib/response');
const { getEntity, upsertEntity } = require('../lib/storage');
const { requirePlayer } = require('../lib/auth');
const { normalizeScores, countComplete } = require('../lib/validation');
const { getSettings } = require('../lib/settings');
const { parseJson } = require('../lib/scoring');

app.http('getPredictions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'predictions',
  handler: async (request) => {
    try {
      const player = await requirePlayer(request);
      const settings = await getSettings();

      const entity = await getEntity('prediction', String(player.rowKey));
      const predictions = parseJson(entity?.predictions, {});

      return ok({
        player: {
          id: String(player.rowKey),
          name: String(player.name || '')
        },
        predictions,
        locked: Boolean(settings.locked),
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
      const player = await requirePlayer(request);
      const settings = await getSettings();

      if (settings.locked) {
        return fail(423, 'La porra está cerrada. Pide al admin que la reabra si necesitas corregir algo.');
      }

      const body = await readJson(request);
      const predictions = normalizeScores(body.predictions || {});
      const completeCount = countComplete(predictions);

      await upsertEntity({
        partitionKey: 'prediction',
        rowKey: String(player.rowKey),
        playerName: String(player.name || ''),
        predictions: JSON.stringify(predictions),
        completeCount: Number(completeCount),
        updatedAt: new Date().toISOString()
      }, 'Merge');

      return ok({
        saved: true,
        completeCount,
        predictions
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
});
