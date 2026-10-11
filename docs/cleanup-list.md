# 装机创业记 已执行的文件清理

## 1 清理结果

依据 `docs/cleanup-result.json`，本次删除 10 处目录或文件，原文件体积合计 281.42 MiB

MiB 是二进制容量单位，每 MiB 等于 1,048,576 字节；体积按删除前实际文件字节数换算，保留的压缩包另占空间

原图、提示词、正式切图、运行资源及当前试玩构建已保留，三路线存档和报表继续保留在本地验收目录

## 2 已删除的文件

下表依据删除前盘点及删除后的路径检查，归档资料逐文件比对了压缩包中的内容摘要

<div align="center">

表 2.1 已执行的清理

| 相对工程路径 | 文件数 | 原体积 MiB | 恢复依据 |
| --- | ---: | ---: | --- |
| `library` | 841 | 59.56 | 可重新生成 |
| `temp` | 856 | 13.18 | 可重新生成 |
| `.local/tests` | 12 | 0.22 | 可重新生成 |
| `tools/__pycache__` | 1 | 0.01 | 可重新生成 |
| `.local/figma-import` | 61 | 150.98 | 已核对归档副本 |
| `ui-demos` | 10 | 19.42 | 已核对归档副本 |
| `tools/preview-ui-demos.cjs` | 1 | 0.00 | 已核对归档副本 |
| `build/art-import-check` | 19 | 4.26 | 已核对归档副本 |
| `.local/package/previous-builds/web-desktop` | 334 | 16.93 | 已核对归档副本 |
| `.local/package/previous-builds/wechatgame` | 338 | 16.86 | 已核对归档副本 |

</div>

旧界面提案的全部参考原图已保留，依据 `art/reference/ui-demo-originals.json`；其中已有的源图保留原路径，独有概览图收入参考目录

旧提案网页及其预览脚本已归档，当前工程移除了对应的启动入口，游戏继续使用正式界面资源

## 3 保留的文件

- `assets`：场景、脚本、运行素材和相邻 `.meta` 文件，文件里的 UUID 资源唯一标识保持原值，避免场景引用失效
- `art/source`、`art/prompts`、`art/exports`、`art/figma`、`art/reference`：原图、提示词、正式切图、Figma 编辑记录和参考原图
- `art/preview`：验收截图及说明文档引用的图片
- `design`、`docs`、`tests`、`tools`、`settings`、`build-templates`：经营数据、确认规格、测试和开发工具
- `node_modules`：继续开发和运行测试需要的工具依赖，本轮保留
- `build/web-desktop`、`build/wechatgame`：当前可用的浏览器版和微信版
- `.local/playtests`：正式验收存档、经营记录及历史问题证据
- `.local/environment.json`、`.local/build`：本机工具设置及构建记录，保持本地保存
- `.git`：原有版本历史，继续保留
- `deliverables/2026-10-11`：已经核对内容摘要的交付压缩包及清单

`.local` 中其余一次性脚本仍保留，避免丢失尚未确认替代关系的研究记录

## 4 恢复方法

Creator 游戏引擎重新打开工程后会生成导入缓存和类型配置，版本使用 `package.json` 固定的 `3.8.8`

重新运行测试会生成 `.local/tests`，Python 工具再次运行时会生成自己的编译缓存

旧提案和导入中间文件可从项目素材包恢复，历史构建可从验收资料包的 `historical-builds` 恢复

交付压缩包仍对应清理前快照，原摘要保持不变；当前 GitHub 仓库保存清理后的工程
