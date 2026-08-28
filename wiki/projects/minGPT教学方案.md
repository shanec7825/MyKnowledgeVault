---
type: project
title: "minGPT 实践教学方案（中文版）"
created: 2026-08-08
updated: 2026-08-28
status: active
area: "人工智能"
domain: machine-learning
complexity: intermediate
goal: "亲手跑通、逐行读懂并改造 minGPT，最终能从零写一个 150–250 行的小 GPT。"
prerequisites:
  - "[[wiki/projects/What is ML and its types|What is ML and its types]]"
  - "[[wiki/projects/pythonBasics|pythonBasics]]"
code:
  - ".raw/repos/minGPT"
sources: []
related:
  - "[[wiki/projects/类比于强化学习和深度学习的学习理论|类比于强化学习和深度学习的学习理论]]"
  - "[[wiki/projects/harness开发学习主线|DeepSeek Harness 开发学习主线]]"
tags:
  - project
  - minGPT
  - gpt
  - tutorial
  - area/人工智能
---

# minGPT 实践教学方案（中文版）

> [!info] 源码位置
> minGPT 源码仓库已从 `wiki/projects/minGPT/` 移出，现位于 `.raw/repos/minGPT/`（Obsidian 已忽略 `.raw/`；请在终端或文件管理器中访问）。下文所有相对路径（`mingpt/`、`demo.ipynb`、`projects/` 等）均相对于该仓库根目录。

> 一句话定位：本仓库是 karpathy 的 minGPT——一个约 300 行、用来"看懂"和"改造"的 GPT 教学实现。本方案的目标不是把论文读完，而是**亲手跑起来、逐行读代码、改出问题、再读回去**，最后能自己从零写出一个小 GPT。


## 前置
**前置项目**：[[What is ML and its types]]、[[pythonBasics]]

**知识框架体系**：概念层（Transformer 与自注意力、因果掩码、embedding、loss 与梯度下降、BPE 分词）；技能层（PyTorch 张量操作、跑训练与采样、读模型源码、改参数观察现象）；工具层（PyTorch、Jupyter、minGPT 仓库）。


## 目标产出
> 亲手跑通、逐行读懂并改造 minGPT，最终能从零写一个 150–250 行的小 GPT。

**交付物**：

- [ ] 跑通 demo 排序任务，并逐行拆解 model.py
- [ ] 读懂 trainer.py 的训练循环
- [ ] 训练自己的 chargpt 字符语言模型
- [ ] 完成至少一个自己的改造点（训练 / 采样 / 结构）
- [ ] 每阶段一份 notes/ 短笔记


## 项目关键点
**核心内容**：以 karpathy 的 minGPT（约 300 行）为教材，按「跑通 → 逐行读懂 → 动手改造」的节奏，最终能从零写一个 150–250 行的小 GPT。

**关键难点**：

- 张量形状（B、T、C）在每一层的变化是最容易跟丢的地方，必须能徒手画出。
- 因果注意力「只能看左边」的掩码机制，要亲手改掉并观察后果才算懂。
- 理论与实践落差大——只有亲手改坏、再读回去，模型才真正属于自己。

---


## 0. 怎么用这份方案
### 0.1 两条学习规则（先记住）

1. **实践优先**：每个阶段都是"先动手跑，再读代码解释发生了什么，再改造验证理解"。不要先啃理论再动手。
2. **不知道才补**：数学原理（softmax、注意力公式、梯度下降等）和语法知识（Python / PyTorch 的写法）**不是前置课程**。卡住了、看不懂了，才去查对应阶段的"按需补充"小节。没卡住就不补。

### 0.2 每个阶段的固定节奏

| 步骤 | 做什么 | 目的 |
| --- | --- | --- |
| 动手 | 按步骤运行代码，记录输出 | 先有真实经验，再谈理解 |
| 读码 | 对照输出读对应源码 | 把"现象"和"代码"对上 |
| 改造 | 修改一个参数/一行代码，观察变化 | 验证你的理解对不对 |
| 复盘 | 回答每阶段末尾的复盘问题 | 把零散经验整理成知识 |

每个阶段末尾都有**过关标准**：能做到才算完成，做不到就回到"读码/改造"步骤。

### 0.3 时间预算

按每天 2~4 小时算，全部主线阶段约 **7~10 天**；最后可选项目可以自由延长。

| 阶段 | 主题 | 预计时间 |
| --- | --- | --- |
| 0 | 环境搭建 | 0.5~1 天 |
| 1 | 跑通 demo 排序任务 | 1 天 |
| 2 | 逐行拆解 model.py | 1~2 天 |
| 3 | 读懂训练循环 trainer.py | 0.5~1 天 |
| 4 | 训练自己的字符语言模型 chargpt | 1~2 天 |
| 5 | 精确任务：加法 adder | 1 天 |
| 6 | 加载预训练 GPT-2 生成文本 | 1 天 |
| 7 | 自选扩展项目（可选） | 1~2 周 |

### 0.4 建议的学习笔记习惯

在仓库里建一个 `notes/` 文件夹，每阶段结束时写一份短笔记（`notes/stage1.md` 等），内容就三块：

