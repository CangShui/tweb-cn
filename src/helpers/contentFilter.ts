import {getAdvancedSetting, setAdvancedSetting} from '@helpers/advancedSettingsStorage';
/*
 * tweb-cn: Content filtering on the main thread.
 * Uses MutationObserver to watch only NEWLY ADDED bubbles.
 * No full-DOM scanning. Keywords from localStorage.
 */

const STORAGE_PINNED = 'tweb_cn_block_pinned';
const STORAGE_MSG_KW = 'tweb_cn_msg_keywords';
const STORAGE_USER_KW = 'tweb_cn_user_keywords';

let pinnedStyle: HTMLStyleElement | null = null;
let filterStyle: HTMLStyleElement | null = null;
const filteredMids = new Set<string>();
let observer: MutationObserver | null = null;

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

export function parseFilterKeywords(value: string): string[] {
  return value.split(/[\r\n,\uFF0C]+/).map((keyword) => keyword.trim()).filter(Boolean);
}

/* ── Filter ── */

function hideByMid(mid: string) {
  console.warn('[tweb-cn] HIDING mid=', mid);
  if(filteredMids.has(mid)) return;
  filteredMids.add(mid);
  if(!filterStyle) {
    filterStyle = document.createElement('style');
    filterStyle.id = 'tweb-cn-msg-filter';
    document.head.appendChild(filterStyle);
  }
  filterStyle.textContent += '[data-mid="' + mid + '"]{display:none!important}';
}

function checkBubble(bubble: HTMLElement) {
  if(bubble.style.display === 'none') return;

  const msgKws = getMessageKeywords();
  const userKws = getUserKeywords();
  const hasMsgKws = msgKws.length > 0;
  const hasUserKws = userKws.length > 0;

  if(!hasMsgKws && !hasUserKws) return;

  // Check message content keywords
  if(hasMsgKws) {
    const msgEl = bubble.querySelector('.message');
    if(msgEl) {
      const text = (msgEl.textContent || '').toLowerCase();
      console.warn('[tweb-cn] checkBubble text=', text.substring(0, 60));
      for(const kw of msgKws) {
        if(kw && text.includes(kw.toLowerCase())) {
          const mid = bubble.getAttribute('data-mid');
          if(mid) hideByMid(mid);
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
      for(const kw of userKws) {
        if(kw && name.includes(kw.toLowerCase())) {
          const mid = bubble.getAttribute('data-mid');
          if(mid) hideByMid(mid);
          return;
        }
      }
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
  console.warn('[tweb-cn] initContentFilter entered, msgKw=', getMessageKeywords(), 'userKw=', getUserKeywords());
  applyBlockPinned(isBlockPinned());

  const msgKws = getMessageKeywords();
  const userKws = getUserKeywords();
  if(msgKws.length || userKws.length) {
    startObserver();
    document.querySelectorAll('.bubble').forEach(b => checkBubble(b as HTMLElement));
  }
}

export function refreshContentFilter(): void {
  applyBlockPinned(isBlockPinned());
  if(filterStyle) { filterStyle.textContent = ''; filteredMids.clear(); }
  stopObserver();

  const msgKws = getMessageKeywords();
  const userKws = getUserKeywords();
  if(msgKws.length || userKws.length) {
    startObserver();
    document.querySelectorAll('.bubble').forEach(b => checkBubble(b as HTMLElement));
  }
  if(!msgKws.length && !userKws.length) {
    document.querySelectorAll('.bubble[style*="display: none"]').forEach(b => {
      (b as HTMLElement).style.display = '';
    });
  }
}
