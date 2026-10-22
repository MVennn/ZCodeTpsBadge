# 仓库规范

> **一句话**：这个仓库长什么样、README 怎么写、assets / docs / tools 怎么放 ——
> 新增或调整结构前先对照本篇；参照实现是 GoldSunEnhance。

本篇是仓库结构与外观的**单一正本**。技术机制、视觉、编码、排错分别见
[ARCHITECTURE.md](ARCHITECTURE.md)、[DESIGN.md](DESIGN.md)、
[CODE-RULES.md](CODE-RULES.md)、[TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

---

## 1. 参照与差异

沿用 GoldSunEnhance 的骨架：

- 居中 logo + 标题 + 一句话 + 徽章的 README；
- `assets/` 放品牌资源，`docs/` 四类索引，`tools/` 放开发期工具；
- `.github/` Issue 模板与 CI；
- 每篇文档一句话引言、单一正本、变更触发矩阵；
- CHANGELOG 按「症状 / 根因 / 改法 / 验证」写。

本仓库是 Windows 小工具，**不设** Android 构建、APK 发布、免责双副本、版本 code；
发版是源码 tag + Release notes。

## 2. 目录结构

```
ZCodeTpsBadge/
├── assets/                      # 品牌资源
│   ├── icon.svg                 # 矢量源（改图标先改它）
│   ├── logo.png                 # 512×512，README 顶部 logo
│   ├── icon.ico                 # 16 / 24 / 32 / 48 / 64 / 128 / 256
│   └── social-preview.png       # 1280×640，GitHub 社交预览
├── docs/                        # 文档正本（索引见 docs/README.md）
│   └── release-notes/           # 面向用户的版本说明
├── src/                         # 运行时源码
│   ├── badge-source.mjs         # 徽标代码（preload 与 CDP 共用）
│   ├── event-source.mjs         # 主世界 tap（轮询 session/debug、上报活动）
│   ├── config.mjs               # ZCode 路径解析
│   ├── which.mjs                # 打印解析结果
│   ├── patch.mjs                # asar 补丁（干跑 / 应用 / 重建）
│   └── restore.mjs              # 还原
├── tools/                       # 开发期工具（索引见 tools/README.md）
│   ├── apply.cmd                # 双击打补丁
│   ├── restore.cmd              # 双击还原
│   ├── injector.mjs             # CDP 注入器（备用模式）
│   ├── launch-zcode-tps.cmd     # 备用模式启动器
│   ├── launch-zcode-tps.vbs
│   ├── make_social_preview.py   # 门面生成器（logo / ico / 社交预览），栅格资源的唯一实现
│   ├── gen_assets.py            # 上面那个的兼容入口
│   ├── ci/check.mjs             # 仓库检查
│   ├── ci/test-debug-source.mjs # RPC 形状测试
│   └── preview/                 # 本地预览（build.mjs / serve.mjs）
├── .github/                     # Issue 模板与 CI
├── package.json                 # 版本与 npm scripts
├── README.md                    # 面向使用者
├── CHANGELOG.md                 # 面向开发者
├── CONTRIBUTING.md              # 怎么改、怎么验
├── SECURITY.md                  # 安全问题怎么报
├── LICENSE
└── config.example.json          # 本机路径配置示例
```

`PROGRESS.md` 与 `config.local.json` 只在本机保留，已 gitignore，不随仓库分发。

## 3. README 骨架

门面只面向使用者，不放开发者内容。章节顺序固定：

1. 居中 logo、标题、一句话定位、徽章行；
2. 这是什么；
3. 环境要求；
4. 安装；
5. 效果（用户能看到的几点；截图如放进 `docs/`，用绝对地址引用）；
6. 卸载；
7. 备用模式（CDP）；
8. 反馈；
9. 免责声明；
10. 开源鸣谢；
11. 许可证。

规则：

- 首屏必须能看到 logo、一句话和徽章；
- 徽章一行连续排布（空格分隔），**不用表格**；
- 全文 **80–110 行**；写完数一遍，超了就删话，不删事实；
- **不放**目录树、开发命令、文档索引链接 —— 它们分别属于本篇 §2、
  [CONTRIBUTING.md](../CONTRIBUTING.md)、[docs/README.md](README.md)；
- 指向本仓文档的链接用 GitHub 绝对地址
  （`https://github.com/MVennn/ZCodeTpsBadge/blob/main/docs/XXX.md`），
  logo 用 `raw.githubusercontent.com` 绝对地址 —— 门面在仓外被打开时也能正常显示；
- 截图放 `docs/`（不进 `assets/` 门面），用 GitHub 绝对地址引用；
- 不写本机绝对路径，不写改动过程；
- README 只做概述，机制 / 视觉 / 构建 / 排错细节链接到 docs 正本。

## 4. assets 规范

| 文件 | 规格 | 说明 |
|---|---|---|
| `icon.svg` | viewBox 108×108，512×512 输出 | 矢量源，改图标先改它 |
| `logo.png` | 512×512，圆角透明 | README 顶部 logo |
| `icon.ico` | 16 / 24 / 32 / 48 / 64 / 128 / 256 | Windows 图标 |
| `social-preview.png` | 1280×640 | GitHub 社交预览 |

品牌色对齐 GoldSunEnhance：

| 用途 | 值 |
|---|---|
| 背景渐变 | `#2B3242` → `#161A22` |
| 强调色渐变 | `#FFC24A` → `#FF7A00` |
| 正文 | `#F2F2F5` |
| 次要文字 | `#A7ADB8` |

应用内徽标**不套用**品牌色，仍使用 ZCode 主题变量（见 [DESIGN.md](DESIGN.md)）。
改图标后运行 `python tools/make_social_preview.py --ico` 重新生成栅格资源
（`tools/gen_assets.py` 是它的兼容入口）；栅格只从 `assets/icon.svg` 渲染，不会再漂，规格见本篇 §4。

## 5. docs 分类

| 类别 | 收什么 |
|---|---|
| 架构与设计 | 注入机制、视觉规范 |
| 功能专项 | 一个功能一篇（`FEATURE-*`） |
| 流程与规范 | 构建、发布、版本、维护、命名、编码、文档、仓库、tools、排错 |
| 参考资料 | Release 说明、assets、根文档 |

四类划分与每类的现有成员、一句话定位见 [docs/README.md](README.md)（索引是这门面之下的正本）。
每篇开头必须有一句话引言；单一正本映射与变更矩阵见 [DOC-RULES.md](DOC-RULES.md)。

## 6. 版本与发布

- 版本号写在 `package.json` 的 `version`，三段式语义化版本；
- 进位规则见 [VERSIONING.md](VERSIONING.md)；
- 发版流程见 [RELEASE.md](RELEASE.md)；
- 用户可感知的改动必须进 [CHANGELOG.md](../CHANGELOG.md) 与 `docs/release-notes/`。

## 7. CI 与检查

`tools/ci/check.mjs` 是仓库检查的唯一入口：

- 所有 `.mjs` 通过 `node --check`；
- Markdown 相对链接可解析；
- 必需文件与资源存在；
- 数据源守卫：`session/debug` 唯一数据源 + RPC 形状测试（`tools/ci/test-debug-source.mjs`）；
- Release 说明符合清单口径（首行加粗、`## 本版内容`、固定风险提示、五个动词）；
- `docs/` 无孤儿文档；
- 仓库文本不含本机用户名路径或明显密钥。

CI 在 push / PR 时运行 `node tools/ci/check.mjs`（Node 20）。
本地等价命令：`npm run check`。

## 8. Issue 模板

`.github/ISSUE_TEMPLATE/` 固定三件：

- `bug_report.yml`：现象、复现步骤、ZCode 版本、`node src/patch.mjs` 输出、截图；
- `feature_request.yml`：场景、期望、备选方案；
- `config.yml`：关闭空白 Issue，指向文档。

## 9. 命名

- 文档：全大写 + 连字符（`FEATURE-TPS-BADGE.md`、`REPO-STANDARD.md`）；
- 脚本：小写 + 连字符（`make_social_preview.py`、`check.mjs`）；
- 资源：小写 + 连字符（`social-preview.png`）；
- 用户可见文案：见 [NAMING.md](NAMING.md)；
- 提交信息：`type: summary`，type 用 `feat` / `fix` / `docs` / `chore`。

## 10. 变更触发矩阵

| 变更 | 必须同步 |
|---|---|
| 改目录 / README 骨架 / assets 规格 | 本篇、根 [README.md](../README.md)、[docs/README.md](README.md) |
| 改图标或品牌色 | `assets/icon.svg`、`python tools/make_social_preview.py`、根 README |
| 改开发者流程 / 命令 | [CONTRIBUTING.md](../CONTRIBUTING.md)、[BUILD.md](BUILD.md)、`package.json` |
| 新增 / 删除文档 | [docs/README.md](README.md)、[DOC-RULES.md](DOC-RULES.md) §7 |
| 改构建 / 检查命令 | [BUILD.md](BUILD.md)、`package.json` |
| 发版 | [VERSIONING.md](VERSIONING.md)、[RELEASE.md](RELEASE.md)、CHANGELOG、release-notes |
| 用户可感知的改动 | CHANGELOG、release-notes |
