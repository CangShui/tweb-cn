import type lang from '@/lang';
import type langSign from '@/langSign';
import type {State} from '@config/state';
import {IS_BETA, MOUNT_CLASS_TO} from '@config/debug';
import {HelpCountry, LangPackDifference, LangPackString} from '@layer';
import App from '@config/app';
import rootScope from '@lib/rootScope';
import {IS_MOBILE} from '@environment/userAgent';
import deepEqual from '@helpers/object/deepEqual';
import safeAssign from '@helpers/object/safeAssign';
import capitalizeFirstLetter from '@helpers/string/capitalizeFirstLetter';
import matchUrlProtocol from '@lib/richTextProcessor/matchUrlProtocol';
import wrapUrl from '@lib/richTextProcessor/wrapUrl';
import {setDirection} from '@helpers/dom/setInnerHTML';
import setBlankToAnchor from '@lib/richTextProcessor/setBlankToAnchor';
import {createSignal} from 'solid-js';
import commonStateStorage from '@lib/commonStateStorage';
import Icon from '@components/icon';
import currencyStarIcon from '@components/currencyStarIcon';

export const langPack: {[actionType: string]: LangPackKey} = {
  'messageActionChatCreate': 'ActionCreateGroup',
  'messageActionChatCreateYou': 'ActionYouCreateGroup',
  'messageActionChatEditTitle': 'ActionChangedTitle',
  'messageActionChatEditPhoto': 'ActionChangedPhoto',
  'messageActionChatEditVideo': 'ActionChangedVideo',
  'messageActionChatDeletePhoto': 'ActionRemovedPhoto',
  'messageActionChatReturn': 'ActionAddUserSelf',
  'messageActionChatReturnYou': 'ActionAddUserSelfYou',
  'messageActionChatJoined': 'ActionAddUserSelfMega',
  'messageActionChatJoinedYou': 'ChannelMegaJoined',
  'messageActionChatAddUser': 'ActionAddUser',
  'messageActionChatAddUsers': 'ActionAddUser',
  'messageActionChatLeave': 'ActionLeftUser',
  'messageActionChatLeaveYou': 'YouLeft',
  'messageActionChatDeleteUser': 'ActionKickUser',
  'messageActionChatJoinedByLink': 'ActionInviteUser',
  'messageActionPinMessage': 'Chat.Service.Group.UpdatedPinnedMessage',
  'messageActionContactSignUp': 'Chat.Service.PeerJoinedTelegram',
  'messageActionChannelCreate': 'ActionCreateChannel',
  'messageActionChannelEditTitle': 'Chat.Service.Channel.UpdatedTitle',
  'messageActionChannelEditPhoto': 'Chat.Service.Channel.UpdatedPhoto',
  'messageActionChannelEditVideo': 'Chat.Service.Channel.UpdatedVideo',
  'messageActionChannelDeletePhoto': 'Chat.Service.Channel.RemovedPhoto',
  'messageActionHistoryClear': 'HistoryCleared',
  'messageActionDiscussionStarted': 'DiscussionStarted',
  'messageActionChannelJoined': 'ChannelJoined',

  'messageActionChannelMigrateFrom': 'ActionMigrateFromGroup',

  'messageActionPhoneCall.video_in_ok': 'ChatList.Service.VideoCall.incoming',
  'messageActionPhoneCall.video_out_ok': 'ChatList.Service.VideoCall.outgoing',
  'messageActionPhoneCall.video_missed': 'ChatList.Service.VideoCall.Missed',
  'messageActionPhoneCall.video_cancelled': 'ChatList.Service.VideoCall.Cancelled',
  'messageActionPhoneCall.in_ok': 'ChatList.Service.Call.incoming',
  'messageActionPhoneCall.out_ok': 'ChatList.Service.Call.outgoing',
  'messageActionPhoneCall.missed': 'ChatList.Service.Call.Missed',
  'messageActionPhoneCall.cancelled': 'ChatList.Service.Call.Cancelled',

  'messageActionGroupCall.started': 'Chat.Service.VoiceChatStarted.Channel',
  'messageActionGroupCall.started_by': 'Chat.Service.VoiceChatStarted',
  'messageActionGroupCall.started_byYou': 'Chat.Service.VoiceChatStartedYou',
  'messageActionGroupCall.ended': 'Chat.Service.VoiceChatFinished.Channel',
  'messageActionGroupCall.ended_by': 'Chat.Service.VoiceChatFinished',
  'messageActionGroupCall.ended_byYou': 'Chat.Service.VoiceChatFinishedYou',

  'messageActionBotAllowed': 'Chat.Service.BotPermissionAllowed'
};

export type LangPackKey = /* string |  */keyof typeof lang | keyof typeof langSign;

export type FormatterArgument = string | number | Node | FormatterArgument[];
export type FormatterArguments = FormatterArgument[];

export const UNSUPPORTED_LANG_PACK_KEY: LangPackKey = IS_MOBILE ? 'Message.Unsupported.Mobile' : 'Message.Unsupported.Desktop';
const TEST_LOCAL = IS_BETA && true;

