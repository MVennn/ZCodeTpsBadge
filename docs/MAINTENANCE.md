# 维护手册

> **一句话**：ZCode 升级后怎么恢复、资源怎么重建、哪些东西不能删、文档怎么保持一致。

---

## 1. ZCode 升级后

ZCode 升级会替换 `resources/app.asar`，补丁与徽标消失。步骤：

1. 从托盘完全退出 ZCode；
2. `npm run patch`；
3. 完全重启 ZCode；
4. 确认徽标出现在输入框工具条、悬停卡正常。

如果徽标出现但**不计数**，优先检查聊天区 DOM 是否变了：

- `[data-testid="chat-view"]` / `[data-v4-timeline-message-layer]` 是否还存在；
- `[data-v4-composer-dock]` / `[data-composer-trailing-actions]` 是否还存在；
- 用户消息是否仍带 `data-v4-user-input-bubble`。

选择器变化时同步 [ARCHITECTURE.md](ARCHITECTURE.md) 与
[FEATURE-TPS-BADGE.md](FEATURE-TPS-BADGE.md)，并补 CHANGELOG。

## 2. 资源重建

改 `assets/icon.svg` 后：

```bash
python tools/make_social_preview.py --ico
```

会重新生成 `assets/logo.png`、`assets/icon.ico`、`assets/social-preview.png`。
栅格只从 `assets/icon.svg` 渲染，不会与矢量正本漂移。

GitHub 仓库的社交预览图在 **Settings → Social preview** 手工上传
`assets/social-preview.png`（GitHub 没有提供对应 API）。

品牌色正本见 [REPO-STANDARD.md](REPO-STANDARD.md) §4。

## 3. 不要删的东西

| 文件 | 原因 |
|---|---|
| `resources/app.asar.header.tps-bak` | 还原补丁用的原始头部；删了只能重装 ZCode |
| `resources/app.asar.unpacked/out/preload/index.cjs` | 补丁后的外部 preload；删了 ZCode 可能启动异常 |
| `config.local.json` | 本机 ZCode 路径；删了要重新配置 |
| `assets/icon.svg` | 图标矢量源；丢了只能重画 |

清理时只删 `tools/preview/site/`、`*.tmp-*`、日志这类可再生文件。

## 4. 文档一致性

每次改动后：

```bash
npm run check
```

检查会覆盖：

- 相对链接是否可解析；
- `docs/` 是否有孤儿文档；
- README / docs 引用的文件是否存在；
- 是否把本机用户名路径或密钥写进仓库。

新增 / 删除 / 改名文档必须同步 [docs/README.md](README.md)；
单一正本映射见 [DOC-RULES.md](DOC-RULES.md) §2。

## 5. 隐私与仓库卫生

- 不提交 `config.local.json`、`PROGRESS.md`、`.work/`、截图之外的临时文件；
- 文档与脚本里不写本机用户名路径，统一用 `%LOCALAPPDATA%` 或占位符；
- Issue 里不要贴 token、cookie、完整对话内容；
- 提交前跑 `git status` 与 `npm run check`。

## 6. 周期性复查

每个次版本至少过一次：

1. 干净 clone 跑 `npm run check`；
2. 从零 apply → 重启 → 验收；
3. 对照 [FEATURE-TPS-BADGE.md](FEATURE-TPS-BADGE.md) §8 的验收清单；
4. 检查 README 的效果说明与 `docs/` 里的截图是否过期；
5. 检查 Release notes 与 CHANGELOG 是否对得上。
