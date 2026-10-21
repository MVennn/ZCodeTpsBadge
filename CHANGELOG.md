# 更新日志

记录用户可感知的改动与修复。每条按「症状 / 根因 / 改法 / 验证」写；没验证就明说没验证。

---

## [未发布] — 2026-10-22

### 改用开发者工具同源的 `session/debug`（0.3.0）

**症状**：思考阶段的 token 仍然不显示。0.2.0–0.2.2 连修两轮事件路，折叠的思考
还是不进统计；同时徽标的实时数字与开发者工具「Token 调试」对不上。

**根因**：徽标一直在用「字符增量估 token」。这条路要求解码会话行文本，而思考行
折叠时正文不在 DOM，事件路又依赖一条不稳定的内部帧；即使解码成功，估算值与
provider usage 也永远对不上。开发者工具根本没有做字符估算——它读的是 agent
在 `model_request_completed` 上记录的 usage 快照。

**改法**：

- tap 改为抓住 base service port（`zcode:service-port`），每秒调用一次
  `zcode-agent.readSessionDebug({workspacePath, workspaceIdentity?, sessionId})`；
  这是开发者工具「Token 调试」自己的只读接口。
- 徽标只消费快照里的最后一轮 `round`、会话 `cache` 与 tap 现算的速度统计。
  TPS 直接用 `tokensPerSecond = outputTokens ÷ generationDurationMs`，与面板同口径；
  思考 tokens 来自 `usage.reasoningTokens`，不再依赖页面文本。
- 悬停卡新增平均 / 最高 / 最低 tok/s：tap 从 `rounds` 里取
  `tokensPerSecond > 0` 的轮次，算术平均 / 最大 / 最小，最多最近 200 轮（与面板
  表格一致）；移除平均命中（开发者工具摘要里已有）。
- 生成中只让圆点脉冲，数字保持上一轮；请求完成后下一次轮询更新。
- 删除字符估算、DOM 文本统计、EMA、批量摊还、最高 / 最低 / 活跃等全部旧路径；
  删除计数用的整树 MutationObserver。
- 失败 fail-closed：超时 / 202 / 通道改名时显示 `—`，悬停状态「数据源不可用」，
  连续失败退避 5 秒；**不退回字符估算**。
- `tools/ci/test-debug-source.mjs`：假 MessagePort 固定请求形状、快照转发、
  活动信号与错误路径；CI 增加数据源守卫，禁止字符估算残留。

**验证**：

- `node tools/ci/test-debug-source.mjs` 通过：请求帧为
  `[100, id, "zcode-agent", "readSessionDebug"] + [[{workspacePath, sessionId}]]`，
  201 快照只转发 round + cache + stats（两轮 TPS 20 / 40 → avg 30 / max 40 /
  min 20），204 帧产生 activity，202 产生 error。
- `node tools/ci/check.mjs` 全绿（syntax 11 / required 33 / links 133 / docs 13 /
  source guard）。
- `node src/patch.mjs` 干跑：原始 781611 → 811601 字节。
- 真机效果待完全退出 ZCode 再启动后确认（本会话无法重启宿主）。

### 修复异常 TPS 带偏平均 / 最高（2026-10-22）

**症状**：开发者工具某一轮显示 `388 output / 64,666.7 tok/s`（输入 612,799、
缓存命中 612,608、命中率 100%）；徽标的平均 / 最高速度随之被带炸。

**根因**：面板 TPS 的分母是 `durationMs − timeToFirstContentMs`。缓存命中 /
上下文压缩类请求可能把这两个时间报得几乎相等（该轮只剩 **6ms**），
`388 ÷ 0.006 = 64,666.7`。这是计时口径的异常值，不是真实生成速度；面板不过滤，
徽标又直接采用面板的 `tokensPerSecond`，于是平均 / 最高被污染。

**改法**：

- tap 新增 `isPlausibleRound`：`tokensPerSecond > 2000` 或
  `generationDurationMs < 100ms` 视为异常，不计入平均 / 最高 / 最低。
- snapshot 增加 `plausible` 标志；最后一轮异常时徽标显示 `—`，悬停状态
  「本轮 TPS 异常（已跳过）」。
- 测试 snapshot 增加第三轮 `64,666.7 tok/s / 6ms`，断言 stats 仍为
  `avg 30 / max 40 / min 20` 且 `plausible=false`；CI 增加 `isPlausibleRound`
  与 `lastRoundPlausible` 守卫。

**验证**：RPC 测试与 `node tools/ci/check.mjs` 全绿；真机待完全重启确认。

