# KU新着・一般書を探す

きんとくのKindle Unlimited新着から、明確な漫画・ライトノベル・写真集とユーザー指定作品を除き、一般書・新書・実用書・普通の小説・判断不能の本を新着順に表示します。推薦やAI APIは使いません。

## 現在の公開状況と制約

**現在の運用は「Windowsへのサインイン → PCで新着を取得 → GitHubへpush → Pagesへ配信」です。** サインイン約1分後に非表示で起動し、日本時間で1日1回、正常に取得・pushできたときだけ完了を記録します。PCを切っても公開済みの結果は閲覧できます。固定時刻ではなく、PCへサインインした時刻が取得のきっかけです。

### Windowsの自動更新

ユーザーのスタートアップフォルダーに `Kindle Unlimited 自動更新.lnk` を設定します。リンク先は `wscript.exe` からこのフォルダーの `publish-on-login.vbs` を実行する構成です。管理者権限やパスワード登録は不要です。起動中のPCを再起動する必要はなく、次回のWindowsサインインから自動で動きます。

- 取得・公開処理：`publish-on-login.js`。手動実行はこのフォルダーで `node publish-on-login.js`。同日中に再取得する場合のみ `node publish-on-login.js --force`。
- 最終実行ログ：リポジトリ内 `work/auto-publish/latest.log`。
- 最終正常公開：`work/auto-publish/last-success.json`。取得またはpushに失敗した場合は成功扱いにしません。
- ネット接続が未準備の場合はGitHubへの接続を30秒間隔で最大5回確認します。取得元への403を再試行したり回避したりはしません。
- 二重起動はロックで防ぎ、編集途中のコードやステージ済み変更がある場合は保護のため停止します。ログのERRORを確認してCodexへ依頼してください。
- このPCのGitHubログインが有効である必要があります。別PCに移すときはGit認証とスタートアップの再設定が必要です。
- 停止するときはWindowsの「スタートアップアプリ」から無効化するか、`shell:startup` で開くフォルダー内の上記ショートカットを外します。

GitHubの毎朝03:00設定は維持していますが、現在はクラウドから新規取得せず、PCがpushしたデータの配信に使います。PCで取得・pushした時点でもすぐに配信が始まるため、03:00まで待つ必要はありません。

公開先は https://sawanoto.github.io/kindle-unlimited-new-arrivals/ 、リポジトリは https://github.com/sawanoto/kindle-unlimited-new-arrivals です。

2026年10月17日のGitHub Actions実取得では、取得元がHTTP 403を返しました。制限を回避するためのUA変更・プロキシ・別出口への切り替え等は行わず、リポジトリ変数 `FETCH_ENABLED=false` で自動取得を停止しています。毎朝のcronと手動実行は設定済みですが、現在は前回の正常データを配信するだけで、**自宅PC停止中の自動最新取得は完成していません**。取得元からクラウド取得の許可または正式に利用できる取得方法を確認する必要があります。許可された方法を実装・検証したあと、FETCH_ENABLEDをtrueにして手動実行から再検証してください。GitHubの実行が緑色でも、取得停止中は新しい取得が成功した意味ではありません。画面の停止表示と最終取得日時を確認してください。

## 既存実装の調査結果と今回の変更

- 当初はGit管理されていないローカルフォルダーで、リモートリポジトリ・Actions・公開先はありませんでした。
- `crawler.js` が実際の「次へ」リンクを順次たどり、Cheerioで書誌データを抽出します。ASINで重複を排除し、取得元の順序を維持します。
- `rules.js` は既存の追加ルールをすべて維持しています。一般小説の文庫全体を新たに除外する変更はしていません。
- `data/manual-exclusions.json` の個人の手動除外記録は削除せず、Git対象外にしました。移行作業中の追加分を含む83件のIDを `data/manual-exclusion-ids.json` に引き継いでいます。未確認分もID指定で除外され、ローカルのレビュー記録として残ります。
- 既読状態は従来どおり `localStorage['ku-book-state']`。同じURL・ブラウザーでの既読状態を引き継ぎます。新URLや別端末には設定ファイルで移します。
- HTML/CSSとフロントエンドの一覧方式を維持し、静的ホストでも動作するようAPI呼び出し先と保存先を切り替えます。
- 取得上限到達・抽出失敗・通信失敗・空データは失敗として扱い、正常な `latest.json` を維持します。

