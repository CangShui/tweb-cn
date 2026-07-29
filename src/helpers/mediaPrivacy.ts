const STORAGE_BLOCK_IMAGE_AVATARS = 'tweb_cn_block_image_avatars';
const STORAGE_CLICK_TO_LOAD_STICKERS = 'tweb_cn_click_to_load_stickers';

export const MEDIA_PRIVACY_CHANGE_EVENT = 'tweb-cn-media-privacy-change';

export function isBlockImageAvatars(): boolean {
  return localStorage.getItem(STORAGE_BLOCK_IMAGE_AVATARS) === '1';
}

export function setBlockImageAvatars(enabled: boolean): void {
  localStorage.setItem(STORAGE_BLOCK_IMAGE_AVATARS, enabled ? '1' : '0');
  console.warn('[tweb-cn] block image avatars=', enabled);
  window.dispatchEvent(new CustomEvent(MEDIA_PRIVACY_CHANGE_EVENT));
}

export function isClickToLoadStickers(): boolean {
  return localStorage.getItem(STORAGE_CLICK_TO_LOAD_STICKERS) === '1';
}

export function setClickToLoadStickers(enabled: boolean): void {
  localStorage.setItem(STORAGE_CLICK_TO_LOAD_STICKERS, enabled ? '1' : '0');
  console.warn('[tweb-cn] click to load stickers=', enabled);
}
