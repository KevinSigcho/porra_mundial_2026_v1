const { TableClient, odata } = require('@azure/data-tables');

const tableName = process.env.TABLE_NAME || 'PorraMundial2026';
let clientPromise = null;
const memoryStore = new Map();

function memoryKey(partitionKey, rowKey) {
  return `${partitionKey}::${rowKey}`;
}

async function getClient() {
  const connectionString = process.env.STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    return null;
  }
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = TableClient.fromConnectionString(connectionString, tableName);
      try {
        await client.createTable();
      } catch (error) {
        if (error.statusCode !== 409) {
          throw error;
        }
      }
      return client;
    })();
  }
  return clientPromise;
}

async function upsertEntity(entity, mode = 'Merge') {
  const client = await getClient();
  if (!client) {
    const key = memoryKey(entity.partitionKey, entity.rowKey);
    const previous = mode === 'Merge' ? (memoryStore.get(key) || {}) : {};
    memoryStore.set(key, { ...previous, ...entity });
    return;
  }
  await client.upsertEntity(entity, mode);
}

async function getEntity(partitionKey, rowKey) {
  const client = await getClient();
  if (!client) {
    return memoryStore.get(memoryKey(partitionKey, rowKey)) || null;
  }
  try {
    return await client.getEntity(partitionKey, rowKey);
  } catch (error) {
    if (error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

async function listByPartition(partitionKey) {
  const client = await getClient();
  if (!client) {
    return [...memoryStore.values()].filter((entity) => entity.partitionKey === partitionKey);
  }
  const entities = [];
  const iterator = client.listEntities({
    queryOptions: { filter: odata`PartitionKey eq ${partitionKey}` }
  });
  for await (const entity of iterator) {
    entities.push(entity);
  }
  return entities;
}

module.exports = { upsertEntity, getEntity, listByPartition };
