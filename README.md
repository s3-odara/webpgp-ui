# browser-pgp-ui

OpenPGP.js を使った「暗号化のみ」の静的 Web UI です。復号/署名検証/署名生成は実装していません。

## 使い方
- `site/` を静的ホスティングに配置すると動作します（ビルド不要）。
- 公開鍵は同一オリジンの `/pubkey.asc` から取得します。
- 暗号化対象の平文を入力して「暗号化」を押すと、armored PGP message が出力されます。
- ファイル/フォルダを選択して「ファイル/フォルダを暗号化」を押すと、`tar` にまとめて暗号化したファイルをダウンロードできます（ローカル処理）。

## 公開鍵の差し替え
1. 既存の `site/pubkey.asc` を置き換えます。
2. 例: GnuPG で公開鍵をエクスポートする場合
   - `gpg --armor --export your@example.com > site/pubkey.asc`
3. デプロイ後、UI 画面に表示される fingerprint を確認してください。

## GitHub Actions secrets
Cloudflare R2 に同期するため、以下の Secrets を設定してください。
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ACCOUNT_ID`
- `R2_BUCKET`

## 自動更新の仕組み
`.github/workflows/weekly-build-and-deploy.yml` が週1回（JST 月曜 03:00 / UTC 日曜 18:00）と手動実行で動作します。

フロー:
1. openpgpjs/openpgpjs の最新 Release tag を取得
2. ソースをダウンロードしてビルド
3. `npm audit signatures` を実行（失敗したら workflow を中断）
4. `openpgp.min.mjs` と `openpgp.version.txt` を artifact 化
5. deploy job が artifact を `site/vendor/` に反映して R2 に sync

## セキュリティ上の意図
- ビルド job とデプロイ job を分離し、**ビルド job には R2 の Secrets を渡さない**構成です。
- 署名/プロベナンス検証に失敗する場合は `npm audit signatures` で失敗させ、安全側に倒します。
- ランタイムで外部 CDN を参照せず、`site/vendor/openpgp.min.mjs` を自前ホストします。

## リポジトリ構成
- `site/index.html`
- `site/style.css`
- `site/app.mjs`
- `site/vendor/openpgp.min.mjs`（週次ビルド成果物で上書き）
- `site/vendor/openpgp.version.txt`
- `site/pubkey.asc`
- `.github/workflows/weekly-build-and-deploy.yml`
