# 显卡供应商资料

## 1 目录结论

根据`gpu.json`的products数组统计，本目录保留79条有代表性的独立板卡型号

样本覆盖Maxwell、Pascal、Polaris、Vega、Turing、RDNA、Ampere与RDNA 2；每条分别记录图形平台品牌、板卡厂商、厂商系列与板型

平台发布和实体板卡上市各自记账

GTX 750 Ti、GTX 900系列与Radeon R9 300列为2016年开局的存量采购候选，存量身份是游戏设定推演；NVIDIA与AMD资料证明核心家族年代，不能单独证明某一具体品牌当时仍有库存 [1]、[2]

产品表区分`release`与`gameAvailability`

`release`记录具体板卡的实售证据，`gameAvailability`记录游戏采购月份

厂商只公布核心或系列日期时，板卡首售保留空值，游戏月份单独标为供货窗口推演

## 2 核心平台时间线

下表按发布或零售节点整理核心家族；一个月份出现多项时分行列出，具体板卡数据仍以产品规格页为准

<div align="center">

表 2.1 核心家族发布节点与采购意义

| 月份 | 事件 | 状态与采购意义 |
| --- | --- | --- |
| 2016-01 | Maxwell、GTX 900、Radeon R9 300作为开局存量 | 游戏设定推演，为开局提供旧卡档位 |
| 2016-05 | GTX 1080发布 | 已核实核心发布，旗舰Pascal进入采购候选 [1] |
| 2016-06 | GTX 1070公布；RX 480于6月29日上市 | 两个核心家族进入供货候选 [1]、[3] |
| 2016-07 | GTX 1060发布并向板卡伙伴供货 | 主流性能档补齐 [4] |
| 2016-08 | RX 470发布；RX 460开放零售 | Polaris覆盖主流与入门档 [5]、[6] |
| 2016-10 | GTX 1050与GTX 1050 Ti发布 | 增加入门独显选项 [7] |
| 2017-01 | GIGABYTE回顾称AORUS GTX 1080卡系于当年1月推出 | 只确认系列节点，具体Xtreme板型首售仍未知 [8] |
| 2017-03 | GTX 1080 Ti发布，伙伴卡从3月10日起上市 | Pascal旗舰进入供货池 [9] |
| 2017-04 | RX 580与RX 570开始供货 | Polaris 500系列扩充库存 [10] |
| 2017-05 | GT 1030进入产品线；另有GDDR5和DDR4板卡修订 | 显存类型分行，DDR4具体上市日未确认 [11] |
| 2017-08 | Radeon RX Vega 56与64发布 | HBM2高端档进入候选 [12] |
| 2017-11 | GTX 1070 Ti于11月2日上市 | 补入GTX 1070与1080之间的性能档 [13] |
| 2018-08 | RTX 2080系列公布并开放预购 | 公告不等于零售，按9月供货事件记录 [14] |
| 2018-09 | RTX 2080开始供货 | Turing RTX进入采购进度 [14] |
| 2019-01 | RTX 2060上市；AMD公布Radeon VII | Radeon VII此时仅为公告节点 [15]、[16] |
| 2019-02 | GTX 1660 Ti发布；Radeon VII从2月7日零售 | 分开记录核心发布和Radeon VII零售 [17]、[16] |
| 2019-07 | RTX 2060 SUPER、2070 SUPER上市；RX 5700 XT与RX 5700全球上市 | Turing更新与首批RDNA并行 [18]、[19] |
| 2019-10 | RX 5500系列公布；GTX 1660 SUPER发布 | 新品供货窗口进入第四季度 [20]、[21] |
| 2019-11 | GTX 1650 SUPER发布；XFX RX 5700 XT THICC III Ultra SKU上市 | 低预算核心与具体XFX板型均有月份证据 [21]、[22] |
| 2019-12 | RX 5500 XT成为独立桌面SKU | RDNA入门档进入零售候选 [23] |
| 2020-01 | RX 5600 XT向板卡伙伴供货 | RDNA主流1080p档补齐 [24] |
| 2020-09 | Ampere RTX 30公布，RTX 3080首发 | 高端新核心进入采购窗口 [25]、[26] |
| 2020-10 | RTX 3070上市；AMD公布RX 6800系列 | 双平台换代并行 [27]、[28] |
| 2020-11 | RX 6800与RX 6800 XT上市 | RDNA 2进入零售供货 [28] |
| 2020-12 | RTX 3060 Ti于12月2日上市；RX 6900 XT上市 | 年末补齐两家平台的高性能档 [29]、[28] |

</div>

