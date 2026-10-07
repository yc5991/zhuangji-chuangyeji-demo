# 2016—2020存储组件目录审阅

本资料整理2016年1月至2020年12月的内存、固态硬盘和机械硬盘参考条目[1]

条目数由目录JSON的products数组按category字段统计：共82条，内存20条、存储62条[2]

这些记录属于历史研究草案，不改变Demo采购目录，也不把容量变体计作独立产品行

## 1 目录边界

本目录分开记录厂商产品规格、产品公告、阶段供货推演和未核实字段（[阶段目录契约](../design/catalog-2016-2020/CONTRACT.md)）

release.date记录公告或已知销售时间及其精度，gameAvailability.from记录游戏中可采购的最早月份

厂商说明全球供货或地区销售的，游戏月份仍按公告范围或供货窗口处理，不把当前产品页当作历史首售证明

DDR3与DDR4使用不同插槽和电气规格，不能互换

DDR4商品标称传输率不是每台电脑的默认工作频率

SPD（串行存在检测）保存启动默认参数，XMP（扩展内存配置文件）保存经验证的性能档位；高频档能否启用还取决于主板BIOS、CPU内存控制器、模组和套装组合

Kingston的FURY资料显示，具体套条可有较低SPD默认值和更高XMP档，因此不能把标称频率当作默认值[3]

<div align="center">

**表 1.1 内存存储条目分布**

| 类别 | 条目数 | 主要范围 |
|:---:|---:|:---|
| 内存 | 20 | DDR3存量；DDR4入门2133/2400/2666与3000/3200/3600；低趴散热片、性能散热片及RGB候选 |
| 存储 | 62 | 2.5英寸SATA、M.2 SATA、mSATA、PCIe NVMe 3.0/4.0代际及3.5英寸机械盘 |
| 合计 | 82 | 研究数据，不增加Demo目录条目 | 

</div>

## 2 内存产品线

已能对应到制造商资料的系列包括HyperX FURY / Genesis、Corsair Vengeance LPX / RGB PRO、G.SKILL Ripjaws V / Trident Z / Trident Z RGB、ADATA XPG SPECTRIX D40、Crucial Ballistix Sport LT、Colorful DDR4，以及DDR3的Corsair Vengeance套条

HyperX Genesis资料列出DDR3系列规格；Corsair Vengeance CMZ16GX3M2A1600C10资料对应16GB双通道套条[4][5]

HyperX FURY DDR4的产品简报覆盖2133至2666 MT/s及多种模组容量；当前的3200套条数据表示例中，SPD默认速度低于XMP性能档[3][6]

G.SKILL把Trident Z RGB列为2017年1月发布的系列，因此该RGB行不在2016年1月开放[7]

ADATA SPECTRIX D40资料日期为2017年，RGB能力与频率档只按具体数据表覆盖范围记录[8]

其余登记品牌仍保留在覆盖表，但当手头来源只属于别的厂商时，不继续把别家资料用于它们的规格核验

Apacer和TeamGroup仍有具体商品候选，但官方历史料号和供货月待补；KLEVV、Asgard、Predator与三星零售内存暂时只列供应商覆盖，不生成产品行

DRAM上游身份不自动证明零售模组型号或批次

## 3 SSD接口协议

M.2是模块形态和连接器规格，不能单独判定使用SATA还是PCIe/NVMe

目录分别记录SATA SSD、M.2 SATA、mSATA、PCIe NVMe和机械硬盘；不同接口形态要匹配主板插槽协议、键位、PCIe通道与BIOS支持[9][10]

Intel 600p / 660p、Samsung 960 EVO / 970系列和HP EX920 / EX950资料可分别作为PCIe NVMe代际例子[9][10][11][12]

Samsung于2016年9月21日公布960 EVO，并计划于2016年10月全球供货，容量为250GB、500GB和1TB[10]

目录把960 EVO最早供应月份设为2016-10

Samsung于2018年1月23日公布860 PRO与860 EVO[13]

860 EVO有2.5英寸、M.2和mSATA版本，各形态容量范围不同[13]

Kingston UV500按2018年产品年代处理，官方数据表列出120GB至1.92TB容量与2.5英寸、M.2、mSATA形态；KC1000的数据表版权为2017年，列240/480/960GB，但版权年份不等于首售日[14][15]

WD Blue 3D NAND和SanDisk Ultra 3D不再被提前放入2016年；当前SanDisk资料能核实Ultra 3D现行形态和容量范围，却不能单独确认历史首发月[16]

<div align="center">

**表 3.1 SSD接口代际**

