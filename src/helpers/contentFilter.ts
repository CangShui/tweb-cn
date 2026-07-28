/*
 * tweb-cn: Content filtering helpers.
 * - Block pinned messages
 * - Block messages by content keywords
 * - Block messages by sender name keywords
 */

const STORAGE_PINNED = 'tweb_cn_block_pinned';
const STORAGE_MSG_KW = 'tweb_cn_msg_keywords';
const STORAGE_USER_KW = 'tweb_cn_user_keywords';

let observer: MutationObserver | null = null;
let pinnedStyle: HTMLStyleElement | null = null;

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
      pinnedStyle.textContent = '.pinned-container.pinned-message { display: none !important; }';
      document.head.appendChild(pinnedStyle);
    }
  } else {
    if(pinnedStyle) { pinnedStyle.remove(); pinnedStyle = null; }
    const el = document.getElementById('tweb-cn-block-pinned');
    if(el) el.remove();
  }
}

/* ── Message keywords ── */

export function getMessageKeywords(): string[] {
  const raw = localStorage.getItem(STORAGE_MSG_KW) || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export function setMessageKeywords(keywords: string): void {
  localStorage.setItem(STORAGE_MSG_KW, keywords);
}

export function isBlockMessageKeywords(): boolean {
  return getMessageKeywords().length > 0;
}

/* ── User keywords ── */

export function getUserKeywords(): string[] {
  const raw = localStorage.getItem(STORAGE_USER_KW) || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export function setUserKeywords(keywords: string): void {
  localStorage.setItem(STORAGE_USER_KW, keywords);
}

export function isBlockUserKeywords(): boolean {
  return getUserKeywords().length > 0;
}

/* ── MutationObserver: scan new bubbles ── */

function checkBubble(bubble: HTMLElement): void {
  const msgKws = getMessageKeywords();
  const userKws = getUserKeywords();

  if(!msgKws.length && !userKws.length) return;

  // Already hidden
  if(bubble.style.display === 'none') return;

  // Check message content keywords
  if(msgKws.length) {
    const msgEl = bubble.querySelector('.message');
    if(msgEl) {
      const text = (msgEl.textContent || '').toLowerCase();
      for(const kw of msgKws) {
        if(kw && text.includes(kw.toLowerCase())) {
          bubble.style.display = 'none';
          return;
        }
      }
    }
  }

  // Check user name keywords
  if(userKws.length) {
    const nameEl = bubble.querySelector('.peer-title');
    if(nameEl) {
      const name = (nameEl.textContent || '').toLowerCase();
      for(const kw of userKws) {
        if(kw && name.includes(kw.toLowerCase())) {
          bubble.style.display = 'none';
          return;
        }
      }
    }
  }
}

function scanAllBubbles(): void {
  const bubbles = document.querySelectorAll('.bubble');
  bubbles.forEach(b => checkBubble(b as HTMLElement));
}

export function initContentFilter(): void {
  // Init pinned
  if(isBlockPinned()) setBlockPinned(true);

  // Init observer for new messages
  const hasFilters = isBlockMessageKeywords() || isBlockUserKeywords();
  if(!hasFilters) return;

  observer = new MutationObserver((mutations) => {
    for(const m of mutations) {
      for(const node of m.addedNodes) {
        if(node instanceof HTMLElement) {
          if(node.classList.contains('bubble')) {
            checkBubble(node);
          } else {
            node.querySelectorAll('.bubble').forEach(b => checkBubble(b as HTMLElement));
          }
        }
      }
    }
  });

  observer.observe(document.body, {childList: true, subtree: true});
  scanAllBubbles();
}

export function refreshContentFilter(): void {
  if(observer) {
    observer.disconnect();
    observer = null;
  }

  // Re-apply pinned
  setBlockPinned(isBlockPinned());

  const hasFilters = isBlockMessageKeywords() || isBlockUserKeywords();
  if(hasFilters) {
    observer = new MutationObserver((mutations) => {
      for(const m of mutations) {
        for(const node of m.addedNodes) {
          if(node instanceof HTMLElement) {
            if(node.classList.contains('bubble')) {
              checkBubble(node);
            } else {
              node.querySelectorAll('.bubble').forEach(b => checkBubble(b as HTMLElement));
            }
          }
        }
      }
    });
    observer.observe(document.body, {childList: true, subtree: true});
    scanAllBubbles();
  }

  // If no filters active, unhide any previously hidden bubbles
  if(!hasFilters) {
    document.querySelectorAll('.bubble[style*="display: none"]').forEach(b => {
      (b as HTMLElement).style.display = '';
    });
  }
}
