import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crawl } from './crawler.js';
import { patterns } from './rules.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const feedbackFile = path.join(root, 'data', 'manual-exclusions.json');
let running = null;
let feedbackWrite = Promise.resolve();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
async function readFeedback() {
  try { return JSON.parse(await readFile(feedbackFile, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': types['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
http.createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://localhost:${port}`).pathname;
  if (pathname === '/runtime-config.js') {
    res.writeHead(200, { 'Content-Type': types['.js'], 'Cache-Control': 'no-store' });
    res.end('window.KU_CONFIG = { static: false, books: "./api/books", rules: "./api/rules", status: "./api/status", seed: "./data/manual-exclusion-ids.json" };');
    return;
  }
  if (pathname === '/api/manual-exclusions') {
    if (req.method === 'GET') { json(res, 200, await feedbackWrite.then(readFeedback)); return; }
    if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }); return; }
    try {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 100_000) throw new Error('リクエストが大きすぎます');
      }
      const { action, books, id, ids } = JSON.parse(raw);
      if (!['add', 'remove', 'review'].includes(action) ||
          (action === 'add' && (!Array.isArray(books) || books.length > 500)) ||
          (action === 'remove' && (typeof id !== 'string' || id.length > 300)) ||
          (action === 'review' && (!Array.isArray(ids) || ids.length > 500 || ids.some(value => typeof value !== 'string' || value.length > 300)))) throw new Error('入力が正しくありません');
      const cleaned = action === 'add' ? books.map(book => {
        if (!book || typeof book.id !== 'string' || !book.id || book.id.length > 300 ||
            typeof book.title !== 'string' || !book.title || book.title.length > 500) throw new Error('書籍データが正しくありません');
        return Object.fromEntries(['id', 'title', 'author', 'publisher', 'label', 'amazonUrl'].map(key =>
          [key, String(book[key] || '').slice(0, key === 'amazonUrl' ? 1000 : 500)]));
      }) : [];
      const update = feedbackWrite.then(async () => {
        const records = await readFeedback();
        const next = action === 'add'
          ? [...records.filter(record => !cleaned.some(book => book.id === record.id)),
             ...cleaned.map(book => ({ ...book, excludedAt: new Date().toISOString() }))]
          : action === 'remove' ? records.filter(record => record.id !== id)
          : records.map(record => ids.includes(record.id) ? { ...record, reviewedAt: new Date().toISOString() } : record);
        await mkdir(path.dirname(feedbackFile), { recursive: true });
        const temporary = `${feedbackFile}.tmp`;
        await writeFile(temporary, JSON.stringify(next, null, 2), 'utf8');
        await rename(temporary, feedbackFile);
        return next;
      });
      feedbackWrite = update.then(() => {}, () => {});
      json(res, 200, await update);
    } catch (error) { json(res, 400, { error: error.message }); }
    return;
  }
  if (pathname === '/api/rules' && req.method === 'GET') {
    const labels = { comic: '漫画', lightNovel: 'ライトノベル', photo: '写真集' };
    const rules = Object.fromEntries(Object.entries(patterns).map(([type, list]) => [type, {
      label: labels[type], terms: list.map(rule => rule.source.replaceAll('\\b', '').replaceAll('(?:', '('))
    }]));
    res.writeHead(200, { 'Content-Type': types['.json'], 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(rules));
    return;
  }
  if (pathname === '/api/update' && req.method === 'POST') {
    if (running) { res.writeHead(409); res.end('更新中です'); return; }
    running = crawl();
    try { const data = await running; res.writeHead(200, { 'Content-Type': types['.json'] }); res.end(JSON.stringify(data)); }
    catch (e) { res.writeHead(502, { 'Content-Type': types['.json'] }); res.end(JSON.stringify({ error: e.message })); }
    finally { running = null; }
    return;
  }
  const files = { '/': 'index.html', '/index.html': 'index.html', '/style.css': 'style.css', '/app.js': 'app.js', '/preferences.js': 'preferences.js', '/api/books': 'data/latest.json', '/api/status': 'data/status.json', '/data/manual-exclusion-ids.json': 'data/manual-exclusion-ids.json' };
  if (!files[pathname]) { res.writeHead(404); res.end(); return; }
  try { const body = await readFile(path.join(root, files[pathname])); res.writeHead(200, { 'Content-Type': types[path.extname(files[pathname])], 'Cache-Control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404, { 'Content-Type': types['.json'] }); res.end(JSON.stringify({ error: 'まだデータがありません。更新してください。' })); }
}).listen(port, process.env.HOST || '127.0.0.1', () => console.log(`http://localhost:${port}`));
