export const relayEvents = ['star', 'push'] as const

export type RelayEventName = typeof relayEvents[number]

export interface RelayBindingRecord {
  id: number
  repo: string
  platform: string
  botId?: string
  channelId: string
  guildId?: string
  userId?: string
  events: RelayEventName[]
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface BindingConfig {
  repo: string
  channelId: string
  guildId?: string
  platform?: string
  botId?: string
  events?: RelayEventName[]
}

export interface NormalizedBinding {
  repo: string
  platform?: string
  botId?: string
  channelId: string
  guildId?: string
  userId?: string
  events: RelayEventName[]
  enabled: boolean
  source: 'database' | 'config'
}

export interface GitHubActor {
  login?: string
  name?: string
}

export interface GitHubBaseEvent {
  owner: string
  repo: string
  repoKey: string
  actor?: GitHubActor
  action?: string
  payload?: Record<string, any>
}

export interface GitHubStarEvent extends GitHubBaseEvent {
  action?: 'started' | 'deleted' | string
}

export interface GitHubPushCommit {
  id?: string
  sha?: string
  message?: string
  url?: string
  distinct?: boolean
  author?: {
    name?: string
  }
}

export interface GitHubPushEvent extends GitHubBaseEvent {
  ref?: string
  before?: string
  after?: string
  commits?: GitHubPushCommit[]
  headCommit?: GitHubPushCommit
}

declare module 'koishi' {
  interface Tables {
    github_relay_bindings: RelayBindingRecord
  }
}
