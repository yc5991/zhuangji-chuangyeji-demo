# 第四处过时的问题记录：工作台几何

第 108 轮发现「记录问题状态的字段最容易过时」✓ 第 109 轮**系统扫描了设计数据里所有这类字段**

## 1 扫描结果：15 处

| 文件 | 字段 | 处数 |
| --- | --- | ---: |
| `completion-audit.json` | `areas[].blockedBy` | 9 |
| `demo-schedule.json` | `openGaps` | 1（+1 子字段） |
| `economy-review-results.json` | `limitations` | 6 |
| `era-trends.json` | `gaps` | 4 |
| `supplier-system.json` | `substitution.warning` | 1 |
| **`workbench.json`** | **`geometryStatus` + `pendingGeometry`** | **1 + 7** |

## 2 最过时的一处：`workbench.json`

| 字段 | 原值 | 实况 |
| --- | --- | --- |
| `geometryStatus` | `requires_art_review` | **`workbench-geometry.json` 写的是 `implemented_game_geometry`** ✗ |
| `pendingGeometry` | 7 项待建 | **5 项已实现且有校验** ✗ |

### 逐项核对

| pendingGeometry 项 | 实况 |
| --- | --- |
| `per_case_anchor_coordinates` | **已实现**——`cases[].anchors`（每个机箱 8 个锚点） |
| `channel_neighbors_and_capacity` | **已实现**——`cases[].channels`（7 条通道），由 `check:cable-routing` 校验 |
| `cable_lengths` | **已实现**——`cases[].cableLengths`（8 条） |
| `cooler_ram_clearance` | **已实现**——`cases[].cpuRamClearanceMm` |
| `gpu_connector_bend_space` | **已实现**——`cases[].gpuCableBendMm` |
| `port_transforms` | 仍缺——几何里没有显式的端口姿态字段 |
| `collision_volumes` | 属交互与美术工作流 |

**5 项已实现、1 项仍缺、1 项不属数值策划** ✓

## 3 已更新

| 字段 | 更新后 |
| --- | --- |
| `geometryStatus` | `game_geometry_implemented; art detail still requires review` |
| `pendingGeometry` | 缩到 3 项（`port_transforms`、`collision_volumes`、`art_detail`） |
| `pendingGeometryNote` | **新增**——写明 5 项已实现及在哪、并提醒「本字段不被任何程序读取，改动前先核对 geometry 文件」 |

## 4 为什么它会过时：**没有任何程序读它**

实测搜索：

| 位置 | 结果 |
| --- | --- |
| `tools/` | 只有 `check-design.cjs` 自己构造了一个同名的局部变量，**不读这个字段** |
| `assets/` | **零引用** |

**`geometryStatus` 与 `pendingGeometry` 是纯散文** ✗ 与 `openGaps` 一样 ✓

**区别**：`openGaps` 的**结构**受 `check:schedule` 保护 ✓ 而这两个字段**连结构都不受保护** ✗

## 5 同一现象的四次记录

| 轮 | 过时的东西 | 有校验吗 |
| --- | --- | --- |
| 59 | 完成度审计的数字 | ✓ `check:audit`（结构） |
| 70—71 | 交接说明与四份文档 | ✓ `check:doc-figures`（数字） |
| 108 | `demo-schedule.openGaps` | ✓ `check:schedule`（结构） |
| **109** | **`workbench.geometryStatus` / `pendingGeometry`** | **✗ 完全不受保护** |

**规律很清楚**：**受校验保护的部分保持准确，不受保护的部分会过时。**

## 6 另外一处待判断：`economy-review-results.json` 的 `limitations`

六条限制里有几条已经不再成立：

| 原限制 | 现状 |
| --- | --- |
| 「提前期、发布日瓶颈、配件批次、退货、质量与口碑未模拟」 | **批次与口碑已模拟** ✗ |
| 「库存保留历史成本，无降价、转售、需求适配、折旧或设备残值」 | 历史成本 ✓ 但仍无降价转售 ✓ **部分成立** |

**但该文件是「记录某轮运行结果」的快照** ✗ 它的 `limitations` 描述的是**当时的模型** ✓ 是否该更新需判断——**快照类文件的过时是正常的** ✓
