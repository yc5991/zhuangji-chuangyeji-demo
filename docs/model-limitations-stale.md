# 第五处过时记录：模型自己的「已知限制」

第 108—111 轮发现四处「问题状态记录」过时 ✓ 第 112 轮找到第五处，**而且它就在模型自己里面** ✗

## 1 位置

`tools/simulate-economy.cjs` 第 391—398 行**硬编码**了六条限制 ✓ 每次运行都写进 `design/economy-review-results.json` ✓

    limitations: [
      'Capacity checks use monthly totals ...',
      'The owner performs design ...',
      'Delivery costs are in direct costs. Lead times, release-day bottlenecks,
       component lots, returns, quality and reputation are not simulated.',   ← 这一条过时了
      ...
    ]

## 2 第 3 条逐项核对

| 它声称「未模拟」的项 | 模型里实际有吗 |
| --- | --- |
| lead times | **没有** ✓ 该条成立 |
| **release-day bottlenecks** | **有** ✗ `releaseCapacityFactor`（3 处） |
| **component lots** | **有** ✗ `for (const [id, lots] of Object.entries(stock))`、`lots.shift()` |
| returns | 未能确认（搜索会命中 `return` 关键字） |
| **quality** | **有** ✗ `failureRateFor`（5 处） |
| **reputation** | **有** ✗ 24 处 |

**六项里四项已不成立** ✗

## 3 已更正

    'Delivery costs are in direct costs. Lead times and returns are not simulated.
     Release-day capacity, component lots, quality and reputation are simulated;
     an earlier version of this list predated them.'

**并保留了不确定的 `returns` 在「未模拟」一侧** ✓ ——因为我的搜索无法排除 `return` 关键字的干扰 ✓ 宁可保守 ✓

## 4 一个次要但真实的缺口：这个文件没有重新生成路径

| 项 | 说明 |
| --- | --- |
| 谁读它 | **3 个校验**（`check:difficulty`、`check:events`、`check:reliability`） |
| 谁写它 | `runAll()` 里的第 399 行——**只有把 `simulate-economy.cjs` 当主程序运行时才触发** |
| **哪个 npm 脚本会触发** | **没有** ✗ |

**所以它能否保持最新，取决于有没有人记得手敲 `node tools/simulate-economy.cjs`** ✗

### 已补

    npm run refresh:review

（我一开始用 `node -e "require('./tools/simulate-economy.cjs')"` 试图重新生成 ✓ **没用** ✗ ——写入在 `runAll()` 里，而 require 不会调用它 ✓ 这是排查过程中的一个弯路，值得记下）

## 5 五处过时记录的完整清单

| 轮 | 过时的东西 | 有校验吗 |
| --- | --- | --- |
| 59 | 完成度审计的数字 | ✓ 结构 |
| 70—71 | 交接说明与四份文档 | ✓ 数字 |
| 108 | `demo-schedule.openGaps` | ✓ 结构 |
| 109 | `workbench.geometryStatus` / `pendingGeometry` | ✗ 现由 `check:open-claims` 覆盖 |
| **112** | **`simulate-economy.cjs` 自己的 `limitations`** | ✗ **本轮才发现** |

## 6 为什么这一处特别值得注意

**前四处是「描述别人的状态」，这一处是「模型描述自己」** ✗

**模型改进后，描述它缺点的清单没有跟着改** ✗ ——因为那段散文和模型逻辑在同一行代码里，但**没有任何断言读它** ✓

**规律仍然成立**：受校验保护的部分准确，不受保护的会过时 ✓
