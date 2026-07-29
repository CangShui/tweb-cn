/*
 * tweb-cn: Content filtering at the data layer.
 * - Pinned messages: CSS blocking (instant, zero performance cost)
 * - Message keywords: intercepts saveMessages BEFORE storage (zero DOM scan)
 * - User keywords: intercepts saveMessages with peer name cache
 */

import rootScope from '@lib/rootScope';

const STORAGE_PINNED = 'tweb_cn_block_pinned';
const STORAGE_MSG_KW = 'tweb_cn_msg_keywords';
const STORAGE_USER_KW = 'tweb_cn_user_keywords';

let pinnedStyle: HTMLStyleElement | null = null;
// Synchronous peer name cache: "u123" | "c456" -> display name
const peerNameCache: Record<string, string> = {};

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
export function isBlockMessageKeywords(): boolean { return getMessageKeywords().length > 0; }

export function getUserKeywords(): string[] {
  return (localStorage.getItem(STORAGE_USER_KW) || '').split(',').map(s => s.trim()).filter(Boolean);
}
export function setUserKeywords(v: string): void { localStorage.setItem(STORAGE_USER_KW, v); }
export function isBlockUserKeywords(): boolean { return getUserKeywords().length > 0; }

/* ── Peer name cache ── */

function peerToKey(peer: any): string {
  if(!peer) return '';
  if(peer._ === 'peerUser') return 'u' + peer.user_id;
  if(peer._ === 'peerChannel') return 'c' + peer.channel_id;
  if(peer._ === 'peerChat') return 'c' + peer.chat_id;
  return '';
}

function cachePeerName(peerKey: string, name: string) {
  if(peerKey && name) peerNameCache[peerKey] = name;
}

function getPeerName(peer: any): string {
  return peerNameCache[peerToKey(peer)] || '';
}

/* ── Data-layer filter hook ── */

export function setupMessageFilter(): void {
  import('@appManagers/appMessagesManager').then(({AppMessagesManager}) => {
    AppMessagesManager.messageFilter = (message: any): boolean => {
      const msgKws = getMessageKeywords();
      const userKws = getUserKeywords();

      if(!msgKws.length && !userKws.length) return true;

      // Message text filter
      if(msgKws.length) {
        const text = (message.message || '').toLowerCase();
        for(const kw of msgKws) {
          if(kw && text.includes(kw.toLowerCase())) return false;
        }
      }

      // User name filter
      if(userKws.length && message.from_id) {
        const name = getPeerName(message.from_id).toLowerCase();
        if(name) {
          for(const kw of userKws) {
            if(kw && name.includes(kw.toLowerCase())) return false;
          }
        }
        // If name not in cache yet, try to resolve asynchronously
        // but don't block the current message
      }

      return true;
    };
  });
}

/* ── Init ── */

export function initContentFilter(): void {
  if(isBlockPinned()) setBlockPinned(true);

  // Build peer name cache from rootScope events
  rootScope.addEventListener('history_append', (e: any) => {
    const msg = e?.message || e;
    if(!msg || !msg.from_id) return;
    // Try to cache the sender name from forward info
    if(msg.fwd_from?.from_name) {
      cachePeerName(peerToKey(msg.from_id), msg.fwd_from.from_name);
    }
  });

  // Also listen for peer data updates
  rootScope.addEventListener('peer_changed' as any, (e: any) => {
    if(e?.peerId && e?.title) {
      cachePeerName(typeof e.peerId === 'string' ? e.peerId : String(e.peerId), String(e.title));
    }
  });
}

export function refreshContentFilter(): void {
  setBlockPinned(isBlockPinned());
  import('@appManagers/appMessagesManager').then(({AppMessagesManager}) => {
    AppMessagesManager.messageFilter = null;
    setupMessageFilter();
  });
}
