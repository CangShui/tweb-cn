/*
 * tweb-cn: Content filtering via main-thread event listener.
 * Listens for history_append on the MAIN thread (where localStorage
 * is available), checks keywords, and injects CSS to hide matched messages.
 * Zero DOM scanning, zero Worker dependency.
 */

import rootScope from '@lib/rootScope';

const STORAGE_PINNED = 'tweb_cn_block_pinned';
const STORAGE_MSG_KW = 'tweb_cn_msg_keywords';
const STORAGE_USER_KW = 'tweb_cn_user_keywords';

let pinnedStyle: HTMLStyleElement | null = null;
let filterStyle: HTMLStyleElement | null = null;
const filteredMids = new Set<string>();

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

/* ── Keywords get/set ── */

export function getMessageKeywords(): string[] {
  return (localStorage.getItem(STORAGE_MSG_KW) || '').split(',').map(s => s.trim()).filter(Boolean);
}
export function setMessageKeywords(v: string): void { localStorage.setItem(STORAGE_MSG_KW, v); }

export function getUserKeywords(): string[] {
  return (localStorage.getItem(STORAGE_USER_KW) || '').split(',').map(s => s.trim()).filter(Boolean);
}
export function setUserKeywords(v: string): void { localStorage.setItem(STORAGE_USER_KW, v); }

/* ── CSS injection ── */

function hideMessageByMid(mid: string) {
  if(filteredMids.has(mid)) return;
  filteredMids.add(mid);
  if(!filterStyle) {
    filterStyle = document.createElement('style');
    filterStyle.id = 'tweb-cn-msg-filter';
    document.head.appendChild(filterStyle);
  }
  filterStyle.textContent += `[data-mid="${mid}"]{display:none!important}`;
}

function checkAndHide(message: any) {



  if(msgKws.length) {
    const text = (message.message || '').toLowerCase();
    for(const kw of msgKws) {
      if(kw && text.includes(kw.toLowerCase())) {
        const mid = message.mid || message.id;
        if(mid != null) hideMessageByMid(String(mid));
        return;
      }
    }
  }

  if(userKws.length && message.from_id) {
    const peerName = ''; // will be matched via peer-title CSS later
    // For now, user keyword matching uses peer name from history_append
    // which doesn't carry the display name. We'll enhance later if needed.
  }
}

/* ── Init ── */

function onHistoryAppend(e: any) {
  const msg = e?.message || e;
  if(!msg || !msg.message) return;
  checkAndHide(msg);
}

  if(isBlockPinned()) setBlockPinned(true);

  // Listen for history_append on the MAIN thread
  rootScope.addEventListener('history_append', onHistoryAppend);

  // Scan already-rendered messages on init (for cache-loaded messages)
  setTimeout(() => {
    const msgKws = getMessageKeywords();
    if(!msgKws.length) return;
    document.querySelectorAll('.bubble[data-mid]').forEach(bubble => {
      const msgEl = bubble.querySelector('.message');
      if(!msgEl) return;
      const text = (msgEl.textContent || '').toLowerCase();
      for(const kw of msgKws) {
        if(kw && text.includes(kw.toLowerCase())) {
          const mid = bubble.getAttribute('data-mid');
          if(mid) hideMessageByMid(mid);
          break;
        }
      }
    });
  }, 2000);
}

  setBlockPinned(isBlockPinned());
  // Clear old filter rules and re-scan
  if(filterStyle) {
    filterStyle.textContent = '';
    filteredMids.clear();
  }
  // Re-scan visible messages
  const msgKws = getMessageKeywords();
  if(!msgKws.length) return;
  document.querySelectorAll('.bubble[data-mid]').forEach(bubble => {
    const msgEl = bubble.querySelector('.message');
    if(!msgEl) return;
    const text = (msgEl.textContent || '').toLowerCase();
    for(const kw of msgKws) {
      if(kw && text.includes(kw.toLowerCase())) {
        const mid = bubble.getAttribute('data-mid');
        if(mid) hideMessageByMid(mid);
        break;
      }
    }
  });
}
