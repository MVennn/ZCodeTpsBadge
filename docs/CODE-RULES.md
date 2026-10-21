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

**规则 2.3 · 只读 DOM，不写宿主状态。**
不修改聊天内容、不调用宿主接口、不拦截事件；徽标节点 `pointer-events: none`。
统计只读文本长度，不保存文本内容。

**规则 2.4 · 主题只用 CSS 变量 + 降级值。**
颜色一律 `var(--token, fallback)`，不硬编码绿色 / 黑色 / 白色。
不依赖只在单一主题下定义的变量（如 `--color-foreground-subtle`）。
规范见 [DESIGN.md](DESIGN.md)。

**规则 2.5 · 双路计数：事件路优先，DOM 路兜底。**
事件路（`src/event-source.mjs`）在主世界被动观察 RPC MessagePort，解码会话增量帧
（`row.delta` / `row.appended` / `row.upserted` / `row.removed`），把字符增量发给徽章；
**tap 只读不改**——从不清空回调、不改写消息、不解码失败重试，任何异常静默跳过。
DOM 路（本条以下为原规则）在事件路 4 秒无产出时启用：统计范围是聊天区根
（优先 `[data-v4-composer-dock]` 的父元素，其次
`[data-testid="chat-view"]` / `[data-v4-timeline-message-layer]`），
**不要依赖 `data-trajectory-message-role="assistant"`**——该属性在真实聊天
DOM 里不总是存在，用了会把计数整个漏掉。侧边栏在根外；用户消息、输入框、按钮、
终端、开发者工具、消息操作 / 状态标签 / 推理标签在 `SKIP` 里排除。
思考文本（`data-reasoning-content`）与工具调用块（`data-tool-call-id`）计入；
工具块内输出也会计入，属于为了让调用阶段也有速度显示的取舍。给根记一个 token 总量，
只把增量计入——markdown 流式渲染会替换文本节点，按节点长度会把已有内容重复计数。
第一次见到新根只记基线；单次新增子树超过 400 字符（历史消息 / 整段重渲染）
也只更新基线。结算周期 0.35 秒，不使用 `setInterval` 轮询整个 DOM。

**规则 2.9 · 事件路解码必须容错，格式按 ARCHITECTURE §7 记录。**
RPC 帧格式（类型字节 / varint / Object JSON / EventFire=204 / conversation 主题 /
行字段名）的单一正本在 [ARCHITECTURE.md](ARCHITECTURE.md) §7。改 tap 前先读它；
ZCode 升级后解码失效是预期行为（自动回退 DOM 路），不要为兼容猜格式而放宽解析——
解码器遇到未知类型字节必须抛错跳过整帧，不能带病输出。跨世界通信只用
`window.postMessage` 字符串负载（结构化对象不跨隔离世界）。

**规则 2.6 · 统计口径固定。**
CJK 0.6 token/字、其他 0.25 token/字符；EMA 系数 0.6 / 0.4；
空闲判定是「最后一次文本增长后 1.8 秒」，**不要用 EMA 衰减来计时**——
衰减会让计时器不断续命，表现为停止输出后数字久久不归零。
改口径必须同步 [DESIGN.md](DESIGN.md) 与 [CHANGELOG.md](../CHANGELOG.md)。

**规则 2.10 · 后台与批量帧不得污染速率统计。**
`document.hidden` 期间不结算：rAF 暂停时任何「首帧补算」都会把后台时长计入
活跃、把平均稀释成 7 tok/s 这种假数。恢复后积压按**当时的 EMA 速率**摊还入
累计与活跃，最高 / 最低不吸收构造出来的瞬时值。批量判定阈值 `dt × 800`
与摊还逻辑的正本在 [FEATURE-TPS-BADGE.md](FEATURE-TPS-BADGE.md) §4。

**规则 2.7 · 徽标挂在宿主工具条里，不固定悬浮。**
只插入 `[data-composer-trailing-actions]` 的第一个子节点，随 flex 布局重排；
工具条出现前**不注入**（禁止 fixed 兜底，否则启动时先闪一下右下角）。
React 重渲染会移除注入节点，必须检测 `host.isConnected` 并重新挂载
（MutationObserver + 每 60 帧兜底）。用 `ResizeObserver` 观察输入框容器宽度，
按 <600 / <480 / <360 三档收缩（隐藏圆点 → 隐藏单位 → 缩小字号）。

**规则 2.8 · 悬停卡挂在聊天区根外。**
`#zcode-tps-tip` 必须挂在 `document.documentElement` 下，避免被计数观察器统计；
卡片 `pointer-events:none`，不挡鼠标；位置按徽标 rect 计算并夹在视口内。
统计值只从 tick 的 `instant` 累计（样本 / tokens / 活跃时长 / 最高 / 最低），
不在 DOM 里反推。

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
10. 统计口径改动同步了 DESIGN / CHANGELOG？（§2.6）
11. tap 仍然只读、容错、跨世界只用 postMessage？（§2.5/2.9）
12. 入口脚本没有写死项目目录？（§3.1）
13. 三层验证跑过，真机状态说清楚了？（§4.1/4.2）
