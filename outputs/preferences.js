export const STORAGE_KEY = 'ku-book-state';
export const MANUAL_KEY = 'ku-manual-exclusions-v1';
export const RESTORED_KEY = 'ku-restored-books-v1';

export function isExcluded(book, saved, manual, restored) {
  if (manual.has(book.id)) return true;
  if (restored.has(book.id)) return false;
  return ['comic', 'lightNovel', 'photo'].includes(book.category) || saved[book.id]?.excluded === true;
}

export function validateBackup(value) {
  if (!value || value.schemaVersion !== 1 || !value.saved || typeof value.saved !== 'object' || Array.isArray(value.saved) ||
      !Array.isArray(value.manualExclusions) || !Array.isArray(value.restoredIds) || value.manualExclusions.length > 10000) throw new Error('対応する設定ファイルではありません');
  const saved = Object.fromEntries(Object.entries(value.saved).map(([id, state]) => {
    if (!id || id.length > 500 || !state || typeof state !== 'object') throw new Error('設定データが不正です');
    return [id, Object.fromEntries(['checked', 'excluded'].filter(key => typeof state[key] === 'boolean').map(key => [key, state[key]]))];
  }));
  const manualExclusions = value.manualExclusions.map(book => {
    if (!book || typeof book.id !== 'string' || !book.id || book.id.length > 500 || typeof book.title !== 'string') throw new Error('除外記録が不正です');
    return Object.fromEntries(['id', 'title', 'author', 'publisher', 'label', 'amazonUrl', 'excludedAt', 'reviewedAt'].filter(key => typeof book[key] === 'string').map(key => [key, book[key].slice(0, 2000)]));
  });
  if (value.restoredIds.some(id => typeof id !== 'string' || id.length > 500)) throw new Error('復元記録が不正です');
  return { saved, manualExclusions, restoredIds: value.restoredIds };
}
