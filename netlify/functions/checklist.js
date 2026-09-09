const { getStore, connectLambda } = require("@netlify/blobs");

const RETENTION_DAYS = 15;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const STORE_NAME = "checklist-entries";
const KEY = "entries";

function jsonResponse(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: JSON.stringify(body),
  };
}

// Remove entries older than the retention window. This is how storage
// stays free forever: every read/write self-cleans instead of needing a
// separate scheduled job or paid database.
function pruneExpired(entries) {
  const cutoff = Date.now() - RETENTION_MS;
  return entries.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
}

async function loadEntries(store) {
  const data = await store.get(KEY, { type: "json" });
  if (!data || !Array.isArray(data)) return [];
  return pruneExpired(data);
}

async function saveEntries(store, entries) {
  await store.setJSON(KEY, entries);
}

exports.handler = async (event) => {
  // Required for Netlify Blobs to work in this classic (Lambda-compatible)
  // handler format — without this, getStore() fails in production even
  // though it works fine locally via `netlify dev`.
  connectLambda(event);

  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(200, {});
  }

  try {
    const store = getStore(STORE_NAME);

    if (event.httpMethod === "GET") {
      const entries = await loadEntries(store);
      // Lazily persist the pruned list so the store never keeps growing.
      await saveEntries(store, entries);
      entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return jsonResponse(200, { entries, retentionDays: RETENTION_DAYS });
    }

    if (event.httpMethod === "POST") {
      const payload = JSON.parse(event.body || "{}");
      if (!payload.title || !payload.responsible) {
        return jsonResponse(400, { error: "Título e responsável são obrigatórios." });
      }
      const entries = await loadEntries(store);
      const now = new Date().toISOString();
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: payload.title,
        responsible: payload.responsible,
        type: payload.type || "video",
        link: payload.link || "",
        notes: payload.notes || "",
        status: "a_gravar",
        createdAt: now,
        updatedAt: now,
      };
      entries.push(entry);
      await saveEntries(store, entries);
      return jsonResponse(201, { entry });
    }

    if (event.httpMethod === "PUT") {
      const payload = JSON.parse(event.body || "{}");
      if (!payload.id) {
        return jsonResponse(400, { error: "id é obrigatório." });
      }
      const entries = await loadEntries(store);
      const idx = entries.findIndex((e) => e.id === payload.id);
      if (idx === -1) {
        return jsonResponse(404, { error: "Registro não encontrado (pode já ter expirado)." });
      }
      const updated = {
        ...entries[idx],
        title: payload.title !== undefined ? payload.title : entries[idx].title,
        responsible: payload.responsible !== undefined ? payload.responsible : entries[idx].responsible,
        type: payload.type !== undefined ? payload.type : entries[idx].type,
        link: payload.link !== undefined ? payload.link : entries[idx].link,
        notes: payload.notes !== undefined ? payload.notes : entries[idx].notes,
        status: payload.status !== undefined ? payload.status : entries[idx].status,
        updatedAt: new Date().toISOString(),
      };
      entries[idx] = updated;
      await saveEntries(store, entries);
      return jsonResponse(200, { entry: updated });
    }

    if (event.httpMethod === "DELETE") {
      const id = event.queryStringParameters && event.queryStringParameters.id;
      if (!id) {
        return jsonResponse(400, { error: "id é obrigatório." });
      }
      const entries = await loadEntries(store);
      const next = entries.filter((e) => e.id !== id);
      await saveEntries(store, next);
      return jsonResponse(200, { ok: true });
    }

    return jsonResponse(405, { error: "Método não suportado." });
  } catch (err) {
    return jsonResponse(500, { error: err.message || "Erro interno." });
  }
};
