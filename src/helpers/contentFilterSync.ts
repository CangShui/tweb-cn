// tweb-cn: Account-scoped localStorage + Saved Messages synchronization.

import {Message, MessageEntity} from '@layer';
import {
  ADVANCED_SETTINGS_CHANGE_EVENT,
  ADVANCED_SETTINGS_DEFAULTS,
  AdvancedSettingsSnapshot,
  hasLegacyAdvancedSettings,
  normalizeAdvancedSettings,
  readAccountAdvancedSettings,
  readLegacyAdvancedSettings,
  removeLegacyAdvancedSettings,
  replaceAccountAdvancedSettings
} from '@helpers/advancedSettingsStorage';
import {
  ADVANCED_SETTINGS_SYNC_MARKER,
  parseAdvancedSettingsSyncText,
  ParsedSyncPayload
} from '@helpers/advancedSettingsSyncPayload';
import {isTestMode} from '@helpers/testMode';
import getProxiedManagers from '@lib/getProxiedManagers';
import rootScope from '@lib/rootScope';

const SYNC_SEARCH_QUERY = 'TWEB';
const SYNC_DEBOUNCE_MS = 3000;
const SYNC_RETRY_MS = 30000;

type ParsedSyncMessage = ParsedSyncPayload & {
  message: Message.message
};

type RemoteSettings = {
  latest: ParsedSyncMessage,
  messages: ParsedSyncMessage[],
  settings: Record<string, string>,
  updatedAt: number
};

let activePeerId: PeerId;
let initializationPromise: Promise<boolean>;
let remoteSettings: RemoteSettings;
let retryTimer: ReturnType<typeof setTimeout>;
let syncTimer: ReturnType<typeof setTimeout>;
let syncInFlight: Promise<void>;
let syncReady = false;
let syncRequestedBeforeReady = false;
let syncRequestedWhileWriting = false;

function parseSyncMessage(message: Message.message): ParsedSyncMessage | undefined {
  const payload = parseAdvancedSettingsSyncText(
    message.message || '',
    (message.edit_date || message.date) * 1000
  );
  return payload && {...payload, message};
}

async function searchSyncMessages(peerId: PeerId): Promise<Message.message[]> {
  const manager = getProxiedManagers().appMessagesManager;
  const history = await manager.getHistory({
    peerId,
    query: SYNC_SEARCH_QUERY,
    inputFilter: {_: 'inputMessagesFilterEmpty'},
    limit: 100
  });
  const messages = history.messages || await Promise.all(
    history.history.map((mid) => manager.getMessageByPeer(peerId, mid))
  );
  const unique = new Map<number, Message.message>();

  for(const message of messages) {
    if(message?._ === 'message') unique.set(message.mid, message);
  }

  console.warn('[tweb-cn] sync: search returned', unique.size, 'text messages');
  return [...unique.values()];
}

async function loadRemoteSettings(peerId: PeerId): Promise<RemoteSettings | undefined> {
  const parsed = (await searchSyncMessages(peerId))
  .map(parseSyncMessage)
  .filter((item): item is ParsedSyncMessage => {
    return !!item && (!item.accountId || item.accountId === String(peerId));
  })
  .sort((a, b) => a.updatedAt - b.updatedAt || a.message.mid - b.message.mid);

  if(!parsed.length) {
    console.warn('[tweb-cn] sync: no cloud snapshot found for peer=', peerId);
    return;
  }

  // Old clients could publish partial snapshots after localStorage was cleared.
  // Merge oldest to newest so an absent key does not erase an older value, while
  // an explicitly empty string still clears that setting.
  const merged: Record<string, string> = {};
  for(const snapshot of parsed) Object.assign(merged, snapshot.settings);

  const latest = parsed[parsed.length - 1];
  const settings = normalizeAdvancedSettings(merged);
  console.warn(
    '[tweb-cn] sync: loaded',
    parsed.length,
    'cloud snapshots, latest=',
    latest.updatedAt,
    'keys=',
    Object.keys(settings)
  );

  return {
    latest,
    messages: parsed,
    settings,
    updatedAt: latest.updatedAt
  };
}

function settingsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  return aKeys.length === bKeys.length &&
    aKeys.every((key, index) => key === bKeys[index] && a[key] === b[key]);
}

function createPayload(peerId: PeerId, snapshot: AdvancedSettingsSnapshot): string {
  return ADVANCED_SETTINGS_SYNC_MARKER + JSON.stringify({
    _v: 2,
    _account: String(peerId),
    _ts: snapshot.updatedAt,
    settings: snapshot.settings
  });
}

function createPayloadEntities(payload: string): MessageEntity[] {
  return [{
    _: 'messageEntityCode',
    offset: 0,
    length: payload.length
  }];
}

async function cleanupOldSyncMessages(peerId: PeerId, keepMid: number): Promise<void> {
  const staleMids = remoteSettings?.messages
  .map(({message}) => message.mid)
  .filter((mid) => mid !== keepMid) || [];
  if(!staleMids.length) return;

  await getProxiedManagers().appMessagesManager.deleteMessages(peerId, staleMids, true);
  console.warn('[tweb-cn] sync: removed', staleMids.length, 'obsolete cloud snapshots');
}