namespace I18n {
  export const strings: Map<LangPackKey, LangPackString> = new Map();
  export const countriesList: HelpCountry[] = [];
  let pluralRules: Intl.PluralRules;

  let cacheLangPackPromise: Promise<LangPackDifference>;
  let lastRequestedLangCode: string;
  let lastRequestedNormalizedLangCode: string;
  let lastAppliedLangCode: string;
  let timeFormat: State['settings']['timeFormat'];
  let isRTL = false;

  export function getLastRequestedLangCode() { return lastRequestedLangCode; }
  export function getLastRequestedNormalizedLangCode() { return lastRequestedNormalizedLangCode; }
  export function getLastAppliedLangCode() { return lastAppliedLangCode; }
  export function getTimeFormat() { return timeFormat; }
  export function getIsRTL() { return isRTL; }

  export const [langCodeNormalized, setLangCodeNormalized] = createSignal<TranslatableLanguageISO>();

  export function setRTL(rtl: boolean) {
    isRTL = rtl;
  }

  function setLangCode(langCode: string) {
    lastRequestedLangCode = langCode;
    lastRequestedNormalizedLangCode = langCode.split('-')[0];
    setLangCodeNormalized(lastRequestedNormalizedLangCode.split('-')[0] as any);
  }

  export function getCacheLangPack(dontLoadLocal?: boolean) {
    return Promise.all([
      commonStateStorage.get('langPack').then((langPack) => langPack || (dontLoadLocal ? undefined : loadLocalLangPack())),
      polyfillPromise
    ]).then(([langPack]) => langPack);
  }

  export function getCacheLangPackAndApply() {
    return cacheLangPackPromise ||= getCacheLangPack(true).then(async(langPack) => {
      if(!langPack) {
        langPack = await loadLocalLangPack();
        langPack = await saveLangPack(langPack, false);
      }

      setLangCode(langPack.lang_code);
      applyLangPack(langPack);
      return langPack;
    }).finally(() => {
      cacheLangPackPromise = undefined;
    });
  }

  function updateAmPm() {
    if(timeFormat === 'h12') {
      try {
        const dateTimeFormat = getDateTimeFormat({hour: 'numeric', minute: 'numeric', hour12: true});
        const date = new Date();
        date.setHours(0);
        const amText = dateTimeFormat.format(date);
        amPmCache.am = amText.split(/\s/)[1];
        date.setHours(12);
        const pmText = dateTimeFormat.format(date);
        amPmCache.pm = pmText.split(/\s/)[1];
      } catch(err) {
        console.error('cannot get am/pm', err);
        amPmCache.am = 'AM';
        amPmCache.pm = 'PM';
      }
    }
  }

  export function setTimeFormat(
    format: State['settings']['timeFormat'],
    haveToUpdate = !!timeFormat && timeFormat !== format
  ) {
    timeFormat = format;

    updateAmPm();

    if(haveToUpdate) {
      cachedDateTimeFormats.clear();
      const elements = Array.from(document.querySelectorAll(`.i18n`)) as HTMLElement[];
      elements.forEach((element) => {
        const instance = weakMap.get(element);

        if(instance instanceof IntlDateElement) {
          instance.update();
        }
      });
    }
  }

  export function loadLocalLangPack() {
    const defaultCode = App.langPackCode;
    return Promise.all([
      import('../lang'),
      import('../langSign'),
      import('../countries')
    ]).then(([lang, langSign, countries]) => {
      const strings: LangPackString[] = [];
      formatLocalStrings(lang.default, strings);
      formatLocalStrings(langSign.default, strings);

      const langPack: LangPackDifference = {
        _: 'langPackDifference',
        from_version: 0,
        lang_code: defaultCode,
        strings,
        version: App.langPackVersion,
        countries: countries.default,
        localVersion: App.langPackLocalVersion
      };
      return langPack;
    });
  }

  export function loadLangPack(langCode: string, web?: boolean, ignoreCache?: boolean) {
    web = true;
    const managers = rootScope.managers;
    return Promise.all([
      managers.appLangPackManager.getLangPack(langCode, web ? 'web' : App.langPack, ignoreCache),
      !web && managers.appLangPackManager.getLangPack(langCode, 'android', ignoreCache),
      import('../lang'),
      import('../langSign'),
      managers.appLangPackManager.getCountriesList(langCode, ignoreCache),
      polyfillPromise
    ]);
  }

  export function getStrings(langCode: string, strings: string[]) {
    return rootScope.managers.appLangPackManager.getStrings(langCode, strings);
  }

  export function formatLocalStrings(strings: any, pushTo: LangPackString[] = []) {
    for(const i in strings) {
      // @ts-ignore
      const v = strings[i];
      if(typeof(v) === 'string') {
        pushTo.push({
          _: 'langPackString',
          key: i,
          value: v
        });
      } else {
        pushTo.push({
          _: 'langPackStringPluralized',
          key: i,
          ...v
        });
      }
    }

    return pushTo;
  }

