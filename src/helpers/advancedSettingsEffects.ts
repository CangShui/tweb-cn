import {ADVANCED_SETTINGS_CHANGE_EVENT} from '@helpers/advancedSettingsStorage';
import {refreshContentFilter} from '@helpers/contentFilter';
import {refreshHideDialogFolders} from '@helpers/dialogFoldersVisibility';
import {refreshImageRestriction} from '@helpers/mediaPrivacy';
import {refreshBlockSponsored} from '@helpers/sponsoredMessages';

let scheduled = false;
let initialized = false;

export function applyAdvancedSettingsEffects(): void {
  refreshBlockSponsored();
  refreshContentFilter();
  refreshImageRestriction();
  refreshHideDialogFolders();
}

export function scheduleAdvancedSettingsEffects(): void {
  if(scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    applyAdvancedSettingsEffects();
  });
}

export function initAdvancedSettingsEffects(): void {
  if(initialized || typeof(window) === 'undefined') return;
  initialized = true;
  window.addEventListener(ADVANCED_SETTINGS_CHANGE_EVENT, () => {
    console.warn('[tweb-cn] advanced settings changed; scheduling effects refresh');
    scheduleAdvancedSettingsEffects();
  });
}
