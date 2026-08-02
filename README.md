# browser-pgp-ui

OpenPGP.js を使って自分用に暗号化メッセージを作成するための静的 Web UI 。復号/署名検証/署名生成の機能はない。

## 使い方
- Github Actionsで`site/`以下を静的ホスティングサービスに配置すると動作する。
- 公開鍵は同一オリジンの `/pubkey.asc` から取得する。
- 暗号化対象の平文を入力して「暗号化」を押すと、armored PGP message が出力される。
- ファイル/フォルダを選択して「ファイル/フォルダを暗号化」を押すと、`tar` にまとめて暗号化したファイルをダウンロードできる。

## 公開鍵の差し替え
1. 既存の `site/pubkey.asc` を置き換える。
2. 例: GnuPG で公開鍵をエクスポートする場合
   - `gpg --armor --export your@example.com > site/pubkey.asc`
3. デプロイ後、UI 画面に表示される fingerprint を確認する。

## GitHub Actions Environment と secrets
GitHub リポジトリの Settings で `production` Environment を作成し、Cloudflare Workers へのデプロイ用に以下を Environment secrets として設定する（repository secrets ではない）。
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

API token には対象アカウントの Workers Scripts を編集する権限が必要。

Environment の protection rules も GitHub の Settings で設定する。Deployment branches は `master` のみに制限し、必要に応じて required reviewers と prevent self-review を有効にする。これらの protection rules は workflow YAML では定義できないため、Settings での設定が必須。

## 自動更新の仕組み
`.github/workflows/weekly-build-and-deploy.yml` が週1回（JST 月曜 03:00 / UTC 日曜 18:00）、手動実行、および `master` ブランチへの push で動作する。

フロー:
1. openpgpjs/openpgpjs の最新 Release tag を取得
2. ソースをダウンロードしてビルド
3. `npm audit signatures` を実行（失敗したら workflow を中断）
4. `openpgp.min.mjs` と `openpgp.version.txt` を `site/vendor/` に追加し、生成した `dist/` を artifact 化
5. deploy job が artifact の `dist/` を Cloudflare Workers Static Assets にデプロイ

`wrangler.toml` は `workers.dev` を無効にしているため、公開先の独自ドメインは Cloudflare 側で設定する。

## セキュリティ上の意図
- ビルド job とデプロイ job を分離し、ビルド job には Cloudflare の Secrets を渡さない構成。
- `git verify-tag`と`npm audit signatures`でソースとビルド時の依存を検証する。
- ランタイムで外部CDNを参照せず、`site/vendor/openpgp.min.mjs` を同一オリジンに置く。

