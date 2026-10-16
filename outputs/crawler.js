import { load } from 'cheerio';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { classify } from './rules.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const SOURCE = 'https://premium.gamepedia.jp/kindle/unlimited?sort=unlimited_start_at';
const AGENT = 'KU-New-Arrivals-Personal';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const day = date => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(date);
const allowed = u => { const x = new URL(u); return x.protocol === 'https:' && x.hostname === 'premium.gamepedia.jp' && x.pathname === '/kindle/unlimited' && x.searchParams.get('sort') === 'unlimited_start_at'; };
const dateKey = (year, month, date) => {
  const key = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
  return day(new Date(`${key}T12:00:00+09:00`)) === key ? key : null;
};

export function parsePage(html, url, now = new Date()) {
  const $ = load(html);
  const href = $('ul.pager li.next a[href]').first().attr('href');
  const next = href ? new URL(href, url).href : null;
  if (next && !allowed(next)) throw new Error('次ページのURLが不正です');
  let heading = '';
  const books = [];
  $('h3.book-group-heading, div.product-display.amazon-item-display').each((_, el) => {
    const e = $(el);
    if (e.is('h3')) { heading = e.text().trim(); return; }
    const a = e.find('.item-title a[href]').first();
    const title = a.text().trim();
    if (!title) return;
    const amazonUrl = a.attr('href') || '';
    const rawImage = e.find('.pd-contents__image img.item-image').first().attr('src') || '';
    const imageUrl = /^https:\/\/m\.media-amazon\.com\/images\/I\//.test(rawImage) ? rawImage.replace(/\._SL\d+_\./, '._SL160_.') : '';
    const asin = amazonUrl.match(/\/dp\/([A-Z0-9]{10})/i)?.[1]?.toUpperCase() || e.find('.amazon-item-button').attr('data-cv_id') || '';
    const details = e.find('.pd-contents__detail > .text-s').map((_, x) => $(x).text().trim()).get();
    const [publisher = '', author = ''] = details;
    const match = e.find('.text-weak').text().match(/更新時刻[：:]\s*(\d{1,2})\/(\d{1,2})\s*(\d{1,2}):(\d{2})/);
    const headingMatch = heading.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    let observedDay = null;
    try { if (headingMatch) observedDay = dateKey(+headingMatch[1], +headingMatch[2], +headingMatch[3]); } catch {}
    // 「更新時刻」はKU追加確認日時と同一とは限らない。記録だけし、範囲判定には使わない。
    let updatedAt = null;
    if (match && +match[3] < 24 && +match[4] < 60) {
      const year = +day(now).slice(0, 4);
      const candidates = [year - 1, year, year + 1].flatMap(y => {
        try { const key = dateKey(y, +match[1], +match[2]); return key ? [`${key}T${match[3].padStart(2, '0')}:${match[4]}:00+09:00`] : []; } catch { return []; }
      });
      updatedAt = candidates.filter(t => Date.parse(t) <= now.getTime() + 36e5).sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null;
    }
    const label = [...title.matchAll(/[（(]([^()（）]{2,80})[）)]/g)].at(-1)?.[1] || '';
    books.push({ id: asin || `${title}|${author}|${publisher}`, asin, title, author, publisher, label,
      amazonUrl, imageUrl, dateHeading: heading, observedDay, updatedAt, updateText: match?.[0] || '',
      observedAt: observedDay ? new Date(`${observedDay}T00:00:00+09:00`).toISOString() : null,
      datePrecision: observedDay ? 'day' : 'unknown', category: classify({ title, publisher, label }) });
  });
  return { books, next };
}

// robots.txt のUAグループと最長一致を尊重。Allow、*、末尾$にも対応。
export function robotsPermits(txt, url, agent = AGENT) {
  const groups = []; let group = { agents: [], rules: [] };
  for (const line of txt.split(/\r?\n/)) {
    const match = line.replace(/#.*/, '').match(/^\s*(user-agent|allow|disallow)\s*:\s*(.*?)\s*$/i);
    if (!match) continue;
    const [, rawKey, value] = match, key = rawKey.toLowerCase();
    if (key === 'user-agent') {
      if (group.rules.length) { groups.push(group); group = { agents: [], rules: [] }; }
      group.agents.push(value.toLowerCase());
    } else if (group.agents.length && value) group.rules.push({ allow: key === 'allow', value });
  }
  groups.push(group);
  const matching = groups.map(g => ({ ...g, score: Math.max(-1, ...g.agents.map(a => a === '*' ? 0 : agent.toLowerCase().includes(a) ? a.length : -1)) }));
  const score = Math.max(-1, ...matching.map(g => g.score));
  const target = new URL(url), candidate = target.pathname + target.search;
  const rules = matching.filter(g => g.score === score && score >= 0).flatMap(g => g.rules).filter(rule => {
    const pattern = rule.value.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replaceAll('*', '.*');
    return new RegExp(`^${pattern}`).test(candidate);
  }).sort((a, b) => b.value.replaceAll('*', '').length - a.value.replaceAll('*', '').length || Number(b.allow) - Number(a.allow));
  return rules[0]?.allow ?? true;
}

async function robotsAllowed() {
  const response = await fetch('https://premium.gamepedia.jp/robots.txt', { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`robots.txt を確認できません (${response.status})`);
  const txt = await response.text();
  if (!robotsPermits(txt, SOURCE)) throw new Error('robots.txt が一覧ページを禁止しています');
  return txt;
}

async function fetchPage(url, cache, first) {
  const hit = cache[url];
  if (!first && hit && Date.now() - hit.at < 300000) return hit.html;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetch(url, { redirect: 'error', headers: { 'User-Agent': `${AGENT}/2.0`, Accept: 'text/html' }, signal: AbortSignal.timeout(20000) });
    } catch (error) {
      if (attempt === 2) throw error;
      await sleep((attempt + 1) * 5000); continue;
    }
    if (response.ok) { const html = await response.text(); cache[url] = { at: Date.now(), html }; return html; }
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) throw new Error(`取得元が HTTP ${response.status} を返しました`);
    const retry = response.headers.get('retry-after');
    const retryMs = retry ? (/^\d+$/.test(retry) ? +retry * 1000 : Date.parse(retry) - Date.now()) : 0;
    if (retryMs > 60000) throw new Error('取得元が長い待機時間を指定したため、今回の取得を終了します');
    await sleep(Math.max(retryMs || 0, (attempt + 1) * 5000));
  }
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2), 'utf8');
  await rename(`${file}.tmp`, file);
}

