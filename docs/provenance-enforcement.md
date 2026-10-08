# 出处规则的实际执行情况

`AGENTS.md` 有一条规则：

> **同一个字段不得同时出现在 `verifiedFields` 与 `inferredFields` 里。字段名与它的 `specs.` 前缀形式是同一个字段。**

第 67 轮逐条核对这条规则**是否真的被完整执行**

## 1 出处数据在哪里

不在 `components.json`（那是游戏数据），而在**四份 2016—2020 图鉴研究文件**里：

| 文件 | 条目数 |
| --- | ---: |
| `design/catalog-2016-2020/cpu-motherboard.json` | — |
| `design/catalog-2016-2020/gpu.json` | — |
| `design/catalog-2016-2020/memory-storage.json` | — |
| `design/catalog-2016-2020/structural.json` | — |
| **合计** | **336** |

实测：**336 条里 0 条重复** ✓

## 2 我先怀疑了一个漏洞，但它不存在

`check-suppliers` 第 99 行的比较是**裸字符串比较**：

    const verified = new Set(product.verifiedFields);
    for (const field of product.inferredFields) assert(!verified.has(field), ...)

看起来 `verifiedFields: ['specs.socket']` 配 `inferredFields: ['socket']` **不会被抓到**。我做实验验证——**结果被抓到了**，但报的不是这一条，而是：

    gpu_001: noncanonical path graphicsPlatformBrandId

原因是第 91 行的**规范路径断言**：

    assert.equal(field, canonicalPath(product, field), 'noncanonical path')

而 `canonicalPath` 的逻辑是（`tools/normalize-catalog.cjs`）：

1. 已带 `specs.` 前缀 → 就是规范形式
2. 否则若 `product.specs[字段]` 存在 → **规范形式是 `specs.字段`**，裸名即非规范
3. 否则 → 顶层路径，自身即规范

**所以裸名与 `specs.` 名不可能同时出现**——裸名会先被规范路径断言拒掉 ✓ **这条规则是完整的**

## 3 但发现规则覆盖不到的一种情况

如果某个名字**同时**存在于顶层与 `specs` 下（例如顶层也有 `socket`），那么按 `canonicalPath` 的第 2 条：

- `socket` 会被解析成 `specs.socket`
- **顶层那个 `socket` 永远无法被引用**——它能写出来的唯一形式会被判为非规范

实测：**336 条里 0 条存在这种同名** ✓ 目前没有这个问题

但它没有防护。已补：`check-suppliers` 现在拒绝顶层与 `specs` 同名的字段，并说明理由

## 4 结论

| 规则 | 是否执行 | 怎么执行 |
| --- | --- | --- |
| 同一字段不得两处出现 | ✅ | 规范路径断言使两种形式不可能共存 |
| 裸名与 `specs.` 名等同 | ✅ | `canonicalPath` 归一到 `specs.` 形式 |
| 顶层与 `specs` 不得同名 | ✅ **本轮新增** | 显式拒绝并说明后果 |
