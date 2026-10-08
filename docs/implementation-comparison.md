# 实现 vs 平衡模型：逐条对照（第一批）

第 90 轮发现游戏实现与平衡模型在口碑上分歧。第 91 轮把其余经济规则逐条对照

## 1 对照结果

| 规则 | 平衡模型 | 游戏实现 | 一致？ |
| --- | --- | --- | --- |
| 人工产能 | `ownerHours + 员工数 × 月工时` | 同 | ✅ |
| 老板产能 | `ownerHours` | 同 | ✅ |
| 台位产能 | `台位数 × stationMonthlyHours` | `台位数 × monthHours`（= `stationMonthlyHours`） | ✅ |
| 测试产能 | `测试站数 × stationMonthlyHours` | 同 | ✅ |
| 配件成本 | 基础价 × 渠道系数 × 难度系数 | 同 | ✅ |
| 难度系数 | `opening.supplierTermsFactor` | 同 | ✅ |
| 事件加价 | `categoryPriceFactor` | `unitPrice` 末尾乘 `priceFactor(partId)` | ✅ |
| 事件需求倍率 | `scenario.demandMultiplier` | 不适用——**游戏内事件没有这个字段** | ✅ |
| **口碑倍率** | `Math.min(1, reputation)` | **`reputation`（不封顶）** | ❌ **第 90 轮的发现** |

**除口碑一项外，逐条一致。**

## 2 我犯的一个错，值得记下来

读到 `game.ts` 第 166 行的 `unitPrice` 时，我**把行截断在 106 个字符**，看到的是：

    return Math.ceil(p.game.basePriceCoins*channel!.nominalUnitPriceFactor*DATA.economy.opening[this.state.difficu

**于是推断「没有乘市场倍率」**——而完整的那一行结尾是：

    *this.priceFactor(partId));

**市场倍率是在的。我的推断错了。**

### 为什么会错

为了在一屏里看更多行，我把每一行截到固定宽度。**截断让「这一行没有 X」和「这一行的 X 在截断处之后」看起来一样。**

**这与第 67 轮（以为有漏洞，其实规范路径断言已堵住）、第 82 轮（以为办公价定高了，其实混合路线也用它）是同一类错误**：**用一个不完整的读数下结论。**

## 3 事件需求倍率为什么不用对齐

平衡模型有 `scenario.demandMultiplier`，游戏没有用 ✓ **这是对的**：

| 来源 | 有无 `demandMultiplier` |
| --- | --- |
| 平衡模型的场景（`demand_down_35`、`parts_up_10`） | **有**——它们是**压力测试夹具** |
| 游戏内事件（`market-events.json`） | **没有**——只有 `categoryMultiplier` |

**所以游戏不对齐它是正确的**：那个字段只存在于稳健性测试里，不对应真实事件

## 4 目前的分歧清单只有一条

| # | 规则 | 状态 |
| --- | --- | --- |
| 1 | 口碑倍率是否封顶 | **❌ 待确认（H1/H2）** |

**其余经济规则（产能、成本、渠道、难度系数、事件加价）逐条一致**

## 5 还没对照的部分

| 项 | 说明 |
| --- | --- |
| 返工与配件回收 | `game.ts` 第 296—324 行，逻辑较复杂 |
| 开发（定型）成本与工时 | `game.ts` 第 253—258 行 |
| 定金与账期记账 | `game.ts` 第 244、448—455 行 |
| 库存批次与先进先出 | `game.ts` 第 47、217 行 |

**下一轮继续**
