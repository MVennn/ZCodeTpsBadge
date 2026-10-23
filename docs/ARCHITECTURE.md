# 注入架构

> **一句话**：讲清楚徽标如何在不动 asar 数据区的前提下，通过「等长头部 + unpacked preload」
> 在每次 ZCode 启动时注入，以及补丁、重建、还原各自做什么。

---

## 1. 目标与约束

- 目标：ZCode 每次启动都自动出现徽标，不需要专用启动器、不开调试端口。
- 约束：不能重新打包整个 asar（约 341 MB），不能移动任何已有文件的数据偏移。
- 结论：只改 asar 头部里一个条目的 `unpacked` / `size` / `integrity`，
  并把该条目对应的文件复制到 `app.asar.unpacked`。

## 2. 为什么选 preload 补丁（而不是 CDP）

| 方案 | 优点 | 代价 |
|---|---|---|
| asar unpacked preload（主方案） | 普通图标启动即生效；无额外进程；无调试端口 | 修改安装目录；ZCode 升级后要重打 |
| CDP 注入（备用） | 完全不改安装文件 | 必须用专用启动器开 9222；本机进程可控制 ZCode |

两套方案共用同一份徽标代码（`src/badge-source.mjs`），保证外观与统计逻辑一致。

## 3. asar 结构与本项目用到的不变量

asar 文件布局：

```
0            : 4 字节 header size picker
4            : 4 字节 header size
8            : 4 字节 jsonSize
12           : 4 字节 jsonSize
16           : header JSON（jsonSize 字节）
16 + jsonSize: 文件数据区（dataBase）
```

实际读取以 `readUInt32LE(12)` 为准（见 `src/patch.mjs` 的 `readHeader`）。

每个文件条目形如：

```json
{ "size": 781611, "offset": "12345", "integrity": { "algorithm": "SHA256", "...": "..." } }
```

补丁依赖三条不变量：

1. **头部长度不变**：新 JSON 用空格（`0x20`）补齐到原 `jsonSize`，`dataBase` 因此不变，
   所有 `offset` 继续有效。
2. **只动目标条目**：`out/preload/index.cjs` 的 `size` 改成新文件长度，`unpacked` 置 `true`，
   删除 `offset`，重算 `integrity`。其他条目原样保留。
3. **先外部文件、后头部**：Electron 一旦看到 `unpacked=true` 就会去读外部文件；
   顺序反了会有一瞬间指向不存在的文件。

## 4. 补丁四步

`src/patch.mjs`：

1. 读头部 JSON，定位 `out/preload/index.cjs`。
2. 从 `dataBase + offset` 读出原始 preload 字节，把 `badgeSource.toString()` 追加到末尾。
3. 把新文件写到 `resources/app.asar.unpacked/out/preload/index.cjs`（临时文件 + rename）。
4. 把当前这份干净头部写到 `app.asar.header.tps-bak`（已存在且属于旧版本时覆盖），
   然后把新 JSON 写回头部（等长）。

输出会打印 `original size` / `patched size` / `verified: unpacked=true size=... external=...`。

## 5. 启动加载链路

```
ZCode.exe
  └─ Electron 读取 resources/app.asar 头部
       └─ out/preload/index.cjs 标记为 unpacked
            └─ 读取 resources/app.asar.unpacked/out/preload/index.cjs
                 └─ 末尾依次执行：
                      1. var __tpsEventTapSource = function eventSource(){…}（函数对象）
                      2. 徽标 IIFE 在 renderer（隔离世界）执行
                           ├─ installTap()：把函数 toString() 包装成 `(…)()` 调用，
                           │  再经 webFrame.executeJavaScript 注入主世界；
                           │  主世界抓 base service port，轮询 session/debug
                           │  （活动时每秒、空闲时 10 秒）
                           └─ 监听 DOM，在输入框工具条渲染 #zcode-tps-badge
```

> **坑**：`__tpsEventTapSource` 是**函数对象**，不是字符串。直接把它交给
> `executeJavaScript` 只会声明函数、不会执行，调试轮询会静默失效（0.2.0–0.2.2
> 就是这样）。`installTap()` 必须先 `'(' + fn.toString() + ')()'`。

徽标脚本的启动条件（`src/badge-source.mjs`）：

- `location.pathname` 以 `index.html` 结尾；
- 页面里有 `#root`；
- 尚未安装过（`window.__zcodeTpsBadgeInstalled`）且不存在 `#zcode-tps-badge`。

