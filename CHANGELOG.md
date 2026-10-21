# 更新日志

记录用户可感知的改动与修复。每条按「症状 / 根因 / 改法 / 验证」写；没验证就明说没验证。

---

## [未发布] — 2026-10-21

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
