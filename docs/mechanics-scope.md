# 机制范围自动追踪

`check:wiring` 要判断「数据文件里的每个规则是否被机制读取」。它需要一个「机制」的定义

## 1 原来的做法有一个真实的漏

原先是**手工维护的列表**：

    const MECHANICS = ['simulate-economy.cjs', 'evaluate-product.cjs', 'check-design.cjs', 'check-customers.cjs'];

第 48 轮抽出 `price-acceptance.cjs` 后，**这个列表没有跟着更新**，`check:wiring` 立刻误报：

    2 rules are stated in a design file but no demo mechanic reads them:
    customer-model.json:appearancePreference.baselineScore,
    customer-model.json:appearancePreference.maxPricePremium

那两个字段**确实被读了**——被新模块读的。**漏的是列表，不是数据。** 当轮靠手工把新模块加进列表才修好

## 2 现在的做法：跟着 require 链走

新增 `tools/mechanics-source.cjs`，从 `simulate-economy.cjs` 出发，**递归跟踪 `require('./x.cjs')`**，自动收集全部本地依赖的源码

实测追出来的链：

    simulate-economy.cjs
    check-design.cjs
    evaluate-product.cjs
    check-customers.cjs
    price-acceptance.cjs

`check:wiring` 与 `check:seams` 都改用它，**不再有任何手工列表**

（`check-design` 与 `check-customers` 是因为仿真器借用了它们的纯函数而被引入的。它们的断言不是重点，但它们的函数确实读设计字段，所以**故意不过滤**。）

## 3 已实测能自动追上

验证方式：

1. 在 `balance.json` 里加一个没人读的新规则 `thermal.radiatorBonusUnits = 15`
2. 新建 `tools/_tmp-mech.cjs` 读取它
3. 让 `simulate-economy.cjs` require 这个新模块

结果：`check:wiring` **自动把 `_tmp-mech.cjs` 纳入机制范围**，`radiatorBonusUnits` 被判定为「已被读取」，校验通过

**没有再手工改任何列表。** 全部还原后校验依旧通过

## 4 分工

| 检查 | 防的漏 |
| --- | --- |
| `check:wiring` | 数据里的规则**没有任何机制读取** |
| `mechanics-source.cjs` | 机制范围**因为新增模块而算少了** |

两者合起来：新加一个模块读数据，会被自动算进范围；新加一条没人读的规则，会立刻失败
