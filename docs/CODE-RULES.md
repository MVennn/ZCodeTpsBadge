# 编码纪律

> **一句话**：这个补丁工具的必守规则 —— 每条都对应一次真实踩坑；
> 改 `src/` 前后各过一遍 §5 清单。

本文是编码纪律的单一正本。具体修法记录在 [CHANGELOG.md](../CHANGELOG.md)，
机制解释在 [ARCHITECTURE.md](ARCHITECTURE.md)。

---

## 1. 补丁与还原

**规则 1.1 · 补丁落下的每一笔都要能还原。**
apply 写三样东西：外部 preload、头部备份、头部字段。restore 必须一一对应地撤销；
新增任何写入前，先想好它怎么撤。

- 症状：还原后徽标还在，或 ZCode 启动报 preload 缺失。

**规则 1.2 · 头部必须等长写入。**
新 JSON 用 `0x20` 补齐到原 `jsonSize`；超出就失败退出，绝不扩容。
`dataBase = 18 + jsonSize` 是所有 `offset` 的基准，长度一变，全盘偏移失效。

- 症状：ZCode 启动白屏、文件读取错位、asar 解析失败。

**规则 1.3 · 先写外部文件，再写头部。**
头部一旦出现 `unpacked=true`，Electron 就会去读外部文件。顺序反了会出现
「头部已指向、文件还不存在」的窗口。

**规则 1.4 · 外部文件原子写入。**
先写 `index.cjs.tmp-<pid>`，再 `rename` 覆盖。避免新窗口在写入中途加载到半截文件。

**规则 1.5 · 已打补丁时从备份重建，不重复追加。**
补丁后的头部删掉了 `offset`；原始字节要从 `app.asar.header.tps-bak` 里记录的
`offset` / `size` 重新读取。直接拿当前外部文件再追加会得到两份徽标。

**规则 1.6 · 备份只在首次应用时写。**
`if (!exists(BACKUP)) write(BACKUP, headerBuf)`。重建时覆盖备份会把「原始头部」
换成「已补丁头部」，之后再也还原不回去。

## 2. 徽标代码

**规则 2.1 · 无依赖、可序列化。**
`badgeSource` 会被 `toString()` 后注入 preload / CDP，函数体内不能引用模块作用域的
变量、import 或闭包。所有常量写在函数内部。

- 症状：注入后 `ReferenceError`，徽标静默不出现。

**规则 2.2 · 幂等守卫。**
进入时检查 `window.__zcodeTpsBadgeInstalled` 与 `#zcode-tps-badge`；
preload 与 CDP 同时存在、页面重载、热更新都靠这两道守卫避免重复。

**规则 2.3 · 只读调试数据，不写宿主状态。**
不修改聊天内容、不拦截事件；徽标本体保留 `pointer-events:auto` 以接收悬停，
悬停卡 `pointer-events:none`。
唯一允许的宿主调用是 `zcode-agent.readSessionDebug` —— 开发者工具自己每秒也在调
同一个只读方法。**禁止**调用发送、停止、改模型、改设置等写接口；不转发请求头、
响应头或消息正文，只保留最后一轮 round 与会话 cache 计数。

**规则 2.4 · 主题只用 CSS 变量 + 降级值。**
颜色一律 `var(--token, fallback)`，不硬编码绿色 / 黑色 / 白色。
不依赖只在单一主题下定义的变量（如 `--color-foreground-subtle`）。
规范见 [DESIGN.md](DESIGN.md)。

**规则 2.5 · 唯一数据源：`session/debug`。**
徽标的数字只能来自 `zcode-agent.readSessionDebug` 返回的 `rounds[].tokensPerSecond`
与 `usage`；这与开发者工具「Token 调试」是同一份快照。
**禁止**重新引入字符估算、DOM 文本统计、EMA 或「事件 delta 换 token」——
这些路径无法正确处理折叠的思考，也会与面板数字打架。tap 只负责抓 base
service port、发只读请求、把最后一轮 round + cache 转发给徽章；
`networkEntries`、请求头、正文字段一律丢弃。

**规则 2.6 · TPS 口径照抄面板。**
`tokensPerSecond = outputTokens ÷ (generationDurationMs / 1000)`，
`generationDurationMs = durationMs − timeToFirstContentMs`；分子分母都由 agent
算好，客户端不二次换算。`outputTokens` 含思考 tokens，另有一列
`reasoningTokens` 只用于展示。provider 没上报的字段显示 `—`，不要用 0 冒充。
改口径必须同步 [FEATURE-TPS-BADGE.md](FEATURE-TPS-BADGE.md) §4、
[DESIGN.md](DESIGN.md) 与 [CHANGELOG.md](../CHANGELOG.md)。

**规则 2.9 · 请求/响应编解码必须容错，格式按 ARCHITECTURE §7 记录。**
RPC 帧格式（类型字节 / varint / Object JSON / Promise=100 / PromiseSuccess=201 /
EventFire=204 / `zcode-agent` 通道 / `readSessionDebug` 方法）的单一正本在
[ARCHITECTURE.md](ARCHITECTURE.md) §7。改 tap 前先读它；解码器遇到未知类型字节
必须抛错跳过整帧，不能带病输出。请求 id 用高位段（`1e9+`）避免与 App 的
ChannelClient 撞号；同一时间只允许一个在途请求。

