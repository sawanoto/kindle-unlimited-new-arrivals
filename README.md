# Kindle Unlimited新着・一般書を探す

既存のローカルツールを維持し、GitHub Actionsで毎朝取得し、GitHub Pagesまたは認証付き静的ホストで閲覧する構成です。

実装・起動・公開手順・データの扱いは [outputs/README.md](outputs/README.md) を参照してください。

- アプリ・クローラー：`outputs/`
- 毎朝の取得と公開：`.github/workflows/update.yml`
- 静的サイトの生成先：`dist/`（Git対象外）
- 元の個人除外記録：`outputs/data/manual-exclusions.json`（Git対象外、ローカルに維持）
- 変更前のデータ：`backups/before-cloud/`（Git対象外）

初期状態では `PAGES_ENABLED` が未設定のため一般公開しません。GitHub側で公開方法を設定して初めて、自宅PCを起動しなくても閲覧できるようになります。
