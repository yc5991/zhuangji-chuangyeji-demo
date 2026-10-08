# 组装不兼容与风扇散热

`check-design` 会算出 `blocked`——**20 种硬性不兼容**，例如：

| 代码 | 含义 |
| --- | --- |
| `CPU_PLATFORM` | 处理器插槽与主板不匹配 |
| `RAM_TYPE` | 内存类型与主板不匹配 |
| `RAM_CAPACITY` | 内存容量超过主板上限 |
| `BOARD_FORM` | 主板板型装不进机箱 |
| `COOLER_HEIGHT` | 散热器太高 |
| `GPU_LENGTH` | 显卡太长 |
| `PSU_DEPTH` | 电源太深 |
| `POWER_OVERLOAD` | 整机功耗超过电源额定 |
| `NO_DISPLAY` | 既没独显也没核显输出 |
| `STORAGE_BAYS` / `STORAGE_INTERFACE` / `SATA_POWER_CONNECTORS` | 硬盘位、接口、供电线不足 |
| `GPU_POWER_CONNECTORS` / `CPU_POWER_CONNECTORS` | 供电接口不匹配 |
| `FAN_SLOTS` | 风扇数量超出机箱或集线器 |
| `CAGE_NOT_REMOVABLE` | 机箱硬盘架不可拆却按可拆计算 |
| `NOT_RELEASED` | 配件当时还没上市 |

而 `check:customers` 也依赖 `blocked`（`satisfies` 第一句就是 `if (report.blocked.length) return false`）

**但仿真器从来不看 `blocked`。** 玩家装一台插槽不匹配的机器，仿真器照样按计划生产、照样卖给客户

## 1 修复

仿真器现在在两处拦截：

| 位置 | 效果 |
| --- | --- |
| 需求计算 | 不兼容的机器**没有任何客户下单** |
| 生产循环 | 不兼容的机器**按计划也造不出来** |

并发出 `BUILD_BLOCKED:<样机>` 通知，让玩家知道原因

## 2 实测证据

把办公配方的处理器换成 AMD 的 `cpu_fx8350`（主板是 Intel 插槽）：

| 项目 | 结果 |
| --- | --- |
| `evaluate().blocked` | `["CPU_PLATFORM", "NO_DISPLAY"]` |
| 仿真器通知 | `["BUILD_BLOCKED:office"]` |
| 办公整轮建造 | **0** |
| 游戏整轮建造 | 不受影响 |

**对现有数值零影响**——四套参考配方全部 `blocked: []`，回归基线 `unchanged`

## 3 顺带修好一个静默陷阱

`balance.json` 的 `fanHeatUnits` 值是 **0**，**没有任何工具读取它**。它本来是气流模型的一部分（风扇耗电，电最终变成机箱内的热）

值恰好是 0，所以「没接进去」看不出来。**但如果将来有人把它改成 5，什么都不会发生**——这是个静默陷阱

**已修**：`caseHeat` 现在加上 `风扇数量 × fanHeatUnits`。当前值为 0，所以结果不变，但改动会真的生效

## 4 校验强制项

`check:seams` 新增：

- 仿真器**必须真的调用** `evaluate(...).blocked`
- **需求与生产两处都必须跳过**不兼容的机器（只拦一处即失败）
- **`fanHeatUnits` 必须进入散热求和**（定义了却不进公式即失败）
