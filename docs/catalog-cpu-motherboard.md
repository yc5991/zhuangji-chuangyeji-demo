# 2016–2020处理器平台核查

## 1 供应窗口

本文数值来自紧邻说明的厂商资料；缺少月份时，游戏供货窗口按官方季度换算或作为经验估计记录

本目录收录2016年1月至2020年12月的CPU与主板代表样本.

现实型号保留厂商名称，游戏型号单独记录.

完整版供应商研究不改变Demo固定的32项商品.



来源字段区分官方规格、发布公告、可售公告和当前兼容资料.

游戏供货月份按明确可售时间或芯片组世代窗口推演.

推演月份不代表现实首售日期.



## 2 CPU供货档位

中央处理器（CPU）决定插槽、核心线程数和散热需求.

高端桌面平台（HEDT）使用独立插槽和更多内存通道，不能与主流平台只按性能档位混配.



本次收录 **44 条CPU**.

Intel覆盖Skylake、Broadwell-E、Kaby Lake、Coffee Lake、Coffee Lake Refresh、Cascade Lake-X和Comet Lake.

AMD覆盖FX、Bristol Ridge、Ryzen 1000/2000/3000/5000及Threadripper 1000/2000/3000.

每年保留入门、主流、性能、旗舰和HEDT代表档位，条目不穷举全部SKU.



AMD A12-9800规格页分别列出OEM系统日期2016-09和零售渠道日期2017-07-27.

2016年的公告只证明OEM整机出货，因此游戏采购从2017-07开始.

[1][2]

Ryzen 1000于2017-03开售，Ryzen 2000于2018-04开售，Ryzen 3000于2019-07开售.

Threadripper 3000于2019-11采用sTRX4插槽.

[3][4][5][6]

Intel Comet Lake-S于2020-Q2推出，并切换到LGA1200.

i5-10400官方规格列出6核12线程、65 W；i9-10900K列出10核20线程、125 W.

[7][8][9]

Skylake i3-6100规格包含2核4线程、51 W、HD Graphics 530及DDR4/DDR3L支持.

其余Skylake代表档位参考Intel系列简报；逐SKU页面证据仍需补齐.

[10]

## 3 主板兼容

主板芯片组和基本输入输出系统（BIOS）共同决定处理器能否启动.

相同插槽外形不足以确认兼容.



### 3.1 LGA1151代际边界

Intel第6/7代桌面CPU使用100/200系列芯片组.

第8/9代使用300系列芯片组.

两组CPU都标为LGA1151，Intel明确说明两组芯片组不能互换.

[11]

第8/9代只支持DDR4.

第6/7代主板可能使用DDR3L或DDR4，需按板型核对.

DDR3、DDR3L和DDR4内存槽不能混插.

[10][11]

部分第9代CPU需要更新300系列主板BIOS.

装机配对需核对具体板型的CPU支持清单和固件版本.

[11]

### 3.2 AM4芯片组支持

AMD兼容矩阵把Ryzen CPU与Radeon核显APU分开列示.

B550和A520支持Zen 2 Ryzen 3000小芯片CPU及较新世代，但不支持2200G、2400G、3200G和3400G等APU.

3200G与3400G虽带有3000系列编号，核心仍属于Zen+ APU，不能按普通Zen 2桌面CPU配对.

[12]

X570可支持部分早期APU，但最终条件由主板型号和BIOS决定.

B450、X470的Ryzen 5000支持也需要逐板核对最低BIOS版本.

AMD兼容表描述的是芯片组家族能力，不证明某块主板已刷入可启动固件.

[12]

X570可提供PCIe 4.0芯片组通道.

B550把PCIe 4.0用于CPU直连显卡和NVMe，并保留PCIe 3.0芯片组通道.

A520采用PCIe 3.0，也不支持CPU超频.

[12]

Ryzen 5000于2020-10公布，并于2020-11-05开售.

AMD当时称超过100款500系列主板准备支持该系列.

BIOSTAR在2020年的公告只列出部分X570、B550和A520型号，实际支持随主板型号和BIOS批次分批开放.

[13][14]

### 3.3 HEDT插槽边界

Broadwell-E使用LGA2011-v3和四通道DDR4.

Intel i7-6800K为6核12线程、140 W.

[15]

Intel Skylake-X和Cascade Lake-X使用LGA2066.

AMD Threadripper 1000/2000使用TR4与X399；Threadripper 3000改用sTRX4与TRX40.

AMD说明Threadripper 2000可通过BIOS更新支持部分既有X399主板.

[6][16]

### 3.4 品牌覆盖

本次登记 **39 条主板**，品牌覆盖表逐项记录项目指定供应商的产品或证据缺口

YESTONE 尚缺可确认的阶段板型，因此保留供应商说明，产品表不计入未命名占位

ROGUE保留为ASUX的子品牌映射.