### 修复启动页卡住（0.3.0 真机事故，2026-10-22）

**症状**：0.3.0 补丁应用后完全重启，ZCode 卡在启动页不动；重装 ZCode 才恢复。

**根因**：主世界 tap 在收到 `zcode:service-port` 窗口消息时抢先调用
`port.start()` 并立即发 `readSessionDebug`。宿主在 ChannelServer 创建时把
`Initialize(200)` 排在端口队列里，本应由 App 的 `MessagePortProtocol` 在
`start()` 后交给 `ChannelClient`；tap 抢先启动/轮询会先把这一帧消费掉，App 的
ChannelClient 停在 Uninitialized，启动页一直等服务初始化。

**改法**：

- tap 只 `addEventListener`，**不调用 `port.start()`**；由 App 自己启动端口。
- 收到 `Initialize(200)` 后才开始轮询；2 秒没等到则兜底。
- `windowKind=update-status` 的启动 / 更新窗口直接跳过，不碰它的端口。
- `tools/ci/test-debug-source.mjs` 新增：tap 不得 start、Initialize 前不得发请求、
  update-status 窗口不得安装 tap；CI 增加 `servicePort.start(` 禁令。

**验证**：RPC 测试与 `node tools/ci/check.mjs` 全绿；补丁已重新应用
（781611 → 811601 字节，外部文件与 Electron asar 实读一致）；**真机待完全重启确认**。

### 修复「最高 1 万 tok/s」假峰与事件路未安装（2026-10-21 深夜）

**症状**：悬停统计卡的「最高」仍会出现 10000 tok/s 级别的数；徽标本身也会闪一下
同样离谱的瞬时值。重启 0.2.2 后还暴露了两个更基础的问题：**没有当前速度**、
**思考不记录 token**。0.2.1 的补丁确已生效（外部 preload 805930 字节，
含 `counted > cap && ema > 0`）。

**根因**（四处，前三处叠加假峰，第四处让事件路完全没生效）：

0. **事件路从 0.2.0 起就没装上过。** `patch.mjs` 把 `__tpsEventTapSource` 绑成
   **函数对象**（`var X=function eventSource(){…}`），而 `installTap()` 只接受
   字符串，函数分支又引用了从未定义的 `eventTapSource`，于是 `tap === null`，
   每次启动都静默放弃。实际一直只有 DOM 兜底：思考折叠时正文不在 DOM → 不计数；
   没有可见正文时 → 当前速度为空；工具输出与整段重渲染又都从 DOM 进统计。
1. 批量守卫依赖 `ema > 0`。空闲 1.8 秒后 EMA 归零，而工具输出 / 整行 upsert
   恰好在这时到达；一次结算 6000 token ÷ 0.35 秒 = 17000 tok/s，直接写进「最高」。
2. 事件路活跃时 DOM 路只跳过计数、不更新聊天区根基线。事件路停 4 秒切回 DOM 路时，
   事件路已经计过的整段正文被第二次计入；因为 EMA 已归零，又被当成瞬时速度。
3. 事件路把 `row.delta` 的所有 path 都计入，包括 `output.text`（工具输出，整块到达）
   与 `summaryText`（子代理）；实测工具输出是最大的批量来源之一。另外行基线只按
   `rowId` 索引，不同会话的同名 `rowId` 会串线。

**改法**：

- `installTap()` 识别函数形式的 `__tpsEventTapSource`，用
  `'(' + fn.toString() + ')()'` 序列化并**调用**后再交给 `webFrame.executeJavaScript`；
  字符串形式继续支持。CI 增加守卫，防止只剩字符串分支。
- 批量判定改为只看 `counted > dt × 800`，与 EMA 是否为 0 无关；批量帧只入累计与
  活跃（活跃按当时 EMA 重建，EMA 为 0 时用本次运行平均，再无历史用 40 tok/s），
  不刷新当前值、不入最高 / 最低。
- 事件路活跃期间把 DOM 基线标脏；切回 DOM 路的第一次变更先重读根总量再计数。
- 事件路只计 `text` / `inputText`；基线按会话主题分开；`row.removed.fromRowId`
  按数字处理（线格式是 number，原来按 string 判断，永远匹配不上）。
- DOM 兜底不再统计工具块（`data-tool-call-id`）：块内参数与工具输出混在一起，
  工具输出会持续抬高最高值与累计；工具参数改由事件路精确计入。
- 事件路按 CJK 字数与总字符数分别上报，徽章用与 DOM 路相同的 0.6 / 0.25 系数换算
  （原来固定 0.25，中文速度低报约 2.4 倍）。