  export function getLangPackAndApply(langCode: string, web?: boolean, ignoreCache?: boolean) {
    setLangCode(langCode);
    return loadLangPack(langCode, web, ignoreCache).then(([langPack1, langPack2, localLangPack1, localLangPack2, countries, _]) => {
      let strings: LangPackString[] = [];

      const pushLocal = () => [localLangPack1, localLangPack2].forEach((l) => {
        formatLocalStrings(l.default as any, strings);
      });

      if(!TEST_LOCAL) pushLocal();
      strings = strings.concat(...[langPack1.strings, langPack2.strings].filter(Boolean));

      langPack1.strings = strings;
      langPack1.countries = countries;
      langPack1.localVersion = App.langPackLocalVersion;
      return saveLangPack(langPack1, true);
    });
  }

  export function saveLangPack(langPack: LangPackDifference, apply: boolean) {
    langPack.version ||= App.langPackVersion;

    if(!apply) return langPack;
    return commonStateStorage.set({langPack}).then(() => {
      applyLangPack(langPack);
      return langPack;
    });
  }

  export const polyfillPromise = (function checkIfPolyfillNeeded() {
    if(typeof(Intl) !== 'undefined' && typeof(Intl.PluralRules) !== 'undefined'/*  && false */) {
      return Promise.resolve();
    } else {
      return import('./pluralPolyfill').then((_Intl) => {
        (window as any).Intl = Object.assign(typeof(Intl) !== 'undefined' ? Intl : {}, _Intl.default);
      });
    }
  })();

