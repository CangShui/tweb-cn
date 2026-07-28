/*
 * tweb-cn: Block sponsored messages (ads) feature.
 * Reads/writes localStorage key 'tweb_cn_block_ads' and injects/removes
 * a CSS rule that hides .is-sponsored message bubbles.
 */

const STORAGE_KEY = 'tweb_cn_block_ads';
const STYLE_ID = 'tweb-cn-block-sponsored';

function getStyleElement(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if(!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = '.is-sponsored { display: none !important; }';
    document.head.appendChild(el);
  }
  return el;
}

export function isBlockSponsored(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function setBlockSponsored(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  if(enabled) {
    getStyleElement();
  } else {
    const el = document.getElementById(STYLE_ID);
    if(el) el.remove();
  }
}

export function initBlockSponsored(): void {
  if(isBlockSponsored()) {
    getStyleElement();
  }
}