async function writeToSavedMessages(): Promise<void> {
  if(!syncReady || !activePeerId) {
    syncRequestedBeforeReady = true;
    console.warn('[tweb-cn] sync: write deferred until cloud restore finishes');
    return;
  }

  if(syncInFlight) {
    syncRequestedWhileWriting = true;
    return syncInFlight;
  }

  const peerId = activePeerId;
  const snapshot = readAccountAdvancedSettings(peerId);
  if(!snapshot || !snapshot.updatedAt) {
    console.warn('[tweb-cn] sync: skipped empty/default-only snapshot');
    return;
  }

  syncInFlight = (async() => {
    let writeFailed = false;
    try {
      const manager = getProxiedManagers().appMessagesManager;
      const payload = createPayload(peerId, snapshot);
      const entities = createPayloadEntities(payload);
      const existingMessage = remoteSettings?.latest.message;

      if(existingMessage) {
        await manager.editMessage(existingMessage, payload, {entities, noWebPage: true});
        console.warn('[tweb-cn] sync: updated Saved Messages snapshot mid=', existingMessage.mid);
        await cleanupOldSyncMessages(peerId, existingMessage.mid);
      } else {
        await manager.sendText({peerId, text: payload, entities, clearDraft: true, noWebPage: true});
        console.warn('[tweb-cn] sync: created Saved Messages snapshot');
      }

      remoteSettings = await loadRemoteSettings(peerId);
    } catch(err) {
      writeFailed = true;
      console.warn('[tweb-cn] sync: cloud write failed:', err);
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        syncRequestedWhileWriting = false;
        queueSyncToSavedMessages();
      }, SYNC_RETRY_MS);
    } finally {
      syncInFlight = undefined;
      if(syncRequestedWhileWriting && !writeFailed) {
        syncRequestedWhileWriting = false;
        queueSyncToSavedMessages();
      }
    }
  })();

  return syncInFlight;
}

export function queueSyncToSavedMessages(): void {
  if(!syncReady) {
    syncRequestedBeforeReady = true;
    console.warn('[tweb-cn] sync: local change queued before initialization');
    return;
  }

  clearTimeout(syncTimer);
  syncTimer = setTimeout(writeToSavedMessages, SYNC_DEBOUNCE_MS);
}

async function initializeForPeer(peerId: PeerId): Promise<boolean> {
  syncReady = false;
  const local = readAccountAdvancedSettings(peerId);
  const hadLegacySettings = !local && hasLegacyAdvancedSettings();
  const legacySettings = hadLegacySettings ? readLegacyAdvancedSettings() : undefined;

  if(isTestMode()) {
    replaceAccountAdvancedSettings(
      peerId,
      local?.settings || legacySettings || ADVANCED_SETTINGS_DEFAULTS,
      local?.updatedAt || 0
    );
    removeLegacyAdvancedSettings();
    console.warn('[tweb-cn] sync: test mode uses account-local settings only');
    return true;
  }

  remoteSettings = await loadRemoteSettings(peerId);
  let shouldWriteCloud = false;

  if(remoteSettings) {
    if(local && local.updatedAt > remoteSettings.updatedAt) {
      console.warn('[tweb-cn] sync: account-local snapshot is newer; cloud update queued');
      shouldWriteCloud = true;
    } else {
      replaceAccountAdvancedSettings(peerId, remoteSettings.settings, remoteSettings.updatedAt);
      console.warn('[tweb-cn] sync: cloud snapshot restored for peer=', peerId);
    }

    const latestNormalized = normalizeAdvancedSettings(remoteSettings.latest.settings);
    if(
      remoteSettings.latest.version < 2 ||
      remoteSettings.messages.length > 1 ||
      !settingsEqual(latestNormalized, remoteSettings.settings)
    ) {
      shouldWriteCloud = true;
      console.warn('[tweb-cn] sync: legacy/partial cloud data will be normalized to V2');
    }
  } else if(local) {
    shouldWriteCloud = !!local.updatedAt;
    console.warn('[tweb-cn] sync: no cloud snapshot; account-local snapshot will seed it');
  } else if(legacySettings) {
    replaceAccountAdvancedSettings(peerId, legacySettings, Date.now());
    shouldWriteCloud = true;
    console.warn('[tweb-cn] sync: migrated legacy localStorage settings for peer=', peerId);
  } else {
    replaceAccountAdvancedSettings(peerId, ADVANCED_SETTINGS_DEFAULTS, 0);
    console.warn('[tweb-cn] sync: initialized defaults without creating an empty cloud message');
  }

  removeLegacyAdvancedSettings();
  syncReady = true;

  if(shouldWriteCloud || syncRequestedBeforeReady) {
    syncRequestedBeforeReady = false;
    queueSyncToSavedMessages();
  }

  return true;
}

export function initializeAdvancedSettingsSync(): Promise<boolean> {
  const peerId = rootScope.myId;
  if(!peerId) {
    console.warn('[tweb-cn] sync: initialization skipped before login');
    return Promise.resolve(false);
  }

  if(activePeerId !== peerId) {
    activePeerId = peerId;
    initializationPromise = undefined;
    remoteSettings = undefined;
    syncReady = false;
  }

  if(initializationPromise) return initializationPromise;

  initializationPromise = initializeForPeer(peerId).catch((err) => {
    console.warn('[tweb-cn] sync: initialization failed; cloud writes remain locked:', err);
    initializationPromise = undefined;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(initializeAdvancedSettingsSync, SYNC_RETRY_MS);
    return false;
  });
  return initializationPromise;
}

// Compatibility for the previous unpublished index.ts integration.
export function restoreFromSavedMessages(): Promise<boolean> {
  return initializeAdvancedSettingsSync();
}

if(typeof(window) !== 'undefined') {
  window.addEventListener(ADVANCED_SETTINGS_CHANGE_EVENT, queueSyncToSavedMessages);
}
