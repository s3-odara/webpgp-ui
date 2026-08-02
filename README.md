# browser-pgp-ui

OpenPGP.jsを使って自分用に暗号化メッセージを作成するための静的Web UI。復号/署名検証/署名生成の機能はない。

## 使い方
- Github Actionsで`site/`以下を静的ホスティングサービスに配置すると動作する。
- 公開鍵は同一オリジンの`/pubkey.asc`から取得する。
- wranglerでworkers assetsがデプロイされるので適宜`wrangler.toml`をいじり、公開先のルートはCloudflare側で設定する。

## 公開鍵の差し替え
1. 例: GnuPG
   - `gpg --armor --export your@example.com > site/pubkey.asc`
2. `site/pubkey.asc`を置き換える。

## GitHub Actions Environment と secrets
`production`Environmentを作成し、以下をEnvironment secretsとして設定する。
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

API tokenにはWorkers Scriptsを編集する権限が必要。

## 自動更新
`.github/workflows/weekly-build-and-deploy.yml`が週1回動作する。

フロー:
1. openpgpjs/openpgpjs の最新 Release tag を取得
2. gpg鍵を取得、whitelistをtrust
3. git tagがtrustされた鍵で署名されているか確認
4. チェックアウトして`npm ci`
5. `npm audit signatures` を実行
6. `openpgp.min.mjs` と `openpgp.version.txt` を `site/vendor/` に追加し、生成した `dist/` を artifact 化
7. deploy job が artifact の `dist/` を Cloudflare Workers Static Assets にデプロイ

## セキュリティ上の意図
- 自身の責任で管理されるサイトに設置して、自身へ暗号化してもらうので、公開鍵の検証はサイトがこのアセットを真正に配信することと、ユーザが間違えずにサイトを使うことに依る。
- ビルドjobとデプロイjobを分離し、ビルドjob にはCloudflareのSecrets を渡さない。
- `git verify-tag`と`npm audit signatures`でソースの依存を検証する。
- やろうと思えばあなた向けに暗号化された悪意あるtarなんていくらでも作れるのでここで対策はしない。
