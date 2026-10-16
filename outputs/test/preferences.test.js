import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isExcluded, validateBackup, STORAGE_KEY } from '../preferences.js';
import { classify } from '../rules.js';

test('既存の既読ストレージキーと未知のASINの状態を維持する', () => {
  assert.equal(STORAGE_KEY, 'ku-book-state');
  const backup = validateBackup({ schemaVersion: 1, saved: { OLD_ASIN: { checked: true } }, manualExclusions: [], restoredIds: [] });
  assert.equal(backup.saved.OLD_ASIN.checked, true);
});
test('明示的な手動除外は復元より優先し、復元は自動除外より優先する', () => {
  const book = { id: 'test', category: 'comic' };
  assert.equal(isExcluded(book, {}, new Map(), new Set()), true);
  assert.equal(isExcluded(book, {}, new Map(), new Set(['test'])), false);
  assert.equal(isExcluded(book, {}, new Map([['test', book]]), new Set(['test'])), true);
});
test('一般書・普通の小説を残し、既存追加ルールを適用する', () => {
  assert.equal(classify({ title: '普通の小説 (角川文庫)', publisher: 'KADOKAWA', label: '角川文庫' }), 'novel');
  assert.equal(classify({ title: '科学入門', publisher: '講談社', label: '' }), 'general');
  assert.equal(classify({ title: '作品 (TL☆恋乙女ブック)', publisher: 'KADOKAWA', label: 'TL☆恋乙女ブック' }), 'comic');
  assert.equal(classify({ title: '作品 (電撃の新文芸)', publisher: 'KADOKAWA', label: '電撃の新文芸' }), 'lightNovel');
});
test('永続化済みの手動除外IDを重複なく残す', () => {
  const seed = JSON.parse(fs.readFileSync(new URL('../data/manual-exclusion-ids.json', import.meta.url)));
  assert.ok(seed.length >= 35); assert.equal(new Set(seed).size, seed.length);
});
test('無効な設定ファイルを取り込まない', () => {
  assert.throws(() => validateBackup({}));
  assert.throws(() => validateBackup({ schemaVersion: 1, saved: {}, manualExclusions: [{ id: 'x' }], restoredIds: [] }));
});
