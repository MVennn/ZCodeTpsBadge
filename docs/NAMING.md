# 文案与命名

> **一句话**：用户可见的产品名、徽标文案、统计卡标签、文件名与提交信息怎么写。

---

## 1. 产品名

| 场景 | 写法 |
|---|---|
| 仓库 / 项目名 | `ZCodeTpsBadge` |
| 英文标题 | `ZCode Tok/s Badge` |
| 中文称呼 | `ZCode tok/s 徽标` |
| 仓库描述 | `ZCode 桌面版右下角 tok/s 徽标：asar unpacked preload 注入，胶囊样式跟随主题。` |

不要写成 `ZCode TPS Badge`（TPS 只在 GitHub topics 里作为检索词）。

## 2. 徽标文案

| 场景 | 文案 |
|---|---|
| 流式输出 | `42.1` + `tok/s` |
| 空闲 | `—` + `tok/s` |
| 单位 | 小写 `tok/s`，与数值之间一个空格 |

- 数值 `<100` 保留 1 位小数，`>=100` 取整；
- 不使用 `tokens/s`、`T/s`、`tok/sec` 等变体；
- 空闲使用 em dash `—`，不用 `--` 或 `0`。

## 3. 统计卡文案

标题：`速度统计 · 本次运行`

标签与含义见 [FEATURE-TPS-BADGE.md](FEATURE-TPS-BADGE.md) §5（当前 / 平均 / 最高 / 最低 / 累计 / 活跃）。

单位：速度 `tok/s`，累计 `tokens`，活跃 `s`。

## 4. 文档标题

- 文档文件名全大写 + 连字符：`FEATURE-TPS-BADGE.md`；
- 一级标题用中文短语，不加序号；
- 每篇开头一句话引言；
- 引用章节用 `§N`，跨文档链接用相对路径。

## 5. 提交信息

格式：`type: summary`

| type | 用途 |
|---|---|
| `feat` | 新功能 / 用户可感知的行为变化 |
| `fix` | 修复 |
| `docs` | 只改文档 |
| `chore` | 脚本、构建、资源、仓库维护 |
| `release` | 发版提交 |

示例：

```
feat: dock badge in composer with hover stats
fix: restore counting after ZCode 3.16.2 DOM change
docs: add repository standard and release notes
```
