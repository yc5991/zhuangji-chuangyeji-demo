# 方案预演

六项待定决策现在各有一个实测方案。`npm run preview:proposal` 在**不改动任何已提交数据**的前提下，用仿真器的覆盖参数把方案整体跑一遍，逐条检查不变量

结果写入 `.local/proposal-verification.json`。这是「你说做之后会得到什么」的证据，而不是承诺

## 决策定义只有一处

**第 62 轮之前，这份预演与落地脚本各自写了一份方案，而两份已经不一致**：预演还带着已被放弃的「口碑放大客群」，也没有决策 2 后来加上的两处客群月上限修正

**现在预演直接引用 `tools/apply-decisions.cjs` 里的 `DECISIONS`**，两处不可能再说出不同的方案

| 项目 | 来源 |
| --- | --- |
| 工时时长 | `DECISIONS.hours` |
| 售价 | `DECISIONS.prices` |
| 两个客群的月上限 | `DECISIONS.demandCaps` |
| 混合路线排产 / 投资 / 招募 | `DECISIONS.mixed*` |
| 口碑是否放大客群 | 固定为 `none`——决策 4 已放弃 |

## 与落地脚本的分工

| 工具 | 做什么 | 碰数据文件吗 |
| --- | --- | --- |
| `preview:proposal` | 用覆盖参数跑一遍，检查不变量 | **不碰** |
| `apply-decisions --apply` | 真正写入，重跑校验，更新基线 | 写入 |
| `experiment.cjs` | 单变量对照实验，用完还原 | 碰但保证还原 |
