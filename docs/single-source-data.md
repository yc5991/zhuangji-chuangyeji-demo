# 单一来源（第二批）：设计数据之间

第 63 轮查完 `tools/` 里的重复定义后，本轮查**设计数据文件之间**是否有同一件事的两份定义

## 1 查法

找出**同名字段在多份设计数据里都带数值**的情况。记录类文件（基线、审查结果、审计、导出清单）排除——它们本身就是快照

**同名不一定就是重复**：`appearancePoints` 在机箱选项和工艺档里都有，但一个是 0—20、一个是 20—85，是两个不同的刻度。所以每一项都要看

## 2 查出 3 处真重复——但**已经被校验守住**

| 字段 | 值 | 出现在 |
| --- | ---: | --- |
| `monthlySalary` | 1400 | `economy-candidate.json` 与 `staff.json` |
| `monthlyLaborHours` | 112 | 同上 |
| `recruitmentCost` | 600 | 同上 |

`economy-candidate.json` 的 `employee` 与 `staff.json` 的基准等级是**同一个事实的两份记录**

**但 `check:staff` 已经在断言它们相等**：

    assert.equal(base.monthlySalary, economy.employee.monthlySalary, ...)
    assert.equal(base.monthlyLaborHours, economy.employee.monthlyLaborHours, ...)
    assert.equal(base.recruitmentCost, economy.employee.recruitmentCost, ...)

所以这两份不会悄悄分叉。**这是可以接受的**：`economy-candidate` 是 Demo 的运行配置，`staff.json` 是完整版的等级阶梯，两者职责不同，用校验锁住一致性是合理的做法

## 3 其余 13 处是「同名不同义」

| 字段 | 为什么不是重复 |
| --- | --- |
| `throughMonth` | 场景窗口与事件窗口——**`check:events` 断言它们相等** |
| `testStationHours` | 产品测试时长 2/3/4/6 与返工时长 1.5，是两个量 |
| `office` / `gaming` / `creation` | 三张不同映射表里的**键**，不是值 |
| `appearancePoints` | 机箱选项 0—20 与工艺档 20—85，两个刻度 |
| `noiseMultiplier` | 机箱选项与机箱本体，同一个和式的两个阶段 |
| `height` / `width` / `capacity` / `cost` / `weight` / `ceiling` | 各自领域的同名量 |

## 4 检查扩到设计数据

`check:single-source` 现在**同时查工具与数据**：

- 工具里同一个常量不得声明两次
- 数据里同一个字段名带值出现在多份文件时，**必须在豁免清单里写明理由**

**16 个共享字段名全部有说明。** 以后新增一个同名跨文件字段，会当场要求说明它是不是同一个事实