- 删除从未被触发的 `usage` 消息分支（tap 不发它，且换算系数与统计口径不一致）。

**验证**：

- 按 `patch.mjs` 的真实绑定方式复现：函数对象 → `toString()` → 调用，
  确认主世界 `window.__zcodeTpsEventTap === true`，tap 安装成功。
- 结算逻辑仿真（10 秒 @40 tok/s 流式 → 3 秒空闲 → 8400 token 批量交接）：
  旧逻辑最高 20000 tok/s、平均 705；新逻辑最高 40.1、平均 40.1、累计无重复。
- 事件路合成帧用例 9 条全通过：优化输出排除、参数计入、跨主题 rowId 隔离、
  整行 upsert 只计差值、数字 `fromRowId`、子代理摘要排除。
- 补丁重建 + 三层验证；真机需完全退出 ZCode 再启动后确认。

### 门面统一批次（2026-10-21）

在「README 收敛批次」之后再收一轮：门面压到与 GSAuxiliary 同款的七节，
开发者内容继续下沉 `docs/`，门面资源（logo / 社交预览）统一由 `assets/icon.svg` 渲染。

- 调整 文档 —— 根 README 收敛为七节（这是什么 / 环境要求 / 安装 / 反馈 / 免责声明 / 开源鸣谢 / 许可证）；
  顶部不写「一句话」引言块，定位由副标题承担（对齐 GSAuxiliary）
- 调整 文档 —— 目录树下沉 [docs/REPO-STANDARD.md](docs/REPO-STANDARD.md) §2；开发命令下沉 [CONTRIBUTING.md](CONTRIBUTING.md)；
  悬停统计口径下沉 [docs/FEATURE-TPS-BADGE.md](docs/FEATURE-TPS-BADGE.md) §5
- 调整 资源 —— `tools/gen_assets.py` 降级为 `tools/make_social_preview.py` 的转调入口；栅格资源只有一份实现
- 清理 资源 —— 删除 `assets/screenshot-dark.png`（效果截图）及指向它的六处引用；CI 必需文件清单 34 → 33
- 新增 工具 —— `tools/make_social_preview.py`：自带 SVG 渲染器，从 `assets/icon.svg` 生成
  `assets/logo.png`（512×512）与 `assets/social-preview.png`（1280×640），不依赖 cairosvg 等外部程序
- 调整 资源 —— `assets/logo.png` 改为由 `assets/icon.svg` 渲染，图形不再有两份正本
- 调整 文档 —— `docs/DOC-RULES.md` 正本映射表与 `docs/README.md` 索引同步；
  各仓 docs 里指向根 README 章节的文字引用改指新正本
- 调整 仓库 —— GitHub 仓库描述与话题改成面向使用者的口径（与 README 副标题同调）
- 修复 文档 —— `docs/README.md` 的 assets 索引仍写着「效果截图」，已删；
  `docs/REPO-STANDARD.md` 与 `docs/MAINTENANCE.md` 的截图落点改为 `docs/`

### Release 说明口径（2026-10-21）

- 调整 文档 —— `docs/release-notes/` 改为清单口径：第一行加粗总结（无「一句话」引言块、
  无 `# 版本号 — 日期` 标题）、五个动词一行一条、固定尾巴；
  `0.1.0` / `0.2.0` / `0.2.1` 三份说明按此重写（事实不变）
- 调整 文档 —— `docs/RELEASE.md` 重写为「发版发什么 / 发版步骤 / 说明口径 /
  发版前后检查 / 推送节奏」；`docs/VERSIONING.md` §4 与 `docs/DOC-RULES.md`
  正本映射同步，`docs/README.md` 索引改指新正本
- 新增 检查 —— `tools/ci/check.mjs` 校验 Release 说明形状：首行加粗、
  `## 本版内容`、固定风险提示、条目只用五个动词；注入坏文件验证会红

---

## [0.2.1] — 2026-10-21

### 修复

- 修复 挂后台后平均速度被稀释（如 25 分钟会话平均只有 7.1 tok/s）——
  根因有二：① `requestAnimationFrame` 在窗口隐藏时暂停，但事件增量不停，
  回到前台的第一帧把整个后台时长计入了「活跃」；② 单帧涌入的积压增量
  直接按「积压 ÷ 超长时长」计速，制造出 0.6 这样的假低速和 4318 的假尖峰。
  改法：隐藏期间不结算、不计活跃；恢复后积压按当时的 EMA 速率摊还入
  累计与活跃，最高 / 最低不吸收构造出的瞬时值。

