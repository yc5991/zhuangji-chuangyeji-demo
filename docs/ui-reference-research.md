# 开源模拟经营游戏 UI 参考

调研日期：2026-10-08。这里只整理公开仓库能确认的 UI 结构和控件行为，不复制代码、贴图、字体或商标；五个视觉方向是为 Orangegame 制作的独立提案。

## 核心观察

模拟经营游戏不存在一套通用皮肤。跨项目反复出现的是一套信息组织方式：场景负责建立经营空间，工具栏负责高频动作，窗口/页签承载详细管理，列表呈现库存与任务，颜色和形态同时说明状态，玩家能随时看到账务与时间。

| 项目 | 类型与仓库 | 可核对的 UI 实现 | 可迁移到 Orangegame 的经验 |
| --- | --- | --- | --- |
| OpenTTD | 运输经营模拟，[仓库](https://github.com/OpenTTD/OpenTTD) | [`src/window_gui.h`](https://github.com/OpenTTD/OpenTTD/blob/master/src/window_gui.h) 定义窗口、控件间距，以及 `FrameFlag` 的 transparent、border-only、lowered、darkened 状态 | 月份/现金做常驻状态栏；采购、公司与月报采用窗口化信息区；选中与按下分别表达 |
| OpenRCT2 | 游乐园经营模拟，[仓库](https://github.com/OpenRCT2/OpenRCT2) | [`Window.h`](https://github.com/OpenRCT2/OpenRCT2/blob/develop/src/openrct2-ui/interface/Window.h) 管理窗口和滚动控件，含 widget disabled/pressed/enabled 状态；[`Widget.h`](https://github.com/OpenRCT2/OpenRCT2/blob/develop/src/openrct2-ui/interface/Widget.h) 定义具体控件 | 委托和月报用标题、正文、滚动内容、固定动作区；长列表可浏览但主动作不丢失 |
| OpenLoco | 交通网络经营模拟，[仓库](https://github.com/OpenLoco/OpenLoco) | [`Widget.h`](https://github.com/OpenLoco/OpenLoco/blob/master/src/OpenLoco/include/OpenLoco/Ui/Widget.h)、[`ProgressBar.h`](https://github.com/OpenLoco/OpenLoco/blob/master/src/OpenLoco/include/OpenLoco/Ui/ProgressBar.h)、[`ScrollView.h`](https://github.com/OpenLoco/OpenLoco/blob/master/src/OpenLoco/include/OpenLoco/Ui/ScrollView.h) | 排产展示阶段/进度条；列表用紧凑行而不是堆大卡片；可视场景与经营面板并存 |
| Simutrans | 运输网络模拟，[仓库](https://github.com/simutrans/simutrans) | [`src/simutrans/gui/`](https://github.com/simutrans/simutrans/tree/master/src/simutrans/gui) 下按业务拆分 city、vehicle、finance、list 等窗口 | 将产品、供应商、库存、员工和财务拆成稳定的业务页，不塞入单一大面板 |
| Widelands | 聚落建设/生产链策略，[仓库](https://github.com/widelands/widelands) | [`panel_styles.h`](https://github.com/widelands/widelands/blob/master/src/graphic/styles/panel_styles.h) 区分全屏菜单与游戏内面板；另有 table/window 样式模块 | 菜单视觉和游戏内 HUD 分层；数据表按列/状态组织，面板样式保持一致 |
| Mindustry | 工厂自动化策略，[仓库](https://github.com/Anuken/Mindustry) | [`Styles.java`](https://github.com/Anuken/Mindustry/blob/master/core/src/mindustry/ui/Styles.java) 把默认、平面、边框、切换、列表、滑杆、输入框等定义成语义样式 | 一个控件状态只表达一种意思；资源与产能可视化；建造/生产动作要直接且可回看 |

## 归纳成 Orangegame 的通用结构

1. **经营主画面**：工坊场景或实物照片占据视觉中心；顶部持续显示年月、现金和提醒；下方是排产与工位状态。
2. **高频导航**：五个入口以内，工坊、产品、采购、订单、公司固定位置；工作台内部再用分段页签切配置、装配、理线、外观、测试。
3. **管理内容**：列表行优先显示名称、进度/可用状态、价格或期限，次级信息保持一行；筛选、排序和分页放在列表附近。
4. **状态表达**：颜色之外加入文字、图形或进度；暂停、缺货、测试通过、逾期不能只靠颜色区别。
5. **主要动作**：每屏一个明确主行动；月结是玩家触发且有影响的操作，固定显示并确认后再推进月份。
6. **游戏材质**：界面外框可从真实工业面板取材质，但文字和业务控件必须清楚、平面可读，不让纹理争夺硬件照片的注意力。

## 五个视觉候选

这些不是从某个游戏照搬的皮肤，而是同一信息架构的五种艺术指导。提示词位于 [art/prompts/ui/](../art/prompts/ui/)，可逐条复制到图像生成模型。请每个方向各生成一张 9:16 主界面图，便于并排比较。

| 编号 | 方向 | 视觉关键词 | GitHub 结构参考 | 更适合的体验 |
| --- | --- | --- | --- | --- |
| 01 | 工坊写实 | PC Building Simulator 气质、真实工坊照片、石墨金属、少量安全橙 | OpenRCT2 场景+管理窗；OpenTTD 状态工具栏 | 最贴合当前已确认的写实工业方向 |
| 02 | 清爽运营台 | 浅灰工作台、深色文字、表格化排产、少量橙绿红状态色 | Simutrans 业务窗口；Widelands table/window 分层 | 长时间查看公司、财务与大量订单 |
| 03 | 精品高定 | 暗木/深石墨、铜色工艺细节、产品特写、留白更大 | OpenRCT2 固定窗口结构，减少信息密度 | 强调客户委托、外观工艺和单台利润 |
| 04 | 供应链调度 | 蓝钢/冷灰、交期时间轴、库存与授信数字优先 | Mindustry 资源/产能状态；OpenLoco 进度控件 | 强调采购、缺货替代、在途和批产 |
| 05 | 2016 年代计算 | 2016 PC 门店/工作站、LCD/早期终端细节、低饱和橙绿 | OpenTTD/OpenLoco 的经典管理游戏密度 | 强化时间线和硬件圈怀旧感 |

## 生成与回传约定

- 每条提示词都要求一张完整手机竖屏经营主界面，不出拼贴稿、不出多方案合成图。
- 参考图使用项目当前确认的工坊与硬件气质：`art/source/style_review_v02.png`。它是风格参考，不要求复刻画面内容。
- UI 里的文字严格限制为短中文标签与给定经营数据；如果模型无法正确画中文，可让模型留空文字位，之后用真实字体覆排。
- 生成后请回传原始 PNG，不要先裁切、压缩或加滤镜；我会检查屏幕信息层级、文字区域和 720 x 1280 的切片安全边界，再做 Cocos 可用素材。
- 许可提醒：第三方仓库的 UI 代码各自有不同许可证；本项目仅引用公开行为并做视觉原创提案，避免直接搬运 GPL 项目素材或代码。
