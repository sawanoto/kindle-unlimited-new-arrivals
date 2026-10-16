import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crawl, parsePage, robotsPermits, SOURCE } from '../crawler.js';

const item = (id = 'B012345678', title = '一般書', update = '10/17 04:00') => `<div class="product-display amazon-item-display"><div class="item-title"><a href="https://www.amazon.co.jp/dp/${id}">${title}</a></div><div class="pd-contents__detail"><div class="text-s">出版社</div><div class="text-s">著者</div></div><span class="text-weak">更新時刻：${update}</span></div>`;
const page = (date, items, next) => `<h3 class="book-group-heading">${date}</h3>${items}${next ? `<ul class="pager"><li class="next"><a href="?sort=unlimited_start_at&amp;page=${next}">次へ</a></li></ul>` : ''}`;
const now = new Date('2026-10-17T04:00:00+09:00');

test('更新時刻と追加確認日を区別する', () => {
  const result = parsePage(page('2026年10月15日', item()), SOURCE, now).books[0];
  assert.equal(result.observedDay, '2026-10-15');
  assert.equal(result.datePrecision, 'day');
  assert.match(result.updatedAt, /^2026-10-17/);
});
test('年末年始と全角巻数でもASINで識別する', () => {
  const result = parsePage(page('2025年12月31日', item('B012345678', '一般書 ２', '1/1 00:01')), SOURCE, new Date('2026-01-01T04:00:00+09:00')).books[0];
  assert.equal(result.observedDay, '2025-12-31');
  assert.match(result.updatedAt, /^2026-01-01/);
  assert.equal(result.id, 'B012345678');
});
test('3ページに固定せず日付境界まで進み、ASINを重複排除する', async () => {
  const pages = [page('2026年10月17日', item(), 2), page('2026年10月16日', item() + item('B012345679'), 3), page('2026年10月16日', item('B012345680'), 4), page('2026年10月15日', item('B012345681', '古い本'), 5)];
  let calls = 0;
  const result = await crawl({ now, persist: false, delayMs: 0, checkRobots: async () => '', fetcher: async () => pages[calls++] });
  assert.equal(calls, 4); assert.equal(result.pages, 4); assert.equal(result.books.length, 3);
  assert.equal(result.complete, true); assert.equal(result.exact24Hours, false); assert.equal(result.within24Hours, null);
  assert.equal(result.rangeStartDate, '2026-10-16');
});
test('日付不明は残し、正確な24時間の件数には含めない', async () => {
  const result = await crawl({ now, persist: false, delayMs: 0, checkRobots: async () => '', fetcher: async () => item() });
  assert.equal(result.unknownDateCount, 1); assert.equal(result.books.length, 1); assert.equal(result.within24Hours, null);
});
test('外部ドメインや別ソートのページリンクを拒否する', () => {
  const html = page('2026年10月17日', item(), 2);
  assert.throws(() => parsePage(html.replace('?sort=unlimited_start_at&amp;page=2', 'https://example.com/'), SOURCE, now));
  assert.throws(() => parsePage(html.replace('unlimited_start_at', 'price'), SOURCE, now));
});
test('robots.txt のUAグループ、Allowの優先、ワイルドカードを尊重する', () => {
  assert.equal(robotsPermits('User-agent: OtherBot\nDisallow: /\nUser-agent: *\nDisallow: /wp-admin/', SOURCE), true);
  assert.equal(robotsPermits('User-agent: *\nDisallow: /kindle/', SOURCE), false);
  assert.equal(robotsPermits('User-agent: *\nDisallow: /kindle/\nAllow: /kindle/unlimited', SOURCE), true);
  assert.equal(robotsPermits('User-agent: *\nDisallow: /*page=2$', SOURCE + '&page=2'), false);
  assert.equal(robotsPermits('User-agent: *\nAllow: /\nUser-agent: KU-New-Arrivals-Personal\nDisallow: /', SOURCE), false);
});
for (const failure of ['limit', 'empty', 'network', 'zero', 'robots']) test(`${failure}: 失敗時に前回JSONを変更せずエラーだけ保存`, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ku-test-'));
  const previous = '{"books":[{"id":"previous"}]}';
  await writeFile(path.join(dir, 'latest.json'), previous);
  try {
    await assert.rejects(crawl({ now, outputDir: dir, maxPages: 1, delayMs: 0,
      checkRobots: async () => { if (failure === 'robots') throw new Error('robots denied'); return ''; },
      fetcher: async () => { if (failure === 'network') throw new Error('network'); return failure === 'empty' ? '<html></html>' : failure === 'zero' ? page('2026年10月15日', item()) : page('2026年10月17日', item(), 2); }
    }));
    assert.equal(await readFile(path.join(dir, 'latest.json'), 'utf8'), previous);
    assert.equal(JSON.parse(await readFile(path.join(dir, 'status.json'), 'utf8')).ok, false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
