import cloudApi from './cloudClient';

// The desktop app's local ids are small, sequential SQLite autoincrement
// integers (unique only within one instance). Ids minted here must never
// land in that range, or a future desktop-generated row could silently
// overwrite a web-created one (the cloud dedupes by id, last-write-wins).
// Date.now()*1000 is already a 16-digit number — no small shop's local
// counter will ever reach it — plus a rolling sub-counter for same-tick calls.
let counter = 0;
export function nextId() {
  counter = (counter + 1) % 1000;
  return Date.now() * 1000 + counter;
}

/**
 * Pushes one or more sync events through the exact same endpoint (and shape)
 * the desktop app's cloud_sync_queue flush uses: POST /api/sync with
 * { items: [{ entity_type, operation, payload, local_id }] }.
 */
export async function pushEvents(items) {
  const { data } = await cloudApi.post('/sync', { items });
  return data;
}

export async function pushEntity(entityType, operation, payload) {
  return pushEvents([{ entity_type: entityType, operation, payload, local_id: payload.id }]);
}
