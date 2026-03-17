# koishi-plugin-github-qq-relay

把 `koishi-plugin-adapter-github` 已派发的 GitHub 事件转发到指定 QQ 群。

这不是一个自己接收 GitHub Webhook 的插件。它依赖 `adapter-github` 先完成：

1. 接收 GitHub Webhook
2. 校验 Secret
3. 解析事件
4. 派发 `ctx.on('github/...')`

本插件只负责：

1. 监听 `adapter-github` 派发的事件
2. 查询数据库中的 `owner/repo -> QQ 群` 绑定
3. 通过 QQ Bot 转发到目标群



## QuickStart

以下假设：

- 插件源码目录：`/app/koishi-plugin-github`
- Koishi 主项目目录：`/app/my-bot`
- Koishi HTTP 对外端口：`3000`
- QQ 适配器已能正常给群发消息

### 1. 把插件源码传到服务器

可选方式：

- `git clone`
- `git pull`
- `scp -r`

推荐保持服务器上的插件目录本身就是一个 git 仓库，后续更新最省事。

### 2. 编译插件

```bash
cd /app/koishi-plugin-github
pnpm install
pnpm build
```

### 3. 安装到 Koishi 主项目

```bash
cd /app/my-bot
yarn add koishi-plugin-github-qq-relay@file:/app/koishi-plugin-github
```

### 4. 修改 `koishi.yml`

示例：

```yaml
plugins:

  github-qq-relay:
    defaultBranch: main
    defaultEvents:
      - push
      - pull_request
      - issue_opened
      - discussion_created
      - discussion_comment
    debug: false
    concurrency: 5
    commandAuthority: 3
    maxPushCommits: 3
```

### 5. 重启 Koishi

```bash
npm install -g pm2

cd /app/my-bot

pm2 list
pm2 logs koishi
pm2 restart koishi
pm2 stop koishi
pm2 delete koishi
```


## GitHub Webhook 配置

进入目标仓库：

`Settings -> Webhooks -> Add webhook`

填写：

- Payload URL: `http://你的公网地址:3000/github/webhook`
- Content type: `application/json`
- Secret: 与 `webhookSecret` 一致

建议至少勾选：

- `Watch`
- `Pushes`
- `Pull requests`
- `Issues`
- `Discussions`

如果希望少折腾，也可以直接选：

- `Send me everything`



## 功能

当前支持的转发事件：

- `star`
- `push`
- `pull_request`
- `issue_opened`
- `discussion_created`
- `discussion_comment`

对应 `adapter-github` 事件来源：

- `github/star`
- `github/push`
- `github/pull-request`
- `github/issue-opened`
- `github/discussion-created`
- `github/discussion-comment`

## 工作链路

完整链路如下：

1. GitHub 向 `http://你的公网地址:端口/github/webhook` 发送 Webhook。
2. `koishi-plugin-adapter-github` 收到并验证请求。
3. `adapter-github` 派发 `github/star`、`github/push` 等事件。
4. 本插件监听这些事件。
5. 本插件查询表 `github_relay_bindings`。
6. 找到 `owner/repo -> QQ 群` 的绑定。
7. 通过 OneBot/NapCat 对应的 QQ Bot 执行 `bot.sendMessage()`。

## 依赖

至少需要这些 Koishi 插件：

- GitHub 侧：`koishi-plugin-adapter-github`
- QQ 侧：NapCat 对应的 Koishi 适配器，常见是 OneBot
- 数据库：任意 `database` 插件
- 本插件：`koishi-plugin-github-qq-relay`

本插件只要求 `database` 服务，但想真正发到 QQ 群，还必须有至少一个非 `github` 平台的可用 Bot。

## 配置项

当前配置项如下：

```yaml
plugins:
  github-qq-relay:
    defaultPlatform: onebot
    defaultBotId: "1234567890"
    defaultBranch: main
    defaultEvents:
      - push
      - pull_request
      - issue_opened
      - discussion_created
      - discussion_comment
    debug: false
    concurrency: 5
    commandAuthority: 3
    maxPushCommits: 3
    bindings:
      - repo: owner/repo
        branch: main
        channelId: "12345678"
        guildId: ""
        platform: onebot
        botId: "1234567890"
        events:
          - push
          - discussion_created
```

配置说明：

- `defaultPlatform`
  默认转发平台。单 QQ Bot 场景通常可留空；多平台场景建议填 `onebot`。
- `defaultBotId`
  默认目标 Bot ID。单 QQ Bot 场景通常可留空；多机器人场景建议填写。
- `defaultEvents`
  命令绑定和静态绑定未显式指定 `events` 时使用的默认事件列表。
- `defaultBranch`
  Push 分支过滤默认值。未显式指定 `branch` 时，默认只转发 `main` 分支的 Push。
- `debug`
  开启后输出更详细的匹配和转发日志。
- `concurrency`
  并发转发数。
- `commandAuthority`
  执行绑定命令需要的 Koishi 权限等级。
- `maxPushCommits`
  `push` 消息中最多展示多少条提交。
