import {describe, expect, test} from 'vitest';
import {normalizeAdvancedSettings} from '@helpers/advancedSettingsStorage';
import {parseAdvancedSettingsSyncText} from '@helpers/advancedSettingsSyncPayload';
import {normalizeUsername, parseFilterKeywords} from '@helpers/contentFilter';

describe('advanced settings', () => {
  test('parses mixed newline and comma keyword separators', () => {
    expect(parseFilterKeywords('airport\nfree,trial\uFF0Cpromotion\r\n prize ')).toEqual([
      'airport',
      'free',
      'trial',
      'promotion',
      'prize'
    ]);
  });

  test('keeps regular expression message rules intact', () => {
    const [rule] = parseFilterKeywords('啊(.*)哦');
    expect(new RegExp(rule, 'i').test('啊吧哦')).toBe(true);
  });

  test('normalizes exact username ids', () => {
    expect(normalizeUsername('  @@Example_User  ')).toBe('example_user');
  });

  test('keeps explicit empty keyword values in a normalized snapshot', () => {
    const settings = normalizeAdvancedSettings({
      tweb_cn_msg_keywords: '',
      tweb_cn_user_keywords: 'bot,marketing'
    });

    expect(settings.tweb_cn_msg_keywords).toBe('');
    expect(settings.tweb_cn_user_keywords).toBe('bot,marketing');
  });

  test('migrates legacy image privacy switches', () => {
    const settings = normalizeAdvancedSettings({
      tweb_cn_block_image_avatars: '1'
    });

    expect(settings.tweb_cn_restrict_images).toBe('1');
    expect(settings.tweb_cn_block_image_avatars).toBeUndefined();
  });

  test('reads legacy sync messages after Telegram removes Markdown markers', () => {
    const payload = parseAdvancedSettingsSyncText(
      'TWEB_CN_SYNC_V1{"tweb_cn_msg_keywords":"airport,trial","_ts":"123","_v":"1"}',
      0
    );

    expect(payload?.updatedAt).toBe(123);
    expect(payload?.version).toBe(1);
    expect(payload?.settings.tweb_cn_msg_keywords).toBe('airport,trial');
  });

  test('reads the V2 account-scoped sync format', () => {
    const payload = parseAdvancedSettingsSyncText(
      'TWEB-CN-ADVANCED-SETTINGS-V2:{"_v":2,"_account":"42","_ts":456,"settings":{"tweb_cn_block_ads":"1"}}',
      0
    );

    expect(payload?.accountId).toBe('42');
    expect(payload?.updatedAt).toBe(456);
    expect(payload?.settings.tweb_cn_block_ads).toBe('1');
  });
});
