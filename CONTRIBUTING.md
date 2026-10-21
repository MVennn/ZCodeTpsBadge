# 参与贡献

> **一句话**：这是个人自用的 ZCode 界面增强小工具；改动前先读
> [docs/REPO-STANDARD.md](docs/REPO-STANDARD.md)（仓库规范）、
> [docs/CODE-RULES.md](docs/CODE-RULES.md)（编码纪律）与
> [docs/DOC-RULES.md](docs/DOC-RULES.md)（文档规则），本文件只讲「怎么改、怎么验」。

## 改动流程

1. 读一遍上面三篇规范，确认改动属于徽标 / 补丁 / 文档哪一类。
2. 改 `src/badge-source.mjs`（徽标与统计）或 `src/patch.mjs`、`src/restore.mjs`（补丁机制）。
3. 跑仓库检查：

   ```bash
   npm run check
   ```

4. 样式改动先看预览：

   ```bash
   npm run preview
   ```

5. 干跑补丁（只读）：

   ```bash
   node src/patch.mjs
   ```

6. 完全退出 ZCode 后应用：

   ```bash
   npm run patch
   ```

   ZCode 正在运行又不想退出时用 `npm run patch:force`，下次完全重启生效。

7. 验证：
   - `node --check` 外部 preload；
   - 用 `ELECTRON_RUN_AS_NODE=1 ZCode.exe` 读取 asar 内路径，确认返回外部文件；
   - 完全重启 ZCode 看实际效果（没验就明说没验）。
8. 更新 `CHANGELOG.md`、对应 docs 与 `docs/release-notes/`；
   改图标时运行 `python tools/make_social_preview.py --ico`（`tools/gen_assets.py` 是它的兼容入口）。

## 常用开发命令

```bash
npm run check              # 语法 + 文档链接 + 资源 + 本机路径检查
npm run preview            # 生成并启动本地预览（8766）
npm run patch              # 打补丁（要求 ZCode 完全退出）
npm run patch:force        # ZCode 运行时写入，下次完全重启生效
npm run restore            # 还原补丁
npm run assets             # 重新生成 logo / icon.ico / 社交预览
```

- 路径配置（`ZCODE_RESOURCES` / `config.local.json`）、预览地址与三层验证见
  [docs/BUILD.md](docs/BUILD.md)；
- 仓库的目录树见 [docs/REPO-STANDARD.md](docs/REPO-STANDARD.md) §2；
- `tools/` 下每个脚本的用法见 [tools/README.md](tools/README.md)。

## 几条硬规矩

| 规矩 | 在哪定义 |
|---|---|
| 目录、README 骨架、assets 规格、CI | [docs/REPO-STANDARD.md](docs/REPO-STANDARD.md) |
| 补丁与还原必须成对设计 | [docs/CODE-RULES.md](docs/CODE-RULES.md) §1 |
| asar 头部等长、偏移不变 | [docs/CODE-RULES.md](docs/CODE-RULES.md) §1 |
| 先写外部文件、再写头部；原子写入 | [docs/CODE-RULES.md](docs/CODE-RULES.md) §1 |
| 徽标只统计聊天区根，按根总量算增量 | [docs/CODE-RULES.md](docs/CODE-RULES.md) §2.5 |
| 徽标只挂在输入框工具条，不 fixed 兜底 | [docs/CODE-RULES.md](docs/CODE-RULES.md) §2.7 |
| 悬停卡挂在聊天区根外 | [docs/CODE-RULES.md](docs/CODE-RULES.md) §2.8 |
| 改样式同步 DESIGN 与 CHANGELOG | [docs/DOC-RULES.md](docs/DOC-RULES.md) §4 |
| 新增 / 删除文档必须更新 docs 索引 | [docs/DOC-RULES.md](docs/DOC-RULES.md) §5 |
| 发版才动版本号 / tag | [docs/VERSIONING.md](docs/VERSIONING.md) |

## 资源

- 图标矢量源：`assets/icon.svg`；
- 栅格资源：`python tools/make_social_preview.py --ico`（需要 Pillow 与 numpy）；
- 效果截图：`assets/screenshot-dark.png`，界面改动后手工替换。

## 不做什么

- 不读取、上传对话内容；不修改模型请求；不绕过任何鉴权。
- 不把徽标数值当成精确 usage 或性能结论。
- 不为了「看起来更酷」引入运行时依赖；徽标源码必须保持可 `toString()` 注入。
- 不提交 `config.local.json`、`PROGRESS.md`、预览生成物或本机绝对路径。
