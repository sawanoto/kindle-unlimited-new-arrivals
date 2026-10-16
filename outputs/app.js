import { STORAGE_KEY, MANUAL_KEY, RESTORED_KEY, isExcluded, validateBackup } from './preferences.js';
const $ = s => document.querySelector(s);
const config = window.KU_CONFIG || { static: false, books: './api/books', rules: './api/rules', status: './api/status' };
const state = { data: null, status: null, view: 'candidates', message: '' };
const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
const manualExclusions = new Map(JSON.parse(localStorage.getItem(MANUAL_KEY) || '[]').map(book => [book.id, book]));
const restored = new Set(JSON.parse(localStorage.getItem(RESTORED_KEY) || '[]'));
const seed = new Set();
const save = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  localStorage.setItem(MANUAL_KEY, JSON.stringify([...manualExclusions.values()]));
  localStorage.setItem(RESTORED_KEY, JSON.stringify([...restored]));
};
const automaticallyExcluded = b => ['comic', 'lightNovel', 'photo'].includes(b.category) || seed.has(b.id);
const excluded = b => isExcluded({ ...b, category: automaticallyExcluded(b) ? 'comic' : b.category }, saved, manualExclusions, restored);
const checked = b => !!saved[b.id]?.checked;
const jst = s => s && Number.isFinite(Date.parse(s)) ? new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(s)) : '不明';
const text = (tag, content, className) => { const el = document.createElement(tag); el.textContent = content; if (className) el.className = className; return el; };

async function json(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  if (!response.ok) throw new Error(`読み込み・保存に失敗しました (${response.status})`);
  return response.json();
}

async function recordManual(action, book) {
  if (!config.static) await json('./api/manual-exclusions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action === 'add' ? { action, books: [book] } : { action, id: book.id })
  });
  if (action === 'add') manualExclusions.set(book.id, { ...book, excludedAt: new Date().toISOString() });
  else manualExclusions.delete(book.id);
}

function render() {
  const data = state.data;
  if (!data) return;
  const stale = Date.now() - Date.parse(data.finishedAt) > 36 * 36e5;
  const errors = [data.warning, stale ? '最終取得から36時間以上経過しています。更新状況を確認してください。' : '',
    state.status?.ok === false ? `直近の取得に失敗（${jst(state.status.attemptedAt)}）：${state.status.error}。前回の正常データを表示しています。` : '', state.message];
  $('#notice').textContent = errors.filter(Boolean).join(' ');
  $('#last-update').textContent = `最終取得：${jst(data.finishedAt)}（日本時間）`;
  $('#manual-count').textContent = `確認待ちの手動除外：${[...manualExclusions.values()].filter(book => !book.reviewedAt).length}冊`;
  let books = data.books.filter(b => state.view === 'excluded' ? excluded(b) : state.view === 'candidates' ? !excluded(b) : true);
  if (!$('#novel').checked) books = books.filter(b => b.category !== 'novel');
  if (!$('#checked').checked) books = books.filter(b => !checked(b));
  $('#count').textContent = `${books.length}冊`;
  $('#period').textContent = data.rangeMode === 'calendar-days'
    ? `${data.rangeStartDate}〜${data.rangeEndDate} · 24時間前を含む日付 · 新着順`
    : `${jst(data.cutoff)} 以降 · 過去の取得形式（範囲は参考値）`;
  const area = $('#books'); area.replaceChildren();
  if (!books.length) area.append(text('div', '該当する本はありません。表示条件を変えてください。', 'empty'));
  const frag = document.createDocumentFragment();
  for (const b of books) {
    const card = text('article', '', 'card'), row = text('div', '', 'card-main');
    if ($('#covers').checked && /^https:\/\/m\.media-amazon\.com\//.test(b.imageUrl || '')) {
      const img = document.createElement('img'); img.className = 'cover'; img.src = b.imageUrl;
      img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.width = 76; img.height = 108;
      img.onerror = () => img.remove(); row.append(img);
    }
    const body = text('div', '', 'card-body'), top = text('div', '', 'card-top'); top.append(text('h2', b.title));
    if (checked(b)) top.append(text('span', '確認済み', 'badge'));
    body.append(top, text('p', [b.author, b.publisher].filter(Boolean).join(' · ') || '著者・出版社不明', 'meta'));
    body.append(text('div', b.datePrecision === 'day' ? `追加確認日 ${b.observedDay || b.dateHeading || '不明'}（日付単位）` : `確認日時 ${jst(b.observedAt)}`, 'date'));
    row.append(body); card.append(row);
    const actions = text('div', '', 'actions');
    if (/^https:\/\/(?:www\.)?amazon\.co\.jp\//.test(b.amazonUrl || '')) {
      const link = text('a', 'Amazonで見る'); link.href = b.amazonUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; actions.append(link);
    }
    const mark = text('button', checked(b) ? '確認済みを解除' : '既読（確認済み）');
    mark.onclick = () => { saved[b.id] = { ...saved[b.id], checked: !checked(b) }; save(); render(); };
    actions.append(mark);
    if (automaticallyExcluded(b) && !restored.has(b.id)) actions.append(text('span', '自動除外', 'badge'));
    const hide = text('button', excluded(b) ? '候補に戻す' : '除外');
    hide.onclick = async () => {
      hide.disabled = true;
      try {
        if (excluded(b)) {
          if (manualExclusions.has(b.id)) await recordManual('remove', b);
          restored.add(b.id); saved[b.id] = { ...saved[b.id], excluded: false };
        } else {
          await recordManual('add', b); restored.delete(b.id); saved[b.id] = { ...saved[b.id], excluded: true };
        }
        save(); render();
      } catch (error) { state.message = error.message; render(); }
    };
    actions.append(hide); card.append(actions); frag.append(card);
  }
  area.append(frag);
  const rows = [
    ['最終取得（日本時間）', jst(data.finishedAt)], ['取得ページ数', data.pages], ['取得総冊数', data.totalFetched], ['重複除去後', data.uniqueFetched],
    ['日付範囲内の冊数（24時間より広い範囲）', data.rangeCount ?? data.books.length], ['漫画の自動除外', data.categoryCounts.comic],
    ['ラノベ・指定作品の自動除外', data.categoryCounts.lightNovel], ['写真集の自動除外', data.categoryCounts.photo],
    ['現在の除外冊数（手動・復元を反映）', data.books.filter(excluded).length], ['表示対象冊数', data.books.filter(b => !excluded(b)).length],
    ['現在表示', books.length], ['24時間前を含む日付の境界まで取得', data.complete ? 'はい' : 'いいえ'],
    ['日付不明の作品', data.unknownDateCount ?? 0], ['最古の取得日', jst(data.oldestFetchedAt)], ['終了理由', data.stopReason],
    ['直近の取得エラー', state.status?.ok === false ? state.status.error : 'なし（最新データは成功時のもの）']
  ];
  $('#stats').replaceChildren(...rows.flatMap(([k, v]) => [text('dt', k), text('dd', String(v ?? '—'))]));
}

