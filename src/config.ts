import { Schema } from 'koishi'
import { BindingConfig, RelayEventName, relayEvents } from './types'

export interface Config {
  defaultPlatform?: string
  defaultBotId?: string
  defaultEvents: RelayEventName[]
  defaultBranch: string
  debug: boolean
  concurrency: number
  commandAuthority: number
  maxPushCommits: number
  bindings: BindingConfig[]
}

const eventSchema = Schema.union(relayEvents.map(event => Schema.const(event))) as Schema<RelayEventName>

export const Config: Schema<Config> = Schema.object({
  defaultPlatform: Schema.string().description('默认转发目标平台。通常可留空；多平台场景建议填写，例如 onebot。'),
  defaultBotId: Schema.string().description('默认使用的目标 Bot ID。通常可留空；多 QQ 机器人实例时建议填写。'),
  defaultEvents: Schema.array(eventSchema)
    .default(['star', 'push', 'pull_request'] as RelayEventName[])
    .description('默认转发事件。命令绑定和静态绑定未显式指定 events 时使用此值。'),
  defaultBranch: Schema.string().default('main').description('Push 分支过滤的默认值。未显式指定 branch 时，默认只转发该分支的 Push。'),
  debug: Schema.boolean().default(false).description('调试模式。开启后输出更详细的匹配和转发日志。'),
  concurrency: Schema.number().min(1).max(20).default(5).description('推送并发数。'),
  commandAuthority: Schema.number().default(3).description('绑定命令所需权限等级。'),
  maxPushCommits: Schema.number().min(1).max(10).default(3).description('Push 消息中最多展示多少条提交。'),
  bindings: Schema.array(Schema.object({
    repo: Schema.string().pattern(/^[^/\s]+\/[^/\s]+$/).description('仓库，格式 owner/repo。'),
    branch: Schema.string().default('main').description('Push 分支过滤。默认 main，仅对 push 事件生效。'),
    channelId: Schema.string().description('目标 QQ 群号或频道 ID。'),
    guildId: Schema.string().description('可选 guildId。多数 QQ 群场景可留空。'),
    platform: Schema.string().description('目标平台，默认沿用上方 defaultPlatform。'),
    botId: Schema.string().description('目标 Bot ID。'),
    events: Schema.array(eventSchema).role('table').description('要转发的事件类型；留空时使用 defaultEvents。'),
  })).role('table').default([]).description('静态绑定，会与数据库里的绑定一起生效。'),
})
