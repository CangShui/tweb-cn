import {getAdvancedSetting, setAdvancedSetting} from '@helpers/advancedSettingsStorage';
/*
 * tweb-cn: Content filtering on the main thread.
 * Uses MutationObserver to watch only NEWLY ADDED bubbles.
 * No full-DOM scanning. Keywords from localStorage.
 */

const STORAGE_PINNED = 'tweb_cn_block_pinned';
const STORAGE_MSG_KW = 'tweb_cn_msg_keywords';
const STORAGE_USER_KW = 'tweb_cn_user_keywords';
const STORAGE_USERNAME_IDS = 'tweb_cn_username_ids';

let pinnedStyle: HTMLStyleElement | null = null;
let filterStyle: HTMLStyleElement | null = null;
const filteredMids = new Set<string>();
let observer: MutationObserver | null = null;
let rulesCache: FilterRules;
let scanGeneration = 0;

type MessageRule = {
  source: string,
  regex?: RegExp,
  literal?: string
};

type FilterRules = {
  message: MessageRule[],
  userNickname: string[],
  usernames: Set<string>
};

/* ── Pinned messages ── */

export function isBlockPinned(): boolean {
  return getAdvancedSetting(STORAGE_PINNED, '0') === '1';
}

function applyBlockPinned(enabled: boolean): void {
  if(enabled) {
    if(!pinnedStyle) {
      pinnedStyle = document.createElement('style');
      pinnedStyle.id = 'tweb-cn-block-pinned';
      pinnedStyle.textContent = '.pinned-container.pinned-message{display:none!important}';
      document.head.appendChild(pinnedStyle);
    }
  } else {
    if(pinnedStyle) { pinnedStyle.remove(); pinnedStyle = null; }
    document.getElementById('tweb-cn-block-pinned')?.remove();
  }
}

export function setBlockPinned(enabled: boolean): void {
  setAdvancedSetting(STORAGE_PINNED, enabled ? '1' : '0');
  applyBlockPinned(enabled);
}

/* ── Keywords ── */

export function getMessageKeywords(): string[] {
  return parseFilterKeywords(getAdvancedSetting(STORAGE_MSG_KW));
}

export function setMessageKeywords(v: string): void {
  setAdvancedSetting(STORAGE_MSG_KW, v);
}

export function getUserKeywords(): string[] {
  return parseFilterKeywords(getAdvancedSetting(STORAGE_USER_KW));
}

export function setUserKeywords(v: string): void {
  setAdvancedSetting(STORAGE_USER_KW, v);
}

export function getUsernameIds(): string[] {
  return parseFilterKeywords(getAdvancedSetting(STORAGE_USERNAME_IDS)).map(normalizeUsername).filter(Boolean);
}

export function setUsernameIds(v: string): void {
  setAdvancedSetting(STORAGE_USERNAME_IDS, v);
}

export function parseFilterKeywords(value: string): string[] {
  return value.split(/[\r\n,\uFF0C]+/).map((keyword) => keyword.trim()).filter(Boolean);
}

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

function compileMessageRule(source: string): MessageRule {
  try {
    return {source, regex: new RegExp(source, 'i')};
  } catch(err) {
    console.warn('[tweb-cn] invalid message filter regex, fallback to literal:', source, err);
    return {source, literal: source.toLowerCase()};
  }
}

function buildRules(): FilterRules {
  return {
    message: getMessageKeywords().map(compileMessageRule),
    userNickname: getUserKeywords().map((keyword) => keyword.toLowerCase()),
    usernames: new Set(getUsernameIds())
  };
}

function getRules(): FilterRules {
  return rulesCache ||= buildRules();
}

function invalidateRules(): void {
  rulesCache = undefined;
}

/* ── Filter ── */

function hideByMid(mid: string, reason: string, rule: string) {
  console.warn('[tweb-cn] HIDING mid=', mid, 'reason=', reason, 'rule=', rule);
  if(filteredMids.has(mid)) return;
  filteredMids.add(mid);
  if(!filterStyle) {
    filterStyle = document.createElement('style');
    filterStyle.id = 'tweb-cn-msg-filter';
    document.head.appendChild(filterStyle);
  }

  try {
    filterStyle.sheet?.insertRule('[data-mid="' + CSS.escape(mid) + '"]{display:none!important}');
  } catch(err) {
    filterStyle.textContent += '[data-mid="' + mid + '"]{display:none!important}';
  }
}

