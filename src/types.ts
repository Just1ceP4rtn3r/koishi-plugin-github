export const relayEvents = ['star', 'push', 'pull_request', 'issue_opened', 'discussion_created', 'discussion_comment'] as const

export type RelayEventName = typeof relayEvents[number]

export interface RelayBindingRecord {
  id: number
  repo: string
  branch?: string
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
  branch?: string
  channelId: string
  guildId?: string
  platform?: string
  botId?: string
  events?: RelayEventName[]
}

export interface NormalizedBinding {
  repo: string
  branch: string
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

export interface GitHubIssueAssignee {
  login?: string
}

export interface GitHubIssueEvent extends GitHubBaseEvent {
  issue: {
    number?: number
    title?: string
    body?: string
    html_url?: string
    assignees?: GitHubIssueAssignee[]
  }
}

export interface GitHubPullRequestRef {
  ref?: string
}

export interface GitHubPullRequestEvent extends GitHubBaseEvent {
  pullRequest: {
    number?: number
    title?: string
    body?: string
    html_url?: string
    merged?: boolean
    draft?: boolean
    base?: GitHubPullRequestRef
    head?: GitHubPullRequestRef
  }
  action?: 'opened' | 'closed' | 'reopened' | string
}

export interface GitHubDiscussionComment {
  body?: string
  html_url?: string
}

export interface GitHubDiscussionEvent extends GitHubBaseEvent {
  discussion: {
    number?: number
    title?: string
    body?: string
    html_url?: string
    category?: {
      name?: string
    }
  }
  comment?: GitHubDiscussionComment
}

declare module 'koishi' {
  interface Tables {
    github_relay_bindings: RelayBindingRecord
  }
}
