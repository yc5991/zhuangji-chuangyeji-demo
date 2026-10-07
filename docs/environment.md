# Orangegame 开发环境

项目使用 Cocos Creator 开发微信小游戏，主要素材由 Codex 绘制，并在 Figma 中切图

本机已安装开发工具，Cocos Creator 已完成项目首次导入，Figma 素材工作区已经连接并建档

## 1 本机工具

以下版本来自本机程序、Windows 安装记录和工具自身的版本输出，检查日期为香港时间 2026 年 10 月 7 日：

- Cocos Creator 3.8.8：安装文件的数字签名有效
- 微信开发者工具 2.02.2608070：命令行入口可运行
- Git 2.45.1：用于保存代码版本
- Node.js 24.19.0：用于运行项目开发工具
- npm 11.17.0：用于调用项目脚本
- VS Code 1.137.0：用于编辑 TypeScript 游戏脚本
- Python 3.11.4：可用于辅助处理素材记录

Cocos Creator 使用自身随附的运行环境编译游戏，本机 Node.js 用于开发工具

## 2 项目入口

项目依据 Cocos Creator 的官方空工程模板初始化，`package.json` 固定引擎版本，`tsconfig.json` 使用编辑器生成的 TypeScript 配置

`assets/scenes/Bootstrap.scene` 是空启动场景，供环境验证使用，玩法和画面由游戏规格确定

本地工具路径保存在 `.local/environment.json`，该目录由版本管理忽略规则排除，避免将机器路径和账户配置提交到项目

项目提供以下入口：

- `tools/check-environment.ps1` 检查本地工具路径
- `tools/open-creator.ps1` 使用本机安装的编辑器打开项目
- `tools/build-cocos.ps1` 根据启动场景构建浏览器或微信小游戏版本

构建脚本将配置与日志保存在 `.local/build`，构建包保存在 `build`，这些文件可重新生成

## 3 Figma 素材工作区

[Orangegame 素材工作区](https://www.figma.com/design/1Pd44NBRzvtRWywj1V4bz5)包含原图与参考、素材切图、界面草稿三个页面

项目中的 `art/figma/workspace.json` 保存文件和页面的关联信息，[素材制作约定](art-workflow.md)说明原图保留、切片命名和 Cocos Creator 导入要求

## 4 构建检查

空启动场景的浏览器版本和微信小游戏版本均已构建完成，结果来自本次构建日志与生成文件

初次微信构建使用 Cocos 官方文档提供的测试 AppID，随后已使用用户提供的小游戏测试号重新构建成功

生成文件中的 AppID 与本地配置一致，设备方向为竖屏，构建脚本已固定这一方向

构建检查覆盖工程导入和打包，浏览器运行效果、微信模拟器效果与真机预览需要在实现玩法后分别验证

## 5 微信验证条件

小游戏的 AppID 是微信平台分配的项目标识，真实项目构建通过脚本参数或本地配置提供

用户提供的测试 AppID 已保存在 `.local/environment.json`，AppSecret 未写入项目文件，客户端和共享文档均不保存该密钥

微信开发者工具登录、项目权限与真机预览分别核实，安装工具和生成构建包只证明对应步骤完成

账号关联和云存档已纳入游戏规格，云环境开通情况及测试账号可用权限尚未验证

## 6 官方资料

[Cocos Creator 下载页](https://www.cocos.com/creator-download)用于核对引擎版本

[微信小游戏发布流程](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-wechatgame.html)说明开发者工具配置与小游戏构建选项

[命令行构建说明](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-in-command-line.html)说明构建参数和退出码
