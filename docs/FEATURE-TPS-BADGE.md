# 功能专项：tok/s 徽标

> **一句话**：徽标显示什么、数据从哪里来、放在哪里、悬停看什么 ——
> 这是功能范围与验收标准的正本；实现机制见 [ARCHITECTURE.md](ARCHITECTURE.md)，
> 视觉参数见 [DESIGN.md](DESIGN.md)。

---

## 1. 目标

在 ZCode 桌面版输入框底部工具条里显示一个胶囊徽标：

- **每个完成的主轮请求**显示该请求的 `tok/s`，与开发者工具「Token 调试」
  表格里的 `TPS (tokens/s)` 同源同口径；
- 生成过程中圆点脉冲，数字保持上一轮 —— 不做逐秒采样，也不按字符估算；
- 空闲时保留最后一轮数值，圆点变暗；
- 鼠标悬停显示本轮与本次会话的 token / 缓存 / 耗时统计；
- 不遮挡输入框、不压住滚动条、不拦截鼠标点击。

面向使用者的概述在根 [README.md](../README.md)；本篇是范围与口径的正本。

## 2. 挂载位置

- 锚点：`[data-composer-trailing-actions]`，插入为第一个 flex 子项；
- 优先选择可见的 `[data-v4-composer-dock]` 内的工具条；
- 工具条出现前不注入，**不做 fixed 右下角兜底**；
- React 重渲染移除节点时自动重新挂载（每 60 帧兜底）；
- 窗口缩放时随工具条重排，并按容器宽度三档收缩；
- 深 / 浅主题自动适配，配色与降级值见 [DESIGN.md](DESIGN.md) §3。

## 3. 数据来源

只有一条数据路：ZCode 开发者工具「Token 调试」使用的 session debug 快照。

主世界的 tap（`src/event-source.mjs`）抓住宿主下发的 base service
MessagePort（`zcode:service-port`），每秒向 `zcode-agent` 通道发一次只读请求：

```
readSessionDebug({ workspacePath, workspaceIdentity?, sessionId })
```

宿主返回 `{ sessionId, rounds, networkEntries, cache }`。tap 只取：

- `rounds`：每个完成的主轮请求一条；
- `cache`：本会话的累计输入 / 缓存命中 / 平均命中率。

`workspacePath` / `workspaceIdentity` 优先取同一会话的
`zcode:scoped-service-port` 消息（侧聊 / 子会话会带；主聊天窗口通常没有），其次窗口
URL 的 `initialWorkspacePath`，最后从同端口的出站请求里嗅探。`sessionId` 取可见聊天
容器的 `[data-session-id]`（跳过 `draft`），没有时回退到最近的
`conversation/<sid>` 主题。

每条 round 的字段：

| 字段 | 含义 |
|---|---|
| `requestIndex` | 本会话第几个主轮请求（面板的「轮次」） |
| `usage.inputTokens` | 本轮输入 tokens |
| `usage.outputTokens` | 本轮输出 tokens（含思考，按 provider usage） |
| `usage.reasoningTokens` | 其中思考 tokens |
| `usage.cachedInputTokens` | 缓存命中的输入 tokens |
| `usage.cachedWriteInputTokens` | 缓存写入 tokens |
| `usage.totalTokens` | provider 返回的总量 |
| `generationDurationMs` | 从首个输出 token 到请求结束的毫秒数 |
| `tokensPerSecond` | `outputTokens ÷ (generationDurationMs / 1000)` |
| `hitRate` | `cachedInputTokens ÷ inputTokens` |

**TPS 公式与开发者工具完全相同**：`Output tokens ÷ 首个输出 token 到请求结束的秒数`。
因为 `outputTokens` 来自模型 usage，思考 tokens 不需要也不应该由页面文本推算；
思考行折叠、展开或完全不在 DOM 里，都不影响读数。

不统计：

- 页面 DOM 文本（正文、思考文本、工具块）；
- 工具输出、子代理摘要；
- 历史消息、侧边栏、终端、开发者工具面板自身；
- 没有完成的主轮请求（进行中的请求没有 usage，不编造数字）。

启动约束：

- tap 只给 base 端口挂监听器，**不调用 `port.start()`**；端口启动和 `Initialize(200)`
  帧属于 App 自己的 `MessagePortProtocol`。抢跑会让 App 停在未初始化状态、启动页挂起；
- 等到 `Initialize(200)` 后才开始轮询；2 秒没等到则兜底；
- `windowKind=update-status` 的启动 / 更新窗口直接跳过，不碰它的端口。

只读约束：

- tap 不调用发送、修改、停止等任何写接口；
- `networkEntries`、请求头、响应头、消息正文都不转发给徽标，只转发最后一轮
  round 与会话 cache；
- 每秒最多一个请求、同一时间最多一个在途请求；窗口隐藏时暂停，恢复后立即刷新。

## 4. 统计口径

