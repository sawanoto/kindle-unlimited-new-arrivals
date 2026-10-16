// レーベル名を中心に判定。迷う作品は残す。
export const patterns = {
  comic: [/コミックス/i, /コミック(?:ス)?(?:\b|[０-９0-9]|　|\s)/i, /\bCOMICS?\b/i, /\bMFC\b/i, /HARTA COMIX/i, /まんがタイム/i, /LScomic/i, /CoMax/i, /GANMA!/i, /月マガ基地/i, /BL☆美少年ブック/i, /アルト出版/i, /ナンバーナイン/i, /ラブキス[!！]/i, /LOVEBITES/i, /週刊漫画ゴラク/i, /週刊漫画TIMES/i, /ヤングエース/i, /孔雀王\s*退魔聖伝/i, /暁[!！]{2}男塾/i, /蜜恋ティアラ/i, /RCユニコーン/i, /TL☆恋乙女ブック/i, /サイベリアplus/i],
  lightNovel: [/MF文庫J/i, /電撃文庫/i, /ガガガ文庫/i, /富士見ファンタジア文庫/i, /角川スニーカー文庫/i, /ファンタジア文庫/i, /オーバーラップノベルス/i, /オーバーラップ文庫/i, /GA文庫/i, /HJ文庫/i, /ファミ通文庫/i, /富士見L文庫/i, /Kラノベブックス/i, /ドラゴンノベルス/i, /ジュエルブックス/i, /ジュエル文庫/i, /ビーズログ文庫/i, /オシリス文庫/i, /ダッシュエックス文庫/i, /ダッシュエックス単行本DIGITAL/i, /アンダルシュノベルズ/i, /角川つばさ文庫/i, /角川ルビー文庫/i, /角川ビーンズ文庫/i, /角川ホラー文庫/i, /カドカワBOOKS/i, /MFブックス/i, /アース・スターノベル/i, /講談社X文庫/i, /スターツ出版文庫/i, /eロマンスロイヤル/i, /アイリスNEO/i, /アルファポリス/i, /ミニスカ宇宙海賊/i, /悪人面したB級冒険者/i, /異世界の沙汰は社畜次第/i, /嫌われ者の転移者/i, /電撃の新文芸/i, /ルビーコレクション/i, /メリッサ/i, /夢中文庫プランセ/i, /毒恋\s*[～~]/i, /チートあるけどまったり暮らしたい/i, /ダンジョンを経営しています/i, /雇われ悪女なのに、冷酷王子さまを魅了魔法で篭絡/i, /メゾン文庫/i, /一迅社ノベルス/i, /集英社オレンジ文庫/i, /二次元ドリーム文庫/i, /ベリーズファンタジー/i, /集英社コバルト文庫/i, /いろは堂あやかし語り/i, /犬を拾った、はずだった/i, /鉛の太陽\s*錫の沈黙/i],
  photo: [/写真集/, /フォトブック/, /グラビア/]
};
export function classify(b) {
  const bracket = [...b.title.matchAll(/[（(]([^()（）]{2,80})[）)]/g)].map(m => m[1]).join(' ');
  const searchable = `${b.publisher} ${b.label} ${bracket} ${b.title}`.normalize('NFKC');
  for (const [type, tests] of Object.entries(patterns)) if (tests.some(r => r.test(searchable))) return type;
  if (/^(?:漫画|マンガ|まんが)[:：\s]/.test(b.title) || /【(?:漫画|コミック)】/.test(b.title)) return 'comic';
  if (/:\s*[^:]{0,50}コミックス?$/.test(b.title.normalize('NFKC'))) return 'comic';
  if (/写真集|フォトブック/.test(b.title)) return 'photo';
  if (/【(?:電子書籍限定)?書き下ろしSS付き】|【SS付き】/i.test(b.title)) return 'lightNovel';
  if (/小説|ノベル|文庫/.test(searchable) && !/実用|学術|歴史|ビジネス/.test(searchable)) return 'novel';
  return 'general';
}