## 3 板卡规格

图形处理器（Graphics Processing Unit，GPU）是显卡上的运算核心

辅助供电指显卡需要的六针或八针线缆，板卡功耗指厂商公布的卡级功耗，推荐电源容量描述整机电源建议，三种规格不能互相替代

NVIDIA GeForce GT 1030分别记录GDDR5与DDR4版本；MSI DDR4型号为2GB、20W、150×69×38mm，GDDR5型号为2GB、30W、147×100×37mm [30]

两张卡的厂商页面未列辅助供电插头，因此真实插头值留空；游戏免外接供电假设单独写在`gameProfile` [30]

MSI GTX 1080 GAMING X 8G规格为180W、6-pin加8-pin、279×140×42mm；GTX 1080 Ti GAMING X 11G为250W、双8-pin、290×140×51mm；两张卡的推荐电源分别为500W与600W，数据表没有把推荐电源容量计作板卡功耗 [31]、[32]

Colorful iGame GTX 1070 U-TOP-8G官方规格列出150W TDP和双8-pin，未提供卡长与厚度；SAPPHIRE NITRO+ RX 480 8G列出240×125×41mm与1个8-pin，未提供板卡功耗 [33]、[34]

SAPPHIRE NITRO+ RX 6900 XT列出340W、双8-pin和310×134.3×55.3mm；INNO3D GTX 1660 Ti Twin X2列出单8-pin、196×113mm卡身和双槽宽度，但未列板卡功耗；网页的850W和450W都只是整机电源要求 [35]、[36]

XFX RX 5700 XT THICC III Ultra规格页列出双8-pin和2.8槽位，卡身尺寸标作估算值315×131×57mm [22]

该页将600W列为最低电源要求，没有公布板卡功耗 [22]

按`gpu.json`中的`verifiedFields`统计，12条产品记录同时具有厂商来源支持的完整卡长、高度、厚度与辅助供电插头

XFX条目的尺寸为厂商估算值

具有完整外形与插头数据的12条产品可用于初步检查机箱长度、卡高、槽位和线缆空间

其余产品仍有至少一项机械字段缺失

## 4 供应商覆盖

板卡厂商与图形核心平台是两种独立角色

MISI的RTX 2060由MISI制造板卡、NVIDIA提供核心 [15]

PCPARTNERS作为集团登记，不作为单独零售板卡品牌

根据`gpu.json`的板卡品牌覆盖表统计，18个品牌有产品样本

ASUX、MISI、GIGABITE、COLORFULL均有多个核心阶段样本

SAPPHIRA、POWERCOLOUR、XFY、EVGO、GAINWIND、LEADTEX、MAXSHINE、INNO3X、MANLY、PALIX、ZOTAK、GALAXY、AXGAME、ASROK、YESTONE及ROG子品牌各有独立覆盖状态

INNO3D官方页面确认GTX 1660 Ti Twin X2型号规格，但首售日期未知 [36]

YESTONE与AXGAME的覆盖状态保留未证实；PowerColor有候选具体型号线索，但本轮无法打开官方页面，板卡规格继续留空

INTEK图形平台登记从2022年后开放，所以2016—2020没有INTEK产品行；PCPARTNERS只按集团角色登记，其下零售品牌独立记录

## 5 未确认事项

根据`gpu.json`的79条products记录统计，12条具有尺寸、插头都来自板卡级厂商来源的完整机械数据

14条产品同时具有尺寸、插头与板卡功耗

20条产品已有尺寸数据

21条产品已有插头数据

16条产品已有板卡功耗数据

缺失字段保留`null`

板卡合作伙伴（Add-in Board，AIB）的历史首售公告是主要缺口，因此具体板卡的`release.date`常留空

核心首发月份不能证明某品牌的具体板型同月开售，游戏采购月份按独立供货假设运行

现行厂商规格页可证明页面列出的型号规格，不能独自证明该卡在2016—2020的首售时间；AORUS Xtreme GTX 1080仍沿用2017年1月家族推出线索，具体Xtreme零售日期未证实

GTX 1030 DDR4修订的首售月份仍未知；Radeon R9 300、GTX 900及Maxwell作为2016开局存量是游戏设定，不是当年所有供应商都持续供货的历史断言

## 6 参考资料