  export function applyLangPack(langPack: LangPackDifference) {
    const currentLangCode = lastRequestedLangCode;
    if(langPack.lang_code !== currentLangCode) {
      return;
    }

    try {
      pluralRules = new Intl.PluralRules(lastRequestedNormalizedLangCode);
    } catch(err) {
      console.error('pluralRules error', err);
      pluralRules = new Intl.PluralRules(lastRequestedNormalizedLangCode.split('-', 1)[0]);
    }

    try {
      pluralRules = new Intl.PluralRules(langPack.lang_code);
    } catch(err) {
      console.error('pluralRules error', err);
      pluralRules = new Intl.PluralRules(langPack.lang_code.split('-', 1)[0]);
    }

    strings.clear();

    for(const string of langPack.strings) {
      strings.set(string.key as LangPackKey, string);
    }

    // tweb-cn: hardcoded Chinese overrides
    const zh: Record<string, string> = {'Animations':'动画', 'AttachAlbum':'相册', 'Appearance.Color.Hex':'十六进制', 'Appearance.Color.RGB':'RGB', 'BlockModal.Search.Placeholder':'搜索用户...', 'DarkMode':'暗黑模式', 'FilterMenuDelete':'删除文件夹', 'FilterHeaderEdit':'编辑文件夹', 'FilterAllGroups':'所有群组', 'FilterAllContacts':'所有联系人', 'FilterAllNonContacts':'所有非联系人', 'FilterAllChannels':'所有频道', 'FilterAllBots':'所有机器人', 'FilterPersonal':'个人', 'EditContact.OriginalName':'原始名称', 'EditProfile.FirstNameLabel':'姓名', 'EditProfile.BioLabel':'简介', 'EditProfile.Username.Label':'用户名', 'EditProfile.Username.Available':'用户名可用', 'EditProfile.Username.Taken':'用户名已被占用', 'EditProfile.Username.Invalid':'用户名无效', 'EditFolder.Toast.ChooseChat':'请至少选择一个聊天。', 'EditFolder.EmojiAsIconTip':'将表情符号放在开头或末尾，它将显示为文件夹图标。', 'EditProfile.AddBirthdayRow':'添加生日', 'EditProfile.PersonalChannel.Label':'频道', 'EditProfile.PersonalChannel.Add':'添加', 'EditProfile.PersonalChannel.Title':'个人频道', 'EditProfile.PersonalChannel.Description':'在个人资料中显示您管理的频道。', 'EditProfile.PersonalChannel.PickerTitle':'选择频道', 'EditProfile.PersonalChannel.NoChannels':'您没有符合条件的频道。', 'EditProfile.PersonalChannel.Remove':'移除频道', 'EditBot.Title':'编辑机器人', 'EditBot.Username.Caption':'此用户名无法编辑。', 'EditBot.Buttons.Intro':'编辑简介', 'EditBot.Buttons.Commands':'编辑命令', 'EditBot.Buttons.Settings':'更改机器人设置', 'Chat.Menu.SelectMessages':'选择消息', 'Chat.Menu.ClearSelection':'清除选择', 'Chat.Input.UnpinAll':'取消置顶所有消息', 'Chat.Input.Attach.PhotoOrVideo':'照片或视频', 'Chat.Input.Attach.Document':'文件', 'Chat.Input.Record.Voice':'语音消息', 'AccountSettings.Notifications':'通知', 'AccountSettings.PrivacyAndSecurity':'隐私和安全', 'Telegram.GeneralSettingsViewController':'通用设置', 'AccountSettings.Filters':'聊天文件夹', 'AccountSettings.SpeakersAndCamera':'扬声器和摄像头', 'AccountSettings.Language':'语言', 'KeyboardShortcuts.Title':'键盘快捷键', 'AccountSettings.Logout':'退出登录', 'EditAccount.Logout':'退出登录', 'Premium.Boarding.Title':'Telegram Premium', 'MenuTelegramStars':'Telegram Stars', 'Chat.Menu.SendGift':'发送礼物', 'SendGiftTo':'选择收礼人', 'CallSettings.AcceptCalls':'接受通话', 'CallSettings.DeviceDefault':'系统默认', 'CallSettings.Speakers':'扬声器', 'CallSettings.Microphone':'麦克风', 'CallSettings.OutputSection':'输出设备', 'CallSettings.InputSection':'输入设备', 'LiteMode.Info':'开启后可节省电量并提升性能。', 'LiteMode.DisableAlert':'请先关闭省电模式的主开关。', 'CreateGroup':'创建群组', 'CreateChannel':'创建频道', 'ClearHistory':'清除聊天记录', 'DeleteChat':'删除聊天', 'MarkAsRead':'标记已读', 'MarkAsUnread':'标记未读', 'ReadAll':'全部已读', 'UserBio':'个人简介', 'Preview':'预览', 'Language.zh-hans':'简体中文', 'Language.zh-hant':'繁體中文', 'Language.en':'English', 'PasscodeLock.Title':'密码锁定', 'FilterIncludeExcludeInfo':'选择将在此文件夹中显示和不显示的聊天。', 'Settings':'设置', 'Saved Messages':'收藏夹', 'Contacts':'联系人', 'Calls':'通话', 'Chats':'聊天', 'TextSize':'文字大小', 'ChatBackground':'聊天背景', 'EnableAnimations':'启用动画', 'DistanceUnitsTitle':'距离单位', 'DistanceUnitsKilometers':'公里', 'DistanceUnitsMiles':'英里', 'ColorTheme':'颜色主题', 'ThemeDay':'日间', 'ThemeNight':'夜间', 'ThemeLight':'浅色', 'ThemeTinted':'深色', 'AutoNightSystemDefault':'跟随系统', 'Devices':'设备', 'SessionsTitle':'活跃会话', 'WebSessionsTitle':'网页会话', 'Telegram.NotificationSettingsViewController':'通知设置', 'PrivacySettings':'隐私和安全', 'PrivacyMessages':'消息隐私', 'PrivacyLastSeen':'最后上线时间', 'PrivacyPhone':'手机号码', 'PrivacyProfilePhoto':'个人资料照片', 'PrivacySettings.Forwards':'转发消息', 'PrivacySettings.Groups':'群组和频道', 'PrivacySettings.VoiceCalls':'语音通话', 'PrivacyVoiceMessages':'语音消息', 'PrivacyGifts':'礼物', 'BlockedUsers':'已屏蔽用户', 'TwoStepVerificationTitle':'两步验证', 'DataSettings':'数据和存储', 'EditAccount.Title':'编辑资料', 'Telegram.LanguageViewController':'语言', 'LanguageName':'简体中文', 'Checkbox.Enabled':'已开启', 'Checkbox.Disabled':'已关闭', 'Cancel':'取消', 'Save':'保存', 'Delete':'删除', 'Edit':'编辑', 'Search':'搜索', 'Close':'关闭', 'OK':'确定', 'Done':'完成', 'Next':'下一步', 'Back':'返回', 'Copy':'复制', 'Share':'分享', 'Forward':'转发', 'Reply':'回复', 'Pin':'置顶', 'Unpin':'取消置顶', 'Mute':'静音', 'Unmute':'取消静音', 'Archive':'归档', 'Unarchive':'取消归档', 'Leave':'离开', 'Join':'加入', 'Report':'举报', 'Block':'屏蔽', 'Unblock':'取消屏蔽', 'LogOut':'退出登录', 'Select':'选择', 'Send':'发送', 'Download':'下载', 'Upload':'上传', 'Add':'添加', 'Remove':'移除', 'Today':'今天', 'Yesterday':'昨天', 'Online':'在线', 'Offline':'离线', 'NewChannel':'新建频道', 'NewGroup':'新建群组', 'GroupMembers':'群组成员', 'GroupAddMembers':'添加成员', 'ChannelType':'频道类型', 'ChannelPermissions':'频道权限', 'EditAdmin':'编辑管理员', 'RecentActions':'近期操作', 'InviteLinks':'邀请链接', 'InviteLink':'邀请链接', 'NewLink':'新链接', 'ArchivedChats':'已归档聊天', 'ArchiveSettings':'归档设置', 'AutoDeleteMessages':'自动删除消息', 'LiteMode.Title':'省电模式', 'LiteMode.EnableText':'省电模式', 'Privacy.Passkeys':'通行密钥', 'Login.Title':'登录', 'Login.Next':'下一步', 'PleaseWait':'请稍候...', 'FilterAlwaysShow':'始终显示', 'FilterNeverShow':'从不显示', 'StickersName':'贴纸与表情', 'CallSettings.OutputDevice':'扬声器', 'CallSettings.InputDevice':'麦克风', 'Loading':'加载中...', 'Error':'错误', 'UserStatus.Online':'在线', 'UserStatus.Offline':'离线', 'KeyboardShortcuts.Caption':'显示适用于您平台的快捷键。', 'KeyboardShortcuts.Section.Formatting':'文本格式', 'KeyboardShortcuts.Section.Formatting.Caption':'在聊天输入框中选择文本以应用格式。', 'KeyboardShortcuts.Section.Messages':'消息', 'KeyboardShortcuts.Section.Messages.Caption':'选择消息发送方式和换行插入方式。', 'KeyboardShortcuts.Section.Chat':'聊天', 'KeyboardShortcuts.Section.Navigation':'导航', 'KeyboardShortcuts.Section.MediaViewer':'媒体查看器', 'KeyboardShortcuts.Section.Stories':'快拍', 'KeyboardShortcuts.Section.MediaEditor':'媒体编辑器', 'KeyboardShortcuts.Section.Other':'其他', 'KeyboardShortcuts.Action.Bold':'粗体', 'KeyboardShortcuts.Action.Italic':'斜体', 'KeyboardShortcuts.Action.Underline':'下划线', 'KeyboardShortcuts.Action.Strikethrough':'删除线', 'KeyboardShortcuts.Action.Monospace':'等宽字体', 'KeyboardShortcuts.Action.Spoiler':'剧透', 'KeyboardShortcuts.Action.Link':'添加链接', 'KeyboardShortcuts.Action.Send':'发送消息', 'KeyboardShortcuts.Action.NewLine':'换行', 'KeyboardShortcuts.Action.EditLast':'编辑上一条消息', 'KeyboardShortcuts.Action.ReplyToPrevious':'回复上一条消息', 'KeyboardShortcuts.Action.JumpToInputStart':'跳转到输入框开头', 'KeyboardShortcuts.Action.JumpToInputEnd':'跳转到输入框末尾', 'KeyboardShortcuts.Action.NextChat':'下一个聊天', 'KeyboardShortcuts.Action.PreviousChat':'上一个聊天', 'KeyboardShortcuts.Action.OpenSearch':'打开搜索', 'KeyboardShortcuts.Action.SavedMessages':'打开收藏夹', 'KeyboardShortcuts.Action.ClosePopup':'关闭弹窗或菜单', 'KeyboardShortcuts.Action.NextMedia':'下一个媒体', 'KeyboardShortcuts.Action.PreviousMedia':'上一个媒体', 'KeyboardShortcuts.Action.ZoomIn':'放大', 'KeyboardShortcuts.Action.ZoomOut':'缩小', 'KeyboardShortcuts.Action.NextStory':'下一个快拍', 'KeyboardShortcuts.Action.PreviousStory':'上一个快拍', 'KeyboardShortcuts.Action.CloseStories':'关闭快拍', 'KeyboardShortcuts.Action.PlayPauseStory':'播放/暂停快拍', 'KeyboardShortcuts.Action.Undo':'撤销', 'KeyboardShortcuts.Action.Redo':'重做', 'KeyboardShortcuts.Action.LockPasscode':'通过密码锁定', 'KeyboardShortcuts.Hint.LockPasscodeNotSet':'在隐私和安全中设置', 'KeyboardShortcuts.Hint.SendDepends':'取决于设置', 'KeyboardShortcuts.Hint.WhenInputEmpty':'当输入框为空时', 'General.SendShortcut.NewLine.ShiftEnter':'按 Shift + Enter 换行', 'General.SendShortcut.NewLine.Enter':'按 Enter 换行', 'General.SendShortcut.Enter':'按 Enter 发送', 'General.SendShortcut.CtrlEnter':'按 Ctrl + Enter 发送', 'General.Keyboard':'键盘', 'General.TimeFormat':'时间格式', 'General.TimeFormat.h12':'12小时制', 'General.TimeFormat.h23':'24小时制', 'EnableDarkMode':'启用暗黑模式', 'DisableDarkMode':'禁用暗黑模式', 'DisableAnimations':'禁用动画', 'ChatBackground.UploadWallpaper':'上传壁纸', 'ChatBackground.Blur':'模糊壁纸图像'};
    for(const k of Object.keys(zh)) {
      strings.set(k as LangPackKey, {_: 'langPackString' as any, key: k, value: zh[k]} as any);
    }


    if(langPack.countries) {
      countriesList.length = 0;
      countriesList.push(...langPack.countries.countries);

      langPack.countries.countries.forEach((country) => {
        if(country.name) {
          const langPackKey: any = country.default_name;
          strings.set(langPackKey, {
            _: 'langPackString',
            key: langPackKey,
            value: country.name
          });
        }
      });
    }

    if(lastAppliedLangCode !== currentLangCode) {
      if(lastAppliedLangCode && rootScope.myId) {
        rootScope.managers.appReactionsManager.resetAvailableReactions();
        rootScope.managers.appUsersManager.indexMyself();
        rootScope.managers.dialogsStorage.indexMyDialog();
      }

      lastAppliedLangCode = currentLangCode;
      cachedDateTimeFormats.clear();
      updateAmPm();
      rootScope.dispatchEvent('language_change', currentLangCode);
    }

    const elements = Array.from(document.querySelectorAll(`.i18n`)) as HTMLElement[];
    elements.forEach((element) => {
      const instance = weakMap.get(element);

      if(instance) {
        instance.update();
      }
    });

    rootScope.dispatchEventSingle('language_apply');
  }

