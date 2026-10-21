# 更新日志

记录用户可感知的改动与修复。每条按「症状 / 根因 / 改法 / 验证」写；没验证就明说没验证。

---

## [未发布]

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

### 验证

- 本地夹具逐项验证：侧边栏 / 用户消息 / 工具输出 / 历史消息均保持 `— tok/s`；
  助手流式输出显示 `95.1 tok/s`，停止 2.2 秒后回到 `—`。
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
