# 文档规则

> **一句话**：docs/ 怎么分类、每条规则的正本在哪、改动时连带改哪些 ——
> 本篇只管「怎么写、怎么保持一致」，不承载具体技术规则。

本项目的文档结构沿用 GoldSunEnhance 的规范，按工具体量裁剪：
保留分类索引、一句话引言、单一正本、链接纪律、变更触发矩阵；
不设发版 code、免责双副本、Android 构建等不适用章节。

---

## 1. 分类与定位

docs/ 分四类（索引见 [README.md](README.md)）：

| 类别 | 收什么 | 现有成员 |
|---|---|---|
| 架构与设计 | 注入机制、视觉规范 | ARCHITECTURE、DESIGN |
| 功能专项 | 一个功能一篇 | FEATURE-TPS-BADGE |
| 流程与规范 | 构建、发布、版本、维护、命名、编码、文档、仓库、tools、排错 | BUILD、RELEASE、VERSIONING、MAINTENANCE、NAMING、CODE-RULES、REPO-STANDARD、DOC-RULES、TOOLS-DOC-RULES、TROUBLESHOOTING |
| 参考资料 | Release 说明、assets、根文档 | release-notes/、assets/、CHANGELOG、README、CONTRIBUTING、SECURITY、LICENSE |

每篇文档开头必须有 **「一句话」引言块**（`> **一句话**：…`）。
新文档没有它不算写完。

## 2. 单一正本原则

**每条规则只在一篇文档里定义；其余位置只允许一句话概述 + 指向正本的链接。**

| 规则 | 正本 |
|---|---|
| 仓库结构、目录树、README 骨架、assets、CI、Issue 模板 | [REPO-STANDARD.md](REPO-STANDARD.md) |
| asar 机制、注入链路、重建 / 还原 | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 功能范围、挂载位置、统计口径、悬停统计卡、验收 | [FEATURE-TPS-BADGE.md](FEATURE-TPS-BADGE.md) |
| 胶囊尺寸、颜色 token、状态、悬停卡外观、响应式 | [DESIGN.md](DESIGN.md) |
| 安装 / 卸载步骤（面向使用者） | [README.md](../README.md) |
| 开发者流程、开发命令、改完跑什么 | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| 构建、路径配置、验证命令 | [BUILD.md](BUILD.md) |
| 版本命名与进位 | [VERSIONING.md](VERSIONING.md) |
| 发布清单与 Release 格式 | [RELEASE.md](RELEASE.md) |
| 升级恢复、资源重建、仓库卫生 | [MAINTENANCE.md](MAINTENANCE.md) |
| 文案与命名 | [NAMING.md](NAMING.md) |
| tools/ 脚本与 README 规则 | [TOOLS-DOC-RULES.md](TOOLS-DOC-RULES.md) |
| 编码纪律与自检清单 | [CODE-RULES.md](CODE-RULES.md) |
| 排错步骤 | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| 文档分类、链接、变更联动 | 本篇 |
| 症状 / 根因 / 改法 / 验证 | [CHANGELOG.md](../CHANGELOG.md) |

## 3. 链接纪律

- docs 内部统一用**相对链接 + 锚点**，不用绝对路径；
- **根 README 是例外**：它指向本仓文档时用 GitHub 绝对地址
  （`https://github.com/MVennn/ZCodeTpsBadge/blob/main/docs/XXX.md`），
  logo 与截图用 `raw.githubusercontent.com` 绝对地址 —— 门面在仓外被打开时也要能正常显示；
- 改动 / 删除 / 合并文档后双向点验：
  - 出链：新文档里指向别处的目标还在、锚点没变；
  - 入链：全仓搜旧文件名，把引用方一起改掉 —— 禁止只删文档不改引用。
- 历史记录里的旧文件名（如 CHANGELOG 历史条目）可以保留；
  正文中指向现役文档的链接必须指向现役文档。

## 4. 变更触发矩阵

| 变更 | 必须同步 |
|---|---|
| 改目录 / README 骨架 / assets 规格 / CI | [REPO-STANDARD.md](REPO-STANDARD.md)、根 [README.md](../README.md)、[README.md](README.md) 索引 |
| 改图标或品牌色 | `assets/icon.svg`、`python tools/make_social_preview.py`、根 README |
| 改徽标样式 / 尺寸 / 颜色 | [DESIGN.md](DESIGN.md)、[CHANGELOG.md](../CHANGELOG.md) |
| 改统计口径 / 挂载位置 / 计数范围 | [FEATURE-TPS-BADGE.md](FEATURE-TPS-BADGE.md)、[DESIGN.md](DESIGN.md)、CODE-RULES §2、CHANGELOG |
| 改补丁 / 还原 / 重建机制 | [ARCHITECTURE.md](ARCHITECTURE.md)、[CODE-RULES.md](CODE-RULES.md)、CHANGELOG |
| 改构建 / 检查命令 | [BUILD.md](BUILD.md)、`package.json`、[CONTRIBUTING.md](../CONTRIBUTING.md) |
| 改 tools/ 脚本 | [TOOLS-DOC-RULES.md](TOOLS-DOC-RULES.md)、`tools/README.md` |
| 发版 | [VERSIONING.md](VERSIONING.md)、[RELEASE.md](RELEASE.md)、CHANGELOG、release-notes |
| 新增 / 删除 / 改名文档 | [README.md](README.md) 索引 |
| 用户可感知的改动 | CHANGELOG（按症状 / 根因 / 改法 / 验证写） |

## 5. 索引维护与孤儿零容忍

- [README.md](README.md) 是 docs/ 的唯一索引；新增 / 删除 / 改名必须同步更新。
- 新文档必须至少被一处既有文档引用（或进索引并有明确入口），不允许孤儿。
- `npm run check` 会检查 docs 是否有孤儿文档。

## 6. 体量预算

- 单篇 ≤ 300 行。超了按「正文档 + 历史篇」拆：结论留在正文档，
  踩坑过程与历史决策移到带 `HISTORY` 的篇目。
- 带版本 / 日期的样例可以过时（那是历史记录）；
  但功能清单、文件名、命令这类「现役事实」必须随代码同步。
