import {queueSyncToSavedMessages} from '@helpers/contentFilterSync';
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
  return localStorage.getItem(STORAGE_PINNED) === '1';
}

export function setBlockPinned(enabled: boolean): void {
  localStorage.setItem(STORAGE_PINNED, enabled ? '1' : '0');
  queueSyncToSavedMessages();
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

/* ── Keywords ── */

export function getMessageKeywords(): string[] {
  return (localStorage.getItem(STORAGE_MSG_KW) || '').split(',').map(s => s.trim()).filter(Boolean);
}
export function setMessageKeywords(v: string): void { localStorage.setItem(STORAGE_MSG_KW, v); queueSyncToSavedMessages(); }
export function getUserKeywords(): string[] {
  return (localStorage.getItem(STORAGE_USER_KW) || '').split(',').map(s => s.trim()).filter(Boolean);
}
export function setUserKeywords(v: string): void { localStorage.setItem(STORAGE_USER_KW, v); queueSyncToSavedMessages(); }

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
  if(isBlockPinned()) setBlockPinned(true);

  const msgKws = getMessageKeywords();
  const userKws = getUserKeywords();
  if(msgKws.length || userKws.length) {
    startObserver();
    document.querySelectorAll('.bubble').forEach(b => checkBubble(b as HTMLElement));
  }
}

export function refreshContentFilter(): void {
  setBlockPinned(isBlockPinned());
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