  function pushNextArgument(out: ReturnType<typeof superFormatter>, args: FormatterArguments, indexHolder: {i: number}, i?: number) {
    const arg = args[i === undefined ? indexHolder.i++ : i];
    if(Array.isArray(arg)) {
      out.push(...arg as any);
    } else {
      out.push(arg);
    }
  }

  const IconMap: Record<string, Icon | (() => HTMLElement)> = {
    '>': 'next',
    '<': 'previous'
    // '⭐️': currencyStarIcon as () => HTMLElement
  };

  const iconsNoWhitespace = '><';
  const iconsKeys = Object.keys(IconMap);

  export function superFormatter(input: string, args?: FormatterArguments, indexHolder?: {i: number}): Exclude<FormatterArgument, FormatterArgument[]>[] {
    if(!indexHolder) { // set starting index for arguments without order
      indexHolder = {i: 0};
      const indexes = input.match(/(%|un)\d+/g);
      if(indexes?.length) {
        indexHolder.i = Math.max(...indexes.map((str) => +str.replace(/\D/g, '')));
      }
    }

    const out: ReturnType<typeof superFormatter> = [];
    const regExp = new RegExp(`(\\*\\*|__)(.+?)\\1|(\\n)|(\\[.+?\\]\\(.*?\\))|(?:^|\\s)(${iconsKeys.join('|')})(?:$|\\s)|un\\d|%\\d\\$.|%\\S`, 'g');

    let lastIndex = 0;
    input.replace(regExp, (match, p1: any, p2: any, p3: any, p4: string, p5: string, offset: number, string: string) => {
      // console.table({match, p1, p2, offset, string});

      if(offset > lastIndex) {
        out.push(string.slice(lastIndex, offset));
      }

      if(p1) {
        // offset += p1.length;
        let element: HTMLElement;
        switch(p1) {
          case '**': {
            element = document.createElement('b');
            break;
          }

          case '__': {
            element = document.createElement('i');
            break;
          }
        }

        element.append(...superFormatter(p2, args, indexHolder) as any);
        out.push(element);
      } else if(p3) {
        out.push(document.createElement('br'));
      } else if(p4) {
        const idx = p4.lastIndexOf(']');
        const text = p4.slice(1, idx);

        const url = p4.slice(idx + 2, p4.length - 1);
        let a: HTMLAnchorElement;
        if(url && matchUrlProtocol(url)) {
          a = document.createElement('a');
          const wrappedUrl = wrapUrl(url);
          a.href = wrappedUrl.url;
          if(wrappedUrl.onclick) a.setAttribute('onclick', wrappedUrl.onclick + '(this)');
          setBlankToAnchor(a);
        } else {
          a = args[indexHolder.i++] as HTMLAnchorElement;

          if(a instanceof DocumentFragment) { // right after wrapRichText
            a = a.firstChild as any;
          }

          if(typeof(a) !== 'string') {
            a.textContent = ''; // reset content
          }
        }

        const formatted = superFormatter(text, args, indexHolder) as any;
        if(typeof(a) === 'string') {
          out.push(...formatted);
        } else {
          a.append(...formatted);
          out.push(a);
        }
      } else if(p5) {
        const noWhitespace = iconsNoWhitespace.includes(p5);
        if(!noWhitespace && !match.startsWith(p5)) out.push(match[0]);
        const className = 'inline-icon';
        const i = IconMap[p5];
        if(typeof(i) === 'function') {
          const element = i();
          element.classList.add(className);
          out.push(element);
        } else {
          out.push(Icon(i, className));
        }
        if(!noWhitespace && match.startsWith(p5)) out.push(match[match.length - 1]);
      } else if(args) {
        const index = match.replace(/\D/g, '');
        pushNextArgument(
          out,
          args,
          indexHolder,
          !index || Number.isNaN(+index) ? undefined : Math.min(args.length - 1, +index - 1)
        );
      }

      lastIndex = offset + match.length;
      return '';
    });

    if(lastIndex !== input.length) {
      out.push(input.slice(lastIndex));
    }

    return out;
  }

