# 接缝审查（第二批）

上一轮补上 `check:seams` 后，本轮把规则扩到**机械模型里的每个数字都必须被真正读取**，又查出自己的两个缺陷和一处分身

## 1 可靠性模型里两个数字从未被使用

`reliability-model.json` 定义了四个质检参数，但仿真器只用了其中两个：

| 参数 | 是否被使用 |
| --- | --- |
| `caughtWhenTestHoursAtLeast`（0.5） | 是 |
| `escapeRateWithoutTesting`（1.0） | 是 |
| `escapeRateWithMinimalTesting`（0.06） | 是 |
| **`minimalTestingHours`（1）** | **否，从未被读取** |

模型的设计意图是**三档测试**——没测、部分测试、完整测试。但仿真器写成两档：只要测试台工时达到 0.5 就按完整测试处理，`minimalTestingHours` 形同虚设

**已修**：补上中间档 `escapeRateWithPartialTesting = 0.3`，规则变成

| 测试台工时 | 故障流出比例 |
| --- | ---: |
| 低于 0.5 小时 | 100%（等于没测） |
| 0.5 至 1 小时 | 30%（只拦下一部分） |
| 达到 1 小时 | 6%（完整测试） |

## 2 到货故障的物流费与退款比例从未被收取

`arrivalDefect` 定义了 `logisticsCoins: 120` 与 `refundFraction: 1.0`，但仿真器只按整机售价计算退款，**物流费与退款比例都没进账**

**已修**：流出故障的成本改为售价乘退款比例再加物流费

实测影响很小（普通档 −4 / −31 / −20），路线规则与三档亏损月数（7.95 / 2.08 / 1.23）都不变

## 3 一处分身：口碑惩罚被定义了两次

`reliability-model.json` 的 `arrivalDefect.reputationDelta`（−0.15）与 `customer-model.json` 的 `reputation.deliveredMissingRequirement`（−0.15）是**同一个概念的两份定义**，而且**前者从未被使用**

**已修**：删掉可靠性模型里的那份，改成指向客户模型的引用。**一个数字只能有一个家**

## 4 规则的适用范围

新规则只作用于**Demo 仿真器必须消费的模型**：

| 模型 | 由谁检查 |
| --- | --- |
| `reliability-model.json`、`finish-options.json`、`case-options.json` | `check:seams` 要求每个数字都被仿真器读取 |
| `staff.json`、`company-progression.json` | 由各自的 `check:staff`、`check:progression` 检查 |

这个区分是有意的：把完整版模型也塞进「必须被 Demo 仿真器读取」会误报——它们本来就不该被六个月的 Demo 消费

## 5 校验强制项

`check:seams` 现在会拒绝：

- 任何维度既没被客户决策读取也没标 `informational`
- **任何定义了却没被收取的成本**（工艺、返工、投资、开发费、到货物流逐项核对）
- **机械模型里任何一个仿真器从不读取的数字**
- 外观工时没有计入产能
- 最富配置下分数越界、外观分与朴素配置相同、最富配置不花钱
