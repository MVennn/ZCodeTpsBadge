# tools/ 文档规则

> **一句话**：`tools/` 下每个脚本都要在 [tools/README.md](../tools/README.md) 有一行定位、
> 自带 usage 头、路径自动探测；新增脚本必须同步 README。

---

## 1. 目录职责

| 位置 | 收什么 |
|---|---|
| `tools/*.cmd` / `.vbs` | 双击入口、备用模式启动器 |
| `tools/*.mjs` | CDP 注入器 |
| `tools/preview/` | 本地预览生成与静态服务 |
| `tools/ci/` | 仓库检查 |
| `tools/gen_assets.py` | 图标与社交预览生成 |

## 2. 脚本要求

1. **usage 头**：文件顶部写清用途、命令、参数、环境变量；
2. **路径自动探测**：用 `import.meta.url` / `%~dp0` / `Path(__file__)`，
   不写项目绝对路径；
3. **可覆盖**：ZCode 路径用 `ZCODE_RESOURCES` / `ZCODE_EXE`，
   预览端口用 `PORT`；
4. **无副作用**：预览与检查只读；生成资产只写 `assets/`；
5. **失败要说话**：缺文件、端口占用、依赖缺失时打印可操作的错误。

## 3. tools/README.md

- 是 `tools/` 的唯一索引；
- 每个脚本一行定位 + 一个可复制示例；
- 环境变量集中列表；
- 新增 / 删除 / 改名脚本必须同步；
- 详细实现不要复制到 README，链接到脚本或 docs 正本。

## 4. 生成物

- `tools/preview/site/` 是生成物，已 gitignore，不提交；
- `assets/` 是品牌资源，由 `tools/gen_assets.py` 生成，提交；
- 临时文件用 `*.tmp-*` 命名，任务结束删除。

## 5. 检查

`npm run check` 会跑 `tools/ci/check.mjs`，覆盖语法、链接、资源与隐私扫描。
新增脚本后确认它仍能通过。
