# 线缆走向与线长预算

`docs/design-confirmation-brief.md` 第 45 行要求：**「线缆路径使用固定节点，节点和通道绑定各机箱局部空间，线长、容量、接口、碰撞和侧板闭合共同检查」**

第 47 行补充：**「CPU 和显卡供电类型分别匹配」**

## 1 查出的缺口

五条检查里**三条的数值已经存在**：

| 检查 | 数据位置 |
| --- | --- |
| 线长 `length_budget` | `workbench-geometry.json` 的 `cableLengths`（八个角色各有预算） |
| 容量 `bundle_capacity` | `workbench-geometry.json` 的 `channels[].capacity` |
| 碰撞 `physical_clearance` | `workbench-geometry.json` 的 `keepouts`、`cpuRamClearanceMm`、`gpuCableBendMm` |
| 接口 `connector_allocation` | 结构规则，见 `workbench.json` 的 `connectionRoles` |
| 侧板闭合 `side_panel_closure` | 结构规则，见 `workbench.json` 的 `blockedRouting` |

**但缺了一样关键的：八个线缆角色都没有绑定到锚点端点。** `workbench.json` 定义了 8 个角色（主板供电、处理器供电、显卡供电……），`workbench-geometry.json` 给了每个角色线长预算，锚点也有坐标和通道图——**可是没有任何地方说明某根线是从哪个锚点走到哪个锚点**

没有这个绑定，**线长预算根本无法检查**：你不知道 1600mm 的主板供电线要跨多远

## 2 补上的绑定

端点从锚点本身的标签推出（电源仓出口、托盘下方过线孔、背板顶部通道……），保存在 [线缆走向](../design/cable-routing.json)：

| 角色 | 中文 | 走向 | 接口 |
| --- | --- | --- | --- |
| MAINBOARD_POWER | 主板供电 | A01 → A02 | 24-pin |
| CPU_POWER | 处理器供电 | A01 → A05 | 8-pin EPS |
| GPU_POWER | 显卡供电 | A01 → A07 | 8-pin PCIe |
| SATA_POWER | 储存供电 | A01 → A08 | SATA power |
| SATA_DATA | 储存数据线 | A02 → A08 | SATA data |
| CPU_FAN | 散热器风扇线 | A02 → A05 | 4-pin fan |
| CASE_FAN | 机箱风扇线 | A02 → A06 | 4-pin fan |
| FRONT_PANEL | 前面板线 | A02 → A06 | front panel header |

**处理器供电与显卡供电使用不同接口，不能互换**——这正是第 47 行的要求

## 3 校验做了什么

`check:cable-routing` 对每个机箱：

1. 每个有线长预算的角色都绑定了锚点（否则报出「长度预算永远不会被检查」）
2. 两个锚点在该机箱里都真实存在
3. 通道图里**存在一条通路**
4. **最短走线长度不超过该角色的线长预算**——这是核心检查
5. **每条通道的容量足以承载经过它的所有线缆**

## 4 实测结果

三个机箱、八个角色全部通过。最紧的是**散热器风扇线**：

| 机箱 | 最短走线 | 线长预算 | 余量 |
| --- | ---: | ---: | ---: |
| case_small | 292mm | 650mm | 358mm |
| case_standard | 467mm | 650mm | 183mm |
| **case_quiet** | **517mm** | **650mm** | **133mm** |

**case_quiet 的余量只有 133mm（用掉预算的 80%）**，是整套走向里最容易被卡住的一根。以后改动这个机箱的锚点位置或通道时，这条会最先失败

## 5 边界

这份文件只补**端点绑定**。坐标、通道形状和碰撞体仍属于几何工作流（`workbench.json` 的 `pendingGeometry` 标注为 `requires_art_review`）

