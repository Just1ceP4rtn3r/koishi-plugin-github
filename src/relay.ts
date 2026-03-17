import { Bot, Context, Logger } from 'koishi'
import { Config } from './config'
import { getMergedBindings } from './database'
import { buildDiscussionCommentMessage, buildDiscussionCreatedMessage, buildIssueOpenedMessage, buildPullRequestMessage, buildPushMessage, buildStarMessage } from './message'
import { GitHubBaseEvent, GitHubDiscussionEvent, GitHubIssueEvent, GitHubPullRequestEvent, GitHubPushEvent, GitHubStarEvent, NormalizedBinding, RelayEventName } from './types'
import { formatError, normalizeBranch, simplifyRef } from './utils'

const logger = new Logger('github-qq-relay')

export function registerRelay(ctx: Context, config: Config) {
  ;(ctx.on as any)('github/star', async (event: GitHubStarEvent) => {
    await relayEvent(ctx, config, 'star', event, buildStarMessage(event))
  })

  ;(ctx.on as any)('github/push', async (event: GitHubPushEvent) => {
    await relayEvent(ctx, config, 'push', event, buildPushMessage(event, config))
  })

  ;(ctx.on as any)('github/pull-request', async (event: GitHubPullRequestEvent) => {
    await relayEvent(ctx, config, 'pull_request', event, buildPullRequestMessage(event))
  })

  ;(ctx.on as any)('github/issue-opened', async (event: GitHubIssueEvent) => {
    await relayEvent(ctx, config, 'issue_opened', event, buildIssueOpenedMessage(event))
  })

  ;(ctx.on as any)('github/discussion-created', async (event: GitHubDiscussionEvent) => {
    await relayEvent(ctx, config, 'discussion_created', event, buildDiscussionCreatedMessage(event))
  })

  ;(ctx.on as any)('github/discussion-comment', async (event: GitHubDiscussionEvent) => {
    await relayEvent(ctx, config, 'discussion_comment', event, buildDiscussionCommentMessage(event))
  })
}

async function relayEvent(
  ctx: Context,
  config: Config,
  eventName: RelayEventName,
  event: GitHubBaseEvent,
  message: string,
) {
  const bindings = await getMergedBindings(ctx, config, event.repoKey)
  const matched = bindings.filter(binding => isBindingMatched(binding, eventName, event, config))

  if (!matched.length) {
    if (config.debug) logger.info('no bindings matched for %s (%s)', event.repoKey, eventName)
    return
  }

  const results = await runWithConcurrency(matched, config.concurrency, async (binding) => {
    const bot = resolveTargetBot(ctx, binding, config)
    if (!bot) {
      throw new Error(`未找到可用的目标 Bot${binding.platform ? `（platform=${binding.platform}）` : ''}`)
    }

    if (bot.platform === 'onebot') {
      await bot.sendMessage(binding.channelId, message)
    } else if (binding.guildId) {
      await bot.sendMessage(binding.channelId, message, binding.guildId)
    } else {
      await bot.sendMessage(binding.channelId, message)
    }

    return binding
  })

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const binding = matched[index]
      logger.warn(
        'failed to relay %s (%s) to %s:%s: %s',
        event.repoKey,
        eventName,
        binding.platform || 'auto',
        binding.channelId,
        formatError(result.reason),
      )
    } else if (config.debug) {
      const binding = matched[index]
      logger.info('relayed %s (%s) to %s:%s', event.repoKey, eventName, binding.platform || 'auto', binding.channelId)
    }
  })
}

function isBindingMatched(
  binding: NormalizedBinding,
  eventName: RelayEventName,
  event: GitHubBaseEvent,
  config: Config,
) {
  if (!binding.enabled || !binding.events.includes(eventName)) return false
  if (eventName !== 'push') return true
  const eventBranch = normalizeBranch((event as GitHubPushEvent).ref, config.defaultBranch)
  const bindingBranch = normalizeBranch(binding.branch, config.defaultBranch)
  return bindingBranch === simplifyRef(eventBranch)
}

function resolveTargetBot(ctx: Context, binding: NormalizedBinding, config: Config): Bot | null {
  const targetBotId = binding.botId || config.defaultBotId
  const candidates = ctx.bots.filter((bot) => {
    if (!bot.platform) return false
    if (bot.platform === 'github') return false
    if (binding.platform) return bot.platform === binding.platform
    if (config.defaultPlatform) return bot.platform === config.defaultPlatform
    return true
  })

  if (!candidates.length) return null

  if (targetBotId) {
    return candidates.find(bot => bot.selfId === targetBotId) || null
  }

  if (candidates.length === 1) return candidates[0]

  const platformGroups = new Map<string, Bot[]>()
  for (const bot of candidates) {
    const platform = bot.platform
    if (!platform) continue
    const list = platformGroups.get(platform) || []
    list.push(bot)
    platformGroups.set(platform, list)
  }

  if (platformGroups.size === 1) return candidates[0]

  return null
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  handler: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const queue = items.map((item, index) => ({ item, index }))
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (queue.length) {
      const current = queue.shift()
      if (!current) break
      try {
        const value = await handler(current.item, current.index)
        results[current.index] = { status: 'fulfilled', value }
      } catch (error) {
        results[current.index] = { status: 'rejected', reason: error }
      }
    }
  })
  await Promise.all(workers)
  return results
}