### 验证

- 场景仿真（120s 可见流式 @40 tok/s → 1500s 后台持续产出 → 回前台）：
  修复前平均被稀释到个位数、出现数千的假最高；修复后 平均 40.0 / 活跃 180s /
  最高 40 / 累计含全部可见期增量 / 回前台 EMA 立即恢复 40。
- 补丁三层验证：干跑 + `--apply`、外部 preload `node --check`、
  Electron 实读 asar 路径 = 外部文件 805930 字节（含新结算逻辑）。
- `tools/ci/check.mjs` 全绿。真机效果需完全重启 ZCode 后确认。

---

## [0.2.0] — 2026-10-21

### 变更

- **计数改从事件层拿真实增量（思考折叠时也能测）**：徽标原先靠 DOM 文本估算，
  思考行折叠时正文不在 DOM 里，思考阶段显示 `—`。现在补丁会向主世界注入一个
  被动 tap（`src/event-source.mjs`），观察 ZCode 渲染层与宿主进程之间的二进制 RPC
  MessagePort，解码会话增量帧（`row.delta` / `row.appended` / `row.upserted`），
  把助手正文 / 思考 / 工具参数的真实字符增量交给徽章；DOM 估算降级为兜底
  （事件路 4 秒无产出时自动启用）。机制见 [ARCHITECTURE.md](docs/ARCHITECTURE.md) §7。

### 验证

- 解码器单测：按线格式构造合成帧（Object / Array / Int / String / varint、
  `row.delta`、整行 upsert、噪声帧、截断帧）round-trip 全通过。
- tap 端到端：合成 MessagePort 流量下输出正确的每行字符增量（4+100+6+3=113）；
  非 RPC / 非 Uint8Array 消息不产生计数。
- 三层验证：`node src/patch.mjs` 干跑 +23254 字节；`node --check` 外部 preload 通过；
  `ELECTRON_RUN_AS_NODE=1 ZCode.exe` 读 asar 路径返回外部文件 804865 字节（含徽标与 tap）。
- `tools/ci/check.mjs` 全绿（语法 10 / 必需文件 / 链接 121 / docs / 资源 / 隐私）。
- **真机效果需完全退出 ZCode 再启动后确认**（本会话无法重启宿主）；
  ZCode 升级若改 RPC 格式，tap 解码会静默失效并回退 DOM 路。

---

## [0.1.0] — 2026-10-21

### 修复

- 修复 打开侧边栏也跳数字 —— 统计范围从整个 `body` 收紧到聊天区根
  （`chat-view` / 时间线 / 输入框父容器）；侧边栏在根外，用户消息、工具调用、
  按钮、终端、开发者工具由 `SKIP` 排除。
- 修复 徽标不计数 —— 不再依赖 `data-trajectory-message-role="assistant"`
  （真实聊天 DOM 里不总是存在），改为统计聊天区根内非跳过文本的增量。
- 修复 markdown 重渲染导致重复计数 —— 按聊天区根的 token 总量算增量
  （`WeakMap` 记基线），替换文本节点不会把已有内容再算一遍；首次见到新根、
  单次新增超过 400 字符的历史消息只更新基线。
- 修复 停止输出后数字久久不归零 —— 空闲判定改为「最后一次文本增长后 1.8 秒」，
  不再被 EMA 衰减不断续命。
- 修复 启动时先出现在右下角再跳到工具条 —— 移除 fixed 兜底，工具条出现前不注入。
- 修复 思考 / 工具调用阶段不计数 —— 统计根优先取输入框所在主聊天列，
  思考文本（`data-reasoning-content`）与工具调用块（`data-tool-call-id`）计入；
  仅排除推理标签、状态标签与后台终端 / 开发者工具。

### 验证

- 本地夹具逐项验证：侧边栏 / 用户消息 / 历史消息均保持 `— tok/s`；
  助手输出 `95.1 tok/s`，思考 `47.5–128 tok/s`，工具调用 `97.5 tok/s`；
  停止 2.2 秒后回到 `—`。
- 响应式：900px 宽完整 77×21px；600px 档隐藏圆点与单位 32×21px；
  420px 档 10px 字号 27×18px；三档都仍在工具条内、用量左侧。
- 悬停验证：卡片在徽标上方居中、在视口内；显示当前 130 / 平均 134 / 最高 164 /
  最低 111 / 累计 189 tokens / 活跃 1.4s；移开后隐藏。

### 新增

