# docs/ 索引

> **一句话**：这里只做索引与定位 —— 每篇一句话说明它管什么，规则正文按单一正本原则放在对应文档里。

文档分四类。每篇开头都有「一句话」引言块，先看它再决定要不要往下读。

## 一、架构与设计

| 文档 | 一句话定位 |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 注入机制：asar 头部不变量、unpacked preload、重建 / 还原、运行时数据流 |
| [DESIGN.md](DESIGN.md) | 视觉正本：胶囊尺寸、颜色 token、状态、悬停卡与响应式 |

## 二、功能专项

| 文档 | 一句话定位 |
|---|---|
| [FEATURE-TPS-BADGE.md](FEATURE-TPS-BADGE.md) | 徽标功能范围：挂载位置、统计范围、悬停统计、验收清单 |

## 三、流程与规范

| 文档 | 一句话定位 |
|---|---|
| [BUILD.md](BUILD.md) | 构建与验证：环境、路径配置、命令、三层验证 |
| [RELEASE.md](RELEASE.md) | 发布清单：版本、tag、GitHub Release、发版后检查 |
| [VERSIONING.md](VERSIONING.md) | 版本命名：三段式进位规则与 tag 约定 |
| [MAINTENANCE.md](MAINTENANCE.md) | 维护手册：ZCode 升级恢复、资源重建、仓库卫生 |
| [NAMING.md](NAMING.md) | 文案与命名：产品名、徽标文案、统计标签、提交信息 |
| [CODE-RULES.md](CODE-RULES.md) | 编码纪律：补丁 / 还原成对、等长头部、根范围计数、悬停卡 |
| [REPO-STANDARD.md](REPO-STANDARD.md) | 仓库规范：目录、README 骨架、assets、CI、Issue 模板 |
| [DOC-RULES.md](DOC-RULES.md) | 文档规则：分类、单一正本映射、链接纪律、变更矩阵 |
| [TOOLS-DOC-RULES.md](TOOLS-DOC-RULES.md) | tools/ 规则：脚本 usage 头、路径探测、README 索引 |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 排错手册：按「现象 → 步骤 → 原因 / 解法」组织 |

## 四、参考资料

| 位置 | 一句话定位 |
|---|---|
| [release-notes/](release-notes/README.md) | 面向用户的 Release 说明，文件名 = 版本号 |
| [../assets/](../assets/) | 图标、社交预览、效果截图 |
| [../CHANGELOG.md](../CHANGELOG.md) | 开发者记录：症状 / 根因 / 改法 / 验证 |
| [../README.md](../README.md) | 面向使用者：是什么、安装、使用、卸载 |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | 改动前先读什么、改完跑什么 |
| [../SECURITY.md](../SECURITY.md) | 安全问题怎么报、哪些信息不要贴 |
| [../LICENSE](../LICENSE) | MIT 许可证 |

---

> 新增 / 删除 / 改名文档必须同步更新本索引；新文档至少被一处既有文档引用，不允许孤儿。
