import { Context } from 'koishi'
import { Config } from './config'
import { getStaticBindings, listBindings, removeBinding, toNormalizedBinding, upsertBinding } from './database'
import { NormalizedBinding, relayEvents } from './types'
import { inferBotId, inferGuildId, inferPlatform, normalizeRepoKey, parseEventList } from './utils'

export function registerCommands(ctx: Context, config: Config) {
  ctx.command('github-relay', 'GitHub 事件转发管理')

  ctx.command('github-relay.bind <repo:string> [channelId:string]', '绑定 GitHub 仓库到当前群或指定群')
    .option('events', `-e <events:string> 事件列表，逗号分隔：${relayEvents.join(',')}`)
    .option('platform', '-p <platform:string> 目标平台')
    .option('botId', '-b <botId:string> 目标 Bot ID')
    .option('guildId', '-g <guildId:string> 可选 guildId')
    .action(async ({ session, options }: any, repo: string, channelId?: string) => {
      const denied = ensureAuthority(session, config.commandAuthority)
      if (denied) return denied

      const repoKey = normalizeRepoKey(repo)
      if (!repoKey) return '仓库格式错误，应为 owner/repo。'

      const targetChannelId = channelId || session?.channelId
      if (!targetChannelId) return '缺少目标群号，请直接传入 channelId，或在目标群里执行命令。'

      const events = parseEventList(options.events, config.defaultEvents)
      if (!events) return `事件列表无效，只支持 ${relayEvents.join(',')}。`

      const platform = options.platform || inferPlatform(session) || config.defaultPlatform
      if (!platform) return '无法确定目标平台。请在目标群里执行命令，或使用 -p 显式指定平台。'
      const botId = options.botId || inferBotId(session) || config.defaultBotId
      const guildId = options.guildId || inferGuildId(session)
      const userId = session?.userId

      const mode = await upsertBinding(ctx, {
        repo: repoKey,
        platform,
        botId,
        channelId: targetChannelId,
        guildId,
        userId,
        events,
        enabled: true,
      })

      return mode === 'created'
        ? `已创建绑定：${repoKey} -> ${platform}:${targetChannelId} (${events.join(', ')})`
        : `已更新绑定：${repoKey} -> ${platform}:${targetChannelId} (${events.join(', ')})`
    })

  ctx.command('github-relay.unbind <repo:string> [channelId:string]', '解绑 GitHub 仓库与群的转发')
    .option('platform', '-p <platform:string> 目标平台')
    .action(async ({ session, options }: any, repo: string, channelId?: string) => {
      const denied = ensureAuthority(session, config.commandAuthority)
      if (denied) return denied

      const repoKey = normalizeRepoKey(repo)
      if (!repoKey) return '仓库格式错误，应为 owner/repo。'

      const targetChannelId = channelId || session?.channelId
      if (!targetChannelId) return '缺少目标群号，请直接传入 channelId，或在目标群里执行命令。'

      const platform = options.platform || inferPlatform(session) || config.defaultPlatform
      if (!platform) return '无法确定目标平台。请在目标群里执行命令，或使用 -p 显式指定平台。'
      const removed = await removeBinding(ctx, repoKey, platform, targetChannelId)
      if (!removed) return `未找到绑定：${repoKey} -> ${platform}:${targetChannelId}`

      return `已解绑：${repoKey} -> ${platform}:${targetChannelId}`
    })

  ctx.command('github-relay.list [repo:string]', '查看当前转发绑定')
    .action(async ({ session }: any, repo?: string) => {
      const denied = ensureAuthority(session, config.commandAuthority)
      if (denied) return denied

      const repoKey = repo ? normalizeRepoKey(repo) : undefined
      if (repo && !repoKey) return '仓库格式错误，应为 owner/repo。'

      const dbRows = await listBindings(ctx, repoKey)
      const staticRows = getStaticBindings(config).filter(binding => !repoKey || binding.repo === repoKey)
      const rows = [
        ...dbRows.map(row => toNormalizedBinding(row)),
        ...staticRows,
      ]

      if (!rows.length) return '当前没有任何 GitHub 转发绑定。'

      if (session?.channelId) {
        const preferred = rows.filter(row => row.channelId === session.channelId)
        if (preferred.length) return renderBindings(preferred)
      }

      return renderBindings(rows)
    })
}

function renderBindings(bindings: NormalizedBinding[]) {
  return bindings.map((binding) => {
    const platform = binding.platform || 'auto'
    const suffix = binding.botId ? ` bot=${binding.botId}` : ''
    const user = binding.userId ? ` user=${binding.userId}` : ''
    return `${binding.repo} -> ${platform}:${binding.channelId}${suffix}${user} [${binding.events.join(', ')}] (${binding.source})`
  }).join('\n')
}

function ensureAuthority(session: any, required: number) {
  const authority = session?.user?.authority ?? 0
  if (authority < required) {
    return `权限不足，需要 authority >= ${required}。`
  }
  return ''
}
