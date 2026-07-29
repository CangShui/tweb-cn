// tweb-cn: Dual-write sync -- localStorage + Saved Messages
// Saved Messages acts as cloud backup; recovers settings after cache clear.

import getProxiedManagers from '@lib/getProxiedManagers';
import rootScope from '@lib/rootScope';

const SYNC_MARKER = '__TWEB_CN_SYNC_V1__';
const SYNC_DEBOUNCE_MS = 3000;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

const SYNCED_KEYS = [
  'tweb_cn_msg_keywords',
  'tweb_cn_user_keywords',
  'tweb_cn_block_pinned',
  'tweb_cn_block_ads',
  'tweb_cn_restrict_images',
  'tweb_cn_restrict_images_mode',
  'tweb_cn_restrict_images_start',
  'tweb_cn_restrict_images_end'
];

function getFilterSnapshot(): string {
  const data: Record<string, string> = {};
  for(const k of SYNCED_KEYS) {
    const v = localStorage.getItem(k);
    if(v !== null) data[k] = v;
  }
  data._ts = String(Date.now());
  data._v = '1';
  return JSON.stringify(data);
}

function restoreFilterSnapshot(json: string): boolean {
  try {
    const data = JSON.parse(json);
    if(!data._v) return false;
    let restored = false;
    for(const k of SYNCED_KEYS) {
      if(data[k] !== undefined) {
        localStorage.setItem(k, data[k]);
        restored = true;
      }
    }
    if(data._ts) localStorage.setItem('tweb_cn_sync_ts', data._ts);
    return restored;
  } catch(e) { return false; }
}

async function doSync(): Promise<void> {
  try {
    const myId = rootScope.myId;
    if(!myId) { console.warn('[tweb-cn] sync skipped: not logged in'); return; }
    const managers = getProxiedManagers();
    const payload = SYNC_MARKER + getFilterSnapshot();
    await managers.appMessagesManager!.sendText!({
      peerId: myId, text: payload, clearDraft: true, noWebPage: true
    });
    console.warn('[tweb-cn] synced filter settings to Saved Messages');
  } catch(e) { console.warn('[tweb-cn] sync failed:', e); }
}

export function queueSyncToSavedMessages(): void {
  if(syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(doSync, SYNC_DEBOUNCE_MS);
}

export async function restoreFromSavedMessages(): Promise<boolean> {
  try {
    const myId = rootScope.myId;
    if(!myId) { console.warn('[tweb-cn] restore skipped: not logged in'); return false; }
    const managers = getProxiedManagers();
    const history: any = await managers.appMessagesManager!.getHistory!({peerId: myId, limit: 30});
    console.warn('[tweb-cn] restore: got history', history ? 'ok' : 'empty');
    const messages: any[] = history?.history || history?.messages || [];
    console.warn('[tweb-cn] restore: scanning', messages.length, 'messages');
    let latestPayload: string | null = null;
    let latestTs = 0;
    for(const msg of messages) {
      const text: string = msg?.message || msg?.text || '';
      if(text.startsWith(SYNC_MARKER)) {
        const json = text.slice(SYNC_MARKER.length);
        try {
          const data = JSON.parse(json);
          const ts = data._ts || 0;
          if(ts > latestTs) { latestTs = ts; latestPayload = json; }
        } catch(_e) {}
      }
    }
    if(!latestPayload) { console.warn('[tweb-cn] restore: no sync msg found'); return false; }
    const localTs = localStorage.getItem('tweb_cn_sync_ts');
    if(localTs && Number(localTs) >= latestTs) {
      console.warn('[tweb-cn] restore: localStorage newer, skip'); return false;
    }
    const restored = restoreFilterSnapshot(latestPayload);
    if(restored) console.warn('[tweb-cn] restore: restored ts=', latestTs);
    return restored;
  } catch(e) { console.warn('[tweb-cn] restore failed:', e); return false; }
}
