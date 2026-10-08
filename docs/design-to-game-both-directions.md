# 实现校验现在同时覆盖两个方向

第 94 轮建了 `check:design-to-game`，它能抓「**设计有、游戏没有**」✓

第 96 轮发现还有反方向：「**游戏有、设计数据没有**」（随机颜色硬性要求）✗ 而那条校验抓不到 ✗

**第 97 轮把它补上**

## 1 新规则：客户字段必须有设计来源

游戏从客户对象上读 15 个字段 ✓ 分三类：

| 类别 | 字段 | 处理 |
| --- | --- | --- |
| **设计规则** | `budget`、`minRam`、`minStorage`、`discreteGpu`、`minVram`、`maxNoise`、`minimumScores` | **必须映射到 `customer-model.json` 的字段** ✓ |
| **运行时记录** | `id`、`archetype`、`kind`、`name`、`dueMonth`、`status`、`designId`、`satisfaction`、`agreedPrice`、`deposit` | 列出豁免 |
| **其余** | —— | **失败** ✗ |

映射表：

| 游戏字段 | 设计来源 |
| --- | --- |
| `budget` | `budgetCoins` |
| `minRam` | `minimumRamGB` |
| `minStorage` | `minimumStorageGB` |
| `discreteGpu` | `requiredDiscreteGpu` |
| `minVram` | `minimumVramGB` |
| `maxNoise` | `maximumNoiseBurden` |
| `minimumScores` | `minimumScores` |

**七个全部有据** ✓ 而 `color` 没有——**它被列为已知缺口** ✓

## 2 实际效果

现在输出：

    status: passed_with_known_gaps
    customerFieldsGrounded: 7
    knownUngroundedFields: [{ field: color, reason: ... awaiting decision L }]

### 已实测能抓新缺口

| 情形 | 结果 |
| --- | --- |
| 只有 `color`（已知） | 通过 |
| `color` + 新增 `warrantyMonths` | **失败：warrantyMonths** ✓ |
| 新增 `minFans` | **失败：minFans** ✓ |

## 3 两个方向现在都有了

| 方向 | 例子 | 校验 |
| --- | --- | --- |
| **设计有、游戏没有** | 可靠性模型、评价六维 | ✓ 第 94 轮 |
| **游戏有、设计没有** | 随机颜色要求 | ✓ **第 97 轮** |
| 两边都有但不一致 | 口碑倍率、预算基准、热稳定性 | ✗ **仍需人工对照** |

**第三类抓不到**——它不是存在性检查能回答的问题，需要逐条比较两边的公式

## 4 目前三类分歧的清单

| 类 | 项 | 状态 |
| --- | --- | --- |
| 设计有游戏没有 | 可靠性模型 | 待决策 I1 |
| 设计有游戏没有 | 评价六维 | 待决策 K |
| 游戏有设计没有 | 随机颜色要求 | 待决策 L |
| 两边不一致 | 口碑倍率不封顶 | 待决策 H1 |
| 两边不一致 | 预算按区间上限 vs 抽取值 | 待决策（第 96 轮） |
| 两边不一致 | 热稳定性：扣分 vs 否决 | 待决策 M |
