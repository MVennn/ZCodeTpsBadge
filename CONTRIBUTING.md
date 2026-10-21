# 参与贡献

> **一句话**：这是个人自用的 ZCode 界面增强小工具；改动前先读
> [docs/CODE-RULES.md](docs/CODE-RULES.md)（编码纪律）与
> [docs/DOC-RULES.md](docs/DOC-RULES.md)（文档规则），本文件只讲「怎么改、怎么验」。

## 改动流程

1. 改 `src/badge-source.mjs`（样式 / 统计逻辑）或 `src/patch.mjs`、`src/restore.mjs`（补丁机制）。
2. 预览样式：

   ```bash
   node tools/preview/build.mjs
   node tools/preview/serve.mjs
   ```

3. 干跑补丁（只读）：

   ```bash
   node src/patch.mjs
   ```

4. 完全退出 ZCode 后应用：

   ```bash
   node src/patch.mjs --apply
   ```

5. 验证：
   - `node --check` 外部 preload；
   - 用 `ELECTRON_RUN_AS_NODE=1 ZCode.exe` 读取 asar 内路径，确认返回外部文件；
   - 完全重启 ZCode 看实际效果（没验就明说没验）。
6. 更新 `CHANGELOG.md` 与对应文档，联动规则见 [docs/DOC-RULES.md](docs/DOC-RULES.md) §4。

## 几条硬规矩

| 规矩 | 在哪定义 |
|---|---|
| 补丁与还原必须成对设计 | [docs/CODE-RULES.md](docs/CODE-RULES.md) §1 |
| asar 头部等长、偏移不变 | [docs/CODE-RULES.md](docs/CODE-RULES.md) §1 |
| 先写外部文件、再写头部；原子写入 | [docs/CODE-RULES.md](docs/CODE-RULES.md) §1 |
| 徽标只用 CSS 主题变量，不硬编码颜色 | [docs/CODE-RULES.md](docs/CODE-RULES.md) §2 |
| 改样式必须同步 DESIGN 与 CHANGELOG | [docs/DOC-RULES.md](docs/DOC-RULES.md) §4 |
| 新增 / 删除文档必须更新 docs 索引 | [docs/DOC-RULES.md](docs/DOC-RULES.md) §5 |

## 不做什么

- 不读取、上传对话内容；不修改模型请求；不绕过任何鉴权。
- 不把徽标数值当成精确 usage 或性能结论。
- 不为了「看起来更酷」引入运行时依赖；徽标源码必须保持可 `toString()` 注入。
