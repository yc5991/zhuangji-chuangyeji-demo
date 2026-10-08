# 规则接线

第 34—40 轮补上的缺口有一个共同形态：**规则在数据文件里写好了，校验也验证了参考数据，但运行时那条规则根本没接进去**

| 轮 | 定义了却没接进去的规则 |
| --- | --- |
| 34 | 外观影响客户偏好、工艺与机箱成本 |
| 35 | 三档质检、到货物流费 |
| 37 | 配件上市时间 |
| 39 | 客户硬性要求、迟到口碑 |
| 40 | 组装兼容性、风扇散热 |
| 41 | BIOS 就绪、数据线数量、散热扣具 |

一轮一轮碰效率太低。`npm run check:wiring` 把这个形态**做成一个系统性检查**

## 1 它怎么查

扫描所有设计文件里的**数值与布尔字段**，逐个确认**六个月的仿真器机制真的读取它**

机制侧 = `simulate-economy.cjs` 加上它传递依赖的功能：`evaluate-product`、`check-design`、`check-customers`

## 2 实测规模

| 项目 | 数量 |
| --- | ---: |
| 扫描的数值字段 | **10876** |
| 深入检查的文件 | 6 |
| 按整份豁免的文件 | 20 |
| 按字段豁免 | 23 |
| 按路径豁免 | 6 |

## 3 每一个豁免都写明理由

豁免不是「跳过」，而是**记录一个决定**。整份豁免的文件例如：

| 文件 | 理由 |
| --- | --- |
| `company-progression.json` | 完整版工坊阶梯，Demo 从不离开第一级 |
| `staff.json` | 完整版人员与培训，Demo 只有一名员工 |
| `supplier-system.json` | 完整版采购草案，Demo 不模拟在途货物 |
| `market-events.json` | 由 `check:events` 覆盖，它把每个结果绑到对应场景 |
| `brands.json` | 供应商登记与命名规则 |
| `art-runtime.json` | 属于美术工作流 |

按字段豁免的都附了具体原因，例如：

| 字段 | 理由 |
| --- | --- |
| `includesCooler` | 目录里所有处理器都不带散热器，这个标志还无法让散热器变成可选——要做需要一条不存在的原装散热器数据 |
| `dataRateMtps` / `maxDataRateMtps` | 同类型的内存条速度完全一致，还无法区分方案 |
| `modular` | 走线外观，没有建模的机械效果 |
| `cpuFanHeaders` / `caseFanControlInputs` | 风扇模型通过 `maxFans` 与集线器计数，不经过主板针脚 |
| `mainboardPowerConnectors` | 目录里每个电源都恰好有 1 个，门槛永远不会触发 |

**按路径豁免的是几何**（`gpuSlots`、`modelHeightMm`、`dimensionsMm`），属于工作台碰撞检测工作流

## 4 本轮顺带接上的三条规则

| 规则 | 代码 | 触发条件 |
| --- | --- | --- |
| 散热器不带扣具 | `COOLER_MOUNTING_KITS` | `includesMountingKits` 为假 |
| 主板附带数据线不够 | `SATA_DATA_CABLES` | 硬盘数超过 `includedSataDataCables` |
| 主板固件不认识处理器 | `BIOS_NOT_READY` | `biosReady` 为假 |

三条对现有数值都是**零影响**（参考配方携带的数据线为 2 条、最多用 2 块盘；所有散热器都带扣具；所有主板 `biosReady` 为真），但**从今以后改这些字段会真的生效**

## 5 已实测能抓到问题

在 `balance.json` 的 `thermal` 下新增一个没人读取的规则：

    thermal.radiatorBonusUnits = 15

校验立刻报出：

    1 rules are stated in a design file but no demo mechanic reads them: balance.json:thermal.radiatorBonusUnits

恢复后立即回到通过。**这是本轮想要的：不需要再一轮一轮碰，新规则没人读就会当场失败**
