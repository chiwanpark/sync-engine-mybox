# Sync Engine Module for NAVER MYBOX

A [Sync Engine](https://sync.consensia.cc) module that syncs your vault to a NAVER MYBOX folder. It uses the [MYBOX Open API](https://developers.mybox.naver.com/) with a personal access token, without any third-party server.

## Installation

1. In Obsidian, open **Settings > Sync Engine > Development > Module sources** and add `https://chiwanpark.github.io/sync-engine-mybox/modules.json`.
2. Install **NAVER MYBOX** from the Sync Engine module management page.

## Settings

- **NAVER ID**: The NAVER ID that owns the token. The module uses it to keep sync records of different accounts apart.
- **Personal Access Token**: The Obsidian secret that holds your MYBOX token. Create one in MYBOX web under **Settings > Account and personal access token management**. Tokens expire after 30 to 180 days, so renew the secret before then.
- **Base Directory**: The MYBOX folder for this vault. Defaults to `<vault name>/` and is created on the first sync.
- **Delete Permanently**: Off by default, so deleted files go to the MYBOX trash. When on, they are also removed from the trash.
- **Max API Requests Per Minute**: Limits Open API requests. Defaults to `240`, which is the MYBOX limit per API.

> [!WARNING]
> A token can access every file in your MYBOX account, so keep it private. When switching accounts, change the NAVER ID together with the token. Otherwise, Sync Engine may delete the wrong files.

## Limitations

- Files are compared by modification time and size, since MYBOX has no checksums.
- Names are case-insensitive, so `a.md` and `A.md` cannot share a folder.
- Names that MYBOX rejects, such as `.obsidian` or names with emoji, are percent-encoded. For example, `.obsidian` is stored as `%2Eobsidian`.
- Names can be at most 235 characters after encoding.
- Uploads load the whole file into memory.

## Development

Requires Node.js and pnpm.

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm check
pnpm tests
```

## License

[MIT](LICENSE)
