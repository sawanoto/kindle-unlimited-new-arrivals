# Kindle Unlimited新着・一般書を探す

既存のローカルツールを維持し、GitHub Actionsで毎朝取得し、GitHub Pagesまたは認証付き静的ホストで閲覧する構成です。

実装・起動・公開手順・データの扱いは [outputs/README.md](outputs/README.md) を参照してください。

- アプリ・クローラー：`outputs/`
- 毎朝の取得と公開：`.github/workflows/update.yml`
- 静的サイトの生成先：`dist/`（Git対象外）
- 元の個人除外記録：`outputs/data/manual-exclusions.json`（Git対象外、ローカルに維持）
- 変更前のデータ：`backups/before-cloud/`（Git対象外）

公開先：[一般書を探す](https://sawanoto.github.io/kindle-unlimited-new-arrivals/)

取得方法は **Windowsへのサインイン時にPCで取得・GitHubへ公開（1日1回）** です。公開後はPCを切ってもスマートフォンで閲覧できます。開始はサインインから約1分後です。

GitHub Actionsからの直接取得は取得元がHTTP 403を返したため `FETCH_ENABLED=false` のまま停止しています。PCを使わず毎朝決まった時刻に取得する方式には、取得元の許可等の確認が必要です。

GitHub側の `PAGES_ENABLED=true` でPagesを有効にしています。取得停止中も、画面更新と最後の正常データの配信はできます。