function checkBubble(bubble: HTMLElement) {
  if(bubble.style.display === 'none') return;

  const rules = getRules();
  const hasMsgKws = rules.message.length > 0;
  const hasUserKws = rules.userNickname.length > 0;
  const hasUsernameIds = rules.usernames.size > 0;

  if(!hasMsgKws && !hasUserKws && !hasUsernameIds) return;

  // Check message content keywords
  if(hasMsgKws) {
    const msgEl = bubble.querySelector('.message');
    if(msgEl) {
      const text = (msgEl.textContent || '').toLowerCase();
      console.warn('[tweb-cn] checkBubble text=', text.substring(0, 60));
      for(const rule of rules.message) {
        if((rule.regex && rule.regex.test(text)) || (rule.literal && text.includes(rule.literal))) {
          const mid = bubble.getAttribute('data-mid');
          if(mid) hideByMid(mid, 'message', rule.source);
          return;
        }
      }
    }
  }

  // Check user name keywords
  if(hasUserKws) {
    const peerTitle = bubble.querySelector('.peer-title');
    if(peerTitle) {
      const name = (peerTitle.textContent || '').toLowerCase();
      console.warn('[tweb-cn] checkBubble userName=', name.substring(0, 40));
      for(const kw of rules.userNickname) {
        if(kw && name.includes(kw)) {
          const mid = bubble.getAttribute('data-mid');
          if(mid) hideByMid(mid, 'user-nickname', kw);
          return;
        }
      }
    }
  }

  if(hasUsernameIds) {
    const username = normalizeUsername(bubble.dataset.twebCnFromUsername || '');
    console.warn('[tweb-cn] checkBubble username=', username || '(empty)');
    if(username && rules.usernames.has(username)) {
      const mid = bubble.getAttribute('data-mid');
      if(mid) hideByMid(mid, 'username-id', '@' + username);
    }
  }
}

function scanNode(node: Node) {
  if(node instanceof HTMLElement) {
    if(node.classList.contains('bubble')) {
      checkBubble(node);
    } else {
      node.querySelectorAll('.bubble').forEach(b => checkBubble(b as HTMLElement));
    }
  }
}

function startObserver() {
  console.warn('[tweb-cn] MutationObserver starting');
  if(observer) return;
  observer = new MutationObserver(mutations => {
    for(const m of mutations) {
      for(const node of m.addedNodes) {
        scanNode(node);
      }
    }
  });
  observer.observe(document.body, {childList: true, subtree: true});
}

function stopObserver() {
  if(observer) { observer.disconnect(); observer = null; }
}

/* ── Init / Refresh ── */

export function initContentFilter(): void {
  invalidateRules();
  console.warn('[tweb-cn] initContentFilter entered, rules=', getRules());
  applyBlockPinned(isBlockPinned());

  const rules = getRules();
  if(rules.message.length || rules.userNickname.length || rules.usernames.size) {
    startObserver();
    rescanExistingBubbles();
  }
}

export function refreshContentFilter(): void {
  invalidateRules();
  applyBlockPinned(isBlockPinned());
  if(filterStyle) { filterStyle.textContent = ''; filteredMids.clear(); }
  stopObserver();

  const rules = getRules();
  if(rules.message.length || rules.userNickname.length || rules.usernames.size) {
    startObserver();
    rescanExistingBubbles();
  }
  if(!rules.message.length && !rules.userNickname.length && !rules.usernames.size) {
    document.querySelectorAll('.bubble[style*="display: none"]').forEach(b => {
      (b as HTMLElement).style.display = '';
    });
  }
}

function rescanExistingBubbles(): void {
  const generation = ++scanGeneration;
  const bubbles = Array.from(document.querySelectorAll('.bubble')) as HTMLElement[];
  let index = 0;

  const scanChunk = () => {
    const end = Math.min(index + 80, bubbles.length);
    for(; index < end; ++index) {
      if(generation !== scanGeneration) return;
      checkBubble(bubbles[index]);
    }

    if(index < bubbles.length) {
      requestAnimationFrame(scanChunk);
    }
  };

  console.warn('[tweb-cn] rescanExistingBubbles count=', bubbles.length);
  scanChunk();
}