游戏系列另存候选名称，例如华烁磐基、微狮磐狮、技佳磐翼和华擎岩太衍，现实系列保留在参考栏

CPU供应商INTEK和AMDEX也在品牌覆盖表中按处理器角色登记.



主要实物系列包括ASUS PRIME、TUF和ROG，MSI PRO与GAMING/MPG，GIGABYTE AORUS，Colorful Battle-Ax与CVN，MAXSUN Challenger，BIOSTAR RACING，ASRock Taichi、Extreme与Pro.

SOYO SY系列及ONDA A/B系列在现存目录中有家族记录.

厂商旧档案不足时，覆盖状态标为部分核实.



<div align="center">

表 3.1 主板品牌代表型号与证据覆盖
| 品牌 | 本阶段代表板型 | 覆盖状态 | 证据说明 |
| :---: | :---: | :---: | :---: |
| ASUX / ROGUE | H110M-K、PRIME Z270-A、ROG MAXIMUS X HERO、TUF Z490-PLUS | 已研究 | 官方比较页和规格资料可查；ROG按注册表映射到ASUX |
| MISI | H110M PRO-VD、Z270 GAMING PRO CARBON、MPG Z390 GAMING PRO CARBON | 已研究 | Z390官方规格页可查；部分较早型号的页面证据仍需补强 |
| GIGABITE | GA-H110M-S2H、Z370 AORUS Gaming 5、Z490 AORUS ELITE AC | 已研究 | Z370支持页与Z490手册可查 |
| COLORFULL | 战斧 C.AB350M-HD、CVN X570、战斧 B365M | 部分核实 | B350原厂页可查；部分型号历史规格不完整 |
| MAXSHINE | MS-Challenger B450M ICE | 部分核实 | 原厂页列出B450、AM4、DDR4及BIOS支持条件；首售年份未证实[17] |
| ONDRA | H110C+、B550SD4 | 部分核实 | 原厂目录列出型号，未提供完整规格、BIOS名单和首售月[18] |
| YESTONE | 主板家族占位，具体型号未确认 | 部分核实 | 尚未找到2016–2020具体主板原厂页，规格留空 |
| BIOSTEL | B350GT3、X570GTA、B550GTA | 已研究 | 可查CPU支持页、B550规格和Ryzen 5000通知 |
| ASROK | Z270 Extreme4、Z370 Taichi、X570 Taichi、B550M Pro4 | 已研究 | 官方比较页与AM4 CPU支持表可查 |
| SOYA | SY-B350M、SY-H310M | 部分核实 | 官方家族目录可查；具体旧款CPU清单尚缺[19] |
</div>

## 4 年度变化

<div align="center">

表 4.1 2016至2020年平台供货事件
| 月份 | 事件 | 采购影响 | 证据状态 |
| :---: | :--- | :--- | :---: |
| 2016-05 | Broadwell-E进入HEDT供货期 | 增加LGA2011-v3与四通道DDR4商品[15] | 已核实 |
| 2016-09 | Bristol Ridge AM4 OEM系统开始出货 | 事件只证明OEM整机供货，DIY零售窗口另计[2] | 已核实 |
| 2017-01 | Kaby Lake-S与200系列主板进入市场 | 6/7代共享早期LGA1151主板池，需核验BIOS[7][11] | 已核实 |
| 2017-03 | Ryzen 1000 AM4桌面平台开售 | AM4与DDR4进入主流装机范围[3] | 已核实 |
| 2017-08 | Threadripper与X399平台上市 | TR4/X399成为独立HEDT插槽[16] | 已核实 |
| 2017-10 | Coffee Lake-S与300系列主板上市 | 第8代CPU不能装进100/200系列LGA1151主板[7][11] | 已核实 |
| 2018-04 | Ryzen 2000上市 | AM4旧板可能要更新BIOS[4][12] | 已核实 |
| 2018-08 | Threadripper 2000上市 | X399旧板按支持清单更新BIOS[16] | 已核实 |
| 2018-10 | Coffee Lake Refresh与Z390供应 | 300系可支持第8/9代，部分第9代需更新BIOS[7][11] | 已核实 |
| 2019-07 | Ryzen 3000与X570平台上市 | 旧AM4板逐型号核对固件[5][12] | 已核实 |
| 2019-11 | Threadripper 3000与TRX40上市 | sTRX4不能与旧TR4/X399主板互换[6] | 已核实 |
| 2019-Q4 | Cascade Lake-X HEDT供货窗口 | 延续LGA2066/X299路线，月级首售待核实[7] | 推演 |
| 2020-05 | Comet Lake-S与LGA1200主板上市 | 从LGA1151切到LGA1200，旧板不沿用[7] | 已核实 |
| 2020-10 | Ryzen 5000发布 | 500系板厂开始准备支持清单[13] | 已核实 |
| 2020-11 | Ryzen 5000首批零售 | 首批兼容按型号与BIOS批次解锁[13][14] | 已核实 |
</div>