## 日付判定

2026年10月17日に実HTMLを調査しました。例として日付見出しが「2026年10月16日」でも、同じ作品の「更新時刻」が「10/17 04:47」でした。きんとくは「編集部がUnlimitedへの追加を確認した順」と説明しています。作品の更新時刻を追加確認時刻として使うことはできません。

そこで日付見出しを**追加確認日（日付精度）**として使い、日本時間の実行日時から24時間前を含む日付以降を取得します。10月17日03:00の実行なら、10月16日00:00から10月17日分までを対象にします。約27時間以上の範囲になり得るため、「正確な24時間以内の冊数」とは表示しません。

JSONは `rangeMode: "calendar-days"`、`exact24Hours: false`、`within24Hours: null`、`rangeStartDate`、`rangeEndDate`、`rangeCount` を持ちます。「更新時刻」は `updatedAt` と `updateText` に記録しますが、範囲判定や並び替えには使いません。日付不明の作品は残して警告します。

対象開始日より古い作品だけのページを確認するか、一覧の末尾に到達するまで巡回します。ページ数は固定しません。既定の上限は120ページ、待機は2秒、1リクエスト20秒、再試行2回まで、全体12分が上限です。実サイトへの待機は1.5秒未満にできません。HTTP 403等は停止、429と一部5xxは制限付きで再試行します。Retry-Afterが60秒を超える場合は今回の取得を中止します。毎回robots.txtのUAグループとAllow/Disallowを確認し、アクセス制限の回避やページの並列取得はしません。

## ローカルで使う

Node.js 22以降で、このフォルダーから実行します。既存のダブルクリック用起動ファイルも引き続き使えます。

```powershell
npm ci
npm start
```

`http://localhost:3000/` を開きます。ローカル版の「データを更新」はその場で取得します。

```powershell
npm test
npm run update
npm run build
```

`npm run build` は一つ上の `dist/` に静的サイトを生成します。既存の書籍データに最新ルールを再適用し、前回の正常データでも表示できます。確認用にはリポジトリのルートで `python -m http.server 3100 --bind 127.0.0.1` とし、`http://127.0.0.1:3100/dist/` を開きます。`file://` での直接表示には対応しません。

## GitHub ActionsとPagesの初回設定

公開範囲を決めてから、リポジトリのルート（このREADMEの一つ上）をGitHubへpushします。既存の別プロジェクトへの上書きはしません。

1. GitHub上にリポジトリを作成し、`main` ブランチにコードをpushします。
2. Settings → Actions → GeneralでActionsが許可されていることを確認します。workflowは `contents: write` を使って `latest.json` と `status.json` だけをコミットします。組織ポリシー等で書き込みが制限されている場合は管理者設定が必要です。
3. **一般公開してよい場合だけ** Settings → Pages → Build and deployment → Sourceを **GitHub Actions** にします。
4. Settings → Secrets and variables → Actions → Variablesに `PAGES_ENABLED` = `true` を設定します。未設定ならPagesには公開しません。
5. Actions → **Update Kindle Unlimited and deploy** → **Run workflow** を実行します。workflow_dispatchはデフォルトブランチにworkflowが存在する必要があります。
6. update・deployが成功し、Settings → Pagesに表示されたURLをスマートフォンで開きます。

