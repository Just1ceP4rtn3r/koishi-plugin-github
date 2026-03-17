import { Session } from 'koishi'
import { RelayEventName, relayEvents } from './types'

export const FALLBACK_BRANCH = 'main'

export function normalizeRepoKey(repo?: string) {
  if (!repo) return ''
  const normalized = repo.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/+$/, '')
  return /^[^/\s]+\/[^/\s]+$/.test(normalized) ? normalized : ''
}

export function parseEventList(value?: string, fallback: RelayEventName[] = [...relayEvents]) {
  if (!value) return [...fallback]
  const parts = value.split(',').map(item => item.trim()).filter(Boolean)
  if (!parts.length) return [...fallback]
  if (parts.some(item => !relayEvents.includes(item as RelayEventName))) return null
  return Array.from(new Set(parts)) as RelayEventName[]
}

export function normalizeEvents(events?: RelayEventName[], fallback: RelayEventName[] = [...relayEvents]) {
  if (!events?.length) return [...fallback]
  return Array.from(new Set(events))
}

export function normalizeBranch(branch?: string, fallback = FALLBACK_BRANCH) {
  const normalized = simplifyRef(branch).trim()
  return normalized && normalized !== 'unknown' ? normalized : fallback
}

export function makeBindingKey(repo: string, branch?: string, platform?: string, channelId?: string, guildId?: string, botId?: string) {
  return [repo, normalizeBranch(branch), platform || '', channelId || '', guildId || '', botId || ''].join('::')
}

export function inferPlatform(session?: Session) {
  return session?.platform || ''
}

export function inferBotId(session?: Session) {
  return session?.bot?.selfId || ''
}

export function inferGuildId(session?: Session) {
  if (!session?.guildId || session.guildId === session.channelId) return ''
  return session.guildId
}

export function simplifyRef(ref?: string) {
  if (!ref) return 'unknown'
  return ref.replace(/^refs\/heads\//, '').replace(/^refs\/tags\//, 'tag:')
}

export function firstLine(input?: string) {
  if (!input) return ''
  return input.split('\n')[0].trim()
}

export function buildCompareUrl(repo: string, before?: string, after?: string) {
  if (!before || !after) return ''
  if (/^0+$/.test(before)) return `https://github.com/${repo}/commit/${after}`
  return `https://github.com/${repo}/compare/${before}...${after}`
}

export function formatError(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}