  export function format<T extends boolean>(
    key: LangPackKey,
    plain?: T,
    args?: FormatterArguments
  ): T extends true ? string : ReturnType<typeof superFormatter> {
    const str = strings.get(key);
    let input: string;
    if(str) {
      if(str._ === 'langPackStringPluralized' && args?.length) {
        let v = args[0] as number | string;
        if(typeof(v) === 'string') v = +v.replace(/\D/g, '');
        const s = pluralRules.select(v);
        // @ts-ignore
        input = str[s + '_value'] || str['other_value'];
      } else if(str._ === 'langPackString') {
        input = str.value;
      } else {
        // input = '[' + key + ']';
        input = key;
      }
    } else {
      // input = '[' + key + ']';
      input = key;
    }

    const result = superFormatter(input, args);
    if(plain) { // * let's try a hack now... (don't want to replace []() entity)
      return result.map((item) => item instanceof HTMLBRElement ? '\n' : (item instanceof Node ? item.textContent : item)).join('') as any;
    } else {
      return result as any;
    }

    /* if(plain) {
      if(args?.length) {
        const regExp = /un\d|%\d\$.|%./g;
        let i = 0;
        input = input.replace(regExp, (match, offset, string) => {
          return '' + args[i++];
        });
      }

      return input;
    } else {
      return superFormatter(input, args);
    } */
  }