**不要调用 `port.start()`，也不要抢在 `Initialize(200)` 之前发请求。** 端口启动和
那一帧属于 App 的 `MessagePortProtocol`；tap 抢先会把 `Initialize` 吃掉，App 的
ChannelClient 停在 Uninitialized，启动页挂起（2026-10-22 真机事故，重装才恢复）。
tap 只 `addEventListener`，等到 `[200]` 再轮询，2 秒兜底；`windowKind=update-status`
的窗口直接跳过。CI 会检查源码里没有 `servicePort.start(`。
`__tpsEventTapSource` 是 patch.mjs 绑定的**函数对象**：注入前必须
`'(' + fn.toString() + ')()'` 序列化并调用，直接传函数源代码只会声明函数、
调试轮询静默不工作（0.2.0–0.2.2 的教训）。

**规则 2.10 · 失败要 fail-closed，不要 fallback 到估算。**
`session/debug` 超时（4s）、返回 202 / 203、通道名变化时，徽标显示 `—` 并在悬停卡
标记「数据源不可用」；连续失败退避 5 秒。**不要**在失败时切回字符估算：
那会把「估算值」伪装成「usage」，比不显示更糟。窗口隐藏时暂停轮询，恢复可见立即补一次。

**规则 2.7 · 徽标挂在宿主工具条里，不固定悬浮。**
只插入 `[data-composer-trailing-actions]` 的第一个子节点，随 flex 布局重排；
工具条出现前**不注入**（禁止 fixed 兜底，否则启动时先闪一下右下角）。
React 重渲染会移除注入节点，必须检测 `host.isConnected` 并重新挂载
（每 60 帧兜底；0.3.0 去掉了计数用的 MutationObserver，不要再挂整树观察器）。
用 `ResizeObserver` 观察输入框容器宽度，按 <600 / <480 / <360 三档收缩
（隐藏圆点 → 隐藏单位 → 缩小字号）。

**规则 2.8 · 悬停卡只读快照。**
`#zcode-tps-tip` 挂在 `document.documentElement` 下，避免被页面布局裁切；
卡片 `pointer-events:none`，不挡鼠标；位置按徽标 rect 计算并夹在视口内。
十三行数值全部来自最近一次 snapshot（本轮 round + 会话 cache），不在 DOM 里反推，
也不在徽标侧累计历史。

## 3. 脚本与路径

**规则 3.1 · 不写死项目目录。**
入口脚本用 `%~dp0`（cmd）或 `import.meta.url`（mjs）定位自身；
项目可以整体搬走而不用改代码。

**规则 3.2 · ZCode 安装路径可覆盖。**
`ZCODE_RESOURCES` 覆盖 resources 目录，`ZCODE_EXE` 覆盖可执行文件；
默认值只是本机约定，不是唯一路径。

**规则 3.3 · 破坏性操作先检查宿主状态。**
apply 默认拒绝在 ZCode 运行时写入；`--force` 是显式选择，且只允许用于
「等长头部 + 外部文件」这种运行中安全的操作。restore 永远要求完全退出。

## 4. 验证纪律

**规则 4.1 · 改完必须跑三层验证。**

1. `node src/patch.mjs` 干跑，看大小与目标条目；
2. `node --check` 外部 preload；
3. `ELECTRON_RUN_AS_NODE=1 ZCode.exe -e ...` 确认 Electron 解析到外部文件。

**规则 4.2 · 真机效果没验就明说。**
补丁写对 ≠ 徽标可见。必须完全退出 ZCode 再启动确认；本会话无法重启宿主时，
在交付说明里写清楚「需重启确认」，不要写成「已验证」。

**规则 4.3 · 样式改动先预览再应用。**
`tools/preview` 用真实 `badgeSource` 渲染深 / 浅两套主题；截图确认后再 apply。

## 5. 改动前自检清单

1. 新增写入有对应还原路径？（§1.1）
2. 头部仍等长、未扩容？（§1.2）
3. 写入顺序是外部文件 → 头部？（§1.3）
4. 外部文件是临时文件 + rename？（§1.4）
5. 重建路径从备份读原始字节，不重复追加？（§1.5）
6. 备份没有被覆盖？（§1.6）
7. 徽标与 tap 函数仍无外部引用、可 `toString()`？（§2.1）
8. 幂等守卫还在（徽章 + tap 各一道）？（§2.2）
9. 颜色全部走主题变量 + 降级值？（§2.4）
10. 数字仍然只来自 `session/debug`，没有字符估算回退？（§2.5/2.6）
11. tap 仍然只读、同一时间一个在途请求、跨世界只传 round + cache？（§2.3/2.9）
12. 失败时是 fail-closed（显示 — / 数据源不可用），没有偷偷估算？（§2.10）
13. 入口脚本没有写死项目目录？（§3.1）
14. `tools/ci/test-debug-source.mjs` 与三层验证跑过，真机状态说清楚了？（§4.1/4.2）