## 5 参数证据

CPU核心数、线程数、TDP、插槽、核显和内存代际来自对应厂商资料或家族规格.

主板芯片组、插槽、DIMM数和CPU支持条件来自厂商产品页、手册或CPU支持清单.

未找到原厂字段时，JSON保留null，并把假设列入inferredFields.



现实首售精度与游戏供货月份分别保存.

官方资料只有季度或年份时，JSON保留原有精度.

游戏供货月再按世代窗口推演，不能当成现实首售时间.



## 6 证据缺口

AMD AM4总表描述芯片组家族能力.

具体主板仍需按板型、硬件修订号和最低BIOS版本核对.

2020年末Ryzen 5000支持需按厂商和型号分批记录.



COLORFULL、MAXSHINE、ONDRA、YESTONE和SOYA部分历史板型缺少可访问的原厂档案.

现存资料不足以确认具体首售日期，YESTONE主板型号与主要规格保留空值.

供货窗口作为游戏设计推演单独保存.



DDR3、DDR3L和DDR4使用不同的模块与插槽.

第6/7代主板需要按具体板型区分内存类型.

第8/9代Intel LGA1151平台使用DDR4.

[10][11]

## 7 参考来源

[1] AMD, [A12-9800 APU规格](https://www.amd.com/en/support/downloads/drivers.html/processors/a-series/a12-series-apu-for-desktops/7th-gen-a12-9800-apu.html)

[2] AMD, [第七代A系列OEM系统公告](https://ir.amd.com/news-events/press-releases/detail/712/new-mainstream-esports-ready-gaming-pcs-powered-by-7th-generation-amd-a-series-desktop-processors-debut-globally)

[3] AMD, [Ryzen 1000供货公告](https://ir.amd.com/news-events/press-releases/detail/753/amd-ryzentm-7-desktop-processors-featuring-record-breaking-overclocking-performance-available-worldwide-today)

[4] AMD, [Ryzen 2000供货公告](https://ir.amd.com/news-events/press-releases/detail/827/2nd-generation-amd-ryzen-desktop-processors-deliver-best-in-class-compute-performance-and-even-faster-gaming-framerates-than-previous-generation)

[5] AMD, [Ryzen 3000供货公告](https://www.amd.com/en/newsroom/press-releases/2019-5-26-amd-announces-next-generation-leadership-products.html)

[6] AMD, [Threadripper 3000供货公告](https://ir.amd.com/news-events/press-releases/detail/913/amd-introduces-worlds-fastest-high-end-desktop-processors-with-3rd-gen-ryzen-threadripper-family-delivering-unmatched-performance-with-no-compromises)

[7] Intel, [Core桌面系列世代与发布时间](https://www.intel.com/content/www/us/en/support/articles/000099655/processors.html)

[8] Intel, [Core i5-10400规格](https://www.intel.com/content/www/us/en/products/sku/199271/intel-core-i510400-processor-12m-cache-up-to-4-30-ghz/specifications.html)

[9] Intel, [Core i9-10900K规格](https://www.intel.com/content/www/us/en/products/sku/199332/intel-core-i910900k-processor-20m-cache-up-to-5-30-ghz/specifications.html)

[10] Intel, [第六代Core桌面处理器简报](https://www.intel.com/content/dam/www/public/us/en/documents/product-briefs/6th-gen-core-family-desktop-brief.pdf)

[11] Intel, [第8/9代Core处理器兼容说明](https://www.intel.com/content/www/us/en/support/articles/000025694/processors/intel-core-processors.html)

[12] AMD, [AM4芯片组与CPU兼容表](https://www.amd.com/en/products/processors/chipsets/am4.html)

[13] AMD, [Ryzen 5000桌面处理器公告](https://ir.amd.com/news-events/press-releases/detail/972/amd-launches-amd-ryzen-5000-series-desktop-processors-the-fastest-gaming-cpus-in-the-world)

[14] BIOSTAR, [Ryzen 5000主板BIOS支持通知](https://www.biostar.com.tw/app/tw/news/news.php?S_ID=435)

[15] Intel, [Core i7-6800K规格](https://www.intel.com/content/www/us/en/products/sku/94189/intel-core-i76800k-processor-15m-cache-up-to-3-60-ghz/specifications.html)

[16] AMD, [Threadripper 2000与X399支持说明](https://ir.amd.com/news-events/press-releases/detail/846/amd-launches-worlds-most-powerful-desktop-processor-bigger-better-2nd-generation-amd-ryzen-threadripper-processors-break-boundaries-of-high-end-desktop-market)

[17] MAXSUN, [MS-Challenger B450M ICE规格](https://www.maxsun.com/products/challenger-b450m-ice)

[18] ONDA, [主板产品目录](https://www.onda.cn/MotherBoard.aspx)

[19] SOYO, [Intel与AMD主板家族目录](https://www.soyocn.net/product16/zb/INTEL/bzcpu/)
