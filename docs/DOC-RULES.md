# 文档规则

> **一句话**：docs/ 怎么分类、每条规则的正本在哪、改动时连带改哪些 ——
> 本篇只管「怎么写、怎么保持一致」，不承载具体技术规则。

本项目的文档结构沿用 GoldSunEnhance 的规范，按工具体量裁剪：
保留分类索引、一句话引言、单一正本、链接纪律、变更触发矩阵；
不设发版 / 版本号 / 免责双副本等不适用章节。

---

## 1. 分类与定位

docs/ 分两类（索引见 [README.md](README.md)）：

| 类别 | 收什么 | 现有成员 |
|---|---|---|
| 架构与设计 | 注入机制、视觉规范 | ARCHITECTURE、DESIGN |
| 流程与规范 | 编码纪律、文档规则、排错 | CODE-RULES、DOC-RULES、TROUBLESHOOTING |

每篇文档开头必须有 **「一句话」引言块**（`> **一句话**：…`）。
新文档没有它不算写完。

## 2. 单一正本原则

**每条规则只在一篇文档里定义；其余位置只允许一句话概述 + 指向正本的链接。**

| 规则 | 正本 |
|---|---|
| asar 机制、注入链路、重建 / 还原 | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 胶囊尺寸、颜色 token、状态与动效 | [DESIGN.md](DESIGN.md) |
| 安装 / 卸载 / 使用步骤 | [README.md](../README.md) |
| 排错步骤 | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| 编码纪律与自检清单 | [CODE-RULES.md](CODE-RULES.md) |
| 文档分类、链接、变更联动 | 本篇 |
| 症状 / 根因 / 改法 / 验证 | [CHANGELOG.md](../CHANGELOG.md) |

## 3. 链接纪律

- 统一用**相对链接 + 锚点**，不用绝对路径。
- 改动 / 删除 / 合并文档后双向点验：
  - 出链：新文档里指向别处的目标还在、锚点没变；
  - 入链：全仓搜旧文件名，把引用方一起改掉 —— 禁止只删文档不改引用。
- 历史记录里的旧文件名（如 CHANGELOG 历史条目）可以保留；
  正文中指向现役文档的链接必须指向现役文档。

## 4. 变更触发矩阵

| 变更 | 必须同步 |
|---|---|
| 改徽标样式 / 尺寸 / 颜色 | [DESIGN.md](DESIGN.md)、[CHANGELOG.md](../CHANGELOG.md) |
| 改统计口径（token 估算、EMA、空闲阈值） | [DESIGN.md](DESIGN.md)、[CODE-RULES.md](CODE-RULES.md) §2.6、CHANGELOG |
| 改补丁 / 还原 / 重建机制 | [ARCHITECTURE.md](ARCHITECTURE.md)、[CODE-RULES.md](CODE-RULES.md)、CHANGELOG |
| 改入口脚本或目录结构 | [README.md](../README.md) 文件结构、[TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| 新增 / 删除 / 改名文档 | [README.md](README.md) 索引 |
| 用户可感知的改动 | CHANGELOG（按症状 / 根因 / 改法 / 验证写） |

## 5. 索引维护与孤儿零容忍

- [README.md](README.md) 是 docs/ 的唯一索引；新增 / 删除 / 改名必须同步更新。
- 新文档必须至少被一处既有文档引用（或进索引并有明确入口），不允许孤儿。

## 6. 体量预算

- 单篇 ≤ 300 行。超了按「正文档 + 历史篇」拆：结论留在正文档，
  踩坑过程与历史决策移到带 `HISTORY` 的篇目。
- 带版本 / 日期的样例可以过时（那是历史记录）；
  但功能清单、文件名、命令这类「现役事实」必须随代码同步。