cronは `0 18 * * *`（UTC）、日本時間では翌日03:00です。GitHubのスケジュールには遅延・取りこぼし・無効化の可能性があります。画面で最終取得時刻を確認し、36時間以上古い場合は警告を表示します。GitHubの失敗通知も有効にしてください。手動再取得はActionsのRun workflowで行います（FETCH_ENABLED=falseの間は取得しません）。Web画面の「最新の取得結果を読み込む」は既存JSONを再読み込みする操作で、Actionsを起動するものではありません。

クラウド取得が停止中でも、PCでローカル取得に成功したJSONをGitHubへ反映すれば、スマートフォンからその結果を閲覧できます。ローカル画面の「データを更新」だけでは公開先へ自動反映されません。リポジトリのルートで次の操作を行います。取得が失敗した場合はそこで止め、古いデータを新しい取得結果として公開しないでください。

```powershell
npm --prefix outputs run update
# 上の取得が成功した場合だけ実行
git add outputs/data/latest.json outputs/data/status.json
git commit -m "Publish locally fetched KU data"
git push
```

push後にActionsが静的サイトを配信します。公開画面の最終取得日時が変われば反映完了です。PCは取得とpushのときだけ必要で、配信後は電源を切っても閲覧できます。

GitHub CLIでの設定例（OWNER/REPOは実際の公開先に置き換えます）：

```powershell
gh api --method POST repos/OWNER/REPO/pages -f build_type=workflow
gh variable set PAGES_ENABLED --body true --repo OWNER/REPO
gh workflow run update.yml --repo OWNER/REPO
gh run list --repo OWNER/REPO --limit 5
```

Pages設定がすでに存在する場合は作り直さず設定を確認してください。リポジトリ名の配下でも動くよう、すべての静的URLは相対パスです。新しいAPIキーやPATをWeb画面へ埋め込む必要はありません。

## 公開範囲と個人利用

GitHub Pagesは通常、URLへアクセスした誰でも閲覧できます。非公開ソースリポジトリを使ってもPages自体が非公開になるとは限りません。GitHub Freeでは公開リポジトリのPagesが利用対象で、非公開リポジトリのPagesには対応プランが必要です。

公開リポジトリにpushすると、ソース・除外ルール・書誌データ・手動除外IDが閲覧可能です。履歴の各コミットにも過去のJSONが残ります。個人の手動除外履歴（タイトル、除外日時、確認済み日時）とHTMLキャッシュはGitに含めず、ビルドにも含めません。既読と新しい手動除外・復元は端末内に保存し、サーバーへ送信しません。表紙の画像ファイルは保存・再配布せず、表示時に元の画像URLを遅延読み込みします。`noindex`とrobots.txtは検索抑制の要請であり、アクセス制限ではありません。

一般公開を避ける場合は、**非公開GitHubリポジトリ＋Actions＋認証付き静的ホスト**を使ってください。例としてCloudflare PagesとCloudflare Access等がありますが、静的HTMLだけでなくJSONや画像以外の全パスを認証で保護する必要があります。別途アカウント・公開先・認証設定が必要です。`PAGES_ENABLED` を設定しなければ、このworkflowは取得と認証済みGitHubユーザー向けのartifact生成まで行い、一般公開しません。artifactをダウンロードするだけでは「いつでもスマートフォンから閲覧」の完成条件を満たしません。認証付きホストへの配信設定を完了する必要があります。

2026年10月17日時点のrobots.txtは `/wp-admin/` を禁止し、一覧ページは禁止していません。一方、利用規約第9条は権利侵害・過度な負荷・アクセス制御回避・無許諾の商業利用を禁止し、第10条は権利帰属を定めています。robotsの許可は転載・再公開の許諾ではありません。公開一覧の二次配信が明示許諾されているとは確認できていないため、広く公開する場合は必要に応じ運営元へ確認してください。本文・説明文・取得HTMLは公開しません。

参照：