- 我今天跑通了什么（贴关键输出）
- 我改了什么、结果如何
- 我还能解释什么、解释不了什么

这份笔记是后续复习和自测的依据。

---


## 1. 学习目标
### 1.1 学完主线 7 个阶段后，你应该能做到

- 能说清 GPT 的完整数据流：token 序列 → embedding → 多层 Transformer 块 → logits → 下一个 token 的概率分布
- 能不看资料画出每个张量在每一层的形状变化（B、T、C 分别代表什么）
- 能用 minGPT 训练一个自己的小语言模型（喂任意文本），并解释 loss 和采样结果
- 能解释因果注意力为什么是"只能看左边"的，并亲手把它改掉、观察后果
- 能解释 temperature、top_k、do_sample 这三个生成参数在代码里做了什么
- 能区分"生成式任务"（模仿文本）和"精确任务"（加法），并知道为什么后者更难
- 了解 BPE 分词和 GPT-2 预训练权重是怎么加载进来的

### 1.2 仓库文件地图（先有个印象，不用现在读）

| 文件 | 是什么 |
| --- | --- |
| `mingpt/model.py` | GPT 模型本体：Embedding、注意力、MLP、生成逻辑（核心中的核心） |
| `mingpt/trainer.py` | 与模型无关的训练循环：取 batch、算 loss、反向传播、更新参数 |
| `mingpt/bpe.py` | OpenAI 的字节对编码（BPE）分词器：文本 ↔ token 整数 |
| `mingpt/utils.py` | 工具：随机种子、日志、轻量配置类 CfgNode |
| `demo.ipynb` | 最小示例：训练 GPT 学会"排序"任务 |
| `generate.ipynb` | 加载预训练 GPT-2 并生成文本 |
| `projects/chargpt/` | 字符级语言模型项目（喂文本，学写文本） |
| `projects/adder/` | GPT 学加法项目（精确任务） |
| `tests/` | 单元测试 |

---


## 2. 阶段 0：环境搭建与第一次运行
> 本机现状（2026-08-08 检查）：PowerShell 里 `python` 命令不可用，torch 未安装。所以这一步是必须的。

### 2.1 动手：安装 Python

任选一种方式（推荐第一种）：

