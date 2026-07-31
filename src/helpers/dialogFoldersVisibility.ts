import {getAdvancedSetting, setAdvancedSetting} from '@helpers/advancedSettingsStorage';
import {FOLDER_ID_ALL} from '@lib/appManagers/constants';
import useFolders from '@stores/folders';

const STORAGE_KEY = 'tweb_cn_hide_dialog_folders';
const STYLE_ID = 'tweb-cn-hide-dialog-folders';

function getStyleElement(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if(!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = [
      'body.tweb-cn-hide-dialog-folders #folders-tabs',
      'body.tweb-cn-hide-dialog-folders .folders-tabs-scrollable',
      'body.tweb-cn-hide-dialog-folders .folders-tabs-gradient',
      'body.tweb-cn-hide-dialog-folders #folders-sidebar{display:none!important}'
    ].join(',');
    document.head.appendChild(el);
  }

  return el;
}

function selectAllDialogs(): void {
  const folders = useFolders();
  if(folders.selectedFolderId() === FOLDER_ID_ALL) return;

  const onClick = folders.onClick();
  if(onClick) {
    onClick(0);
    return;
  }

  folders.setSelectedFolderId(FOLDER_ID_ALL);
}

export function isHideDialogFolders(): boolean {
  return getAdvancedSetting(STORAGE_KEY, '0') === '1';
}

export function canUseDialogFolder(index: number): boolean {
  return !isHideDialogFolders() || index === 0;
}

export function setHideDialogFolders(enabled: boolean): void {
  setAdvancedSetting(STORAGE_KEY, enabled ? '1' : '0');
  applyHideDialogFolders(enabled);
}

function applyHideDialogFolders(enabled: boolean): void {
  if(enabled) {
    getStyleElement();
    document.body.classList.add('tweb-cn-hide-dialog-folders');
    selectAllDialogs();
  } else {
    document.body.classList.remove('tweb-cn-hide-dialog-folders');
    document.getElementById(STYLE_ID)?.remove();
  }

  console.warn('[tweb-cn] hide dialog folders active=', enabled);
}

export function initHideDialogFolders(): void {
  applyHideDialogFolders(isHideDialogFolders());
}

export function refreshHideDialogFolders(): void {
  applyHideDialogFolders(isHideDialogFolders());
}
