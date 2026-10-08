# 实现 I（可靠性模型）的具体方案

你已确认「整个可靠性的东西肯定要实现」✓ 这是剩下最大的一块，而且**它会改变平衡数值**，所以放最后做、做完重新标定 ✓

下面是可直接执行的方案：**每一处改哪个文件、加什么公式、公式从哪来**。

---

## 一、模型里现在是怎么算的（游戏的对应物）

`tools/simulate-economy.cjs` 第 296—313 行，**每造一台**都按期望值计入：

    reworkCost = failRate × (返工耗材 70 + 换件概率 0.15 × 该机型配件成本)
    escapeCost = failRate × escapeRate × (售价 × 退款比例 1 + 物流 120)
    现金 -= reworkCost + escapeCost

**产能**那一侧另外计入（第 273—276 行）：

    人工工时 += failRate × 返工人工 3 小时
    测试工时 += failRate × 返工测试 1.5 小时

**三个输入**：

| 输入 | 公式 | 数据来源 |
| --- | --- | --- |
| `failRate` | `0.04 × 员工系数`，再乘热不稳定 ×3、供电余量低于 0.2 ×1.8、测试不稳 ×2，上限 0.6 | `reliability-model.json` 的 `failureRate` |
| `escapeRate` | 测试台工时 ≥1 → 0.06；≥0.5 → 0.30；否则 1.00 | 同文件的 `qualityControl` |
| 口碑扣减 | 缺陷流到客户时 −0.15 | `customer-model.json` 的 `deliveredRemainingRequirement` |

---

## 二、游戏里要改的六处

### 改动 1：把可靠性数据传进游戏

| 文件 | 改动 |
| --- | --- |
| `tools/prepare-demo.cjs` | 第 55—61 行的 `data` 对象里加 `reliability: read('design/reliability-model.json')` |
| `assets/scripts/domain/types.ts` | `GameData` 加 `reliability` 字段 |

**做完这一步 `check:design-to-game` 会从「已知缺口」变成通过** ✓

### 改动 2：新增可靠性计算模块

新建 `assets/scripts/domain/reliability.ts`，**照抄模型的两个函数**：

| 函数 | 用途 |
| --- | --- |
| `failureRate(design, gradeMultiplier)` | 由 `evaluate()` 的 `coolingRatio`、`headroom` 与员工等级算出故障率 |
| `escapeRate(design)` | 由 `testStationHours` 算出逃逸率 |

**为什么照抄而不是引用**：游戏是 TypeScript，模型是 CommonJS，两边不能共享代码 ✓ 所以会有一份实现——**但它受 `check:reliability` 与本书面公式约束** ✓

### 改动 3：返工占用产能

`game.ts` 的 `schedule()` 里，第 288—300 行**组装 stages** 的地方：

**在 `stages` 之后追加一个期望返工阶段**：

    stages.push({ name:'返工预留', hours: failRate × 3, labor: 1, owner: 0, bench: 0, test: 0 })
    stages.push({ name:'返工测试预留', hours: failRate × 1.5, labor: 0, owner: 0, bench: 0, test: 1 })

**效果**：故障率高的设计会**多占人工与测试工时** ✓ 这正是「散热不足有代价」的落点 ✓

### 改动 4：返工耗材与换件记进成品成本

`game.ts` 的 `finish()` 里，第 324 行**构造成品**的地方：

    cost: 配件 + job.consumables + priorNonParts + failRate × (70 + 0.15 × 配件成本)

### 改动 5：到货缺陷

`game.ts` 的**销售**处（第 428 行 `post(…'sale'…)` 附近）：

**游戏应该掷骰子而不是按期望值** ✓ —— 玩家要能**真的遇到**坏机器 ✓

    若 random() < failRate × escapeRate  →  该台退款 + 物流 120 + 口碑 −0.15

**注意**：模型按期望值算 ✗ 游戏掷骰子 ✗ 两者**长期平均一致，单局有波动** ✓ 这是刻意的 ✓

### 改动 6：口碑扣减接上

`game.ts` 现在的口碑变化只有「按时交付 +0.04」与「迟交 −0.02」两个 ✓ 加上第三个 ✓

---

## 三、做完之后必须重标

| 项 | 说明 |
| --- | --- |
| 为什么 | 游戏多出故障、返工与到货缺陷的代价 ✗ **玩家会比现在更难** ✓ |
| 怎么做 | 跑 `npm run baseline:update`，然后重跑 28 个校验 ✓ |
| 可能要调 | 若难度提升过多，可下调 `failureRate.base`（现在 0.04）或提高返工耗材的宽恕度 ✓ |

---

## 四、风险

| 风险 | 说明 |
| --- | --- |
| **`game.ts` 正在被另一条工作流编辑** | 最后修改距我上次检查约 20 分钟 ✗ 我落地前要重新读一遍，不能按行号改 ✓ |
| 两份实现会分叉 | 游戏的 TypeScript 与模型的 CommonJS 各有一份 ✓ **这是既有状况**（评价、容量、成本都已如此）✓ |
| 掷骰子带来方差 | 单局可能遇到连续坏机器 ✓ 但这是玩家体验的一部分 ✓ |

---

## 五、你确认的部分与待确认的部分

| 项 | 状态 |
| --- | --- |
| 要不要实现 | ✓ **你说要** |
| 放最后做、做完重标 | ✓ 我的建议（因为只有它改数值） |
| **口碑上限 H 用哪个数字** | ⚠️ **仍待你确认**——见上一轮的「公司年销量 135 台」与「市场年出货 2.6 亿台」 |
