const STORAGE_ENABLED = 'tweb_cn_restrict_images';
const STORAGE_MODE = 'tweb_cn_restrict_images_mode';
const STORAGE_START = 'tweb_cn_restrict_images_start';
const STORAGE_END = 'tweb_cn_restrict_images_end';
const LEGACY_BLOCK_AVATARS = 'tweb_cn_block_image_avatars';
const LEGACY_CLICK_TO_LOAD_STICKERS = 'tweb_cn_click_to_load_stickers';

export type ImageRestrictionMode = 'always' | 'scheduled';

export const IMAGE_RESTRICTION_CHANGE_EVENT = 'tweb-cn-image-restriction-change';

let boundaryTimer: ReturnType<typeof setTimeout>;

function getBeijingMinutes(date = new Date()): number {
  return ((date.getUTCHours() + 8) % 24) * 60 + date.getUTCMinutes();
}

function parseTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function emitChange(): void {
  console.warn('[tweb-cn] image restriction active=', isImageRestrictionActive(), 'settings=', getImageRestrictionSettings());
  window.dispatchEvent(new CustomEvent(IMAGE_RESTRICTION_CHANGE_EVENT));
  scheduleBoundaryChange();
}

function scheduleBoundaryChange(): void {
  clearTimeout(boundaryTimer);
  if(!isImageRestrictionEnabled() || getImageRestrictionMode() !== 'scheduled') return;

  const now = new Date();
  const currentMinutes = getBeijingMinutes(now);
  const boundaries = [parseTime(getImageRestrictionStart()), parseTime(getImageRestrictionEnd())];
  const minutesUntilBoundary = Math.min(...boundaries.map((boundary) => {
    const difference = (boundary - currentMinutes + 1440) % 1440;
    return difference || 1440;
  }));
  const delay = minutesUntilBoundary * 60_000 - now.getUTCSeconds() * 1000 - now.getUTCMilliseconds() + 100;
  boundaryTimer = setTimeout(emitChange, delay);
}

export function isImageRestrictionEnabled(): boolean {
  const stored = localStorage.getItem(STORAGE_ENABLED);
  if(stored !== null) return stored === '1';
  return localStorage.getItem(LEGACY_BLOCK_AVATARS) === '1' ||
    localStorage.getItem(LEGACY_CLICK_TO_LOAD_STICKERS) === '1';
}

export function setImageRestrictionEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_ENABLED, enabled ? '1' : '0');
  emitChange();
}

export function getImageRestrictionMode(): ImageRestrictionMode {
  return localStorage.getItem(STORAGE_MODE) === 'scheduled' ? 'scheduled' : 'always';
}

export function setImageRestrictionMode(mode: ImageRestrictionMode): void {
  localStorage.setItem(STORAGE_MODE, mode);
  emitChange();
}

export function getImageRestrictionStart(): string {
  return localStorage.getItem(STORAGE_START) || '22:00';
}

export function getImageRestrictionEnd(): string {
  return localStorage.getItem(STORAGE_END) || '08:00';
}

export function setImageRestrictionSchedule(start: string, end: string): void {
  localStorage.setItem(STORAGE_START, start);
  localStorage.setItem(STORAGE_END, end);
  emitChange();
}

export function getImageRestrictionSettings() {
  return {
    enabled: isImageRestrictionEnabled(),
    mode: getImageRestrictionMode(),
    start: getImageRestrictionStart(),
    end: getImageRestrictionEnd()
  };
}

export function isImageRestrictionActive(date = new Date()): boolean {
  if(!isImageRestrictionEnabled()) return false;
  if(getImageRestrictionMode() === 'always') return true;

  const start = parseTime(getImageRestrictionStart());
  const end = parseTime(getImageRestrictionEnd());
  const current = getBeijingMinutes(date);
  if(start === end) return true;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

scheduleBoundaryChange();
