# 结构化目录说明

## 1 范围

本文数值依据本目录实际打开的厂商规格页、发布公告、产品表和说明书；资料未列出的字段保留为 `null`，游戏供货月份则单独标成推演 [1][2][3]

本目录覆盖 2016 年 1 月至 2020 年 12 月，共收录 84 条代表型号或明确标注的系列家族，其中电源 23 条、散热器 36 条、机箱 25 条.

这份分阶段参考不会改变 Demo 固定的 32 个商品名额，也不代表列尽所有历史 SKU [4]

电源插头数量描述端头总数，线缆数量描述线束数量，两者分列；只有厂商接线表可支持的字段才标为已核实.

散热器不使用厂商营销 TDP 充当跨产品实测分数.

机箱和冷排适配按安装位置、厚度及邻近组件逐项确认，不能只凭冷排长度推定任意机箱都能安装

## 2 型号时间

2016 年开场库存只表示游戏采购池的设计假设，不能证明具体 SKU 在该月上市.

Seasonic 官方资料将 PRIME 的推出放在 2016 年中，将 FOCUS 系列放在 2017 年 Computex；目录分别记录系列公告时间，并把游戏供货月留作推演 [1][2]

2017 至 2020 年的新增项按官方公告或系列出现时间入场.

Corsair 的 2018 年公告覆盖 AX1600i、H150i PRO、H115i PRO 和 SPEC-OMEGA；Noctua 在 2019 年公布 chromax.black 散热器；MSI 在 2020 年 5 月公告 CORELIQUID 与机箱产品 [5][6][7]

Corsair 于 2018 年 3 月 6 日发布 Carbide 275R 并称全球渠道即刻供货；NZXT 于 2016 年 10 月公布 Kraken X52/X62，并在 2018 年 3 月公布 X72 和 M22 [16][17][18].

Define R6 和 Meshify C 按 Fractal Design 的 2017 年产品历史安排；Define 7、Define 7 Compact、Meshify 2 分别按 2020 年 2 月、6 月和 11 月公告记录 [8][9][10][19].

厂商使用的系列名保存在 `realSeries`，虚构游戏系列名独立保存在 `gameName`，避免把候选商品名当成真实产品系列 [8][9][10]

## 3 规格边界

电源优先记录额定瓦数、ATX 或 SFX 形态、模组方式、尺寸和各类插头总数.

RMx 2018 手册提供了额定输出、尺寸及接头分布 [3]

Seasonic S12II 页面能支持其固定线缆和接头信息 [11]

未找到历史修订或接线表的项目不沿用同系列其他型号的字段

散热器规格重点包括平台扣具、整体高度、内存避让和风扇配置.

Noctua 的 NH-D15 与 NH-U12S 页面分别列出尺寸和内存间隙，DeepCool 2016 产品表支持当年 GAMMAXX、LUCIFER、NEPTWIN 与 FROSTWIN 型号.

当前兼容页面只能说明当前列出的兼容范围，不能证明早期包装随附同一套扣具 [12][13]

一体式水冷需同时匹配冷排长度、机箱安装位、风扇叠厚和邻近主板、内存或显卡净空.

NZXT 的 Kraken 兼容指南列出机箱与冷排位置限制 [14]

Fractal 的 Meshify C 支持页也说明顶部冷排存在额外净空条件 [15]

目录因此保留逐位置核对要求，不把 240、280 或 360 毫米冷排写成通用兼容承诺

机箱字段包括主板板型、显卡长度、CPU 散热器高度、电源长度、硬盘位和冷排安装位.

来源页没给出的字段继续留空；例如官方手册只说明某款机箱系列的结构而没有数值净空时，不从图片或同系列其他机型补出数字

## 4 品牌覆盖

`brandCoverage` 按登记品牌的电源、散热器、机箱角色逐一记录状态、代表产品和引用来源.

`researched` 表示分配给该品牌的角色都有阶段内代表项.

`partial` 表示只有部分角色有型号证据或尚缺历史 SKU.

`unresolved` 表示品牌历史或阶段内型号尚待核实.

`outside_phase` 表示品牌尚不属于本阶段.

注册在供应商表中的品牌不会因此自动进入 2016 年开场库存 [4]

新增代表项包含 EVGA 650 GQ/G3、Super Flower LEADEX III Gold、GIGABYTE P750GM/P850GM，以及长城双卡王发烧版 600SE；长城型号按额定 500W 录入，最大功率不代替额定功率 [20][21][22][23][24].

机箱增加 LIAN LI O11 Dynamic、LANCOOL II、JONSBO U4/U4 PLUS 和 COUGAR MX330；PCCOOLER GI-X4/GI-X6 系列补入散热器候选，厂商页面没有上市日期的项目只标供货推演 [25][26][27][28][29][30].

已收录部分代表项的品牌还包括 Corsair、Seasonic、FSP、Thermaltake、SilverStone、Antec、Super Flower、DeepCool、Noctua、Thermalright、Cooler Master、NZXT、Fractal Design、MSI、ROG、InWin 和 Phanteks.

对应证据集中在具体页面，品牌状态并不代表已经覆盖全部功率档、颜色版本、区域 SKU 或首售日期

航嘉、先马、鑫谷、金河田、Delta、aigo、雅浚、TCOMAS、Valkyrie、大水牛、华硕主品牌及部分 ROG 子类仍缺少阶段内型号证据；乔思伯、联力、COUGAR、EVGA、技嘉、PCCOOLER 和长城虽有代表型号，仍未核完全部分配角色、修订和地区日期 [4][31].

TRYX 的阶段下限设在 2024 年，因此排除在 2016–2020 之外；证据不足的品牌保留在覆盖表和缺口表，不用现代产品填补早期年份 [4]

## 5 来源

