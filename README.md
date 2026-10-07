# Orangegame 微信小游戏

项目使用 Cocos Creator 开发，主要素材由 Codex 绘制，Figma 用于切图

根据已确认的游戏规格，游戏定位为竖屏电脑品牌经营，Demo 试玩版本覆盖 2016 年 1—6 月，保留产品设计、高定委托和生产销售循环

[开发环境](docs/environment.md)记录工具与项目入口，[游戏规格](docs/spec.md)记录玩法和首版范围

[供应商品牌规范](docs/brands.md)整理 Demo 已选 12 家候选的包装名称、对话绰号和文案气质，名称来源为用户提案

[完整版供应商占位表](docs/supplier-registry.md)依据用户提供的品牌图片扩充名称与跨品类关系，新增占位保持在 Demo 商品之外

[商品系列提案](docs/product-names.md)列出正式品牌、系列、型号和现实参考，方便评审商品名称

[配件库设计草案 v0.3](docs/components-draft.md)固定 32 个采购条目，记录具体参考版本、游戏初值、兼容、月内事件、工作台和存档规则

`design` 目录保存对应数据，`npm run check:design` 验算条目数量、配置兼容、用途评分及样机成本，当前校验范围为数值模型

[素材制作约定](docs/art-workflow.md)说明原图保存、切图和导入要求

[Figma 素材工作区](https://www.figma.com/design/1Pd44NBRzvtRWywj1V4bz5)包含原图与参考、素材切图、界面草稿三个页面

本地工具路径保存在 `.local/environment.json`，共享路径示例位于 `tools/environment.example.json`

`tools/check-environment.ps1` 检查本地工具，`tools/open-creator.ps1` 打开项目，`tools/build-cocos.ps1` 构建浏览器或微信小游戏版本

微信小游戏的 AppID 是平台分配的项目标识，构建微信版本时通过脚本参数或本地配置提供