- `bindings`
  静态绑定表。数据库绑定和静态绑定会合并生效。
  其中 `branch` 仅对 `push` 事件生效，默认值为 `main`。


## 绑定命令

建议直接在目标 QQ 群里执行。

绑定当前群：

```text
github-relay.bind owner/repo
```

绑定指定群并指定事件：

```text
github-relay.bind owner/repo 12345678 -e push,pull_request,issue_opened,discussion_created,discussion_comment
```

多 Bot / 多平台场景：

```text
github-relay.bind owner/repo 12345678 -p onebot -b 1234567890 -e push,star
```

指定 Push 分支：

```text
github-relay.bind owner/repo 12345678 -r dev -e push,pull_request
```

查看绑定：

```text
github-relay.list
github-relay.list owner/repo
```

解绑：

```text
github-relay.unbind owner/repo
github-relay.unbind owner/repo 12345678
github-relay.unbind owner/repo 12345678 -r dev
```

说明：

- `bind` 如果在群内执行，会自动继承当前会话的 `platform/channelId/guildId`
- 如果不是在目标群里执行，建议显式传 `channelId`
- `events` 留空时使用 `defaultEvents`
- `branch` 留空时使用 `defaultBranch`，默认是 `main`

## GitHub Adapter 推荐配置

推荐 Webhook 模式：

```yaml
plugins:
  adapter-github:
    token: "ghp_xxx"
    mode: webhook
    webhookPath: /github/webhook
    webhookSecret: "your-webhook-secret"
    silentMode: false
```

关键点：

- 默认 Webhook 路径是 `/github/webhook`
- `star` 事件在 Webhook 模式下支持最好
- `discussion` 事件只在 Webhook 模式下支持
- `push` 事件在 `adapter-github` 源码中已明确派发为 `github/push`

## 从源码编译

在插件源码目录执行：

```bash
cd /app/koishi-plugin
pnpm install
pnpm build
```

编译产物会输出到 `lib/`。

如果 `pnpm` 不存在：

```bash
npm install -g pnpm
```

## 安装到 Koishi 主项目

如果你的 Koishi 主项目使用 Yarn 2/3/4，推荐这样安装本地插件：

```bash
cd /app/my-bot
yarn add koishi-plugin-github-qq-relay@file:/app/koishi-plugin
```

注意：

- 这里必须写完整包名：`koishi-plugin-github-qq-relay`
- 不能只写 `file:/app/koishi-plugin`

如果你的主项目用的是 pnpm，则可用：

```bash
cd /app/my-bot
pnpm add /app/koishi-plugin
```

但如果主项目已经明确配置为 Yarn，请继续用 Yarn，不要混用。


## 当前消息格式

### Star

```text
[GitHub Star] octocat 点亮了 Star
仓库：owner/repo
链接：https://github.com/owner/repo
```

### Push

```text
[GitHub Push] octocat 推送了 2 个提交
仓库：owner/repo
分支：main
提交：
- abc1234 feat: add relay
- def5678 fix: handle push
对比：https://github.com/owner/repo/compare/...
```

### Pull Request

```text
[GitHub PR] octocat 创建了 PR #12
仓库：owner/repo
标题：feat: add relay
分支：feature/login -> main
内容：
...
链接：https://github.com/owner/repo/pull/12
```

### Issue Opened

```text
[GitHub Issue] octocat 创建了 Issue #12
仓库：owner/repo
标题：bug report
指派给：alice, bob
内容：
...
链接：https://github.com/owner/repo/issues/12
```

### Discussion Created

```text
[GitHub Discussion] octocat 创建了 Discussion #5
仓库：owner/repo
标题：proposal
分类：Ideas
内容：
...
链接：https://github.com/owner/repo/discussions/5
```

### Discussion Comment

```text
[GitHub Discussion Comment] octocat 评论了 Discussion #5
仓库：owner/repo
标题：proposal
内容：
...
链接：https://github.com/owner/repo/discussions/5#discussioncomment-xxx
```

## 已知边界

- 本插件不自己接收 GitHub Webhook，必须和 `adapter-github` 配合使用
- `discussion` 事件依赖 `adapter-github` 的 Webhook 模式
- 如果有多个非 GitHub 平台 Bot 且未指定 `platform/botId`，自动选 Bot 可能会不明确
- `branch` 过滤目前仅作用于 `push`，默认只转发 `main` 分支
- “每天推送 project 日报” 目前未实现，需要单独接 GitHub Projects API 与定时任务

## 依据

实现依据：

- [adapter-github 事件系统](https://koishi-shangxue-plugins.github.io/koishi-plugin-adapter-github/markdown/dev/events.html)
- [adapter-github 消息处理](https://koishi-shangxue-plugins.github.io/koishi-plugin-adapter-github/markdown/dev/message.html)
- [adapter-github API](https://koishi-shangxue-plugins.github.io/koishi-plugin-adapter-github/markdown/dev/apis.html)
- [adapter-github 源码事件派发](https://github.com/koishi-shangxue-plugins/koishi-plugin-adapter-github/blob/main/src/bot/event.ts)