挂载位置：只插入输入框底部工具条 `[data-composer-trailing-actions]` 的第一个子节点
（在用量 / 模型选择器左侧）。工具条出现前**不注入**，所以启动时不会先出现在右下角。
工具条重渲染可能移除注入节点：`placeBadge()` 发现 `host.isConnected` 为 false 或
父节点变了就重新挂载，1 秒检查一次（此前是 60 帧兜底，等于让合成器整窗生命周期都
保持 60Hz 唤醒）。`ResizeObserver` 观察输入框容器宽度，按 <600 / <480 / <360 三档
收缩（隐藏圆点 → 隐藏单位 → 缩小字号）。
悬停统计卡 `#zcode-tps-tip` 挂在 `document.documentElement` 下（避免被页面布局裁切），
`position:fixed` 按徽标矩形定位，`pointer-events:none`。

## 6. 重建与还原

### 重建（已打补丁时再跑 `--apply`）

补丁后的头部删掉了目标条目的 `offset`，但原始字节仍留在 asar 数据区。
`src/patch.mjs` 会从 `app.asar.header.tps-bak` 读回原始 `offset` / `size`，
重新取出原始 preload，再追加**当前**的徽标代码。因此改完样式直接再 apply 即可，
不会出现「旧徽标 + 新徽标」叠加。

> **升级后的备份**：ZCode 升级只替换 `app.asar`，不管 `app.asar.header.tps-bak`。
> 旧备份里的 `offset` 指向上一个版本的布局，留着它会让「重建」读到错位字节、让
> 「还原」把头部写乱。所以只要读到的目标条目是**未打补丁**状态（说明 `app.asar`
> 已被替换），apply 就把当前这份干净头部写成新备份，覆盖旧备份时打印
> `header backup belongs to an older ZCode build`。`restore.mjs` 另有逐条 ownership
> 校验，跨版本备份会被直接拒绝。判据正本见 [CODE-RULES.md](CODE-RULES.md) 规则 1.6。

### 还原

`src/restore.mjs`：

1. 用备份头部覆盖当前头部（长度必须一致）；
2. 删除 `app.asar.unpacked/out/preload/index.cjs`；
3. 徽标消失，备份文件可以保留或删除。

还原要求 ZCode 完全退出（头部写回时更敏感）。

## 7. 运行时数据流

0.3.0 起只有一条数据路：主世界 tap 通过 base service port 调用
`zcode-agent.readSessionDebug`，读取开发者工具「Token 调试」的同一份快照。
不再解码会话行文本，也不按 DOM 字符估算。

### 7.1 服务端口与 `session/debug`

ZCode（desktop@2.x）的渲染层与宿主进程之间是一条 **MessagePort 二进制 RPC**
（VSCode 式 VSBuffer marshalling）。主进程把端口作为 `zcode:service-port`
窗口消息交给渲染层，preload 再转发给主世界：

```
宿主进程 (utilityProcess)
  └─ MessagePort（端口消息 = 一个 VSBuffer）
       ├─ 请求：[100, requestId, channelName, method] + [args 数组]
       ├─ 响应：[201, requestId] + result / [202, requestId] + error
       └─ 事件：[204, requestId] + {topic:"conversation/<sid>", payload:{deltas:[…]}}
```

marshalling 类型字节：`0` Undefined / `1` String / `2` Buffer / `3` VSBuffer /
`4` Array / `5` Object(JSON，Uint8Array 转 base64) / `6` Int；
String/Object 等前缀 LEB128 varint 长度。

tap 注入主世界（`webFrame.executeJavaScript`，见 §5 链路），做三件事：

1. 监听窗口消息 `zcode:service-port`，抓住 base 端口（带 `databaseStartupId`）；
2. 收到宿主 `Initialize(200)` 后开始只读轮询：活动时每秒一次、空闲时每 10 秒一次：
   `[100, id, "zcode-agent", "readSessionDebug"]` + `[[{workspacePath,
   workspaceIdentity?, sessionId}]]`；
3. 把 `[201, id]` 的 `rounds` 最后一轮与 `cache` 经 `window.postMessage` 交给徽章。

> **启动握手（2026-10-22 真机事故）**：tap 只 `addEventListener`，**绝不调用
> `port.start()`**。宿主在 ChannelServer 创建时把 `Initialize(200)` 排在端口队列里；
> App 的 `MessagePortProtocol` 负责 `start()` 并把这一帧交给 `ChannelClient`。
> tap 抢先 `start()` / 轮询会把这一帧先吃掉，App 停在 Uninitialized，启动页一直等
> ——真机上卡启动页，重装 ZCode 才恢复。tap 等到 `[200]` 后才开始轮询，2 秒没等到
> 则兜底；`windowKind=update-status` 的窗口直接跳过，不碰它的端口。

