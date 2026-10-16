import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { patterns, classify } from './rules.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const dest = path.resolve(root, '../dist');
const data = JSON.parse(await readFile(path.join(root, 'data/latest.json'), 'utf8'));
if (!Array.isArray(data.books) || !data.books.length) throw new Error('正常な取得データがありません');
// ルールだけを更新した場合も、前回の正常データに新しい判定を適用する。
data.books = data.books.map(book => ({ ...book, category: classify(book) }));
data.categoryCounts = Object.fromEntries(['comic', 'lightNovel', 'photo'].map(type => [type, data.books.filter(book => book.category === type).length]));
data.excludedCount = Object.values(data.categoryCounts).reduce((a, b) => a + b, 0);
data.defaultVisible = data.books.length - data.excludedCount;
const labels = { comic: '漫画', lightNovel: 'ライトノベル・指定作品', photo: '写真集' };
const rules = Object.fromEntries(Object.entries(patterns).map(([key, list]) => [key, { label: labels[key], terms: list.map(rule => rule.source) }]));
await mkdir(path.join(dest, 'data'), { recursive: true });
for (const file of ['index.html', 'app.js', 'style.css', 'preferences.js']) await copyFile(path.join(root, file), path.join(dest, file));
for (const [name, value] of Object.entries({ latest: data, rules })) await writeFile(path.join(dest, `data/${name}.json`), JSON.stringify(value));
for (const file of ['status.json']) {
  try { await copyFile(path.join(root, 'data', file), path.join(dest, 'data', file)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(path.join(dest, 'data', file), file === 'status.json' ? '{}' : '[]'); }
}
const manualIds = new Set(JSON.parse(await readFile(path.join(root, 'data/manual-exclusion-ids.json'), 'utf8')));
try { for (const book of JSON.parse(await readFile(path.join(root, 'data/manual-exclusions.json'), 'utf8'))) manualIds.add(book.id); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await writeFile(path.join(dest, 'data/manual-exclusion-ids.json'), JSON.stringify([...manualIds]));
const repo = process.env.GITHUB_REPOSITORY || '';
const actionsUrl = /^[\w.-]+\/[\w.-]+$/.test(repo) ? `https://github.com/${repo}/actions/workflows/update.yml` : '';
await writeFile(path.join(dest, 'runtime-config.js'), `window.KU_CONFIG = ${JSON.stringify({ static: true, fetchEnabled: process.env.FETCH_ENABLED !== 'false', books: './data/latest.json', rules: './data/rules.json', status: './data/status.json', seed: './data/manual-exclusion-ids.json', actionsUrl })};\n`);
await writeFile(path.join(dest, '.nojekyll'), '');
await writeFile(path.join(dest, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log(`静的サイト: ${dest} / ${data.books.length}冊 / 個人の除外履歴・既読状態・HTMLキャッシュは含みません`);
