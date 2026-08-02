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

## OpenPGP.js の更新
リポジトリのルートから次を実行する。

```sh
scripts/update-openpgpjs.sh
```

1. GitHub APIから最新のOpenPGP.js stable Release tagを取得する。
2. OpenPGP.js maintainerのPGP公開鍵を取得する。
3. openpgpjs/openpgpjsからそのtagを取得して`git verify-tag`で署名を検証する。
4. 検証したtagをdetached checkoutした後、依存関係のinstall、ビルド、テストを一時ディレクトリで実行する。
5. 成功した場合、bundle、生成元tag、upstreamのライセンス、NOTICEを更新する。

- `site/vendor/openpgp.min.mjs`
- `site/vendor/openpgp.tag.txt`
- `site/vendor/LICENSE`
- `site/vendor/openpgpjs.NOTICE`

`.github/workflows/openpgpjs-release-notification.yml`

- 最新のstable release tagを確認する。
- `site/vendor/openpgp.tag.txt`と異なるtagがあれば、GitHub Issueを作成して手動更新を通知する。

## セキュリティ上の意図
- 自身の責任で管理されるサイトに設置して、自身へ暗号化してもらうので、公開鍵の検証はサイトがこのアセットを真正に配信することと、ユーザが間違えずにサイトを使うことに依る。
- ビルドjobとデプロイjobを分離し、ビルドjob にはCloudflareのSecrets を渡さない。
- `git verify-tag`と`npm audit signatures`でソースの依存を検証する。
- やろうと思えばあなた向けに暗号化された悪意あるtarなんていくらでも作れるのでここで対策はしない。
