import { Config } from './config'
import { GitHubDiscussionEvent, GitHubIssueEvent, GitHubPullRequestEvent, GitHubPushEvent, GitHubStarEvent } from './types'
import { buildCompareUrl, firstLine, simplifyRef } from './utils'

export function buildStarMessage(event: GitHubStarEvent) {
  const actor = event.actor?.login || event.actor?.name || 'unknown'
  const action = event.action === 'deleted' ? '取消了 Star' : '点亮了 Star'

  return [
    `[GitHub Star] ${actor} ${action}`,
    `仓库：${event.repoKey}`,
    `链接：https://github.com/${event.repoKey}`,
  ].join('\n')
}

export function buildPushMessage(event: GitHubPushEvent, config: Config) {
  const actor = event.actor?.login || event.actor?.name || 'unknown'
  const branch = simplifyRef(event.ref)
  const commits = (event.commits || []).slice(0, config.maxPushCommits)
  const total = event.commits?.length || 0

  const lines = [
    `[GitHub Push] ${actor} 推送了 ${total} 个提交`,
    `仓库：${event.repoKey}`,
    `分支：${branch}`,
  ]

  if (commits.length) {
    lines.push('提交：')
    for (const commit of commits) {
      const sha = (commit.id || commit.sha || '').slice(0, 7) || 'unknown'
      const title = firstLine(commit.message) || '(no message)'
      lines.push(`- ${sha} ${title}`)
    }
  }

  if (total > commits.length) {
    lines.push(`- 其余 ${total - commits.length} 个提交已省略`)
  }

  const compareUrl = buildCompareUrl(event.repoKey, event.before, event.after)
  if (compareUrl) lines.push(`对比：${compareUrl}`)

  return lines.join('\n')
}

export function buildIssueOpenedMessage(event: GitHubIssueEvent) {
  const actor = event.actor?.login || event.actor?.name || 'unknown'
  const assignees = (event.issue.assignees || [])
    .map(item => item.login)
    .filter(Boolean)
    .join(', ')

  const lines = [
    `[GitHub Issue] ${actor} 创建了 Issue #${event.issue.number || '?'}`,
    `仓库：${event.repoKey}`,
    `标题：${event.issue.title || '(no title)'}`,
  ]

  if (assignees) lines.push(`指派给：${assignees}`)
  if (event.issue.body) lines.push(`内容：\n${event.issue.body}`)
  if (event.issue.html_url) lines.push(`链接：${event.issue.html_url}`)

  return lines.join('\n')
}

export function buildPullRequestMessage(event: GitHubPullRequestEvent) {
  const actor = event.actor?.login || event.actor?.name || 'unknown'
  const action = event.action === 'closed'
    ? (event.pullRequest.merged ? '合并了' : '关闭了')
    : event.action === 'reopened'
      ? '重新打开了'
      : '创建了'
  const head = simplifyRef(event.pullRequest.head?.ref)
  const base = simplifyRef(event.pullRequest.base?.ref)

  const lines = [
    `[GitHub PR] ${actor} ${action} PR #${event.pullRequest.number || '?'}`,
    `仓库：${event.repoKey}`,
    `标题：${event.pullRequest.title || '(no title)'}`,
  ]

  if (head !== 'unknown' || base !== 'unknown') lines.push(`分支：${head} -> ${base}`)
  if (event.pullRequest.draft) lines.push('状态：Draft')
  if (event.pullRequest.body) lines.push(`内容：\n${event.pullRequest.body}`)
  if (event.pullRequest.html_url) lines.push(`链接：${event.pullRequest.html_url}`)

  return lines.join('\n')
}

export function buildDiscussionCreatedMessage(event: GitHubDiscussionEvent) {
  const actor = event.actor?.login || event.actor?.name || 'unknown'
  const lines = [
    `[GitHub Discussion] ${actor} 创建了 Discussion #${event.discussion.number || '?'}`,
    `仓库：${event.repoKey}`,
    `标题：${event.discussion.title || '(no title)'}`,
  ]

  if (event.discussion.category?.name) lines.push(`分类：${event.discussion.category.name}`)
  if (event.discussion.body) lines.push(`内容：\n${event.discussion.body}`)
  if (event.discussion.html_url) lines.push(`链接：${event.discussion.html_url}`)

  return lines.join('\n')
}

export function buildDiscussionCommentMessage(event: GitHubDiscussionEvent) {
  const actor = event.actor?.login || event.actor?.name || 'unknown'
  const lines = [
    `[GitHub Discussion Comment] ${actor} 评论了 Discussion #${event.discussion.number || '?'}`,
    `仓库：${event.repoKey}`,
    `标题：${event.discussion.title || '(no title)'}`,
  ]

  if (event.comment?.body) lines.push(`内容：\n${event.comment.body}`)
  if (event.comment?.html_url || event.discussion.html_url) lines.push(`链接：${event.comment?.html_url || event.discussion.html_url}`)

  return lines.join('\n')
}