- 方式 A：去 [python.org](https://www.python.org/downloads/) 下载 Python 3.12 安装包，安装时**勾选 "Add python.exe to PATH"**。
- 方式 B：安装 [Miniconda](https://docs.conda.io/en/latest/miniconda.html)，之后用 `conda create -n mingpt python=3.12` 创建环境。

验证：

```powershell
python --version
```

能打印出版本号即可。

### 2.2 动手：创建虚拟环境并安装依赖

在仓库根目录打开 PowerShell：

```powershell
cd C:\Users\Lenovo\Documents\MyKnowledgeVault\wiki\projects\minGPT
python -m venv C:\Users\Lenovo\.venvs\minGPT
C:\Users\Lenovo\.venvs\minGPT\Scripts\Activate.ps1
```

激活后命令行前面会出现 `(minGPT)`。然后安装依赖（先按 CPU 版装，最省事）：

```powershell
python -m pip install --upgrade pip
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install numpy jupyter tqdm
```

> 如果你确认电脑有 NVIDIA 显卡且想用 GPU，把 torch/torchvision 换成 CUDA 版即可（本机 RTX 4060 已按下面命令装好）：
>
> ```powershell
> pip install --force-reinstall "torch==2.13.0+cu126" "torchvision==0.28.0+cu126" --index-url https://download.pytorch.org/whl/cu126
> ```
>
> 安装后验证：`python -c "import torch; print(torch.cuda.is_available())"` 应输出 `True`。

把 minGPT 本体以"可编辑模式"装进来（这样改源码会立即生效）：

```powershell
pip install -e .
```

### 2.3 动手：跑单元测试验证安装

```powershell
python -m unittest discover tests
```

这个测试会加载 GPT-2 预训练权重并与 huggingface 实现做对比，因此需要额外两个库（本机已装好）：

```powershell
pip install transformers requests
```

看到测试通过（或至少能 import mingpt 不报错）即算过关。注意：由于新版 transformers 去掉了部分旧键名，本仓库的 `mingpt/model.py` 打了一个小补丁（`from_pretrained` 只拷贝两边共有的参数），属正常兼容性处理。

### 2.4 过关标准

- [ ] `python --version` 有输出
- [ ] `python -c "import torch; print(torch.__version__)"` 有输出
- [ ] `python -c "from mingpt.model import GPT; print('ok')"` 有输出
- [ ] 知道 `.venv` 是什么、为什么要激活它

### 2.5 不知道才补

| 卡在哪 | 补什么 | 去哪里补 |
| --- | --- | --- |
| 不知道虚拟环境和 pip 是什么 | Python 环境管理入门 | 官方教程或任意 Python 入门课的环境章节 |
| 不知道"张量"（tensor）是什么 | PyTorch 张量基础 | PyTorch 官方 60 分钟入门教程的前半部分 |
| 不知道 `pip install -e .` 在干什么 | 可编辑安装 / setup.py | 查 setup.py 内容 + 搜"pip editable install" |

---


## 3. 阶段 1：跑通 demo——第一次看到 GPT 学会一件事
### 3.1 任务是什么

`demo.ipynb` 训练一个微型 GPT 解决**排序问题**：给它一串由 0/1/2 组成的长度 6 的序列，它要输出排好序的序列（例如输入 `[2,0,1,0,2,1]`，输出 `[0,0,1,1,2,2]`）。这是 karpathy 特意选的"玩具任务"——小到一分钟能跑完，又足够让你看到"学习"发生。

### 3.2 动手：运行 demo

```powershell
jupyter notebook demo.ipynb
```

按顺序运行所有单元格，重点观察：

1. 模型实例化时打印的 `number of parameters: xxM`
2. 训练中 loss 从多少开始、往哪个方向走
3. 最后 `eval_split` 打印的 `final score: xx/xx = xx% correct`
4. 最后一段"GPT claims that ... is ... but gt is ..."的报错样例

如果不想用 jupyter，也可以把 notebook 转成脚本再跑：

```powershell
jupyter nbconvert --to script demo.ipynb
python demo.py
```

### 3.3 预期观察（心里有个数）

- 数字只有 3 种，随机猜的 loss 是 `ln(3) ≈ 1.10`，所以 loss 从接近 1.1 开始是正常的。
- 2000 次迭代后 loss 应该降到很低（0.1 以下甚至更低），训练/测试正确率接近 100%。
- 排序任务本身是"确定性的"，所以模型最终可以做到几乎完美——这和后面 chargpt 那种"只能模仿"的任务形成对比，先记住这个区别。

### 3.4 读码：demo 里发生了什么

把 `demo.ipynb` 里的代码和 `mingpt/trainer.py`、`mingpt/model.py` 对照着看，回答这 4 个问题：

1. `SortDataset` 的 `x` 和 `y` 分别是什么？（提示：`x` 是"输入+输出"拼接的 11 个数字，`y` 是每个位置"下一个数字"）
2. `get_block_size()` 为什么返回 `length * 2 - 1`？
3. 训练用的模型是哪一行代码创建的？用了多大模型？
4. `eval_split` 里 `model.generate(inp, n, do_sample=False)` 的 `do_sample=False` 意味着什么？

### 3.5 改造实验（每个都做，每个都要记录结果）

1. 把 `max_iters` 从 2000 改成 200，看 loss 和正确率差多少。
2. 把 `model_type` 从 `'gpt-nano'` 改成 `'gpt-micro'` 或 `'gpt-mini'`，对比参数量和训练速度。
3. 把排序长度 `length=6` 改成 `length=10`，看难度如何变化。
4. （进阶）把 `num_digits=3` 改成更大的数，观察 loss 起点变化。

### 3.6 复盘问题

- 用你自己的话写一段"GPT 在排序任务上是怎么工作的"。
- 为什么 loss 是"越低越好"？loss 和正确率是一回事吗？
- `do_sample=False` 时模型怎么选出下一个数字？（提示：概率最高的那个）

### 3.7 过关标准

- [ ] 能画出 x、y 在第 3.4 节第 1 问中的样子（手写一行例子即可）
- [ ] 能说出改 `max_iters`、`model_type`、`length` 各自带来了什么变化
- [ ] 能解释 loss ≈ 1.10 这个数字是怎么来的

### 3.8 不知道才补

| 卡在哪                                 | 补什么                             | 去哪里补                               |
| ----------------------------------- | ------------------------------- | ---------------------------------- |
| 看不懂 `x, y = train_dataset[0]`       | PyTorch Dataset 概念              | 查 `torch.utils.data.Dataset` 文档    |
| 不知道 loss 为什么是 1.10                  | softmax 与交叉熵（只要直觉：预测分布和真实答案的差距） | 搜"cross entropy 直观理解"，看一个图即可，不用推公式 |
| 看不懂 `model.generate(...)`           | 自回归生成：一个 token 一个 token 地往后猜    | 先看 3.4 的代码注释，再去看阶段 2 的 generate 小节 |
| 不知道 `zip(x,y)`、f-string、`enumerate` | Python 基础语法                     | 任意 Python 快速教程的对应小节                |

---


## 4. 阶段 2：逐行拆解 model.py——GPT 的完整数据流
这是整个方案**最重要**的阶段。目标：对 `mingpt/model.py` 的每个类、每一行关键代码都能说出"它拿到什么、输出什么"。

### 4.1 动手：当一次"形状侦探"

写一个小脚本 `notes/shapes.py`（或在 notebook 里），实例化一个 gpt-nano，然后**在每层之后打印张量形状**：

```python
import torch
from mingpt.model import GPT

cfg = GPT.get_default_config()
cfg.model_type = 'gpt-nano'
cfg.vocab_size = 3
cfg.block_size = 11
model = GPT(cfg)

idx = torch.randint(0, 3, (2, 11))  # (batch, time)
print("input shape:", idx.shape)

# 手工复刻 forward 的前几步，观察形状
tok_emb = model.transformer.wte(idx)
print("token embedding:", tok_emb.shape)
pos = torch.arange(0, 11).unsqueeze(0)
pos_emb = model.transformer.wpe(pos)
print("position embedding:", pos_emb.shape)
x = tok_emb + pos_emb
print("sum:", x.shape)

# 进入第一个 Transformer 块，逐子层打印
block = model.transformer.h[0]
print("ln_1:", block.ln_1(x).shape)
print("attn:", block.attn(block.ln_1(x)).shape)
print("mlp:", block.mlpf(block.ln_2(x)).shape)
```

运行后，你应该能看到一条完整的形状链：`(2,11) → (2,11,48) → ... → (2,11,3)`（最后一步是 lm_head 把 48 维映射回 3 个词表）。

### 4.2 读码：model.py 的五个块

按下面的顺序读，每一块读完后在纸上/笔记里写一句"这个模块的作用"：

1. **`GPT.forward`**（入口）：token embedding + position embedding → dropout → 一堆 Block → LayerNorm → `lm_head` 得到 logits。有 targets 时算交叉熵 loss（注意 `ignore_index=-1`：`-1` 的位置不计入 loss，这会在 adder 里用到）。
2. **`Block`**：残差 + 前置 LayerNorm 结构。`x = x + attn(ln_1(x))`，再 `x = x + mlp(ln_2(x))`。MLP 把维度先放大 4 倍再缩回来（`c_fc → GELU → c_proj`）。
3. **`CausalSelfAttention`**（最难，慢慢啃）：
   - `c_attn` 一个 Linear 同时算 q、k、v（输出 3 倍维度再 `split`）
   - `view + transpose` 把多头拆开：`(B, T, C) → (B, n_head, T, head_size)`
   - `att = (q @ k^T) / sqrt(head_size)`，然后用 `bias`（下三角矩阵）把右上角填成 `-inf`，softmax 后就变成"只能看左边"
   - `att @ v` 聚合信息，再 `transpose + contiguous + view` 拼回原形状，过 `c_proj` 输出
4. **`NewGELU`**：激活函数，一个公式，不用深究数学，知道它是"非线性"即可。
5. **`generate`**：循环 `max_new_tokens` 次——取最后 `block_size` 个 token 前向，取出最后一个位置的 logits，除以 temperature，可选 top_k 裁剪，softmax 变概率，采样或取最大，拼回序列。**这一小段就是 GPT 生成文本的全部原理。**

### 4.3 读码：三个容易忽略的细节

- `register_buffer("bias", torch.tril(...))`：因果掩码存在模型的 buffer 里，会跟着模型搬设备（`.to(device)`），但**不会**被当作参数更新。
- `configure_optimizers`：把参数分成"要 weight decay 的"（Linear 的 weight）和"不 decay 的"（bias、LayerNorm、Embedding 的参数）。这是 GPT 系模型的常见做法。
- 权重初始化：全用 `N(0, 0.02)`，但残差投影（`c_proj.weight`）额外缩小到 `0.02/sqrt(2*n_layer)`，这是 GPT-2 论文里的技巧，防止层数加深后方差爆炸。

### 4.4 改造实验（本阶段核心）

1. **删掉因果掩码**：把 `CausalSelfAttention` 里 `masked_fill` 那行注释掉，重新训练 demo 的排序任务。观察 loss 会不会掉得更快（提示：模型能"偷看答案"了）。再改回去。
2. **验证 `assert config.n_embd % config.n_head == 0`**：把 `n_head` 改成不整除的数，看报错，理解这个断言保护了什么。
3. **temperature 实验**：单独写 10 行脚本，用训练好的排序模型对同一个输入，分别用 `temperature=0.1 / 1.0 / 5.0` 生成，看输出差异。
4. **top_k 实验**：同样输入，`top_k=1` 和 `top_k=None` 对比。
5. **可视化 attention**：把某个 token 的 attention 权重矩阵（`att` 那个形状 `(B, n_head, T, T)` 的矩阵）打印成热力图，观察第 4 个 token 只能"看"前 4 列。

### 4.5 复盘问题

- 输入 `(B, T)` 的整数序列，经过整个模型，每一层形状怎么变？画出来。
- 为什么 q、k、v 要拆成多头？多头在代码里体现在哪个维度？（提示：看 `view` 之后是 `(B, nh, T, hs)`）
- 为什么 attention 要除以 `sqrt(head_size)`？（提示：维度大了点积会很大，softmax 会饱和）
- `generate` 里为什么要 `idx[:, -self.block_size:]` 裁剪？

### 4.6 过关标准

- [ ] 不看代码能写出 `(B,T) → logits` 的形状链
- [ ] 能解释因果掩码在代码里的哪一行、为什么需要
- [ ] 能说出 temperature 和 top_k 在代码里各改了什么
- [ ] 做过至少 2 个改造实验并记录了结果

### 4.7 不知道才补

| 卡在哪                             | 补什么                                     | 去哪里补                                       |
| ------------------------------- | --------------------------------------- | ------------------------------------------ |
| 看不懂 `q @ k.transpose(-2,-1)`    | Python 的 `@` 运算符 = 矩阵乘法；PyTorch 张量乘法与广播 | 搜"numpy broadcasting"，再看 `torch.matmul` 文档 |
| 看不懂 `view/transpose/contiguous` | PyTorch 张量形状操作                          | PyTorch 官方教程"Tensor basics"部分              |
| 不知道 softmax 在干嘛                 | softmax：把一堆数变成和为 1 的概率                  | 阶段 3.8 的交叉熵材料里顺带看                          |
| 不懂 `ln_1`、`ln_2` 的 LayerNorm    | 归一化：把每个向量拉回标准范围，稳定训练                    | 搜"LayerNorm 直觉"，看一页就够                      |
| 不懂 `torch.no_grad()`            | 推理时不需要算梯度，省内存                           | 搜"torch.no_grad 作用"                        |
| 不懂 `register_buffer`            | 和参数的区别：buffer 不更新但随模型迁移                 | 搜"pytorch register_buffer 与 parameter 区别"  |
| 不懂残差连接                          | 残差：`x + f(x)`，让梯度有"近路"可走                | 搜"residual connection 直觉"                  |

---


## 5. 阶段 3：读懂训练循环 trainer.py
### 5.1 动手：给训练加上"仪表盘"

用阶段 1 的 demo，在 `batch_end_callback` 里额外打印：

```python
total_norm = 0.0
for p in model.parameters():
    if p.grad is not None:
        total_norm += p.grad.norm().item() ** 2
print("iter", trainer.iter_num, "loss", trainer.loss.item(), "grad_norm", total_norm ** 0.5)
```

观察：loss 和梯度范数在训练早期、中期各是什么量级。

### 5.2 读码：trainer.py 的三个关键点

1. **无限数据流**：`RandomSampler(replacement=True, num_samples=int(1e10))`——每次都随机抽样，所以理论上永远取不完，这正是 `max_iters` 控制训练长度的原因。
2. **训练一步的固定套路**：`model(x, y)` 算 loss → `zero_grad(set_to_none=True)` → `loss.backward()` → `clip_grad_norm_(..., 1.0)` → `optimizer.step()`。这五行就是深度学习的"标准五连"，任何框架都是这个顺序。
3. **回调机制**：`set_callback('on_batch_end', fn)` / `trigger_callbacks`——每跑完一个 batch 调用你注册的函数。demo、chargpt、adder 的"每 N 步打印/评测/保存"全靠它。

### 5.3 改造实验

1. 把 `learning_rate` 从 `5e-4` 改成 `5e-6` 和 `5e-2`，各跑一次 demo，对比 loss 曲线（一个学不动，一个可能震荡/发散）。
2. 把 `grad_norm_clip` 改成 `0.01`，看训练是否变慢（梯度被裁剪得太狠）。
3. 把 `weight_decay` 改成 `0`，观察最终 loss 的细微差别。

### 5.4 复盘问题

- 为什么同一批参数要被拆成"decay / no_decay"两组？
- `max_iters=None` 时训练会发生什么？（提示：跑不停，只能 Ctrl+C）——chargpt 和 adder 默认就是 None，提前知道。

### 5.5 过关标准

- [ ] 能默写"标准五连"并说明每一步在干嘛
- [ ] 能解释 `RandomSampler(replacement=True, num_samples=1e10)` 的效果
- [ ] 完成至少 1 个学习率实验并记录了现象

### 5.6 不知道才补

| 卡在哪 | 补什么 | 去哪里补 |
| --- | --- | --- |
| 不知道反向传播是什么 | 梯度下降直觉（不用会推链式法则） | 搜"梯度下降 3Blue1Brown"，看可视化 |
| 不知道 AdamW | 一种优化器，给每个参数自适应学习率 | 搜"Adam optimizer 直观理解" |
| 不知道 weight decay | 让权重向 0 收缩，防止过拟合 | 搜"weight decay L2 正则化 直觉" |
| 不知道梯度裁剪 | 把过大的梯度拉回上限，防止训练爆炸 | 搜"gradient clipping" |

---


## 6. 阶段 4：训练自己的字符级语言模型（chargpt）
> 从这一阶段开始，你训练的模型"学会"的是**模仿**，而不是"做对某道题"。语言模型的目标只有一个：预测下一个字符。一切神奇都来自这一点。

### 6.1 动手：准备数据

chargpt 需要一个 `input.txt`（放在 `projects/chargpt/` 目录下）。建议用**中文语料**，例如：

- 一首诗的纯文本（几百行即可）
- 几十首歌词
- 你自己的聊天记录/日记（注意隐私）
- 或英文经典小数据集 tinyshakespeare（`https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt`，需要联网下载）

数据大小参考：几百 KB 到几 MB 都行，几 KB 也能跑（只是效果差）。**编码用 UTF-8**。

### 6.2 动手：训练

```powershell
cd projects\chargpt
python chargpt.py --trainer.max_iters=5000
```

> 重要：`chargpt.py` 默认 `max_iters=None`，会无限训练。上面用命令行参数限制为 5000 次；如果忘加，训练满意后按 `Ctrl+C` 停止即可。

观察：

- 每 10 步打印一次 loss；每 500 步打印一次用 `"O God, O God!"` 当开头生成的 500 个字符（注意：这个开头是英文的，如果语料是中文，开头字符不在词表里会报错，见 6.4 实验 4）
- `./out/chargpt/model.pt` 会被保存

### 6.3 读码：chargpt.py

重点读 `CharDataset`：

- `__len__` 为什么是 `len(data) - block_size`？
- `__getitem__` 里 `x = dix[:-1]`、`y = dix[1:]`：每个位置预测**下一个**字符，这就是"自回归"。
- `stoi` / `itos` 两个字典是字符 ↔ 整数编号的桥梁，词表大小 = 语料里不同的字符数。

### 6.4 改造实验（挑至少 3 个做）

1. **temperature 对比**：把采样代码里的 `temperature=1.0` 改成 `0.5` 和 `1.5`，对比生成文本的风格（低温度更"死板"，高温度更"胡言乱语"）。
2. **top_k 对比**：`top_k=10` vs `top_k=1` vs 去掉 top_k。
3. **模型大小**：`--model.model_type=gpt-nano` vs `gpt-mini`，对比训练速度、loss、生成质量。
4. **换开头**：把回调里的 `context = "O God, O God!"` 改成中文语料里真实出现过的几个字，观察生成是否接得上。如果直接报错，想想为什么（提示：`stoi` 里没有这个字符）。
5. **block_size**：`--data.block_size=64` vs `128`，观察 loss 和生成的长程连贯性。

### 6.5 复盘问题

- 训练 loss 最后停在多少？如果把它换算成"平均猜对概率"（`e^{-loss}`），大概是多少？
- 生成的文本"像不像"语料？哪里像、哪里不像？
- 模型在"背"语料还是在"学规律"？怎么判断？（提示：看它会不会输出语料里没有的组合）

### 6.6 过关标准

- [ ] 成功训练一个字符模型并保存了 checkpoint
- [ ] 用至少两种 temperature/top_k 生成过文本并比较
- [ ] 能解释"语言模型 = 预测下一个字符"和 loss 的关系

### 6.7 不知道才补

| 卡在哪 | 补什么 | 去哪里补 |
| --- | --- | --- |
| 不知道"语言建模"任务 | 自回归语言模型目标：最大化 P(下一个字符|上文) | 看 GPT-1 论文的 1~2 页摘要，或搜"language modeling 直觉" |
| 不知道过拟合 | 模型记住了训练数据、但泛化变差 | 搜"overfitting vs underfitting" |
| 不知道 perplexity | `2^loss`（或 `e^loss`）：困惑度，越小越好 | 阶段 6.5 已给出公式，想深挖再搜 |
| 中文按"字"建模 vs 按"词"建模 | 字符级最简单，词级需要分词 | 阶段 7 的 BPE 会展开 |

---


## 7. 阶段 5：精确任务——加法 adder
### 7.1 为什么做这个

语言模型能"写诗"，但加法要求**精确正确**，一丁点错都不行。这个项目让你体会：数据怎么编码、任务怎么设计，直接决定模型能不能学会。

### 7.2 先读编码（这是本阶段最关键的理解）

看 `AdditionDataset` 的注释和代码。以 `85 + 50 = 135` 为例：

- 丢掉 `+` 和 `=`，输入是 `"85" + "50"`，结果**倒过来**写：`"531"`
- 完整序列：`"8550531"`（用 0 补齐到固定长度）
- 为什么要倒序？因为加法的进位是从低位往高位走的，倒序让"下一步该预测什么"变得顺序自然
- `y[:ndigit*2-1] = -1`：输入部分的"下一个字符"位置全部置为 `-1`，配合 `model.forward` 里 `ignore_index=-1`，模型只在输出部分学

### 7.3 动手：训练 2 位数加法

```powershell
cd projects\adder
python adder.py --trainer.max_iters=3000
```

每 500 步会打印 train/test 的正确率，并保存当前最优模型。预期：2 位数加法几千步内正确率可达 90%+，最终接近 100%。

### 7.4 改造实验

1. **加大难度**：`python adder.py --data.ndigit=3 --trainer.max_iters=10000`，观察正确率天花板明显下降（3 位数加法对这么小的模型很难）。
2. **缩减数据**：把 `num_test = min(int(num*0.2), 500)` 的 20% 改成更小，看测试集正确率是否崩（过拟合）。
3. **延长训练**：2 位数加法跑到 10000 步，看正确率能否到 100%。

### 7.5 复盘问题

- loss 很低但正确率不是 100%，说明什么？（提示：loss 是"平均错多少"，正确率是"全对才赢"）
- 倒序编码在实验里到底起了多大作用？如果去掉倒序，猜测会发生什么（可以试试）。
- 精确任务和 chargpt 的模仿任务，训练目标有区别吗？（提示：没有，都是 next-token prediction）

### 7.6 过关标准

- [ ] 能徒手写出 `6 + 39 = 45` 在代码里的编码序列
- [ ] 训练过 2 位数加法并记录最终正确率
- [ ] 能解释 `ignore_index=-1` 的作用

### 7.7 不知道才补

| 卡在哪 | 补什么 | 去哪里补 |
| --- | --- | --- |
| 不懂 `%0{ndigit}d` 这种写法 | Python 字符串格式化 | 搜"python format spec %0Nd" |
| 不懂"任务设计影响学习难度" | 表示学习 / 数据编码 | 先做实验（倒序 vs 正序），体会比看书快 |
| 不懂训练集/测试集划分 | 评估模型要考"没见过的题" | 搜"train test split" |

---


## 8. 阶段 6：加载预训练 GPT-2 生成文本
### 8.1 先改两个默认值（重要）

`generate.ipynb` 默认 `model_type = 'gpt2-xl'`（15 亿参数，笔记本 CPU 基本跑不动）且 `device = 'cuda'`（没有 GPU 会直接报错）。打开 notebook 把前两行改成：

```python
model_type = 'gpt2'   # 最小号的 GPT-2，1.24 亿参数
device = 'cpu'        # 没有 NVIDIA GPU 就用 cpu
```

还需要安装 transformers 并联网下载权重（首次运行会自动下载，约 500MB）：

```powershell
pip install transformers
```

### 8.2 动手：生成

按顺序运行所有单元格，观察 `generate(prompt='Andrej Karpathy, the', ...)` 的输出。然后自己写几个 prompt 试试，比如：

- 中文 prompt（注意：GPT-2 的 BPE 词表以英文为主，中文效果一般，正好可以体会分词器的语言偏向）
- 空 prompt（无条件生成，代码里用 `<|endoftext|>` 开头）

### 8.3 读码：两条路线

`use_mingpt = True` 时走 minGPT 自己的 `GPT.from_pretrained` + `BPETokenizer`；`use_mingpt = False` 时走 huggingface 的现成实现。**功能等价**。重点看 `from_pretrained`（`mingpt/model.py` 里）：

- 它用 transformers 的 `GPT2LMHeadModel` 加载官方权重，再逐 key 拷贝进 minGPT 模型
- 有 4 个名字以 `attn.c_attn.weight` 等结尾的权重需要**转置**（OpenAI 用的是 Conv1D，minGPT 用 nn.Linear）
- 全程有 `assert` 保证形状对齐——这就是"从框架 A 移植到框架 B"的标准做法

### 8.4 动手：理解 BPE 分词

读 `mingpt/bpe.py`，回答：

- 为什么 GPT 不用"字符级"或"单词级"，而用子词（BPE）？
- `BPETokenizer` 的 `encoder` 和 `bpe_merges` 分别是什么？
- 用 `tokenizer.encode_and_show_work("hello world")` 看一个词是怎么被拆成子词的。

### 8.5 改造实验

1. `temperature` 在 `generate` 函数里是 `do_sample` 下的采样温度，把它改成 `0.5` 和 `2.0`，对比"重复率"和"流畅度"。
2. `top_k=40` 改成 `1` 和 `200`。
3. `model_type` 改成 `gpt2-medium`（CPU 上会很慢，量力而行），对比生成质量。
4. 把 `use_mingpt` 切换成 `False`，确认输出一致，理解两种实现等价。

### 8.6 复盘问题

- GPT-2 是怎么做到"给它一个开头，它就能继续写"的？代码里哪几行是关键？
- BPE 相比字符级分词，好处是什么、代价是什么？

### 8.7 过关标准

- [ ] 成功加载 gpt2 权重并生成过文本
- [ ] 能说出 `from_pretrained` 里"转置"那几行在解决什么问题
- [ ] 能解释 BPE 的"合并"思想（不用会背算法细节）

### 8.8 不知道才补

| 卡在哪 | 补什么 | 去哪里补 |
| --- | --- | --- |
| 不知道子词是什么 | BPE 分词直觉 | 搜"BPE tokenizer 图解" |
| 不知道 transformers 是什么 | 一个装满了预训练模型的库，这里只借它下载 GPT-2 权重 | 了解它是工具即可，不用深入 |
| 网络下载失败 | 离线方案 | 见 8.9 |

### 8.9 网络受限时的替代方案

如果下载权重失败：跳过本阶段，把省下的时间用在阶段 4/5 的改造实验上；或者改用本地自训练的 chargpt 模型做"加载 checkpoint → 续训 → 生成"的流程（这本身就是很好的练习）。

---


## 9. 阶段 7（可选）：自选项目
完成主线后，从下面挑一个（或自拟）：

1. **中文古诗生成器**：找几百首五言/七言诗的纯文本，用 chargpt 训练，看它能不能押韵、对仗（大概率不能，但观察"它学到了什么"很有价值）。
2. **网名/昵称生成器**：收集一批中文昵称，训练后采样，做"不重名的网名"小工具。
3. **排序任务变体**：在 demo 基础上改成"去重"、"逆序"、"按奇偶排序"，观察难度差异。
4. **加法升级**：把 adder 的编码改成正序，量化正确率下降多少，写进笔记。
5. **终极挑战：不看参考代码，从零写一个 150~250 行的小 GPT**（Embedding + 自注意力 + MLP + 训练循环 + 生成），用 demo 的排序任务验证。写完后和 `mingpt/model.py` 对照，记录你的取舍。

每个项目建议 2~4 小时，做完写一页"项目报告"（目标、数据、结果、失败点、改进想法）。

---


## 10. 按需补充知识总索引
出现下列问题的时候再来看这张表；没遇到就先不管。

| 触发场景 | 知识点 | 类型 | 最低要求 |
| --- | --- | --- | --- |
| 看不懂 loss 从 1.1 开始 | 交叉熵、softmax | 数学 | 直觉即可，不推公式 |
| 看不懂注意力矩阵 | 点积注意力、除以 sqrt(d) | 数学 | 能说出"为什么除"即可 |
| 想理解"只能看左边" | 因果掩码、自回归 | 数学 | 能画出掩码矩阵 |
| 想理解训练在做什么 | 梯度下降、反向传播 | 数学 | 3Blue1Brown 级别的直觉 |
| 想理解优化器参数 | AdamW、weight decay、学习率 | 数学 | 知道每个超参"调大调小会怎样" |
| 想量化生成质量 | perplexity | 数学 | 会用 `e^loss` 估算 |
| 看不懂张量形状操作 | view / transpose / contiguous / 广播 | 语法（PyTorch） | 会看官方文档例子 |
| 看不懂 `@`、`*`、`**` | Python 运算符 | 语法 | 查一遍即可 |
| 看不懂 `register_buffer` | PyTorch buffer | 语法 | 知道和 Parameter 的区别 |
| 看不懂 `lambda` / `staticmethod` / `classmethod` | Python 语法 | 语法 | 各看一个例子 |
| 不懂数据集怎么喂给模型 | Dataset / DataLoader | 语法（PyTorch） | 会用 `len` 和下标取样本 |
| 看不懂 `torch.no_grad()` | 推理模式 | 语法（PyTorch） | 知道省内存即可 |
| 好奇 token 是什么 | BPE / 子词分词 | 概念 | 阶段 8 的动手实验 |
| 好奇 GPT 和 Transformer 的关系 | Transformer 架构 | 概念 | 阶段 2 完成后自然清楚 |

---


## 11. 每阶段复盘模板（复制到 notes/ 使用）
```markdown
# 阶段 X 复盘：<主题>

## 今天跑通/完成了什么
（贴关键输出：loss、正确率、生成文本片段）

## 我改造了什么，结果如何
（参数、预期、实际结果、我的解释）

## 我现在能解释
- 1.
- 2.

## 我还解释不了 / 卡住了
- 1.（写下来，去补对应知识点）

## 下一步
（下一阶段的第一个动手任务）
```

### 总检查清单（全部完成后打勾）

- [ ] 阶段 0：环境可跑，单元测试通过
- [ ] 阶段 1：排序任务训练+评测完成，loss 从 ~1.1 明显下降
- [ ] 阶段 2：能画出完整形状链，做过掩码/采样实验
- [ ] 阶段 3：能默写"标准五连"，做过学习率实验
- [ ] 阶段 4：自己的字符模型训练+生成完成
- [ ] 阶段 5：加法任务训练+评测完成
- [ ] 阶段 6：GPT-2 权重加载+生成完成
- [ ] 每阶段笔记已写入 notes/
- [ ] （可选）阶段 7：至少一个自选项目

---


## 附：参考资源（按需取用，不是必读清单）
- 本仓库 README.md：GPT-1/2/3 的实现要点摘录（有中文混排，直接读英文部分也行）
- karpathy 的 [nanoGPT](https://github.com/karpathy/nanoGPT)：minGPT 的现代版，学完后可作下一站
- "The Illustrated Transformer"（Jay Alammar）：可视化讲解，阶段 2 卡住时看
- 《Attention Is All You Need》（Transformer 原论文）：阶段 2 完成后可精读
- GPT-1 论文《Improving Language Understanding by Generative Pre-Training》：阶段 4/5 后可读
- GPT-2 论文《Language Models are Unsupervised Multitask Learners》：阶段 6 后可读


---


## 自动关联
> 以下列表由 Dataview 自动生成，勿手工编辑。改关系请改 frontmatter 的 `sources` / `related` / `prerequisites`。

### 本项目引用的知识

```dataview
LIST WITHOUT ID R
FROM "wiki/projects"
WHERE file.path = this.file.path
FLATTEN (sources + related) AS R
SORT R ASC
```

### 引用本项目的资源

```dataview
LIST
FROM "wiki/resources"
WHERE contains(related, this.file.link) OR contains(sources, this.file.link)
SORT file.name ASC
```

### 前置项目

```dataview
LIST WITHOUT ID P
FROM "wiki/projects"
WHERE file.path = this.file.path
FLATTEN prerequisites AS P
```

### 后继项目

```dataview
LIST
FROM "wiki/projects"
WHERE contains(prerequisites, this.file.link)
```