- 悬停统计卡：鼠标放到徽标上弹出当前 / 平均 / 最高 / 最低 / 累计 tokens / 活跃时长；
  卡片沿用 ZCode 卡片底色与描边，位于徽标上方，`pointer-events:none`。

### 变更

- 重组项目结构：迁入 `F:\Project\ZCodeTpsBadge`，源码归入 `src/`、入口归入 `tools/`、文档归入 `docs/`。
- 脚本不再写死项目目录（入口用 `%~dp0` / `import.meta.url`）；ZCode 安装路径支持
  `ZCODE_RESOURCES` / `ZCODE_EXE` 环境变量覆盖。
- 补丁脚本支持在已打补丁时**重建**外部 preload：改完 `src/badge-source.mjs` 直接再跑一次即可，
  不需要先还原。
- 开源准备：新增 `src/config.mjs`（环境变量 → `config.local.json` → `%LOCALAPPDATA%`），
  仓库内不再包含本机安装路径；新增 `config.example.json`、MIT [LICENSE](LICENSE)、`.gitattributes`；
  `PROGRESS.md` 与 `config.local.json` 不随仓库分发。
- 徽标位置从固定右下角改为注入输入框底部工具条（`[data-composer-trailing-actions]`）
  的第一个子节点，位于用量 / 模型选择器左侧；窗口缩放时随工具条重排并三档收缩
  （<600 隐藏圆点、<480 隐藏单位、<360 缩小字号），不再压住右侧滚动条。
  工具条重渲染后会自动重新挂载；工具条出现前不注入。
- 仓库规范化（对齐 GoldSunEnhance）：
  - README 重写为居中 logo + 徽章 + 固定章节；
  - 新增 `assets/icon.svg`、`logo.png`、`icon.ico`、`social-preview.png`、效果截图；
    品牌色改为 `#2B3242 → #161A22` 与 `#FFC24A → #FF7A00`；
  - 新增 `docs/REPO-STANDARD.md`、`FEATURE-TPS-BADGE.md`、`BUILD.md`、`RELEASE.md`、
    `VERSIONING.md`、`MAINTENANCE.md`、`NAMING.md`、`TOOLS-DOC-RULES.md`、`release-notes/`；
  - 新增 `package.json`（0.1.0）、`tools/ci/check.mjs`、GitHub CI、Issue 模板、`SECURITY.md`、
    `tools/README.md`。

---

## [2026-10-21] 徽标改为 ZCode 同款胶囊样式

### 变更

- 移除绿色，文字改用 `--color-foreground`，`tok/s` 单位降为 55% 透明度。
- 外框改为胶囊：`border-radius: 999px`、高 21px；背景 `--color-card`、描边 `--color-border`。
- 字体改为 `--font-sans`（system-ui），数字使用 `tabular-nums`。
- 圆点改用 `currentColor`：空闲 45% 透明度，有输出时实色。
- 深色 / zai-dark / 浅色主题自动适配；不再依赖只在 `.dark` 下定义的 `--color-foreground-subtle`。

### 验证

- 用真实徽标代码在本地预览页渲染深色、浅色两套主题并截图确认。
- `node --check` 通过；用 `ELECTRON_RUN_AS_NODE=1 ZCode.exe` 读取 asar 内路径，
  确认返回外部 preload（786473 字节，含徽标代码）。
- ZCode 内的实际效果需完全重启后确认（本会话无法重启宿主）。

---

## [2026-10-21] 修复徽标不显示

### 症状

- 安装后右下角没有任何徽标。

### 根因

- `app.asar` 头部仍是未解包状态，`app.asar.unpacked/out/preload/index.cjs` 不存在，
  备份文件也没有——补丁从未成功应用。`apply` 在 ZCode 运行时会被安全检查拒绝，
  而点窗口 X 只是收进托盘，进程并没有退出。

### 改法

- 增加 `--force`：允许在 ZCode 运行时写入（头部等长、偏移不变，运行中实例不受影响）。
- 实际应用补丁并校验 `unpacked=true`、外部文件大小与头部记录一致。

### 验证

- `node --check` 通过；Electron 以 Node 模式读取 `app.asar/out/preload/index.cjs`，
  返回的是外部文件内容。

---

## [2026-10-21] 初始版本

### 新增

- 通过 asar unpacked preload 注入 tok/s 徽标；提供 `--apply` 与还原脚本。
- 提供 CDP 备用注入模式与启动器。
- 徽标按流式文本估算 token 吞吐量：CJK 0.6 token/字、其他 0.25 token/字符；
  EMA 平滑；空闲 1.8 秒归零。
