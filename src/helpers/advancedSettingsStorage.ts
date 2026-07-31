import rootScope from '@lib/rootScope';

export const ADVANCED_SETTINGS_CHANGE_EVENT = 'tweb-cn-advanced-settings-change';

export const ADVANCED_SETTINGS_DEFAULTS: Record<string, string> = {
  tweb_cn_block_pinned: '0',
  tweb_cn_block_ads: '0',
  tweb_cn_restrict_images: '0',
  tweb_cn_restrict_images_mode: 'always',
  tweb_cn_restrict_images_start: '22:00',
  tweb_cn_restrict_images_end: '08:00',
  tweb_cn_msg_keywords: '',
  tweb_cn_user_keywords: '',
  tweb_cn_username_ids: ''
};

const ACCOUNT_STORAGE_PREFIX = 'tweb_cn_advanced_settings_account_';
const LEGACY_SETTING_PREFIX = 'tweb_cn_';
const INTERNAL_SETTING_PREFIXES = [
  ACCOUNT_STORAGE_PREFIX,
  'tweb_cn_sync_'
];
const LEGACY_BLOCK_AVATARS = 'tweb_cn_block_image_avatars';
const LEGACY_CLICK_TO_LOAD_STICKERS = 'tweb_cn_click_to_load_stickers';

export type AdvancedSettingsSnapshot = {
  updatedAt: number,
  settings: Record<string, string>
};

function getAccountStorageKey(peerId: PeerId): string {
  return ACCOUNT_STORAGE_PREFIX + peerId;
}

function isAdvancedSettingKey(key: string): boolean {
  return key.startsWith(LEGACY_SETTING_PREFIX) &&
    !INTERNAL_SETTING_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function parseSnapshot(value: string): AdvancedSettingsSnapshot | undefined {
  if(!value) return;

  try {
    const snapshot = JSON.parse(value) as AdvancedSettingsSnapshot;
    if(!snapshot || typeof(snapshot.updatedAt) !== 'number' || !snapshot.settings || typeof(snapshot.settings) !== 'object') {
      return;
    }

    return {
      updatedAt: snapshot.updatedAt,
      settings: normalizeAdvancedSettings(snapshot.settings)
    };
  } catch(err) {
    console.warn('[tweb-cn] failed to parse account settings cache:', err);
  }
}

export function normalizeAdvancedSettings(settings: Record<string, unknown>): Record<string, string> {
  const normalized = {...ADVANCED_SETTINGS_DEFAULTS};

  for(const [key, value] of Object.entries(settings)) {
    if(isAdvancedSettingKey(key) && typeof(value) === 'string') {
      normalized[key] = value;
    }
  }

  if(
    !('tweb_cn_restrict_images' in settings) &&
    (normalized[LEGACY_BLOCK_AVATARS] === '1' || normalized[LEGACY_CLICK_TO_LOAD_STICKERS] === '1')
  ) {
    normalized.tweb_cn_restrict_images = '1';
  }

  delete normalized[LEGACY_BLOCK_AVATARS];
  delete normalized[LEGACY_CLICK_TO_LOAD_STICKERS];
  return normalized;
}

export function readAccountAdvancedSettings(peerId: PeerId): AdvancedSettingsSnapshot | undefined {
  return parseSnapshot(localStorage.getItem(getAccountStorageKey(peerId)));
}

export function readLegacyAdvancedSettings(): Record<string, string> {
  const settings: Record<string, string> = {};

  for(let i = 0; i < localStorage.length; ++i) {
    const key = localStorage.key(i);
    if(!key || !isAdvancedSettingKey(key)) continue;

    const value = localStorage.getItem(key);
    if(value !== null) settings[key] = value;
  }

  return normalizeAdvancedSettings(settings);
}

export function hasLegacyAdvancedSettings(): boolean {
  for(let i = 0; i < localStorage.length; ++i) {
    const key = localStorage.key(i);
    if(key && isAdvancedSettingKey(key)) return true;
  }

  return false;
}

export function removeLegacyAdvancedSettings(): void {
  const keys: string[] = [];
  for(let i = 0; i < localStorage.length; ++i) {
    const key = localStorage.key(i);
    if(key && isAdvancedSettingKey(key)) keys.push(key);
  }

  keys.forEach((key) => localStorage.removeItem(key));
}

export function replaceAccountAdvancedSettings(
  peerId: PeerId,
  settings: Record<string, unknown>,
  updatedAt: number
): AdvancedSettingsSnapshot {
  const snapshot: AdvancedSettingsSnapshot = {
    updatedAt,
    settings: normalizeAdvancedSettings(settings)
  };

  localStorage.setItem(getAccountStorageKey(peerId), JSON.stringify(snapshot));
  return snapshot;
}

export function getAdvancedSetting(key: string, fallback = ''): string {
  const peerId = rootScope.myId;
  if(peerId) {
    const snapshot = readAccountAdvancedSettings(peerId);
    if(snapshot) return snapshot.settings[key] ?? fallback;
  }

  return localStorage.getItem(key) ?? fallback;
}

export function setAdvancedSetting(key: string, value: string): void {
  setAdvancedSettings({[key]: value});
}

export function setAdvancedSettings(values: Record<string, string>): void {
  const peerId = rootScope.myId;
  if(!peerId) {
    for(const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
    return;
  }

  const current = readAccountAdvancedSettings(peerId);
  const snapshot = replaceAccountAdvancedSettings(peerId, {
    ...(current?.settings || ADVANCED_SETTINGS_DEFAULTS),
    ...values
  }, Date.now());

  window.dispatchEvent(new CustomEvent(ADVANCED_SETTINGS_CHANGE_EVENT, {
    detail: {peerId, keys: Object.keys(values), snapshot}
  }));
}