  export const weakMap: WeakMap<HTMLElement, IntlElementBase<IntlElementBaseOptions>> = new WeakMap();

  export type IntlElementBaseOptions = {
    element?: HTMLElement,
    property?: 'innerText' | 'innerHTML' | 'placeholder' | 'textContent',
  };

  abstract class IntlElementBase<Options extends IntlElementBaseOptions> {
    public element: IntlElementBaseOptions['element'];
    public property: IntlElementBaseOptions['property'];

    constructor(options?: Options) {
      this.element = options?.element || document.createElement('span');
      this.element.classList.add('i18n');

      this.property = options?.property;

      weakMap.set(this.element, this);
    }

    abstract update(options?: Options): void;
  }

  export type IntlElementOptions = IntlElementBaseOptions & {
    key?: LangPackKey,
    args?: FormatterArguments
  };
  export class IntlElement extends IntlElementBase<IntlElementOptions> {
    public key: IntlElementOptions['key'];
    public args: IntlElementOptions['args'];

    constructor(options: IntlElementOptions = {}) {
      super({...options, property: options.property ?? 'innerHTML'});

      if(options?.key) {
        this.update(options);
      }
    }

    public update(options?: IntlElementOptions) {
      safeAssign(this, options);

      if(!this.key) {
        this.element.replaceChildren();
        return;
      }

      if(this.property === 'innerHTML') {
        this.element.replaceChildren(...format(this.key, false, this.args) as any);
        if(this.args?.length) {
          this.element.normalize();
        }
      } else {
        // @ts-ignore
        const v = this.element[this.property];
        const formatted = format(this.key, true, this.args);

        // * hasOwnProperty won't work here
        if(v === undefined) this.element.dataset[this.property] = formatted;
        else (this.element as HTMLInputElement)[this.property] = formatted;
      }
    }

    public compareAndUpdateBool(options?: IntlElementOptions): boolean {
      if(this.key === options.key && deepEqual(this.args, options.args)) {
        return false;
      }

      this.update(options);
      return true;
    }

    public compareAndUpdate(options?: IntlElementOptions) {
      if(this.key === options.key && deepEqual(this.args, options.args)) {
        return;
      }

      return this.update(options);
    }
  }

  const cachedDateTimeFormats: Map<string, Intl.DateTimeFormat> = new Map();
  export function getDateTimeFormat(options: Intl.DateTimeFormatOptions = {}) {
    const json = JSON.stringify(options);
    let dateTimeFormat = cachedDateTimeFormats.get(json);
    if(!dateTimeFormat) {
      dateTimeFormat = new Intl.DateTimeFormat(lastRequestedNormalizedLangCode + '-u-hc-' + timeFormat, options);
      cachedDateTimeFormats.set(json, dateTimeFormat);
    }

    return dateTimeFormat;
  }

  export const amPmCache = {am: 'AM', pm: 'PM'};
  export type IntlDateElementOptions = IntlElementBaseOptions & {
    date?: Date,
    options: Intl.DateTimeFormatOptions
  };
  export class IntlDateElement extends IntlElementBase<IntlDateElementOptions> {
    public date: IntlDateElementOptions['date'];
    public options: IntlDateElementOptions['options'];

    constructor(options: IntlDateElementOptions) {
      super({...options, property: options.property ?? 'textContent'});
      setDirection(this.element);

      if(options?.date) {
        this.update(options);
      }
    }

    public update(options?: IntlDateElementOptions) {
      safeAssign(this, options);

      let text: string;
      if(this.options.hour && this.options.minute && Object.keys(this.options).length === 2/*  && false */) {
        const hours = this.date.getHours();
        text = ('0' + (timeFormat === 'h12' ? (hours % 12) || 12 : hours)).slice(-2) + ':' + ('0' + this.date.getMinutes()).slice(-2);
        // if(this.options.second) {
        //   text += ':' + ('0' + this.date.getSeconds()).slice(-2);
        // }

        if(timeFormat === 'h12') {
          text += ' ' + (hours < 12 ? amPmCache.am : amPmCache.pm);
        }
      } else {
        // * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/hourCycle#adding_an_hour_cycle_via_the_locale_string
        const dateTimeFormat = getDateTimeFormat(this.options);
        text = capitalizeFirstLetter(dateTimeFormat.format(this.date));
      }

      (this.element as any)[this.property] = text;
    }
  }