`workspacePath` / `workspaceIdentity` 的优先级：同一会话的 `zcode:scoped-service-port`
消息（若该会话有）→ 窗口 URL 的 `initialWorkspacePath` → tap 在出站请求里嗅到的值。
主聊天窗口通常走 URL；远程 / 侧聊会话走 scoped 元数据或嗅探。`sessionId` 取可见聊天
容器的 `[data-session-id]`（跳过 `draft`）；没有时回退到最近一个 `conversation/<sid>`
主题。请求同一时间最多一个在途，超时 4 秒、失败退避 5 秒，窗口隐藏时暂停。

`rounds` 由 agent 在 `model_request_completed` 事件上生成，只收
`querySource = "main_turn"`，并计算：

```
generationDurationMs = durationMs - timeToFirstContentMs
tokensPerSecond      = outputTokens ÷ (generationDurationMs / 1000)
```

这正是开发者工具表里的 `TPS (tokens/s)`。思考 tokens 来自 provider 的
`usage.reasoningTokens`，包含在 `outputTokens` 里；tap 不需要读取任何思考文本。
响应里的网络日志（含请求头 / 响应头）与消息正文都不转发、也不解析；跨世界只传最后
一轮 round 与会话 cache 计数。

### 7.2 事件帧只用于「生成中」

`EventFire`(204) 帧**不做 JSON 解析**，直接从载荷字节里读两件事
（`scanConversationFrame`）：

- 找 `"topic":"conversation/`，取到引号前的会话 id，记作 `sessionId` 的 DOM 回退；
- 找 `"deltas":`，后面的 `[` 里第一个非空白字节不是 `]` → 任务仍在活动，
  每 250ms 最多发一次 `{kind:"activity"}`。

这样恢复会话时那一帧整段历史快照（可达数 MB）只被扫一遍字节，不会被 parse。
形状不认识时（宿主改格式）才回退完整 `JSON.parse`，语义与旧版一致。不再维护行文本
基线、CJK 字数或 `COUNTED_PATHS`：任何行增量都只说明「还在跑」。

### 7.3 徽标渲染

```
zcode-tps-debug 消息
  ├─ snapshot → lastRound / cache / roundCount
  │    ├─ 数值 = lastRound.tokensPerSecond（>=100 取整，否则 1 位小数）
  │    ├─ 悬停卡 = 本轮 usage + 会话 cache
  │    └─ roundCount 增加 → 上一请求已完成，generating = false
  ├─ activity → generating = true，圆点脉冲；2 秒无活动 → false
  └─ error    → 显示 —，悬停状态「数据源不可用」
```

生成中数字保持上一轮；没有完成请求时显示 `— tok/s`。tap 安装失败或 RPC 形状变化
时，徽标 12 秒后标记「未收到调试数据」，不会退回字符估算。

### 7.4 兼容与失败

`session/debug` 是 ZCode 的内部接口。宿主改通道名、方法名或帧格式时，tap 的请求
会超时或收到 `202`，徽标显示「数据源不可用」。这是有意的 fail-closed：
不把估算值冒充 usage。`tools/ci/test-debug-source.mjs` 用假 MessagePort 固定了
请求形状、快照转发、活动信号与错误路径；升级 ZCode 后先跑它。

### 7.5 内存与解码预算

tap 挂在渲染进程的主世界里，和 chat 界面共用同一个堆，所以**每条端口消息的开销都
算在 ZCode 头上**，而 base service port 承载整个工作区的 RPC：会话快照、文件内容、
工具输出、流式增量都在同一条端口上。以前是「为了读一个字段 parse 整个载荷」：每条
消息完整解码只为读 `msgType`，每轮轮询再整体 parse 一遍 `{sessionId, rounds,
<网络日志>, cache}` —— 网络日志最多 100 条、每条含 24 个 512 字符的头加约 2 KB 的
消息文本，一次用不上。现在按「只解需要的字节」处理：

