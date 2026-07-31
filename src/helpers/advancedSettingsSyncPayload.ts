export const ADVANCED_SETTINGS_SYNC_MARKER = 'TWEB-CN-ADVANCED-SETTINGS-V2:';
const LEGACY_SYNC_MARKER = 'TWEB_CN_SYNC_V1';

export type ParsedSyncPayload = {
  accountId?: string,
  settings: Record<string, string>,
  updatedAt: number,
  version: number
};

function isSettingsRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof(value) === 'object' && !Array.isArray(value);
}

function extractSettings(value: Record<string, unknown>): Record<string, string> {
  const settings: Record<string, string> = {};
  for(const [key, setting] of Object.entries(value)) {
    if(key.startsWith('tweb_cn_') && typeof(setting) === 'string') {
      settings[key] = setting;
    }
  }

  return settings;
}

export function parseAdvancedSettingsSyncText(
  text: string,
  fallbackUpdatedAt: number
): ParsedSyncPayload | undefined {
  const jsonStart = text.indexOf('{');
  if(jsonStart === -1) return;

  const marker = text.slice(0, jsonStart);
  if(!marker.includes(ADVANCED_SETTINGS_SYNC_MARKER) && !marker.includes(LEGACY_SYNC_MARKER)) return;

  try {
    const payload = JSON.parse(text.slice(jsonStart)) as Record<string, unknown>;
    const nestedSettings = isSettingsRecord(payload.settings) ? payload.settings : payload;
    const payloadTimestamp = Number(payload._ts || payload.updatedAt);
    const updatedAt = Number.isFinite(payloadTimestamp) && payloadTimestamp > 0 ?
      payloadTimestamp :
      fallbackUpdatedAt;

    return {
      accountId: typeof(payload._account) === 'string' ? payload._account : undefined,
      settings: extractSettings(nestedSettings),
      updatedAt,
      version: Number(payload._v || payload.version) || 1
    };
  } catch(err) {
    return;
  }
}
