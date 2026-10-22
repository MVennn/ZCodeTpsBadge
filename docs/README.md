# docs/ 索引

> **一句话**：这里只有索引与定位，不放正文 —— 每篇文档一句话说明「它管什么」，
> 规则本身按 [DOC-RULES.md](DOC-RULES.md) 的单一正本原则只在对应文档里定义。

文档分四类。每篇开头都有一个「一句话」引言块，先看它再决定要不要往下读。

---

## 一、架构与设计

| 文档 | 一句话定位 |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 注入架构：asar 头部不变量、unpacked preload、补丁 / 重建 / 还原、运行时数据流 |
| [DESIGN.md](DESIGN.md) | 视觉正本：胶囊尺寸、颜色 token、状态与动效、悬停卡与响应式收缩 |

## 二、功能专项

| 文档 | 一句话定位 |
|---|---|
| [FEATURE-TPS-BADGE.md](FEATURE-TPS-BADGE.md) | 功能范围正本：挂载位置、统计口径、悬停统计卡内容、已知限制与验收清单 |

## 三、流程与规范

| 文档 | 一句话定位 |
|---|---|
| [BUILD.md](BUILD.md) | 构建与验证：环境、路径配置、常用命令、改完必须跑的三层验证 |
| [RELEASE.md](RELEASE.md) | 发布清单：发版步骤、Release 说明口径、发版前后检查、推送节奏 |
| [VERSIONING.md](VERSIONING.md) | 版本命名：三段式进位规则、tag 约定、不发版不动版本号 |
| [MAINTENANCE.md](MAINTENANCE.md) | 维护手册：ZCode 升级后恢复、资源重建、不能删的东西、仓库卫生 |
| [NAMING.md](NAMING.md) | 文案与命名：产品名、徽标文案、统计卡标签、文件与提交信息 |
| [CODE-RULES.md](CODE-RULES.md) | 编码纪律：补丁 / 还原成对、等长头部、只读 debug 数据源、fail-closed、悬停卡 |
| [REPO-STANDARD.md](REPO-STANDARD.md) | 仓库规范：目录、README 骨架、assets 规格、CI、Issue 模板、命名 |
| [DOC-RULES.md](DOC-RULES.md) | 文档规则：分类定位、单一正本映射、链接纪律、变更触发矩阵、体量预算 |
| [TOOLS-DOC-RULES.md](TOOLS-DOC-RULES.md) | tools/ 规则：脚本 usage 头、路径探测、`tools/README.md` 索引 |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 排错手册：按「现象 → 步骤 → 原因 / 解法」组织 |

## 四、参考资料

| 位置 | 一句话定位 |
|---|---|
| [release-notes/](release-notes/README.md) | 面向用户的 Release 说明，文件名 = 版本号（不带 `v`）；格式规范在它的 README |
| [../assets/](../assets/) | 品牌资源：图标矢量源、logo、ico、社交预览 |
| 仓库根 [CHANGELOG.md](../CHANGELOG.md) | 开发者记录：症状 / 根因 / 改法 / 验证 |
| 仓库根 [README.md](../README.md) | 面向使用者：这是什么、安装、效果、卸载、反馈、免责声明 |
| 仓库根 [CONTRIBUTING.md](../CONTRIBUTING.md) | 开发者流程：改动前先读什么、改完跑什么 |
| 仓库根 [SECURITY.md](../SECURITY.md) | 安全问题怎么报、哪些信息不要贴 |
| 仓库根 [LICENSE](../LICENSE) | MIT 许可证 |

---

> 新增 / 删除 / 改名文档后**必须同步更新本索引**（规则见 [DOC-RULES.md](DOC-RULES.md)）；
> 新文档至少要被一处既有文档引用，不允许孤儿。