[1] Seasonic, “Product Line Revamp,” PRIME 系列推出时间说明，<https://seasonic.com/news/product-line-revamp/>.

[2] Seasonic, “News at Computex 2017,” FOCUS 系列展出信息，<https://seasonic.com/news/news-at-computex-2017/>.

[3] Corsair, “RMx 2018 Series Manual,” 电源规格及接线表，<https://assets.corsair.com/image/upload/corsairmedia/sys_master/productcontent/WW_RMx_2018_Manual_Web_AC.pdf>.

[4] Orangegame, [2016–2020 电源、散热与机箱结构化目录](../design/catalog-2016-2020/structural.json)，含型号级来源、字段来源状态、品牌覆盖、事件、排除项与缺口

[5] Corsair, “Build It Better: Corsair Launches New PSU, Coolers and Case at CES 2018,” <https://www.corsair.com/newsroom/press-release/build-it-better-corsair-launches-new-psu-coolers-and-case-at-ces-2018>.

[6] Noctua, “Noctua Introduces chromax.black CPU Coolers,” 2019 年公告，<https://www.noctua.at/en/news/noctua-introduces-chromax-black-cpu-coolers>.

[7] MSI, “MSI Launch 2020,” 2020 年 5 月公告，<https://www.msi.com/Landing/MSIaunch2020/nb>.

[8] Fractal Design, “Introducing Define 7 and Define 7 XL,” <https://www.fractal-design.com/news/introducing-define-7-and-define-7-xl/>.

[9] Fractal Design, “Introducing Define 7 Compact,” <https://www.fractal-design.com/news/introducing-define-7-compact/>.

[10] Fractal Design, “Introducing Meshify 2 and Meshify 2 XL,” <https://www.fractal-design.com/news/introducing-meshify-2-and-meshify-2-xl/>.

[11] Seasonic, “S12II,” 电源规格及线缆配置，<https://seasonic.com/product/s12ii/>.

[12] Noctua, “NH-D15 Specifications” and “NH-U12S,” 散热器尺寸与内存间隙，<https://www.noctua.at/en/products/nh-d15/specifications> and <https://noctua.at/en/nh-u12s/cpucomp>.

[13] DeepCool, “2016 Product Catalogue,” 散热器系列及产品尺寸，<https://www.deepcool.com/download/E-Catalog/2016_Product_Catalogue.pdf>.

[14] NZXT, “Kraken Series Compatibility Guide,” 2019 年版，<https://assets.cdn.nzxt.com/uploads/download/attachment/677/Kraken_Series_Compatibility_Guide_01.21.2019.pdf>.

[15] Fractal Design, “Meshify C Support,” 顶部冷排净空说明，<https://support.fractal-design.com/support/solutions/articles/4000174841-meshify-c>.

[16] Corsair, “CORSAIR Launches Carbide Series 275R,” 2018 年 3 月 6 日公告及即刻供货说明，<https://www.corsair.com/newsroom/press-release/corsair-launches-carbide-series-275r-pc-case>.

[17] NZXT, “Command Your Cool with the All-New NZXT Kraken,” 2016 年 10 月 18 日 X52/X62 公告，<https://nzxt.com/blogs/news/command-your-cool-with-the-all-new-nzxt-kraken>.

[18] NZXT, “Kraken X72” and “Kraken M22” launch announcements, 2018 年 3 月，<https://nzxt.com/blogs/news/nzxt-expands-its-award-winning-kraken-x-series> and <https://nzxt.com/blogs/news/nzxt-introduces-the-new-kraken-m-series>.

[19] Fractal Design, “History,” 产品时间线，<https://www.fractal-design.com/about/>.

[20] EVGA, “EVGA Haunted Hardware Gaming Event,” 2016 年活动商品清单，<https://www.evga.com/articles/01064/>.

[21] EVGA, “Power Supplies, Q1 2017 Roadmap,” <https://www.evga.com/marketing/EVGA_RoadMap_2017_Q1.pdf>.

[22] Super Flower, “LEADEX III GOLD,” 产品规格页，<https://www.super-flower.com.tw/products-detail/LIII-G/>.

[23] GIGABYTE, “GIGABYTE Launches the Power Supply for NVIDIA Ampere,” 2020 年 9 月 1 日公告，<https://www.gigabyte.com/hk/press/news/1826>.

[24] 中国长城科技集团, “额定500W电源尖兵 长城双卡王发烧版600SE,” <https://www.greatwall.com.cn/5004.html>.

[25] LIAN LI, “PC-O11 Dynamic,” 官方规格页，<https://lian-li.com/product/pc-o11-dynamic/?cn-reloaded=1>.

[26] LIAN LI, “LANCOOL II” and “LANCOOL II MESH RGB,” <https://lian-li.com/product/lancool-ii/> and <https://lian-li.com/product/lancool-ii-mesh-rgb/>.

[27] JONSBO, “U4,” 产品页注明该型号于 2016 年末推出，<https://www.jonsbo.com/en/products/u4black.html>.

[28] JONSBO, “U4 PLUS,” 产品规格及 2020 年说明书入口，<https://www.jonsbo.com/en/products/U4PLUSblack.html>.

[29] COUGAR, “MX330,” MX330/MX330-X 产品规格，<https://cougargaming.com/bg/products/cases2/mx330/>.

[30] PCCOOLER, “GI-X4 Series” and “GI-X6 Series,” 散热器系列页，<https://old.pccooler.com/Products/product2/id/154/ids/0> and <https://old.pccooler.com/Products/product_1/id/147/ids/0>.

[31] MSI, “Full Steam Ahead 2019,” 2019 年促销中列出 MPG SEKIRA 500X，<https://www.msi.com/Promotion/full-steam-ahead-2019>.
