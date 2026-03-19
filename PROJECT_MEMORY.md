# Project Memory

## Project Purpose

- Package: `koishi-plugin-github-qq-relay`
- Goal: relay GitHub events emitted by `koishi-plugin-adapter-github` into QQ groups/channels through a non-GitHub Koishi bot, typically `onebot`.
- This plugin does **not** receive GitHub webhooks itself. It only listens to `ctx.on('github/...')` events from `adapter-github`.

## Current Entry Flow

- Main entry: [src/index.ts](/Volumes/Important/E_backup/Creation/koishi-plugin/src/index.ts)
- `apply()` does three things:
  1. `extendDatabase(ctx)`
  2. `registerCommands(ctx, config)`
  3. `registerRelay(ctx, config)`

## Supported Relay Events

- `star`
- `push`
- `pull_request`
- `issue_opened`
- `discussion_created`
- `discussion_comment`

## Important Runtime Logic

### Relay Registration

- Core file: [src/relay.ts](/Volumes/Important/E_backup/Creation/koishi-plugin/src/relay.ts)
- The plugin now listens to:
  - `github/star`
  - `github/push`
  - `github/pull-request`
  - `github/pull-request-opened`
  - `github/pull-request-closed`
  - `github/pull-request-reopened`
  - `github/issue-opened`
  - `github/discussion-created`
  - `github/discussion-comment`

### PR Deduplication

- PR events may come from both generic and action-specific event names depending on `adapter-github` version/behavior.
- To avoid duplicate forwarding, `src/relay.ts` keeps a short in-memory dedupe cache keyed by:
  - `repoKey`
  - `action`
  - `pullRequest.number`
  - `pullRequest.html_url`
- Dedup window is `10s`.

### Binding Match Rules

- All bindings are loaded by repo via `getMergedBindings()`.
- A binding only matches if:
  - `enabled === true`
  - requested event exists in `binding.events`
- Branch filtering only applies to `push`.
- Non-push events, including `pull_request`, ignore branch filtering.

## Binding Model

- Core files:
  - [src/types.ts](/Volumes/Important/E_backup/Creation/koishi-plugin/src/types.ts)
  - [src/database.ts](/Volumes/Important/E_backup/Creation/koishi-plugin/src/database.ts)
- Binding fields:
  - `repo`
  - `branch`
  - `platform`
  - `botId`
  - `channelId`
  - `guildId`
  - `userId`
  - `events`
  - `enabled`

## Branch Logic

- Default branch is now `main`.
- Config field: `defaultBranch`
- Utility: `normalizeBranch()` in [src/utils.ts](/Volumes/Important/E_backup/Creation/koishi-plugin/src/utils.ts)
- Behavior:
  - if `branch` is omitted, it is treated as `main`
  - old rows with empty/undefined `branch` are also treated as `main`
  - branch filter is currently only for `push`

## Database Notes

- Table: `github_relay_bindings`
- A new `branch` column was added to the model definition.
- Existing old records do not need data backfill because runtime falls back to `main`.
- Remote deployments may still need a schema update if the database adapter does not auto-sync columns.
- Safe manual SQL:

```sql
ALTER TABLE github_relay_bindings ADD COLUMN branch VARCHAR(255);
```

## Command Behavior

- Core file: [src/commands.ts](/Volumes/Important/E_backup/Creation/koishi-plugin/src/commands.ts)
- Main commands:
  - `github-relay.bind <repo> [channelId]`
  - `github-relay.unbind <repo> [channelId]`
  - `github-relay.list [repo]`

### Important Command Rule

- In-group execution can auto-bind the current group if `[channelId]` is omitted.
- Branch must ideally be passed with `-r <branch>`.

### Smart Compatibility Added

- There was a real-world pitfall where users ran:

```text
github-relay.bind owner/repo main -e push,pull_request
```

- In the old behavior, `main` was parsed as `channelId`.
- Current logic tries to infer this case:
  - if command runs in a group
  - and the second positional argument looks like a branch name
  - and `-r` was not explicitly given
  - then it treats that second argument as `branch`, and uses `session.channelId` as the target channel
- This inference is implemented by `inferChannelAndBranch()` in [src/commands.ts](/Volumes/Important/E_backup/Creation/koishi-plugin/src/commands.ts).

### Still Recommended Usage

```text
github-relay.bind owner/repo -p onebot -b BOT_ID -r main -e push,pull_request
```

## Bot Resolution

- Relay only sends through non-GitHub bots.
- Resolver logic is in `resolveTargetBot()` in [src/relay.ts](/Volumes/Important/E_backup/Creation/koishi-plugin/src/relay.ts).
- It filters `ctx.bots` by:
  - excluding platform `github`
  - matching explicit `binding.platform`, else `config.defaultPlatform`, else any non-GitHub bot
  - matching explicit `binding.botId` or `config.defaultBotId` when provided
- Common failures:
  - no available onebot bot online
  - wrong `botId`
  - binding accidentally points to wrong `channelId`

## Known Real-World Pitfall Already Encountered

- A bad binding like this appeared:

```text
Binnnn-Lab/CodeQL-AI branch=main -> onebot:main bot=2577582861 ...
```

- Meaning:
  - `branch=main` is fine
  - but `channelId` also became `main`, which is wrong
- Consequence:
  - relay tries `send_group_msg` with `group_id = "main"`
  - OneBot returns `retcode: 1200`

## Message Builders

- Core file: [src/message.ts](/Volumes/Important/E_backup/Creation/koishi-plugin/src/message.ts)
- Added PR formatter:
  - `[GitHub PR] ...`
  - action mapping:
    - `opened` -> `创建了`
    - `closed && merged` -> `合并了`
    - `closed && !merged` -> `关闭了`
    - `reopened` -> `重新打开了`

## Recommended Debugging Order

1. `github-relay.list owner/repo`
2. confirm the binding shows a real group/channel ID rather than `main`
3. confirm `events` includes `pull_request`
4. confirm OneBot bot is online and `botId` matches actual `selfId`
5. only then investigate adapter-github event emission

## Current Documentation State

- README has been updated to mention:
  - `defaultBranch`
  - `pull_request`
  - branch-aware bind examples
  - PR message examples

## Environment Limitation During This Session

- The current coding environment did not have local `node`, `npm`, `pnpm`, or `tsc` available.
- Result: changes were made by reasoning and code inspection, but no local TypeScript compile verification was run in this session.

## Best Quick Context To Paste Into A New Chat

```text
This repo is a Koishi plugin named koishi-plugin-github-qq-relay. It relays adapter-github events to QQ groups via non-GitHub bots. Current supported events are star, push, pull_request, issue_opened, discussion_created, discussion_comment. Push filtering defaults to branch=main via defaultBranch, but branch filtering only applies to push. PR forwarding is implemented in src/relay.ts by listening to both github/pull-request and github/pull-request-opened/closed/reopened with a 10s dedupe cache. A major pitfall already encountered is users typing `github-relay.bind owner/repo main ...`, which previously bound channelId=main by mistake; src/commands.ts now tries to infer that as branch when run inside a group. Database model github_relay_bindings now includes a branch column, and old empty branch values are treated as main. Most likely runtime issues now are wrong binding channelId, missing pull_request in existing binding events, or no matching onebot bot/selfId.
```
