/*
 * tweb-cn: Test mode helper for offline UI development.
 * Sets window.__testMode flag and ensures test mode persists across
 * page reloads via sessionStorage.
 */

declare global {
  interface Window {
    __testMode?: boolean;
  }
}

export function enableTestMode() {
  window.__testMode = true;
  sessionStorage.setItem('tweb_cn_test_mode', '1');
}

export function disableTestMode() {
  window.__testMode = false;
  sessionStorage.removeItem('tweb_cn_test_mode');
}

export function isTestMode(): boolean {
  return !!window.__testMode;
}

// Restore test mode on reload
if(typeof(window) !== 'undefined' && sessionStorage.getItem('tweb_cn_test_mode') === '1') {
  window.__testMode = true;
}
