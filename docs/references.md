# 跨文件引用完整性

设计数据分散在 26 个 json 里，彼此靠 id 互相引用：配方引用配件、客户原型引用样机、路线引用渠道与投资、市场事件引用情景、线缆引用锚点……

单个校验各自检查自己那一块，但**没有任何一个检查「A 文件里写的 id 在 B 文件里到底存不存在」**。改个名字就可能悄悄产生孤儿引用，而每个分项校验都还是绿的

`npm run check:references` 补上这一层，**15 条规则、173 处引用**

## 1 检查的引用

| 规则 | 内容 |
| --- | --- |
| 配方与样机一一对应 | `balance.json` 的四个配方与 `economy-candidate.json` 的四个样机必须是同一组 |
| 配方引用的配件必须存在 | 处理器、主板、显卡、内存、储存、电源、散热、机箱全部指向 `components.json` |
| 路线的采购渠道必须存在 | `routes[].partsChannel` → `supplier-system.json` |
| 路线的投资必须存在 | `routes[].investments[].id` → `economy.investments` |
| 客户原型指向的样机必须存在 | `archetypes[].referenceRecipe` → 配方 |
| 市场事件结果指向的情景必须存在 | `outcomes[].scenarioId` → `economy.scenarios` |
| 市场事件影响的品类必须存在 | `affectedCategories` → 配件八类 |
| 线缆端点锚点必须存在 | `cable-routing.json` → `workbench.json` 的锚点 |
| 几何机箱必须对应目录里的机箱 | `workbench-geometry.json` 的 caseId → 目录机箱 |
| 几何通道引用的锚点必须存在 | 通道图两端都在锚点表里 |
| 几何线长必须覆盖每个线缆角色 | 八个角色都要有预算 |
| 评价模型的外观来源必须存在 | `evaluation.json` → 工艺档位 |
| 三组 id 唯一性 | 配件、客户原型、工艺档位 |

## 2 校验强制项

`check:references` 会拒绝：任何一处引用解析失败、**两组本应一一对应的 id 集合实际不同**（例如删掉一个配方却没删对应样机）、id 重复

## 3 已实测能抓到问题

把 `student` 原型的 `referenceRecipe` 改成不存在的 `office_v2`，校验立刻报出：

    客户原型指向的样机必须存在: 解析失败 student=office_v2

恢复后立即回到通过。**改动任何一个 id 名字，这一层都会拦住**

## 4 与其他校验的分工

分项校验检查的是**规则**（预算合不合规、价格方向对不对、投资回不回本）；引用校验检查的是**接线**——各份数据之间有没有断掉。两者互补：规则都对，接线也可能是断的

