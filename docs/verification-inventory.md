# 验证体系的完整清单

第 85 轮发现我把 29 个 `check:` 脚本说成 26 个。第 86 轮顺着这条线查下去，发现**还有一整套测试从没跑过，而且它是坏的**

## 1 完整的验证体系

| 层 | 数量 | 内容 | 命令 |
| --- | ---: | --- | --- |
| **设计校验** | 26 | 设计数据与数值 | `npm run check:*` |
| **领域测试** | **10** | **游戏 TypeScript 逻辑** | **`npm test`** |
| 工程脚本 | 2 | 类型检查、包体检查 | `check:types`、`check:package` |
| 回归基线 | 1 | 54 组运行 | `npm run baseline:diff` |
| 方案预演 | 1 | 不变量检查 | `npm run preview:proposal` |
| **合计** | **40** | | |

**此前我一直只报「26 个校验」**，漏了 10 个领域测试与 2 个工程脚本

## 2 领域测试覆盖什么

`npm test` = `prepare:demo` → `tsc -p tsconfig.tests.json` → `node --test tests/*.test.cjs`

编译 `assets/scripts/domain/**/*.ts` 到 `.local/tests/`，测 10 件事：

| 测试 | 覆盖面 |
| --- | --- |
| 1 月自主产品走完设计→采购→打样→测试→定价→定型→销售 | 完整循环 |
| 1 月高定委托只付一次定金 | 定金记账 |
| 信用与折扣按同款订单计算，不追溯合并 | 账期 |
| 批量任务消耗整数实物配件且不重复预留 | 库存批次 |
| 返工回收更换的配件、保留未更换的 | 返工 |
| 手工理线使用指定接口与相邻通道，辅助走同一套校验 | 理线 |
| 在线、加速、离线重载与重复登录共用一个账本 | 排产一致性 |
| 备份恢复与未来版本保留存档 | 存档 |
| 离线完成排产、停在当前月份 | 离线 |
| 六次结算收尾，6 月不能重复记账 | 月结 |

**这些是我那 26 个设计校验覆盖不到的东西**——它们测的是**游戏逻辑**，不是设计数值

## 3 测试是坏的，而且已经坏了一段时间

第一次跑 `npm test` 时通过（10/10）。**把它加进落地脚本后再跑，报错：**

    assets/scripts/domain/data.ts(2962,7): error TS2353: Object literal may only specify known properties, and '"scopeNote"' does not exist in type 'MonthContent'

### 原因链

| 环节 | 状态 |
| --- | --- |
| `design/demo-schedule.json` 第 5 月有 `scopeNote`（**决策 6 的文字**） | 有 |
| `tools/prepare-demo.cjs` 原样把每个月复制进生成的 `data.ts` | 照抄 |
| `assets/scripts/domain/types.ts` 的 `MonthContent` | **没有声明 `scopeNote`** |

**所以 `data.ts` 里有一个类型不认识的多余字段**，`tsc -p tsconfig.tests.json` 拒绝编译 ✗

### 为什么 `check:types` 没发现

| 配置 | 覆盖范围 |
| --- | --- |
| `tsconfig.json`（`check:types` 用） | **不含** `assets/scripts/domain/**` |
| `tsconfig.tests.json`（`npm test` 用） | `assets/scripts/domain/**/*.ts` |

**两个配置覆盖的文件不同，所以同一个错误只有一个能看见。** `check:types` 通过，`npm test` 失败

## 4 已修

**`types.ts` 的 `MonthContent` 加上可选字段 `scopeNote?:string`**——类型应该描述数据实际有什么

修复后：**`npm test` 通过 10/10**

## 5 已把测试加进落地脚本

`apply-decisions.cjs` 原本只跑 26 个设计校验，**不跑测试**。现在：

    re-running every check
      26 of 26 passed

    running the domain test suite
      10 passed, 0 failed

**测试失败会阻止基线更新**，与设计校验同等

## 6 教训

**「有校验通过」不等于「没有校验失败」。** 我一直在跑 26 个设计校验并报告全绿，而另一条独立的验证路径是坏的——**两者覆盖不同的文件，所以互不知情**

这与第 68 轮（覆盖校验只数顶层）、第 85 轮（漏报 3 个脚本）是同一类问题：**验证体系的边界比它看起来的窄**
