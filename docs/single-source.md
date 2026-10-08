# 单一来源

第 62 轮发现 `preview-proposal.cjs` 与 `apply-decisions.cjs` **各写了一份决策定义**，而两份已经不一致。本轮把这类问题**做成检查**

## 1 查法

扫描 `tools/` 下每个文件里**用字面量声明的常量**（变量名 + 直接量值，不是 `require` 来的），找出**在多个文件里各声明一次**的

通用名字（`files`、`report`、`rows` 等）已排除——它们重复但不承载同一个事实

## 2 查出 8 个重复定义

| 常量 | 出现在 | 值 |
| --- | --- | --- |
| `DEMO_MONTHS` | `check-events` / `check-schedule` | 都是 6 |
| `DIFFICULTY` | `analyze-sensitivity` / `check-investments` / `simulate-fullgame` | 都是 `'normal'` |
| `FIRST_YEAR` | `check-era` / `check-progression` | 都是 2016 |
| `SCENARIO` | `analyze-sensitivity` / `check-investments` | 都是 `'baseline'` |

**它们当时都一致**——但一致是巧合，不是构造。任何一处改动都可能让两边分叉，而分叉后没有任何东西会发现

## 3 修复：`tools/demo-facts.cjs`

四个事实改为**从数据里读**，只有一个来源：

| 常量 | 来源 |
| --- | --- |
| `DEMO_MONTHS` | `demo-schedule.json` 的月份数 |
| `FIRST_YEAR` / `LAST_YEAR` | `era-trends.json` 的首尾年份 |
| `DIFFICULTY` / `SCENARIO` | 标定基准档（设计选择，集中一处命名） |

六个工具改为从它导入。**`DEMO_MONTHS` 与 `FIRST_YEAR` 现在是真正从数据推导的**——改数据的月份数或年代范围，工具会跟着变

## 4 新增 `npm run check:single-source`

**同一个常量不得在两个工具里各声明一次。** 需要共享的事实放进共享模块

这样「同一件事两份定义」会当场失败，而不是等到几十轮后被发现

（顺带修了一处自指：`check-era.cjs` 原本已有 `LAST_YEAR`，导入共享定义后重复声明——检查器立刻报出）