async function loadManualExclusions() {
  if (!config.static) {
    const remote = await json('./api/manual-exclusions');
    manualExclusions.clear();
    remote.forEach(book => manualExclusions.set(book.id, book));
  }
  if (config.seed) { const ids = await json(config.seed); seed.clear(); ids.forEach(id => seed.add(id)); }
  const legacy = state.data.books.filter(book => saved[book.id]?.excluded === true && !manualExclusions.has(book.id) && !seed.has(book.id));
  if (legacy.length) {
    if (!config.static) await json('./api/manual-exclusions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', books: legacy }) });
    legacy.forEach(book => manualExclusions.set(book.id, { ...book, excludedAt: new Date().toISOString() }));
  }
  save();
}

async function loadData() {
  try {
    state.data = await json(config.books);
    try { state.status = await json(config.status); } catch { state.status = null; }
    await loadManualExclusions(); render();
  } catch (error) { $('#notice').textContent = error.message; }
}
async function loadRules() {
  try {
    const groups = await json(config.rules), box = $('#rules'); box.replaceChildren();
    for (const group of Object.values(groups)) {
      const section = text('section', '', 'rule-group'); section.append(text('h3', group.label));
      const list = text('div', '', 'rule-tags'); group.terms.forEach(term => list.append(text('span', term))); section.append(list); box.append(section);
    }
  } catch { $('#rules').textContent = 'ルールを読み込めませんでした。'; }
}

function download(name, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#export-state').onclick = () => download('ku-settings.json', { schemaVersion: 1, exportedAt: new Date().toISOString(), saved, manualExclusions: [...manualExclusions.values()], restoredIds: [...restored] });
$('#export-feedback').onclick = () => download('ku-manual-exclusions.json', [...manualExclusions.values()].filter(book => !book.reviewedAt));
$('#import-state').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 10_000_000) throw new Error('設定ファイルが大きすぎます');
    const incoming = validateBackup(JSON.parse(await file.text()));
    if (!config.static) {
      const records = incoming.manualExclusions.filter(book => !incoming.restoredIds.includes(book.id));
      for (let i = 0; i < records.length; i += 50) await json('./api/manual-exclusions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', books: records.slice(i, i + 50) }) });
      for (const id of incoming.restoredIds) if (manualExclusions.has(id)) await json('./api/manual-exclusions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove', id }) });
    }
    for (const [id, value] of Object.entries(incoming.saved)) saved[id] = { ...saved[id], ...value };
    incoming.manualExclusions.forEach(book => manualExclusions.set(book.id, book));
    incoming.restoredIds.forEach(id => { restored.add(id); manualExclusions.delete(id); saved[id] = { ...saved[id], excluded: false }; });
    save(); state.message = '既読・除外・復元の設定を取り込みました。'; render();
  } catch (error) { state.message = error.message; render(); }
  event.target.value = '';
};
document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => {
  state.view = button.dataset.view; document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x === button)); render();
});
$('#covers').onchange = render; $('#novel').onchange = render; $('#checked').onchange = render;
$('#refresh').textContent = config.static ? '最新の取得結果を読み込む' : 'データを更新';
$('#refresh').onclick = async () => {
  const btn = $('#refresh'); btn.disabled = true;
  try {
    if (config.static) { state.message = ''; await loadData(); }
    else { $('#notice').textContent = '取得元を順番に確認しています。数分かかる場合があります。'; await json('./api/update', { method: 'POST' }); state.message = ''; await loadData(); }
  } catch (error) { state.message = `更新エラー: ${error.message}`; await loadData(); }
  finally { btn.disabled = false; }
};
if (config.static) {
  $('#cloud-note').hidden = false;
  const link = $('#actions-link');
  if (config.updateMode === 'pc-login') {
    link.textContent = 'GitHubで公開状況を確認';
    $('#cloud-note').replaceChildren(text('span', 'PCへのサインイン時に新着を取得し、公開します（1日1回）。公開済みの一覧はPCを切っても閲覧できます。 '), link);
  } else if (config.fetchEnabled === false) {
    link.textContent = 'GitHubで更新状況を確認';
    $('#cloud-note').replaceChildren(text('span', '取得元がクラウドからのアクセスを拒否（HTTP 403）したため、自動取得を停止しています。前回の正常取得データを表示します。 '), link);
  }
  if (config.actionsUrl) { link.href = config.actionsUrl; link.hidden = false; }
}
loadData(); loadRules();