[1] NVIDIA, “Introducing The GeForce GTX 1080: Gaming Perfected,” [官方发布资料](https://www.nvidia.com/en-us/geforce/news/geforce-gtx-1080/)

[2] AMD, “AMD Ushers in a New Era of PC Gaming With Radeon R9 and R7 300 Series Graphics Line-Up,” [官方新闻稿](https://ir.amd.com/news-events/press-releases/detail/619/amd-ushers-in-a-new-era-of-pc-gaming-with-radeontm-r9-and-r7-300-series-graphics-line-up-including-worlds-first-graphics-family-with-revolutionary-hbm-technology)

[3] AMD, “Radeon RX 480 Set to Drive Premium VR Experiences,” [官方新闻稿](https://ir.amd.com/news-events/press-releases/detail/690/radeontm-rx-480-set-to-drive-premium-vr-experiences-into-the-hands-of-millions-of-consumers-starting-at-just-199)

[4] NVIDIA, “GeForce GTX 1060 Out Now,” [官方发布资料](https://www.nvidia.com/en-us/geforce/news/nvidia-geforce-gtx-1060/)

[5] AMD, “The Radeon Rebellion Storms Ahead With Radeon RX 470,” [官方新闻稿](https://ir.amd.com/news-events/press-releases/detail/706/the-radeon-rebellion-storms-ahead-with-the-gamer-optimized-radeontm-rx-470-gpu)

[6] AMD, “Introducing Radeon RX 460 Graphics,” [官方新闻稿](https://ir.amd.com/news-events/press-releases/detail/707/introducing-radeontm-rx-460-graphics-disruptive-technology-for-all-esports-gamers-around-the-world)

[7] NVIDIA, “NVIDIA Introduces GeForce GTX 1050 and 1050 Ti,” [官方新闻档案](https://nvidianews.nvidia.com/news/nvidia-powers-new-class-of-sup?page=440)

[8] GIGABYTE, “GIGABYTE Announces AORUS Gaming Graphics Cards,” [官方新闻](https://www.gigabyte.com/sg/press/news/1538)

[9] NVIDIA, “NVIDIA Introduces the Beastly GeForce GTX 1080 Ti,” [官方发布资料](https://nvidianews.nvidia.com/news/nvidia-introduces-the-beastly-geforce-gtx-1080-ti-fastest-gaming-gpu-ever)

[10] AMD, “Radeon RX 500 Series: The Most Compelling Graphics Card Upgrade Yet,” [官方新闻稿](https://ir.amd.com/news-events/press-releases/detail/763/radeontm-rx-500-series-the-most-compelling-graphics-card-upgrade-yet)

[11] NVIDIA, “GeForce GT 1030 Specifications,” [官方规格页](https://www.nvidia.com/en-us/geforce/graphics-cards/gt-1030/specifications/)

[12] AMD, “AMD Redefines the Enthusiast Gaming Experience with Radeon RX Vega,” [官方新闻稿](https://ir.amd.com/news-events/press-releases/detail/782/amd-redefines-the-enthusiast-gaming-experience-with-radeon-rx-vega-and-radeon-packs)

[13] NVIDIA, “GeForce GTX 1070 Ti Out Now,” [官方发布资料](https://www.nvidia.com/en-us/geforce/news/nvidia-geforce-gtx-1070-ti/)

[14] NVIDIA, “10 Years in the Making: NVIDIA Brings Real-Time Ray Tracing to Gamers with GeForce RTX,” [官方发布资料](https://nvidianews.nvidia.com/_gallery/download_pdf/5b7b01e0ed6ae57560c7d30a/)

[15] NVIDIA, “NVIDIA GeForce RTX 2060 Is Here,” [官方发布资料](https://nvidianews.nvidia.com/news/nvidia-geforce-rtx-2060-is-here-next-gen-gaming-takes-off-6747544)

[16] AMD, “AMD Unveils World’s First 7nm Gaming GPU: Radeon VII,” [官方公告与零售安排](https://ir.amd.com/news-events/press-releases/detail/871/amd-unveils-worlds-first-7nm-gaming-gpu-delivering-exceptional-performanceand-incredible-experiences-for-gamers-creators-and-enthusiasts)

[17] NVIDIA, “Introducing GeForce GTX 1660 Ti,” [官方发布资料](https://www.nvidia.com/en-in/geforce/news/nvidia-geforce-gtx-1660-ti/)

[18] NVIDIA, “GeForce RTX 2070 SUPER and GeForce RTX 2060 SUPER Available Now,” [官方发布资料](https://www.nvidia.com/en-us/geforce/news/nvidia-geforce-rtx-2060-super-rtx-2070-super-out-now/)

[19] AMD, “Worldwide Availability of Radeon RX 5700 Series,” [官方新闻稿](https://ir.amd.com/news-events/press-releases/detail/899/amd-unleashes-ultimate-pc-gaming-platform-with-worldwide-availability-of-amd-radeon-rx-5700-series-graphics-cards-and-amd-ryzen-3000-series-desktop-processors)

[20] AMD, “AMD Introduces Radeon RX 5500 Series Graphics,” [官方新闻稿](https://www.amd.com/en/newsroom/press-releases/2019-10-7-amd-introduces-radeon-rx-5500-series-graphics-su.html)

[21] NVIDIA, “Introducing GeForce GTX 1660 and 1650 SUPER GPUs,” [官方发布资料](https://www.nvidia.com/en-us/geforce/news/nvidia-geforce-gtx-1660-super-1650-super/)

[22] XFX, “Radeon RX 5700 XT THICC III Ultra,” [官方产品规格页](https://www.xfxforce.com/gpus/radeon-tm-rx-5700-xt-8gb-gddr6-thicc-iii-ultra-2)

[23] AMD, “AMD Unveils Radeon RX 5500 XT Graphics Card,” [官方新闻稿](https://ir.amd.com/news-events/press-releases/detail/921/amd-unveils-the-amd-radeon-rx-5500-xt-graphics-card-incredible-1080p-performance-breath-taking-visuals-and-powerful-software-features)

[24] AMD, “AMD Unveils Four New Desktop and Mobile GPUs, including Radeon RX 5600 Series,” [官方新闻稿](https://ir.amd.com/news-events/press-releases/detail/925/amd-unveils-four-new-desktop-and-mobile-gpus-including-amd-radeon-rx-5600-series-ultimate-1080p-gaming-breath-taking-visuals-and-game-changing-software-features)

[25] NVIDIA, “GeForce RTX 30 Series Graphics Cards: The Ultimate Play,” [官方发布与上市资料](https://www.nvidia.com/en-us/geforce/news/introducing-rtx-30-series-graphics-cards/)

[26] NVIDIA, “NVIDIA Delivers Greatest-Ever Generational Leap with GeForce RTX 30 Series GPUs,” [官方新闻稿](https://nvidianews.nvidia.com/news/nvidia-delivers-greatest-ever-generational-leap-in-performance-with-geforce-rtx-30-series-gpus)

[27] NVIDIA, “GeForce RTX 3070 Out Now,” [官方发布资料](https://www.nvidia.com/en-us/geforce/news/geforce-rtx-3070-out-now/)

[28] AMD, “AMD Unveils Next-Generation PC Gaming with AMD Radeon RX 6000 Series,” [官方新闻稿](https://ir.amd.com/news-events/press-releases/detail/978/amd-unveils-next-generation-pc-gaming-with-amd-radeon-rx-6000-series-bringing-leadership-4k-resolution-performance-to-aaa-gaming)

[29] NVIDIA, “NVIDIA Debuts GeForce RTX 3060 Family for the Holidays,” [官方新闻稿](https://nvidianews.nvidia.com/news/nvidia-debuts-geforce-rtx-3060-family-for-the-holidays)

[30] MSI, “GeForce GT 1030 2GH OC 与 2GHD4 LP OC Specifications,” [GDDR5型号](https://www.msi.com/Graphics-Card/GeForce-GT-1030-2GH-OC/Specification)，[DDR4型号](https://ua.msi.com/Graphics-Card/GeForce-GT-1030-2GHD4-LP-OC/Specification)

[31] MSI, “GeForce GTX 1080 GAMING X 8G Specifications,” [官方规格页](https://www.msi.com/Graphics-Card/geforce-gtx-1080-gaming-x-8g/Specification)

[32] MSI, “GeForce GTX 1080 Ti GAMING X 11G Specifications,” [官方规格页](https://www.msi.com/Graphics-Card/GeForce-GTX-1080-Ti-GAMING-X-11G/Specification)

[33] Colorful GRP / Colorfly, “iGame GTX1070 U-TOP-8G,” [官方产品页](https://www.colorfly.eu/products/graphic-cards-for-industrial-use/basics-for-customized/igame-gtx1070-u-top-8g/)

[34] SAPPHIRE, “NITRO Matrix,” [官方型号规格表](https://www.sapphiretech.com/en/nitro-matrix)

[35] SAPPHIRE, “NITRO+ AMD Radeon RX 6900 XT 16G GDDR6,” [官方规格页](https://www.sapphiretech.com/en/consumer/nitro-radeon-rx-6900-xt-16g-gddr6)

[36] INNO3D, “GeForce GTX 1660 Ti Twin X2,” [官方规格页](https://www.inno3d.com/product/inno3d-geforce-gtx-1660-ti-twin-x2)