| 位置 | 以前 | 现在 |
|---|---|---|
| 端口消息 | 每条都完整解码 | 只解 head（`[msgType, requestId]`）；不是我们的响应就直接丢，不碰载荷 |
| `EventFire`(204) | `JSON.parse` 整帧（含恢复会话的历史快照） | 扫字节取 topic 与 `deltas` 是否非空 |
| 轮询响应 `201` | `JSON.parse` 整个对象 | 顶层成员切片，只 parse `sessionId` / `rounds` / `cache` |
| 轮询节奏 | 固定 1 秒 | 有活动（最近 5 秒有增量）1 秒，空闲 10 秒 |
| 重复快照 | 每次都 post 给徽标 | 签名不变就不重发 |
| 编解码器 | 每条消息 `new TextDecoder()` / `new TextEncoder()` | 窗口级单例，ASCII 模式串缓存 |
| 徽标心跳 | 常驻 60Hz 帧循环 | 1 秒 `setInterval` |
| 徽标消息入口 | 页面上所有字符串消息都 `JSON.parse` | 先比固定前缀 `{"src":"zcode-tps-debug"` |

两条兜底：任何切片 / 扫描失败都退回完整解码（优化不得改变语义）；
`tools/ci/test-debug-source.mjs` 用 1.4 MB 的网络日志夹具断言
`parsedBytes < 64 KB`、`fallback === 0`，退化会被 CI 拦住。计数器暴露在
`window.__zcodeTpsTapStats`（`msgs` / `skipped` / `frames` / `picked` / `fallback` /
`parsedBytes`），只记计数不存载荷；机制与症状见 [CODE-RULES.md](CODE-RULES.md) 规则 2.12。

## 8. 主题继承

ZCode 把主题类挂在 `<html>` 上（`document.documentElement.classList`）：
`dark`、`theme-zai-light`、`theme-zai-dark`。徽标也挂在 `<html>` 下，因此能直接继承
`--color-card`、`--color-border`、`--color-foreground`、`--font-sans` 等变量。

颜色规范与降级值见 [DESIGN.md](DESIGN.md)。

## 9. 失败模式与边界

| 现象 | 原因 | 处理 |
|---|---|---|
| 徽标不出现 | 补丁没应用 / 只关了窗口没退托盘 / 升级覆盖 | 见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| 启动白屏或 preload 报错 | 外部 preload 缺失 / 截断 / 语法错误 | 立即 restore，再检查磁盘与临时文件 |
| 头部写坏 | 并发写入 / 磁盘满 / 非等长写入 | 从 `app.asar.header.tps-bak` 还原 |
| 补丁后 ZCode 自动更新 | 升级替换整个 `app.asar` | 重新 apply |
| 同时开 CDP 与补丁 | 两份徽标 | 脚本有 `__zcodeTpsBadgeInstalled` 守卫；仍冲突时关掉其中一个 |

**不要**在 ZCode 运行时执行 `restore`；`patch --force` 可以，因为只改头部字段且等长。

## 10. 验证方法

命令正本在 [BUILD.md](BUILD.md) §4；这里是顺着逆向链路读时的**同一份副本**，
改命令时两处一起改。

```bash
# 1) 干跑：只读，打印原始 / 补丁后大小
node src/patch.mjs

# 2) 语法检查外部 preload
RES="$(node src/which.mjs resources)"
node --check "$RES/app.asar.unpacked/out/preload/index.cjs"

# 3) 让 Electron 自己解析 asar 路径，确认读到的是外部文件
cd "$(dirname "$RES")"
ELECTRON_RUN_AS_NODE=1 ./ZCode.exe -e "const fs=require('fs');const b=fs.readFileSync('resources/app.asar/out/preload/index.cjs');console.log(b.length, b.toString('utf8').includes('zcode-tps-badge'));"
```

第 3 步返回的字节数应等于 `verified` 里的 `external=`，且第二项为 `true`。

## 11. 文件职责

| 文件 | 职责 |
|---|---|
| `src/badge-source.mjs` | 徽标全部逻辑与样式；消费 debug 快照；无依赖、可序列化 |
| `src/event-source.mjs` | 主世界 tap：抓服务端口、轮询 `session/debug`、上报生成活动；无依赖、可序列化 |
| `src/patch.mjs` | 应用 / 重建补丁；干跑；`--force` |
| `src/restore.mjs` | 还原头部并删除外部 preload |
| `src/config.mjs` | ZCode 路径解析（环境变量 → `config.local.json` → 默认目录） |
| `src/which.mjs` | 打印当前解析到的 resources / exe 路径 |
| `tools/injector.mjs` | CDP 备用注入 |
| `tools/launch-zcode-tps.*` | 备用模式启动器 |
| `tools/preview/*` | 本地预览生成与静态服务 |
| `tools/ci/check.mjs` | 仓库检查（语法 / 链接 / 资源 / 隐私） |
