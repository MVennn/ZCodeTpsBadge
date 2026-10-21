# 更新日志

记录用户可感知的改动与修复。每条按「症状 / 根因 / 改法 / 验证」写；没验证就明说没验证。

---

## [未发布]

### 变更

- 重组项目结构：迁入 `F:\Project\ZCodeTpsBadge`，源码归入 `src/`、入口归入 `tools/`、文档归入 `docs/`。
- 脚本不再写死项目目录（入口用 `%~dp0` / `import.meta.url`）；ZCode 安装路径支持
  `ZCODE_RESOURCES` / `ZCODE_EXE` 环境变量覆盖。
- 补丁脚本支持在已打补丁时**重建**外部 preload：改完 `src/badge-source.mjs` 直接再跑一次即可，
  不需要先还原。
- 开源准备：新增 `src/config.mjs`（环境变量 → `config.local.json` → `%LOCALAPPDATA%`），
  仓库内不再包含本机安装路径；新增 `config.example.json`、MIT [LICENSE](LICENSE)、`.gitattributes`；
  `PROGRESS.md` 与 `config.local.json` 不随仓库分发。

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
