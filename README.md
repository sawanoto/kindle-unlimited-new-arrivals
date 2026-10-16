# Kindle Unlimited新着・一般書を探す

既存のローカルツールを維持し、GitHub Actionsで毎朝取得し、GitHub Pagesまたは認証付き静的ホストで閲覧する構成です。

実装・起動・公開手順・データの扱いは [outputs/README.md](outputs/README.md) を参照してください。

- アプリ・クローラー：`outputs/`
- 毎朝の取得と公開：`.github/workflows/update.yml`
- 静的サイトの生成先：`dist/`（Git対象外）
- 元の個人除外記録：`outputs/data/manual-exclusions.json`（Git対象外、ローカルに維持）
- 変更前のデータ：`backups/before-cloud/`（Git対象外）

公開先：[一般書を探す](https://sawanoto.github.io/kindle-unlimited-new-arrivals/)

**現在の制約：2026年10月17日のGitHub Actions実行では取得元がHTTP 403を返しました。アクセス制限を回避せず、`FETCH_ENABLED=false` でクラウド取得を停止しています。公開サイトでは前回の正常データを閲覧できますが、毎朝の最新データ取得という完成条件は未達です。取得元からの許可や正式に利用できる取得手段の確認が必要です。**

GitHub側の `PAGES_ENABLED=true` でPagesを有効にしています。取得停止中も、画面更新と最後の正常データの配信はできます。