| 产品类型 | 目录表达 | 兼容注意事项 |
|:---|:---|:---|
| 2.5英寸SSD | SATA 6Gb/s、AHCI | 需有SATA数据与电源连接 |
| M.2 SATA SSD | M.2 2280等形态，SATA协议 | M.2插槽须支持SATA设备 |
| M.2 NVMe SSD | PCIe代际/通道和NVMe版本分别记录 | M.2槽位需支持PCIe/NVMe，通道共享可能影响速度 |
| 3.5英寸HDD | SATA机械盘 | 还需确认机箱安装位和电源接口 |

</div>

## 4 供货时间

目录已经把已知晚出的产品从阶段前段移开

960 EVO使用2016年9月公告和10月供货计划；RD400使用Toshiba在2016年5月24日公布的实际日期；TR200使用2017年7月27日公告及秋季零售计划；Kingston UV500按2018年处理，KC1000按2017年处理；Optane 900P按2017年10月27日公告处理[10][15][17][18][19]

Seagate 2019年1月7日公告写明IronWolf 110计划于当年1月供货，BarraCuda 510与FireCuda 510则在春季供应

目录中IronWolf 110从2019-01起；BarraCuda SATA SSD手册修订始于2018年6月，因此其游戏供货月份不早于2018年中[20][21]

Toshiba 2015年9月发布P300时列出500GB、1TB、2TB和3TB；P300现行页面含后续产品更新，不能把全部现行容量倒填到2015款

P300记为阶段前库存；OCZ RD400按2016年5月24日公告记录128/256/512/1024GB、PCIe Gen3 x4 NVMe及M.2/适配卡两种形态[17][22]

KIOXIA于2019年10月启动公司名与品牌标识迁移，官方称面向消费者的品牌逐步在2020年转换；该变化是品牌名称迁移，不另建同型号库存

Solidigm在2021年12月成立，故排除在本阶段之外[23][24]

## 5 品牌身份

Samsung、SK hynix、美光、长鑫、南亚和长江存储等上游DRAM/NAND供应角色，与面向玩家零售的内存模组或SSD品牌分开记录

SSD颗粒、主控、固件和缓存可能随容量、批次或修订改变，没有对应料号资料时不依据母公司、代工关系或颗粒供应关系推断配料

HP EX920、EX950和S700保留为HP零售品牌商品行；HP Storage产品页说明其SSD由BIWIN获授权设计、开发和生产，因此BIWIN记为制造/OEM关系，不复制成第二个玩家采购SKU[11][12][25]

Lexar NS100公告确认2018年9月推出，列120/240/480GB的2.5英寸SATA III型号；Lite-On CV5目前只找到行业媒体转述，未找到可访问的原始厂商公告，故来源等级和规格字段均标为待核[26][27]

## 6 证据缺口

- 逐料号补齐内存SPD、XMP时序、电压、模组高度及CPU/主板兼容表
- 补充WD Blue 3D NAND历史规格表和地区首售记录；WD Red/Black各代型号需要按具体料号核实，不能把后续修订倒填到阶段早期
- 查找SanDisk SSD PLUS、OCZ RD400以外Toshiba SSD、MAXSUN、Lenovo、BIWIN等品牌的本阶段原始商品档案
- 致态SC001/PC005当前产品入口不足以确认具体型号的历史首发月份，相关容量只作游戏候选

KIOXIA尚未获得能核实本阶段EXCERIA具体零售型号与首售月份的厂商材料
- 逐个确认Seagate FireCuda SSHD、Plextor、Gloway、TeamGroup、Colorful、GIGABYTE、SK hynix零售料号对应的历史供货月，兼容清单本身不代表首售证据
- 按历史容量和型号后缀核对SSD NAND、控制器、缓存策略，以及HDD转速、缓存和CMR/SMR差异

## 7 参考资料

[1] 项目阶段目录契约，限定本目录覆盖2016-01至2020-12，design/catalog-2016-2020/CONTRACT.md

[2] 本任务目录JSON，products数组按category统计条目，design/catalog-2016-2020/memory-storage.json

[3] Kingston / HyperX, HyperX FURY DDR4 product brief, https://media.kingston.com/pdfs/HX_FURY_DDR4_EN.pdf；Kingston HX432C16FB3K2/16 DDR4-3200 datasheet, https://www.kingston.com/dataSheets/HX432C16FB3K2_16.pdf

[4] Kingston / HyperX, HyperX Genesis DDR3 datasheet, https://media.kingston.com/pdfs/HyperX_Genesis_EN.pdf