  export function i18n(key: LangPackKey, args?: FormatterArguments) {
    return new IntlElement({key, args}).element;
  }

  export function i18n_(options: IntlElementOptions) {
    return new IntlElement(options).element;
  }

  export function _i18n(element: HTMLElement, key: LangPackKey, args?: FormatterArguments, property?: IntlElementOptions['property']) {
    return new IntlElement({element, key, args, property}).element;
  }
}

export {I18n};
export default I18n;

const i18n = I18n.i18n;
export {i18n};

const i18n_ = I18n.i18n_;
export {i18n_};

const _i18n = I18n._i18n;
export {_i18n};

export function joinElementsWith<T>(
  elements: T[],
  joiner: T | string | ((isLast: boolean) => T)
): T[] {
  const arr = elements.slice(0, 1) as T[];
  for(let i = 1; i < elements.length; ++i) {
    const isLast = (elements.length - 1) === i;
    arr.push(typeof(joiner) === 'function' ? (joiner as any)(isLast) : joiner);
    arr.push(elements[i]);
  }

  return arr;
}


export function join(elements: (Node | string)[], useLast: boolean, plain: true): string;
export function join(elements: (Node | string)[], useLast?: boolean, plain?: false): (string | Node)[];
export function join(elements: (Node | string)[], useLast: boolean, plain: boolean): string | (string | Node)[];
export function join(elements: (Node | string)[], useLast = true, plain?: boolean): string | (string | Node)[] {
  const joined = joinElementsWith(elements, (isLast) => {
    const langPackKey: LangPackKey = isLast && useLast ? 'AutoDownloadSettings.LastDelimeter' : 'AutoDownloadSettings.Delimeter';
    return plain ? I18n.format(langPackKey, true) : i18n(langPackKey);
  });

  return plain ? joined.join('') : joined;
}

export async function handleUpdateLangPack(update: {difference: LangPackDifference}) {
  const {difference} = update;

  // Check if this update is for the current language
  if(difference.lang_code !== I18n.getLastRequestedLangCode()) {
    return;
  }

  // Get current langPack from storage
  const storedLangPack = await I18n.getCacheLangPack();
  if(storedLangPack?.lang_code !== difference.lang_code || storedLangPack.lang_code !== I18n.getLastRequestedLangCode()) {
    return;
  }

  if(storedLangPack.version !== difference.from_version) {
    handleUpdateLangPackTooLong(difference);
    return;
  }

  // Apply updates to langPack
  if(difference.strings) {
    const storedStrings = storedLangPack.strings ||= [];
    for(const string of difference.strings) {
      const existingIndex = storedStrings.findIndex((s) => s.key === string.key);
      if(existingIndex !== -1) {
        storedStrings[existingIndex] = string;
      } else {
        storedStrings.push(string);
      }
    }
  }

  // if(difference.countries) {
  //   const storedCountries = storedLangPack.countries ||= {_: 'help.countriesList', countries: [], hash: 0};
  //   for(const country of difference.countries.countries) {
  //     const existingIndex = storedCountries.countries.findIndex((c) => c.default_name === country.default_name);
  //     if(existingIndex !== -1) {
  //       storedCountries.countries[existingIndex] = country;
  //     } else {
  //       storedCountries.countries.push(country);
  //     }
  //   }
  //   // Update hash if provided
  //   if(difference.countries.hash) {
  //     storedCountries.hash = difference.countries.hash;
  //   }
  // }

  // Update version
  storedLangPack.version = difference.version;
  storedLangPack.from_version = difference.from_version;

  // Save updated langPack and apply it
  await I18n.saveLangPack(storedLangPack, true);
}

export function handleUpdateLangPackTooLong(update: {lang_code: string}) {
  const {lang_code} = update;

  // Check if this update is for the current language
  if(lang_code !== I18n.getLastRequestedLangCode()) {
    return;
  }

  // I18n.getLangPack(lang_code, undefined, true);
  checkLangPackForUpdates();
}

export function handleStateCleared() {
  handleUpdateLangPackTooLong({lang_code: I18n.getLastRequestedLangCode()});
}

export async function checkLangPackForUpdates() {
  const storedLangPack = await I18n.getCacheLangPack();
  const difference = await rootScope.managers.appLangPackManager.getDifference(storedLangPack.lang_code, storedLangPack.version);
  if(difference.version > storedLangPack.version) {
    return handleUpdateLangPack({difference});
  }
}

// Listen for events from rootScope to handle server updates
rootScope.addEventListener('langpack_update', handleUpdateLangPack);
rootScope.addEventListener('langpack_update_too_long', handleUpdateLangPackTooLong);
rootScope.addEventListener('state_cleared', handleStateCleared);

MOUNT_CLASS_TO && (MOUNT_CLASS_TO.I18n = I18n);

