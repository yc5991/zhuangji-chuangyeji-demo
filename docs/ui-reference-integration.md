# 参考界面素材接入记录 v0.2

本版沿用用户提供的界面素材，暖色纸卡、木质导航、橙色按钮和图标用于经营控件

采购和装配继续使用写实硬件，首页场景继续采用写实等距工坊

## 1 素材处理

用户提供的六张原图保存在 `art/source/ui`，原图内容保持不变

图标表中的图标位置各不相同，切片方案按实际轮廓建立蒙版

Figma 导入文件保留原图像素和可编辑轮廓，导出的透明图集再按固定矩形无损拆包

<div align="center">

表 1.1 本版素材及实际导出依据

| 素材 | Figma 节点 | 运行目录 | 处理依据 |
| --- | --- | --- | --- |
| 20 个透明图标 | `33:185` | `assets/art/workbench/ui/icons` | 切片方案统一为 192 × 192 像素画布，并保留 14 像素边距 |
| 装配图标修正 | `36:2` | 同目录的 `assembly.png` | 单独保护扳手的浅色金属细节，采用独立 PNG 导出 |
| 纸纹、木纹、无字橙色按钮、纸卡 | `33:185` | `assets/art/workbench/ui/surfaces` | 从原图干净区域取样，纸卡和按钮通过九宫格拉伸保留边角 |
| 写实等距工坊 | `32:2` | `assets/art/workbench/workshop/isometric.jpg` | 内置图片生成工具依据已确认的写实参考绘制，Figma 保持原图比例导出 960 × 640 像素 |

</div>

上述数量、边距、尺寸和节点编号来自 `art/figma/ui-slice-plan-v02.json`、`art/figma/reference-ui-slicing.json` 及实际 Figma 导出

Figma 工作区：<https://www.figma.com/design/1Pd44NBRzvtRWywj1V4bz5?node-id=33-185>

连接工具触及账户调用额度后，本版通过普通 Figma 编辑器完成导入、检查和导出

图集原件保存在 `art/exports/ui/ui-slices-v02.png`，对应导入文件为 `art/figma/ui-slices-v02-final.svg`

独立修正版保存在 `art/exports/ui/assembly-v03.png`，对应导入文件为 `art/figma/assembly-v03.svg`

## 2 Demo 接入

五个导航入口统一使用透明图标，选中项使用纸卡底板

纸卡和主按钮覆盖产品、采购、订单、公司、工作台及弹窗，按下和禁用反馈保留独立控件状态

工坊首页显示写实场景、工位资源、设计引导、当前排产和月结入口

装配区进入产品设计，测试区进入已有设计的测试页

场景图片呈现固定设备布局，工位数量和生产状态由独立控件读取存档

月份、公司名称、现金、待付账款、采购价格和任务状态使用 Cocos Label 绘制

Label 是运行时文字组件，因此图片里没有固定经营数字

排产进度按已完成台数、当前阶段和剩余工时共同计算

素材统一从工坊资源包（目录名为 `workbench`）加载，加载完成后只重绘一次，当前弹窗保持打开

图片设置完成后再次指定显示尺寸，避免 Cocos Creator 3.8.8 将控件恢复为源图尺寸

旧整页参考底图已退出运行素材，原图和历史导出保留在美术目录

现有图片替换保留原有 `.meta` 标识，新素材保留相邻 `.meta` 文件

## 3 验收记录

`tools/plan-figma-ui-slices.cjs` 分析原图轮廓，`tools/make-figma-ui-import.cjs` 生成 Figma 导入文件，`tools/import-figma-ui.cjs` 只拆包实际 Figma 导出，不再次去底或调整颜色

写实工坊原图保存在 `art/source/workshop/workshop_isometric_v01.png`，生成提示词保存在 `art/prompts/workshop/workshop_isometric_v01.json`

本次显示和导航截图保存在 `art/preview/demo-ui-v02-*.jpg`

构建、浏览器、微信模拟器和真机结果分别记录在 `art/figma/ui-demo-verification-v02.json`

既有完整经营验证保持原有记录