export async function crawl({ maxPages = Number(process.env.MAX_PAGES || 120), delayMs = Number(process.env.REQUEST_DELAY_MS || 2000),
  now = new Date(), fetcher = fetchPage, checkRobots = robotsAllowed, outputDir = path.join(ROOT, 'data'), persist = true } = {}) {
  const startedAt = new Date().toISOString(), deadline = Date.now() + 12 * 60 * 1000;
  let pages = 0;
  try {
    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 250 || !Number.isFinite(delayMs) || delayMs < 0 || delayMs > 60000) throw new Error('取得設定が範囲外です');
    if (fetcher === fetchPage && delayMs < 1500) throw new Error('実サイトへの待機時間は1500ms以上にしてください');
    const robots = await checkRobots();
    let cache = {};
    if (persist) { try { cache = JSON.parse(await readFile(path.join(outputDir, 'cache.json'), 'utf8')); } catch {} }
    const cutoff = new Date(now.getTime() - 86400000), rangeStartDate = day(cutoff), rangeEndDate = day(now);
    const visited = new Set(), all = [];
    let url = SOURCE, complete = false, reason = '';
    while (url && pages < maxPages) {
      if (Date.now() > deadline) throw new Error('取得時間の上限（12分）に到達しました');
      if (!allowed(url) || visited.has(url)) throw new Error('ページリンクが重複または不正です');
      if (typeof robots === 'string' && !robotsPermits(robots, url)) throw new Error('robots.txt が次ページを禁止しています');
      if (pages) await sleep(delayMs);
      visited.add(url);
      const page = parsePage(await fetcher(url, cache, pages === 0), url, now);
      pages++;
      if (!page.books.length) throw new Error(`${pages}ページ目から書籍を抽出できませんでした`);
      all.push(...page.books);
      console.log(`page=${pages} books=${page.books.length} oldest=${page.books.map(b => b.observedDay).filter(Boolean).sort()[0] || 'unknown'}`);
      if (page.books.every(b => b.observedDay && b.observedDay < rangeStartDate)) { complete = true; reason = '24時間前を含む日付より古いページを確認'; break; }
      if (!page.next) { complete = true; reason = '次ページなし（一覧末尾）'; break; }
      url = page.next;
    }
    if (!complete) throw new Error(`最大ページ数 (${maxPages}) に到達。前回の正常データを維持します`);
    const seen = new Set();
    const unique = all.filter(b => { if (seen.has(b.id)) return false; seen.add(b.id); return true; });
    const books = unique.filter(b => !b.observedDay || (b.observedDay >= rangeStartDate && b.observedDay <= rangeEndDate));
    if (!books.length) throw new Error('対象範囲の書籍が0冊でした。空データで上書きしません');
    const unknownDateCount = books.filter(b => !b.observedDay).length;
    const categoryCounts = Object.fromEntries(['comic', 'lightNovel', 'photo'].map(c => [c, books.filter(b => b.category === c).length]));
    const result = { schemaVersion: 2, source: SOURCE, startedAt, finishedAt: new Date().toISOString(), cutoff: cutoff.toISOString(),
      rangeMode: 'calendar-days', rangeStartDate, rangeEndDate, exact24Hours: false, rangeCount: books.length, within24Hours: null,
      pages, totalFetched: all.length, uniqueFetched: unique.length, categoryCounts, excludedCount: Object.values(categoryCounts).reduce((a, b) => a + b, 0),
      defaultVisible: books.filter(b => !['comic', 'lightNovel', 'photo'].includes(b.category)).length,
      oldestFetchedAt: unique.map(b => b.observedAt).filter(Boolean).sort()[0] || null,
      complete, boundaryReached: true, unknownDateCount, warning: unknownDateCount ? `日付不明の${unknownDateCount}冊も残しています。` : '', stopReason: reason, books };
    if (persist) {
      await atomicJson(path.join(outputDir, 'cache.json'), cache);
      await atomicJson(path.join(outputDir, 'latest.json'), result);
      await atomicJson(path.join(outputDir, 'status.json'), { ok: true, attemptedAt: startedAt, finishedAt: result.finishedAt, pages, error: null });
    }
    return result;
  } catch (error) {
    if (persist) await atomicJson(path.join(outputDir, 'status.json'), { ok: false, attemptedAt: startedAt, finishedAt: new Date().toISOString(), pages, error: error.message });
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  crawl().then(r => console.log(`取得 ${r.pages}ページ / 日付範囲内 ${r.rangeCount}冊 / 表示候補 ${r.defaultVisible}冊`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