[5] Corsair, Vengeance CMZ16GX3M2A1600C10 16GB DDR3 kit, https://www.corsair.com/us/en/p/memory/cmz16gx3m2a1600c10/vengeancea-a-16gb-dual-channel-ddr3-memory-kit-cmz16gx3m2a1600c10

[6] Kingston, HX432C16FB3K2/16 datasheet, https://www.kingston.com/dataSheets/HX432C16FB3K2_16.pdf

[7] G.SKILL, Trident Z RGB launch announcement, https://www.gskill.com/community/1502239313/1524212855/G.SKILL-Announces-Revolutionary-RGB-Lighting-DDR4-with-Trident-Z-RGB-Series--Unadulterated-RGB-Illumination

[8] ADATA / XPG, SPECTRIX D40 datasheet, https://www.adata.com/upload/downloadfile/Datasheet-XPG%20SPECTRIX%20D40%20DDR4%20Memory%20Module_20170918.pdf

[9] Intel, SSD 600p product brief, https://www.thailand.intel.com/content/dam/www/public/us/en/documents/product-briefs/ssd-600p-brief.pdf；Intel SSD 660p product brief, https://www.intel.com/content/dam/www/public/us/en/documents/product-briefs/660p-series-brief.pdf

[10] Samsung Newsroom, 960 PRO / 960 EVO announcement, https://news.samsung.com/us/samsung-electronics-accelerates-nvme-era-consumers-highest-performing-960-pro-evo-solid-state-drives/

[11] HP Storage / BIWIN, EX920 product page, https://hp.biwintech.com/products/hpex920m.2

[12] HP Storage / BIWIN, EX950 product page, https://hp.biwintech.com/products/hpex950m.2/

[13] Samsung Newsroom, 860 PRO / 860 EVO announcement, https://news.samsung.com/us/samsung-electronics-advances-sata-lineup-with-860-pro-and-860-evo-solid-state-drives-powered-by-v-nand

[14] Kingston, UV500 SSD datasheet, https://www.kingston.com/datasheets/SUV500_us.pdf

[15] Kingston, KC1000 NVMe PCIe SSD datasheet, https://www.kingston.com/datasheets/SKC1000_us.pdf

[16] SanDisk, Ultra 3D SATA SSD datasheet, https://documents.sandisk.com/content/dam/asset-library/en_us/assets/public/sandisk/product/internal-drives/ultra-3d-sata-iii-ssd/datasheet-ultra-3d-sata-iii-ssd.pdf

[17] Toshiba, OCZ RD400 launch announcement, https://news.toshiba.com/press-releases/press-release-details/2016/Toshiba-Launches-the-OCZ-RD400-NVMe-SSD-Series/default.aspx

[18] Toshiba, TR200 retail SSD announcement, https://storage.toshiba.com/news/pr/toshiba-introduces-tr200-sata-retail-ssd-series-with-64-layer-3d-flash-memory

[19] Intel Newsroom, Optane SSD 900P launch announcement, https://download.intel.com/newsroom/2021/archive/2017-10-27-news-blazing-fast-gaming-intels-first-client-optane-ssd.pdf

[20] Seagate, CES 2019 storage announcement, https://investors.seagate.com/news/news-details/2019/Seagate-Levels-Up-Data-Creation-At-CES-With-Storage-Solutions-To-Fit-Any-Digital-Life/default.aspx

[21] Seagate, BarraCuda SSD product manual, https://www.seagate.com/content/dam/seagate/migrated-assets/www-content/support-content/internal-products/barracuda/barracuda-ssd/_shared/masters/product-manual-barracuda-ssd-100835666a.pdf

[22] Toshiba, P300 HDD announcement, https://news.toshiba.com/press-releases/press-release-details/2015/Toshiba-Introduces-New-Lineup-of-Cutting-Edge-Internal-Hard-Disk-Drive-Upgrades/default.aspx

[23] KIOXIA, company name and brand transition notice, https://www.kioxia.com/content/dam/kioxia/shared/about/news/2019/asset/kic-news-20191001-1-en.pdf

[24] Solidigm Newsroom, Introducing Solidigm, https://news.solidigm.com/en-WW/212941-introducing-solidigm-a-market-leader-in-nand-flash-technology/

[25] HP Storage, S700 Series specification sheet, https://hp.biwintech.com/u_file/photo/20200903/797c56b873.pdf

[26] Lexar, NS100 / NS200 launch announcement, https://www.lexar.com/global/news/Lexar-Announces-New-NS100-and-NS200-SSD/

[27] Hermitage Akihabara, LITEON CV5 series announcement report, https://www.gdm.or.jp/pressrelease/2016/1018/181884
