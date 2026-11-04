# AGENTS —— 机器协议

> **一句话**：三条硬规矩 —— **补丁是等长字节改写**、**ZCode 升级必先重打**、**只读不写**。
> 其余细节见 `docs/`，这里不重复。

## 1. 补丁是字节级改写，不是装插件

- 原理：把 `preload` 标记为 unpacked，再写一份**等长**的 asar 头部副本。
  任何长度变化都会破坏 asar 头 —— 改 `src/patch.mjs` 时先想清楚字节数。
- 改完必须跑 `npm run check`（`tools/ci/check.mjs`），并实机确认输出里有 `verified: unpacked=true`。
- 打补丁前**从托盘完全退出 ZCode**：点窗口 X 只是收进托盘，进程还在，补丁不生效。
- ZCode 每次升级都会抹掉补丁：升级后重跑 `npm run patch`，不要以为坏了。

## 2. 只读

- 徽标只读每轮 usage 快照：不上传数据、不改模型请求、不碰网络层。
- 速度必须来自 `usage.tokensPerSecond`，**不用字符估算凑数**；思考折叠时也照算。

## 3. 入口

| 动作 | 命令 |
| --- | --- |
| 打补丁 | `tools\apply.cmd` 或 `npm run patch`（强制 `npm run patch:force`） |
| 还原 | `tools\restore.cmd` 或 `npm run restore` |
| 本地预览 | `npm run preview`（mock 宿主，不动 ZCode） |
| 自检 | `npm run check` |
| 重生成图标 | `npm run assets`（需 Python + Pillow） |

## 4. 目录

- `src/` — `patch.mjs`（改写）、`restore.mjs`、`badge-source.mjs`（渲染）、`event-source.mjs`、`config.mjs`、`which.mjs`
- `tools/` — `apply.cmd` / `restore.cmd` / `injector.mjs` / `preview/` / `ci/` / 图标生成脚本
- `docs/` — 架构、代码规则、文档规则、排障、发版；`docs/release-notes/` 文件名 = 版本号（不带 `v`）

## 5. 约定

- 真值配置：`config.local.json`（gitignored）+ `config.example.json`；不写死本机路径。
- 临时文件进 `%TEMP%`（本仓没有 `.work/`）。
- Node 20+；CI 在 `.github/workflows/` + `tools/ci/`。
- 文档规范 `docs/DOC-RULES.md`，代码规范 `docs/CODE-RULES.md`；改文档同步索引。
- 提交信息用 Conventional Commits；「提交」= commit + push，不发版。
