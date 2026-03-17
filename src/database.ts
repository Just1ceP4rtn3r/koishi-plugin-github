import { Context } from 'koishi'
import { Config } from './config'
import { NormalizedBinding, RelayBindingRecord } from './types'
import { makeBindingKey, normalizeBranch, normalizeEvents, normalizeRepoKey } from './utils'

export function extendDatabase(ctx: Context) {
  ctx.model.extend('github_relay_bindings', {
    id: { type: 'unsigned', length: 10 },
    repo: { type: 'string', length: 255 },
    branch: 'string',
    platform: 'string',
    botId: 'string',
    channelId: 'string',
    guildId: 'string',
    userId: 'string',
    events: 'json',
    enabled: 'boolean',
    createdAt: 'timestamp',
    updatedAt: 'timestamp',
  }, {
    primary: 'id',
    autoInc: true,
  })
}

export async function queryBindings(ctx: Context, repo: string) {
  return ctx.database.get('github_relay_bindings', { repo, enabled: true })
}

export async function listBindings(ctx: Context, repo?: string) {
  return repo
    ? ctx.database.get('github_relay_bindings', { repo })
    : ctx.database.get('github_relay_bindings', {})
}

export async function upsertBinding(ctx: Context, data: Omit<RelayBindingRecord, 'id' | 'createdAt' | 'updatedAt'>) {
  const branch = normalizeBranch(data.branch)
  const rows = await ctx.database.get('github_relay_bindings', {
    repo: data.repo,
    platform: data.platform,
    channelId: data.channelId,
  })
  const matchedRow = rows.find(row => normalizeBranch(row.branch) === branch)

  const now = new Date()
  if (matchedRow) {
    await ctx.database.set('github_relay_bindings', { id: matchedRow.id }, {
      branch,
      botId: data.botId,
      guildId: data.guildId,
      userId: data.userId,
      events: normalizeEvents(data.events),
      enabled: data.enabled,
      updatedAt: now,
    })
    return 'updated'
  }

  await ctx.database.create('github_relay_bindings', {
    ...data,
    branch,
    events: normalizeEvents(data.events),
    createdAt: now,
    updatedAt: now,
  })
  return 'created'
}

export async function removeBinding(ctx: Context, repo: string, branch: string, platform: string, channelId: string) {
  const normalizedBranch = normalizeBranch(branch)
  const rows = await ctx.database.get('github_relay_bindings', { repo, platform, channelId })
  const matchedRow = rows.find(row => normalizeBranch(row.branch) === normalizedBranch)
  if (!matchedRow) return false
  await ctx.database.remove('github_relay_bindings', { id: matchedRow.id })
  return true
}

export function getStaticBindings(config: Config): NormalizedBinding[] {
  const bindings: NormalizedBinding[] = []

  for (const binding of config.bindings) {
    const repo = normalizeRepoKey(binding.repo)
    if (!repo) continue

    bindings.push({
      repo,
      branch: normalizeBranch(binding.branch, config.defaultBranch),
      platform: binding.platform || config.defaultPlatform,
      botId: binding.botId || config.defaultBotId,
      channelId: binding.channelId,
      guildId: binding.guildId,
      events: normalizeEvents(binding.events, config.defaultEvents),
      enabled: true,
      source: 'config',
    })
  }

  return bindings
}

export async function getMergedBindings(ctx: Context, config: Config, repo: string) {
  const merged = new Map<string, NormalizedBinding>()

  for (const binding of getStaticBindings(config).filter(item => item.repo === repo)) {
    merged.set(makeBindingKey(binding.repo, binding.branch, binding.platform, binding.channelId, binding.guildId, binding.botId), binding)
  }

  for (const row of await queryBindings(ctx, repo)) {
    const binding = toNormalizedBinding(row)
    merged.set(makeBindingKey(binding.repo, binding.branch, binding.platform, binding.channelId, binding.guildId, binding.botId), binding)
  }

  return Array.from(merged.values())
}

export function toNormalizedBinding(row: RelayBindingRecord): NormalizedBinding {
  return {
    repo: row.repo,
    branch: normalizeBranch(row.branch),
    platform: row.platform || undefined,
    botId: row.botId || undefined,
    channelId: row.channelId,
    guildId: row.guildId || undefined,
    userId: row.userId || undefined,
    events: normalizeEvents(row.events),
    enabled: row.enabled,
    source: 'database',
  }
}