| 项 | 规则 |
|---|---|
| 统计单位 | 一个完成的主轮模型请求（`querySource = main_turn`），不是用户的一轮对话 |
| 数据来源 | `zcode-agent.readSessionDebug`，与开发者工具同一快照 |
| TPS | `outputTokens ÷ (durationMs − timeToFirstContentMs)`，即 round 里的 `tokensPerSecond` |
| 速度统计 | 快照 `rounds` 里**有效轮次**：`tokensPerSecond > 0`、`generationDurationMs ≥ 100ms`、`tokensPerSecond ≤ 2000`；平均为算术平均，最高 / 最低为最大 / 最小；最多最近 200 轮（agent 上限，与面板表格一致） |
| 异常轮次 | 面板偶发的 `generationDurationMs ≈ 6ms` 会让 388 output 算出 64,666.7 tok/s；这类轮次不计入平均 / 最高 / 最低，本轮显示 `—`，状态「本轮 TPS 异常（已跳过）」 |
| 刷新 | 每秒轮询一次；请求完成后，下一次快照即可看到新数值 |
| 生成中 | 圆点脉冲；数值保持上一轮（`data-running="1"`） |
| 空闲 | 保留最后一轮数值；最后一次活动 2 秒后圆点变暗 |
| 无数据 | 显示 `— tok/s`，悬停状态为「等待首个请求」 |
| 会话切换 | 检测到新的 `sessionId` 时清空本轮与会话统计 |
| 后台 | `document.hidden` 期间不轮询；恢复可见时立即补一次 |
| 失败 | RPC 失败 / 超时 / 未知通道：显示 `—`，悬停状态为「数据源不可用」；连续失败按 5 秒退避 |
| 显示 | `>=100` 取整，否则 1 位小数 |

一个用户回合里如果发生多次模型请求（工具调用后继续生成），面板和徽标都会把它
记成多轮；这是 ZCode 的口径，不是本项目另算的。

## 5. 悬停统计卡

鼠标悬停 120ms 后弹出，移开 80ms 后淡出。内容：

| 行 | 含义 |
|---|---|
| 本轮速度 | 最后一轮请求的 `tokensPerSecond`，固定 1 位小数（与面板一致），带单位；异常轮次显示 `—` |
| 平均速度 | 最近 200 轮里有效 TPS 的算术平均（排除异常轮次） |
| 最高速度 | 最近 200 轮里的最大有效 TPS |
| 最低速度 | 最近 200 轮里的最小有效 TPS（只统计 > 0、时长 ≥ 100ms、TPS ≤ 2000） |
| 输出 | 最后一轮的 `usage.outputTokens` |
| 思考 | 最后一轮的 `usage.reasoningTokens` |
| 输入 | 最后一轮的 `usage.inputTokens` |
| 缓存命中 | 最后一轮的 `usage.cachedInputTokens` |
| 生成耗时 | 最后一轮的 `generationDurationMs` |
| 会话请求 | `cache.hitRateRequestCount`（缺失时用本轮快照的 round 数） |
| 累计输入 | `cache.totalInputTokens` |
| 累计命中 | `cache.totalCacheReadTokens` |
| 状态 | 生成中 / 空闲 / 等待首个请求 / 本轮 TPS 异常（已跳过） / 数据源不可用 |

平均 / 最高 / 最低由 tap 在每次快照里按 `rounds` 现算，徽标不自己累计；
统计跨轮保留在 ZCode 的 agent 会话里，重启 ZCode 或新建会话后从零开始。
平均命中不在徽标里重复显示——开发者工具的摘要里已有。

**为什么会有 6 万 tok/s**：面板的 TPS 是
`outputTokens ÷ (durationMs − timeToFirstContentMs)`。缓存命中 / 上下文压缩类请求
可能把 `durationMs` 和 `timeToFirstContentMs` 报得几乎相等（例如只差 6ms），
388 output ÷ 0.006s = 64,666.7 tok/s。这是计时口径的异常值，不是真实生成速度；
面板本身不做过滤，徽标只把它挡在统计之外。

## 6. 响应式

按输入框容器宽度分三档：

| 档位 | 容器宽度 | 变化 |
|---|---|---|
| 完整 | ≥600px | 圆点 + 数值 + 单位 |
| 1 | 480–599px | 隐藏圆点 |
| 2 | 360–479px | 隐藏圆点 + 单位 |
| 3 | <360px | 再缩小字号与内边距 |

## 7. 边界与已知限制

- 只在 Windows + ZCode 桌面版验证；其它 Electron 版本不保证选择器存在。
- ZCode 升级会替换 `app.asar`，补丁与徽标消失，需要重新 apply。
- `session/debug` 是 ZCode 的内部接口；大版本改动通道名、方法名或帧格式时，
  徽标会显示「数据源不可用」，**不会退回字符估算**。这是有意选择：宁可不显示，
  也不把估算值冒充 usage。
- 只包含主轮请求；子代理、后台任务、压缩上下文等请求不在面板的「主轮请求」里，
  徽标也不显示。
- 进行中的请求没有 usage：生成中只脉冲圆点，完成后才更新数字。
- provider 没有上报的字段显示 `—`；`hitRate` 在缺少输入 / 缓存字段时为 `—`。
- 数值是 provider 的 usage，仍不用于计费或精确 benchmark。

## 8. 验收清单

1. 输入框工具条出现后，徽标位于用量左侧，`position: static`；
2. 900 / 600 / 420 三种窗口宽度下都在工具条内，宽度递减；
3. 完成一次主轮请求后，徽标数值与开发者工具「Token 调试」同一行的 TPS 一致；
4. 思考行折叠时，悬停卡里的「输出 / 思考」仍为非零，TPS 与面板一致；
5. 生成过程中圆点脉冲、数字保持上一轮；请求完成后数字更新；
6. 没有完成请求时显示 `— tok/s`，悬停状态为「等待首个请求」；
7. 悬停弹出统计卡，位置在徽标上方且不超出视口；移开鼠标后隐藏；
8. ZCode 完全重启后徽标仍自动出现；tap 或 RPC 不可用时显示「数据源不可用」，
   不出现字符估算的假数字。
