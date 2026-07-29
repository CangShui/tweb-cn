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
export function setMessageKeywords(v: string): void { localStorage.setItem(STORAGE_MSG_KW, v); }
export function getUserKeywords(): string[] {
  return (localStorage.getItem(STORAGE_USER_KW) || '').split(',').map(s => s.trim()).filter(Boolean);
}
export function setUserKeywords(v: string): void { localStorage.setItem(STORAGE_USER_KW, v); }

/* ── Filter ── */

function hideByMid(mid: string) {
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
  if(!msgKws.length) return;
  const msgEl = bubble.querySelector('.message');
  if(!msgEl) return;
  const text = (msgEl.textContent || '').toLowerCase();
  for(const kw of msgKws) {
    if(kw && text.includes(kw.toLowerCase())) {
      const mid = bubble.getAttribute('data-mid');
      if(mid) hideByMid(mid);
      return;
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
  if(isBlockPinned()) setBlockPinned(true);

  const msgKws = getMessageKeywords();
  if(msgKws.length) {
    startObserver();
    // Scan already-rendered
    document.querySelectorAll('.bubble').forEach(b => checkBubble(b as HTMLElement));
  }
}

export function refreshContentFilter(): void {
  setBlockPinned(isBlockPinned());
  // Clear old CSS
  if(filterStyle) { filterStyle.textContent = ''; filteredMids.clear(); }
  stopObserver();

  const msgKws = getMessageKeywords();
  if(msgKws.length) {
    startObserver();
    document.querySelectorAll('.bubble').forEach(b => checkBubble(b as HTMLElement));
  }
  // If no keywords, unhide previously hidden
  if(!msgKws.length) {
    document.querySelectorAll('.bubble[style*="display: none"]').forEach(b => {
      (b as HTMLElement).style.display = '';
    });
  }
}