- [きんとくの取得元](https://premium.gamepedia.jp/kindle/unlimited?sort=unlimited_start_at)
- [robots.txt](https://premium.gamepedia.jp/robots.txt)
- [利用規約](https://gamepedia.jp/rule)
- [GitHub Pagesの対象プランと公開方式](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Actionsのscheduleとworkflow_dispatch](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)

## 既読・除外の移行と復元

1. 従来と同じブラウザーでローカル版 `http://localhost:3000/` を開きます。
2. 「既読・除外の引き継ぎ」→「設定を書き出す」を押します。
3. クラウド版で「設定を取り込む」からそのJSONを選びます。既存設定へ追加し、既存の別作品の既読状態は消しません。

同じPCでも、localhostとGitHub Pagesではブラウザーの保存領域が異なり、自動的には共有できません。従来のlocalStorageキーを維持しても、新URLへは取り込みが必要です。端末間の自動同期はありません。設定ファイルには個人の読書状態が含まれるため、リポジトリへコミットしないでください。

「除外された本」では自動除外も「候補に戻す」で復元できます。明示的な手動除外が最優先、明示的な復元が自動判定より優先です。過去の除外解除状態を無条件で自動判定へ優先させることはせず、新しい復元操作は別キー `ku-restored-books-v1` に記録します。

クラウド版で新しく手動除外した記録は `ku-manual-exclusions-v1` に保存します。「手動除外の記録を書き出す」でJSONをこのチャットへ添付すれば、従来同様に共通レーベルやシリーズを検討して `rules.js` へ追加できます。ローカル版の手動除外は引き続き `data/manual-exclusions.json` にも保存されます。クラウド版からローカル版へ設定を取り込むと、手動除外記録もPCのファイルへ反映されます。

## 保存形式・運用・障害対応

- `data/latest.json`：最後に正常取得できた一覧。schemaVersion=2、日付範囲、全書誌データ、除外区分、統計。
- `data/status.json`：直近の試行日時、成否、ページ数、エラー。失敗時も更新します。
- `data/cache.json`：HTMLの5分キャッシュ。ローカルのみ、Git対象外。Actionsでは前回HTMLを保存しません。
- `data/manual-exclusion-ids.json`：移行時の手動除外ID。Gitで管理し、クラウドでも維持します。
- `data/manual-exclusions.json`：個人の除外レビュー記録。ローカルのみ。確認済みはreviewedAt付き。
- `dist/`：HTML・JS・CSS・最終正常JSON・ルール一覧・手動除外ID・試行状況だけの公開候補。

上限到達や途中失敗は不完全な成功として扱わず、前回JSONを維持します。失敗時にも正常データがあるなら、そのデータとエラー状況をビルド・配信し、Actions自体は失敗扱いにします。以前のサイトはartifact生成・配信が失敗しても残ります。Actionsログと画面の取得情報で、最終取得、ページ数、取得冊数、除外数、候補数、日付境界への到達、エラーを確認できます。

更新を止めるときはGitHub ActionsのworkflowをDisableにします。公開を停止する場合はPagesの公開を解除し、`PAGES_ENABLED` を削除またはfalseにします。共有URLのデータが第三者のキャッシュ等から消えることまでは保証できません。

## 検証

`npm test` は日付見出しと更新時刻の差、年またぎ、4ページ以上の巡回、ASIN重複排除、外部URL拒否、robotsのUA別判定、上限・通信・空ページ・0件・robots失敗時のデータ維持、既読キーの維持、明示復元の優先順位、従来ルール・手動ID維持を検証します。

2026年10月17日のローカル実取得では4ページを取得し、日付境界へ到達。対象日付260冊、既存自動ルールで103冊を除外、候補157冊でした。これらは24時間ちょうどの件数ではありません。GitHub Actions上のテストは通りましたが、実取得はHTTP 403で失敗しました。前回正常JSONが維持されたことをログで確認しています。取得停止後のPages配信は [実行38959319992](https://github.com/sawanoto/kindle-unlimited-new-arrivals/actions/runs/38959319992) で成功しました。画面検証では390px幅で横スクロールがないこと、手動除外・復元・既読の切り替えと再読込後の保存、ローカルから静的サイトへの設定移行を確認しました。
