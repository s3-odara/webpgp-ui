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

## GitHub Actions secrets
以下のシークレットを設定すると、S3互換ストレージに同期できる。
- `ACCESS_KEY_ID`
- `SECRET_ACCESS_KEY`
- `ENDPOINT_URL`
- `BUCKET_NAME`

## 自動更新の仕組み
`.github/workflows/weekly-build-and-deploy.yml` が週1回（JST 月曜 03:00 / UTC 日曜 18:00）と手動実行で動作する。

フロー:
1. openpgpjs/openpgpjs の最新 Release tag を取得
2. ソースをダウンロードしてビルド
3. `npm audit signatures` を実行（失敗したら workflow を中断）
4. `openpgp.min.mjs` と `openpgp.version.txt` を artifact 化
5. deploy job が artifact を `site/vendor/` に反映して R2 に sync

## セキュリティ上の意図
- ビルド job とデプロイ job を分離し、ビルド job には R2 の Secrets を渡さない構成。
- `git verify-tag`と`npm audit signatures`でソースとビルド時の依存を検証する。
- ランタイムで外部CDNを参照せず、`site/vendor/openpgp.min.mjs` を同一オリジンに置く。

