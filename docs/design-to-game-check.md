# 设计 → 游戏 的实现校验

第 93 轮发现三处分歧（口碑、可靠性、评价硬编码）**都没有任何校验能发现**——因为现有 26 个校验全部指向仿真器，而问题是「游戏是否照着设计做」

## 1 新增 `npm run check:design-to-game`

它验证三件事：

| # | 检查 | 为什么 |
| --- | --- | --- |
| 1 | 生成的 `data.ts` 记录的 17 个来源哈希与当前设计文件一致 | 保证游戏拿到的数据不是旧的 |
| 2 | 游戏引用的每个 `DATA.x` 都是生成数据提供的 | 保证不会读到 undefined |
| 3 | 设计里要求游戏实现的规则，**必须被携带或被实现** | **这一条能抓出第 92 轮那种缺口** |

## 2 第 3 条的实际效果

第一次运行时它抓到了：

    1 design rules are neither carried into the game nor implemented in it: reliability-model.json (faults, quality control and arrival defects)

**正是第 92 轮的发现** ✓

### 已知缺口单独列出，不掩盖新缺口

把可靠性模型放进 `KNOWN_GAPS` 并写明「等待决策 I1」，于是：

| 情况 | 结果 |
| --- | --- |
| **新的**规则既没被携带也没被实现 | **失败** ✓ |
| **已知的**缺口 | 通过，但状态写为 `passed_with_known_gaps` 并在输出里列出 |

**这样缺口是可见的，而不是静默的。** 一个永远红的校验没人看；一个永远绿的校验没用——列出已知缺口让两者都避免

## 3 当前输出

    status: passed_with_known_gaps
    sourceFilesHashed: 17
    keysProvided: 10
    keysReferenced: 10
    designRulesTracked: 1
    knownGaps: [{ rule: reliability-model.json, reason: ... }]

## 4 已接入落地脚本

`apply-decisions.cjs` 现在跑 **27** 个校验 ✓

## 5 顺带：校验数从 26 变 27，文档跟着更新

**`check:doc-figures` 当场抓出 6 个文档还写着 26** ✓ ——这正是第 85 轮加那条检查的用处

**并且我又犯了一次第 60 轮的错**：全文替换「26 个校验」时，漏掉了写成「26 个」的那一处，也差点改到历史记录 ✗ 已修正

## 6 这条校验的价值

| 轮 | 发现 | 这条校验能抓到吗 |
| --- | --- | --- |
| 90 | 口碑倍率不封顶 | **不能**——需要语义对比，不是存在性检查 |
| 92 | 可靠性完全未实现 | **能** ✓ |
| 93 | 评价规则硬编码 | 部分——`evaluation.json` 未列入 `GAME_MUST_IMPLEMENT` |

**它能抓「设计有、游戏完全没有」这一类**，抓不到「实现得不一样」那一类 ✗ 后者需要逐条对照，目前只能人工做
