# 自学文档 0（补）：WSL 实操衔接手册

> [!abstract] 这份文档补的是什么断点
> [[自学文档0-命令行前置知识]] 讲「命令行是什么、有哪些命令」，[[自学文档0（下）-项目0核心内容-系统观察与工具入门]] 讲「项目 0 要观察什么」。两份文档都默认你**已经坐在一个 Linux 终端里**。这份手册补的正是中间那段路：从 Windows 桌面到实验真正跑起来的那一步——怎么进 WSL、文件放哪、C 文件怎么建出来、装了什么还没装什么、每条命令敲下去应该看到什么、报错了怎么判断。
>
> 全文的路径、版本、输出都来自**你这台机器的实测**（2026-10-02），不是通用教程的推测。凡是与你机器现状有关的结论，都标了「实测」。

> [!info] 使用方式
> 第 0—2 章是环境落地（一次做完，约 20 分钟）；第 3—4 章解决「文件放哪、怎么建」；**第 5 章是练功房，配合两份手册边做边用**；第 7 章是「文档写的 vs 你机器上的」差异清单，读手册时对不上号就来这里查；第 8 章是报错速查。

## 目录

| **章节** | **内容** | **解决的问题** |
| --- | --- | --- |
| 第 0 章 | 你机器上的真实家底 | 我到底有什么环境？ |
| 第 1 章 | 从 Windows 进 Linux | 终端从哪开、怎么知道自己在哪一层 |
| 第 2 章 | 第一次配置与验证 | 缺什么、怎么装、怎么确认装对了 |
| 第 3 章 | 文件放哪：两套路径与跨界动作 | 代码、库、日志各该放哪里 |
| 第 4 章 | 从零建一个 C 文件的三种写法 | 「建一个 main.c」具体怎么落手 |
| 第 5 章 | 十步练功房（含实测输出） | 命令敲下去对不对，怎么知道 |
| 第 6 章 | 把输出变成 Obsidian 里的证据 | 实验记录怎么归档 |
| 第 7 章 | 文档 ↔ 现实差异清单 | 手册里对不上的地方 |
| 第 8 章 | 报错速查 | 红字怎么读 |

## 第 0 章 先钉住四个锚点

| **锚点** | **你机器上的实际情况（实测）** |
| --- | --- |
| 系统与架构 | Windows 11 + WSL2，唯一发行版 **Ubuntu 24.04.4 LTS**（x86-64），内核 `6.6.87.2-microsoft-standard-WSL2`，主机名 `legionShane` |
| Linux 身份 | 用户名 `lenovo`，家目录 `/home/lenovo`，登录 shell 是 **zsh**（不是 bash） |
| 三块地盘 | Linux 家目录 `~` ／ Windows C: 挂在 `/mnt/c`、D: 挂在 `/mnt/d` ／ Obsidian 库在 `/mnt/c/Users/Lenovo/Documents/MyKnowledgeVault` |
| 目录约定（本课程） | 代码与产物放 `~/project0`；**证据（日志）写回** `lessons/操作系统基础/project0-证据/` |

### 0.1 工具家底（实测，全部逐条查过）

| **工具 / 软件包** | **状态** | **说明** |
| --- | --- | --- |
| gcc | ✅ 已有 | `gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0` |
| build-essential | ✅ 已有 | 含 make、libc 头文件；**不必再装** |
| binutils | ✅ 已有 | 提供 `objdump`、`as`、`ld`、`readelf` |
| gdb | ✅ 已有 | `GNU gdb (Ubuntu 15.1-1ubuntu1~24.04.1)` |
| man-db | ✅ 已有 | `man` 可用 |
| nano / vim / file / ps / readlink | ✅ 已有 | 编辑器与基础工具齐 |
| **strace** | ❌ **缺** | apt 候选 6.8-0ubuntu2；项目 0 必用，见第 2 章 |
| **tree** | ❌ 缺 | apt 候选 2.1.1-2ubuntu3.24.04.2；可选（手册也给了 `ls` 替代） |
| dos2unix | ❌ 缺 | 可选，专治第 3.4 节的换行符问题 |
| ltrace | ❌ 缺 | 本课程不需要 |

> [!tip] 一句话结论
> 项目 0 的环境**只差 strace 一个**（tree、dos2unix 是顺手装）。所以第 2 章其实很短——真正的断点在「文件怎么放、命令对不对」上。

## 第 1 章 从 Windows 进到 Linux

### 1.1 三种进入方式（任选）

| **方式** | **操作** | **什么时候用** |
| --- | --- | --- |
| Windows Terminal（推荐） | 开始菜单搜「终端」→ 顶部标签栏的下拉箭头 → 选 **Ubuntu** | 日常主力；可以开多个标签页（做 `/proc`、`ps` 实验时必须有两个以上） |
| PowerShell / cmd 里敲 `wsl` | 直接进入默认发行版（你只有 Ubuntu，就是它） | 顺手一试；也方便在 Windows 侧临时跑一条 Linux 命令 |
| VS Code 里 `` Ctrl+` `` | 打开集成终端，自动连到 WSL | 边写 C 边编译（配第 4.3 节） |

实测：Windows Terminal（`wt.exe`）和 VS Code 都已安装，路径分别是
`/mnt/c/Users/Lenovo/AppData/Local/Microsoft/WindowsApps/wt.exe` 和 `/mnt/c/Users/Lenovo/AppData/Local/Programs/Microsoft VS Code/bin/code`。

### 1.2 进去以后：先确认自己站在哪一层

你的提示符长这样（zsh + oh-my-zsh 的 robbyrussell 主题）：

```text
➜  ~
```

注意：**手册第 1.2 节写的 `$`（普通用户）/ `#`（root）是 bash 的风格，你的提示符里没有 `$`**。所以判断身份不要靠提示符，靠命令：

| **判据** | **Windows (PowerShell)** | **Ubuntu (WSL)** |
| --- | --- | --- |
| `whoami` | `legionshane\lenovo`（带主机名） | `lenovo`（单独一个词） |
| `uname -a` | 报错，不认识这条命令 | `Linux legionShane 6.6.87.2-microsoft-standard-WSL2 … GNU/Linux` |
| `ls /mnt/c` | 报错 | 列出 C 盘内容 |
| 提示符形态 | `PS C:\Users\Lenovo>` | `➜  ~` |
| 路径写法 | `C:\Users\Lenovo` | `/home/lenovo`、`/mnt/c/Users/Lenovo` |

> [!info] 为什么这很重要
> 本课程的命令 99% 只在 Ubuntu 里敲。最常见的自伤是：在 PowerShell 里敲 `ls -l`（PowerShell 里 `ls` 是 `Get-ChildItem` 的别名，`-l` 会报错），然后怀疑自己学错了。**先看提示符或敲一次 `whoami`，再开始输入。**

### 1.3 开关机命令（在 PowerShell 里敲）

```powershell
wsl -l -v                              # 列出发行版与状态（你现在会看到：Ubuntu / Stopped / 2）
wsl                                    # 进入默认发行版
wsl -d Ubuntu                          # 指定发行版进入
wsl --shutdown                          # 彻底关掉 WSL（改过 /etc/wsl.conf、网络抽风时用）
wsl -d Ubuntu -u root passwd lenovo     # 忘掉 Linux 密码时，用 root 身份重设（不需要旧密码）
```

```bash
exit                                    # 在 Ubuntu 里敲：退出，回到 Windows
```

> [!warning] Ubuntu 一直显示 Stopped 是正常的
> WSL 是「按需启动」：点开 Ubuntu 标签它就起，关掉所有终端窗口、空闲一会儿它自己停。**文件不会丢**，下次进入时 `cd ~/project0` 一切照旧。这不是坏了。

### 1.4 每次启动都会看到的红字：可以无视

从 PowerShell 启动 wsl 时你稳定会看到这句（实测）：

```text
wsl: 检测到 localhost 代理配置，但未将其镜像到 WSL。NAT 模式下的 WSL 不支持 localhost 代理。
```

原因：Windows 里设了 HTTP 代理，而 WSL 默认用 NAT 网络模式，代理不会自动带进来。对本课程（纯本地编译与观察）**完全无影响**。以后若遇到 apt 下载慢或联网实验失败再处理：在 WSL 里单独设代理环境变量，或在 Windows 的 `%UserProfile%\.wslconfig` 里写

```ini
[wsl2]
networkingMode=mirrored
```

然后 `wsl --shutdown` 重启（需 Windows 11 较新版本）。**现在不用管。**

### 1.5 手册第 1.3 节的「救命键」在你的终端里的实际行为

| **手册写的** | **Windows Terminal 里的实际行为** | **注意** |
| --- | --- | --- |
| Tab 补全 | 一样；连按两次列候选 | 补全路径是你的第一生产力 |
| ↑ / ↓ 翻历史 | 一样 | — |
| Ctrl + C | 无选中文本时：中断当前命令；**有选中文本时：复制** | 想绝对不出意外，复制一律用 `Ctrl+Shift+C` |
| Ctrl + L 清屏 | 一样（等于 `clear`） | 屏幕乱了就按它 |
| Ctrl + R 搜索历史 | zsh 下同样可用（提示符变成反向搜索态） | 再按一次 Ctrl+R 继续往前找 |
| Ctrl + A / E 行首行尾 | 一样 | — |
| Ctrl + Z 挂起 | 一样（挂起 ≠ 终止，用 `fg` 调回、`kill` 结束） | 手册 6.3 节已列入易错点 |
| —（手册没写） | **粘贴用 `Ctrl+Shift+V`**（或右键） | 从文档抄长命令主要靠这个 |
| —（手册没写） | 鼠标选中文本即复制（视设置） | 适合只抄一段输出 |

**输入法提醒：**终端里输中文容易出乱码或卡住，命令、路径、文件名一律用英文/数字。

## 第 2 章 第一次配置：装 strace、验证环境

### 2.1 补齐缺的工具（约 3 分钟）

```bash
sudo apt update                    # 刷新软件包索引；第一次会要你的 Linux 密码
sudo apt install -y strace tree    # 装缺的两个；-y = 不再逐条问 yes
```

- 敲完 `sudo` 后**密码不会显示**——连星号都没有，这是正常的，打完直接回车。
- 忘了密码：回到第 1.3 节最后一行，用 `wsl -d Ubuntu -u root passwd lenovo` 重设。
- 可选：`sudo apt install -y dos2unix`（第 3.4 节会用上）。
- 装完回来验证：`which strace tree` 应输出两个 `/usr/bin/` 路径。

### 2.2 环境自检（照着敲，对照预期）

```bash
uname -a
# 预期含：6.6.87.2-microsoft-standard-WSL2 … x86_64 GNU/Linux
head -2 /etc/os-release
# 预期：PRETTY_NAME="Ubuntu 24.04.4 LTS" / NAME="Ubuntu"
whoami; echo "$HOME"; echo "$SHELL"
# 预期：lenovo / /home/lenovo / /usr/bin/zsh   ← 注意最后一个是 zsh，不是 bash
gcc --version | head -1
# 预期：gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0
gdb --version | head -1
# 预期：GNU gdb (Ubuntu 15.1-1ubuntu1~24.04.1) 15.1
which gcc gdb objdump strace tree file
# 预期：五个都给出 /usr/bin/... 路径
```

> [!tip] 想省事
> 第 6.3 节有一条「一键体检」命令，会把上面这些连日期一起写成一份 `00-环境体检.txt` 存进库里——这本身就是项目 0 要的「环境记录」证据。

### 2.3 给项目 0 一个工作目录

```bash
mkdir -p ~/project0     # -p：目录已存在也不报错
cd ~/project0
pwd                     # 预期 /home/lenovo/project0
```

> [!question] 为什么实验目录不放 `/mnt/c/...`？
> 手册（下）第 1.4 节说「放 `/mnt/c/...` 会出现有 x 权限却跑不起来的怪现象」。**实测你这台机器不完全是这样**：`/etc/wsl.conf` 里 `options=metadata`，所以 `/mnt/c` 下 `chmod +x` 真的生效，脚本也能直接跑（我实测了一个 `.sh`，正常输出）。
> 但依然建议放 `~/project0`，理由换成了更实在的两条：① 9p 文件系统读写明显更慢，反复编译时体感很差；② 大小写敏感性、换行符、权限这些「Linux 特性」在 `/mnt/c` 上会被 Windows 打折扣，你会分不清「环境的怪」和「命令的错」。**结论：代码和产物放 Linux 侧，只有要给 Obsidian 看的证据才写到 /mnt/c。**

## 第 3 章 文件放哪、两边怎么互相看见

### 3.1 两套路径对照表

| **Windows 里看到** | **WSL 里的绝对路径** | **说明** |
| --- | --- | --- |
| `C:\Users\Lenovo` | `/mnt/c/Users/Lenovo` | 你的 Windows 家目录 |
| `C:\Users\Lenovo\Documents\MyKnowledgeVault` | `/mnt/c/Users/Lenovo/Documents/MyKnowledgeVault` | **Obsidian 库**（本文档就在这里） |
| `D:\` | `/mnt/d` | 已挂载 |
| `/home/lenovo`（Linux 内部） | 在资源管理器地址栏输入 `\\wsl.localhost\Ubuntu\home\lenovo`（旧写法 `\\wsl$\Ubuntu\home\lenovo` 也可） | 反向访问 Linux 文件 |

记忆锚点（和手册第 2.2 节的三种写法对上）：`~` = 我的 Linux 地盘；`/mnt/c` = Windows 的 C 盘；**两者之间没有快捷方式，只能写全路径**。

### 3.2 三个「跨界」动作（都很常用，实测可用）

```bash
# ① 用 Windows 资源管理器打开当前 Linux 目录
explorer.exe .                      # 注意 . 不能省；会弹出资源管理器窗口

# ② 用 VS Code 打开当前目录（写 C 代码的主力方式）
code .                              # 首次可能提示装 WSL 扩展，按提示装即可

# ③ 调用 Windows 程序 / 把输出送进 Windows 剪贴板
notepad.exe main.c                  # 会用记事本打开（会带来 CRLF 问题，见 3.4，不推荐）
cat asm.txt | clip.exe              # 把文件内容塞进 Windows 剪贴板，可直接粘进 Obsidian
```

> [!info] 为什么 `explorer.exe` 能在 Linux 里敲
> 你的 `/etc/wsl.conf` 里 `[interop] enabled=true`、`appendWindowsPath=true`，所以 Windows 的 exe 按名字就能直接调用（实测 `echo $PATH` 里约有 **50 条** `/mnt/c/...` 路径）。这是 WSL 的独特福利，也是它在 PATH 查找上比真 Linux「脏」的地方：**哪天 `which 某命令` 输出的是 `/mnt/c/...` 而不是 `/usr/bin/...`，就要多看一眼自己调用的到底是谁。**

### 3.3 写 C 文件用哪个编辑器

| **方式** | **适合** | **操作要点** |
| --- | --- | --- |
| VS Code（`code .`） | 主力：写 C、看汇编、多文件 | 在 `~/project0` 里敲 `code .`；保存后回终端直接 `gcc` |
| nano | 临时小改 | `nano main.c` → 编辑 → `Ctrl+O` 回车保存 → `Ctrl+X` 退出 |
| heredoc（终端内直接写文件） | 抄现成代码、写脚本，最快 | 见第 4.1 节 |
| 记事本（notepad.exe） | **不推荐** | 它写 `\r\n`，会制造 3.4 节的坑 |

### 3.4 唯一的「经典大坑」：CRLF 换行符

Windows 换行是 `\r\n`，Linux 只要 `\n`。用 Windows 侧编辑器改过的脚本，在 WSL 里会报一条**看起来像文件丢了**的错（实测原文）：

```text
$ ./build.sh
bash: ./build.sh: cannot execute: required file not found
```

文件明明就在眼前。真正的原因：脚本第一行成了 `#!/bin/bash\r`，内核按这个名字找不到解释器。

诊断与修复：

```bash
file build.sh                 # 出现 "with CRLF line terminators" 就是它
grep -c $'\r' build.sh        # 数有几行带 \r，非 0 即有问题
sed -i 's/\r$//' build.sh     # 原地修掉（或 sudo apt install dos2unix && dos2unix build.sh）
```

**预防（比修复重要）：脚本一律在 WSL 里新建或编辑**（heredoc / nano / `code .`）。从 WSL 侧用 VS Code 打开文件时，换行符会自动按 Linux 来，不会出这个问题。

## 第 4 章 从零建一个 C 文件：三种落手方式

> 这是两份手册之间最大的断点。手册说「建一个最小项目（文件名建议就叫 main.c）」，但你手上没有图形编辑器，也没人说过文件到底怎么出现在 Linux 里。三种写法任选，**先用第一种跑通一次**。

### 4.1 最快：heredoc 一次写完

在终端里整段粘贴、回车：

```bash
mkdir -p ~/project0 && cd ~/project0

cat > main.c <<'EOF'
#include <stdio.h>

int add(int a, int b) {     // 自己写的函数：观察它的汇编
    return a + b;
}

int main(void) {
    int x = 3, y = 4;
    printf("add(3,4) = %d\n", add(x, y));
    return 0;
}
EOF

cat main.c        # 确认内容写进去了
```

读法：`cat > 文件名 <<'EOF'` 意思是「把下面输入的每一行写进这个文件，直到单独一行的 `EOF` 为止」。**`'EOF'` 外面的单引号很关键**：它阻止 Shell 提前展开 `$`，否则 C 代码里的 `%d`、宏、`$` 都可能被终端先动一遍。

### 4.2 最稳：nano

```bash
nano main.c       # 文件不存在时 nano 会新建
# 输入或粘贴代码 → Ctrl+O 回车（保存）→ Ctrl+X（退出）
```

### 4.3 最顺手：VS Code

```bash
cd ~/project0
code .            # 左侧文件树新建 main.c，写完 Ctrl+S
```

> [!tip] 三次确认胜过「我以为它在哪」
> 三种方式效果完全相同：文件都落在 `/home/lenovo/project0/main.c`。落手后立刻敲 `pwd` + `ls -l main.c` 各一次——这是拿回「我在哪、文件在哪」控制感的最廉价动作。

### 4.4 练功房一键搭建（省 20 分钟敲键盘）

把下面整段粘进 Ubuntu 终端：它建好 `~/project0`、写好 `main.c` 与可复现的 `build.sh`，跑完四步流水线，并把证据**直接存进你的 Obsidian 库**。

```bash
PRJ="$HOME/project0"
LOGDIR="/mnt/c/Users/Lenovo/Documents/MyKnowledgeVault/lessons/操作系统基础/project0-证据"
mkdir -p "$PRJ" "$LOGDIR"
cd "$PRJ"

cat > main.c <<'EOF'
#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

int main(void) {
    int x = 3, y = 4;
    printf("add(3,4) = %d\n", add(x, y));
    return 0;
}
EOF

cat > build.sh <<'EOF'
#!/bin/bash
# 项目 0 构建脚本：四步流水线；set -x 让日志里带上真正执行的命令
set -x
gcc -E main.c -o main.i
gcc -S main.c -o main.s
gcc -c main.c -o main.o
gcc -g -Wall -O0 main.c -o a.out
set +x
ls -l main.c main.i main.s main.o a.out
EOF
chmod +x build.sh

./build.sh          > "$LOGDIR/01-构建日志.txt" 2>&1
./a.out             > "$LOGDIR/02-运行输出.txt" 2>&1
objdump -d a.out    > "$LOGDIR/03-反汇编.txt"
objdump -t main.o   > "$LOGDIR/04-符号表-main.o.txt"
objdump -t a.out    > "$LOGDIR/05-符号表-a.out.txt"
file main.c main.i main.s main.o a.out > "$LOGDIR/06-file类型.txt" 2>&1

echo "完成：项目在 $PRJ，证据在 $LOGDIR"
```

跑完在 Obsidian 里应该立刻能看到 `lessons/操作系统基础/project0-证据/` 下多出 6 个文件（第 6 章讲怎么把它们变成作业内容）。

## 第 5 章 十步练功房：每条命令的「预期屏幕」

每步格式：**命令 → 你应该看到什么（实测）→ 对应手册哪一节 → 自检**。请守手册（下）开头的那条纪律：**先在纸上写预测，再敲回车**；对不上就把差异写下来。

| **Drill** | **练什么** | **对应手册** | **预估耗时** |
| --- | --- | --- | --- |
| 1 导航 | pwd / ls / cd / tree | 前手册 3.1 | 15 min |
| 2 文件操作 | mkdir / touch / cp / mv / rm | 前手册 3.2 | 15 min |
| 3 读文件 | cat / head / less / wc | 前手册 3.3 | 10 min |
| 4 权限 | chmod、读懂 rwx | 前手册 3.4 | 15 min |
| 5 管道与重定向 | `>` `>>` `2>&1` `|` | 前手册 4.1—4.2 | 20 min |
| 6 三剑客 | grep / sed / awk | 前手册 3.5 | 20 min |
| 7 四步流水线 | gcc -E/-S/-c/链接 | 下手册 1.2 | 30 min |
| 8 objdump | 符号表 + 反汇编 | 下手册 2.2、3.1 | 30 min |
| 9 gdb | 断点、寄存器、返回栈 | 下手册 4.3 | 30 min |
| 10 strace 与 /proc | 系统调用、进程身份 | 下手册 5.2、5.3 | 30 min |

### Drill 1 导航：我在哪、这里有什么

```bash
cd ~/project0
pwd                 # /home/lenovo/project0
ls                  # main.c  main.i  main.s  main.o  a.out  build.sh
ls -l               # 长格式：权限、链接数、所有者、组、大小、时间、名字
ls -lh              # 大小人性化（K/M）
ls -a               # 多出 . 和 ..（本目录暂无其他隐藏文件）
cd ..               # 回到 /home/lenovo
cd -                # 跳回 /home/lenovo/project0（「刚才那里」）
tree -L 1           # 树状图（装好 tree 后可用）
```

实测 `ls -l`（对照手册 3.1 节那张「解剖图」逐个位置看）：

```text
-rw-r--r-- 1 lenovo lenovo   162 Oct  2 16:17 main.c      ← 普通文件，权限 644
-rw-r--r-- 1 lenovo lenovo 21390 Oct  2 16:17 main.i
-rw-r--r-- 1 lenovo lenovo  1183 Oct  2 16:17 main.s
-rw-r--r-- 1 lenovo lenovo  1672 Oct  2 16:17 main.o
-rwxr-xr-x 1 lenovo lenovo 17328 Oct  2 16:17 a.out       ← 可执行文件，权限 755
```

自检 ①：日期为什么显示 `Oct  2` 而不是手册里的 `10月 1`？（你的 locale 是 `C.UTF-8`，英文月份；手册示例来自中文环境。**输出随环境变，命令没变。**）
自检 ②：`a.out` 天生带 `x`，`main.o` 不带——谁设的？（链接器产出可执行文件时会设执行位；汇编产物只是待处理的数据。）

### Drill 2 文件与目录操作（就在 `~/project0` 里练，别去 `~` 或 `/`）

```bash
mkdir -p tmp/a/b            # 一次建多层：-p 自动补父目录
touch tmp/notes.txt         # 新建空文件
cp main.c main_backup.c     # 复制
mv main_backup.c tmp/       # 移动
mv tmp/notes.txt tmp/memo.txt   # 同目录移动 = 改名
ls -l tmp tmp/a/b
rm tmp/memo.txt             # 点名删除，不用通配符
rm -r tmp                   # 删目录必须 -r（否则报 is a directory）
ls                          # tmp 消失，main.c 完好如初
```

> [!warning] 三不原则（手册 3.2 节）
> ① 不用 `rm -rf` 清理；② 不对 `/` 或 `~` 施加通配删除；③ 删之前先 `ls` 看目标。WSL 里删掉的 Linux 文件**不进 Windows 回收站**，真的没了。

### Drill 3 读文件：先把「文件有多大」变成习惯

```bash
cat main.c              # 11 行，一次打完
wc -l main.c main.i     # 预期：11 main.c / 824 main.i / 835 total
head -n 5 main.i        # 预处理产物的开头：一屏 # 行
less main.s             # 分页看；按 / 搜 ret；按 q 退出
```

> [!question] `main.i` 为什么从 11 行涨到 824 行？
> `#include <stdio.h>` 在预处理阶段把头文件**原文粘了进来**。手册（下）猜「约 500 行」，你实测 **824 行**——差异来自编译器版本与头文件包含关系不同。**把「824」和「为什么和文档不一样」写进你的观察记录，这就是系统思维训练本身。**

### Drill 4 权限：让「Permission denied」亲手出现一次

```bash
ls -l a.out            # -rwxr-xr-x → 记作 755
chmod -x a.out         # 去掉执行位
./a.out                # 预期：Permission denied   ← 手册 3.4 节的现象，自己造一次印象最深
chmod +x a.out         # 加回来（等价于 chmod 755 a.out 的 x 部分）
./a.out                # add(3,4) = 7
chmod 644 main.c; ls -l main.c    # 数字写法：644 = rw-r--r--
```

自检：对**目录**去掉 `x` 会发生什么？（x 在目录上表示「能否进入」；`chmod -x tmp` 后 `cd tmp`、`ls tmp` 都会失败。）可以拿 `tmp` 目录亲手试一次——这三个字母的含义，做一遍比背十遍牢。

### Drill 5 重定向与管道：证据留存的起点

```bash
./a.out > run.txt 2>&1           # 正常输出 + 错误输出一起进文件
cat run.txt                      # add(3,4) = 7
objdump -d a.out | grep -A 12 "<add>:"     # 管道：反汇编 → 只留 add 附近 12 行
ls -l | wc -l                    # 数当前目录有几个条目
history | grep gcc               # 从历史里捞你用过的 gcc 命令
echo "今天用管道和重定向跑了 $(date)" >> run.txt    # 追加重定向 + 命令替换
tail -n 2 run.txt
```

> [!info] `2>&1` 为什么必须写
> 工具把「正常输出」和「错误信息」写在两个不同的流里（fd=1 / fd=2）。只写 `> log.txt` 时，**报错会打在屏幕上、日志里是空的**——回头找证据就抓瞎了。你 `build.sh` 那行 `> 01-构建日志.txt 2>&1` 就是为此。

### Drill 6 三剑客：筛子、剪刀、取列器

```bash
grep -n "printf" main.c              # 带行号，一眼看到第 10 行
grep -c "include" main.i             # 数有几行（预处理产物里 include 展开后行数很多）
sed 's/add/plus/g' main.c | head -8  # 只在屏幕上替换，不动文件
sed -i 's/add/plus/g' main.c         # 注意：这条会真改文件！
sed -i 's/plus/add/g' main.c         # 练完立刻改回来，再 cat 确认
ls -l | awk '{print $1, $9}'         # 只取第 1 列（权限）和第 9 列（文件名）
ps -ef | grep -v grep | grep a.out   # 找进程；grep -v grep 排除 grep 自己
```

自检：为什么 `ps -ef | grep a.out` 有时多出一行「grep」？（手册 6.3 易错点的「过滤掉自己」。）

### Drill 7 四步流水线：项目 0 的核心实验

```bash
cd ~/project0 && ./build.sh         # 一次生成 main.i / main.s / main.o / a.out
file main.c main.i main.s main.o a.out
ls -l main.i main.s main.o a.out
```

实测输出：

```text
main.c: C source, ASCII text
main.i: C source, ASCII text
main.s: assembler source, ASCII text
main.o: ELF 64-bit LSB relocatable, x86-64, version 1 (SYSV), not stripped
a.out:  ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked,
        interpreter /lib64/ld-linux-x86-64.so.2, ... with debug_info, not stripped
```

自检（手册下 2.3）：`relocatable` 和 `pie executable` 差在哪？（前者地址未定、不能运行；后者已可装载执行。）`with debug_info` 是哪个选项带来的？（`-g`。去掉它再 `file` 一次对比。）

### Drill 8 objdump：符号表与反汇编（地方和手册不一样，往下看）

```bash
objdump -t main.o | grep -E " add| main"
# 预期：add 的地址是 0x0 —— 还没定（可重定位）
objdump -t a.out | grep -E " add| main"
# 预期：add 变成 0x1149 —— 链接时定好的真实地址
objdump -d a.out | sed -n '/<add>:/,/ret/p'
```

实测反汇编：

```asm
0000000000001149 <add>:
    1149: f3 0f 1e fa     endbr64
    114d: 55               push   %rbp
    114e: 48 89 e5         mov    %rsp,%rbp
    1151: 89 7d fc         mov    %edi,-0x4(%rbp)   ← 参数 1 落到栈上
    1154: 89 75 f8         mov    %esi,-0x8(%rbp)   ← 参数 2 落到栈上
    1157: 8b 55 fc         mov    -0x4(%rbp),%edx
    115a: 8b 45 f8         mov    -0x8(%rbp),%eax
    115d: 01 d0            add    %edx,%eax         ← 真正做加法的就这一条
    115f: 5d               pop    %rbp
    1160: c3               ret                      ← 返回值在 %eax 里交还
```

> [!question] 为什么地址和手册的 `0x401126` 完全不同？（必须搞清的断点）
> **Ubuntu 24.04 默认生成 PIE**（位置无关可执行文件）：代码每次运行时由内核随机加载（ASLR），所以 `objdump` 看到的是文件内的低偏移 `0x1149`，而 `gdb` 里运行时看到的是 `0x55555555518a` 这种高地址。手册样例用的是「非 PIE」的老习惯。
> 想和手册对齐，加一个选项：
> ```bash
> gcc -g -O0 -no-pie main.c -o a_nopie
> objdump -d a_nopie | sed -n '/<add>:/,/ret/p'
> # 预期第一行：0000000000401136 <add>:   ← 回到 0x40xxxx 段，和手册同一风格
> ```
> 另外 Ubuntu 24.04 开了 CET（控制流保护），函数入口多一条 `endbr64`（可理解为「合法入口」的标记，不影响加法逻辑）。手册样例里没有它，看到不要慌。

### Drill 9 gdb：断点停住的那一刻

```bash
cd ~/project0
gdb ./a.out
(gdb) break add                          # 在 add 入口设路障
(gdb) run                                # 跑到断点停下
(gdb) info args                          # a = 3   b = 4
(gdb) info registers rdi rsi rax         # 参数寄存器：rdi=0x3 rsi=0x4 rax=0x3
(gdb) next                               # 执行 return a + b
(gdb) info registers rax                 # rax=0x7   ← 返回值 7
(gdb) backtrace                          # #0 add   #1 main
(gdb) quit
```

实测（用 `-batch` 一次跑完，顺便就是可直接存档的证据）：

```text
Breakpoint 1 at 0x1157: file main.c, line 4.
Breakpoint 1, add (a=3, b=4) at main.c:4
4	    return a + b;
a = 3
b = 4
rdi 0x3    rsi 0x4    rax 0x3
5	}
rax 0x7
#0  add (a=3, b=4) at main.c:5
#1  0x000055555555518a in main () at main.c:9
```

存证命令（推荐直接抄进观察记录）：

```bash
gdb -q -batch -ex "set pagination off" -ex "break add" -ex run \
    -ex "info args" -ex "info registers rdi rsi rax" \
    -ex next -ex "info registers rax" -ex backtrace ./a.out \
    > 07-gdb观察.txt 2>&1
```

自检（手册下 4.4）：如果改用 `-O2` 编译，上面哪几行会变成 `<optimized out>`？（另外注意 `break add` 命中的行号是 4，不是函数第一行——断点落在第一条可执行语句上。）

### Drill 10 strace 与 /proc：与内核对话

先确认 strace 装好了（第 2 章），否则会看到实测的这句：`strace: command not found`。

```bash
strace ./a.out 2>&1 | tail -5
```

典型形态，重点看三处：

```text
execve("./a.out", ["./a.out"], 0x7ffd... /* 30 vars */) = 0    ← 内核把程序装入内存
...
write(1, "add(3,4) = 7\n", 13) = 13                            ← printf 最终落到这一次 write
exit_group(0)                          = ?                     ← 进程结束
```

```bash
strace -c ./a.out                       # 汇总：每种系统调用出现几次、耗时占比
strace -e openat ./a.out | head         # 只看 openat：找动态库的过程
```

`/proc` 实验必须让进程「活着」，所以**开两个终端标签**最方便：

```bash
# 终端 A：让进程活着
cat > sleeper.c <<'EOF'
#include <stdio.h>
#include <unistd.h>
int main(void) {
    printf("pid = %d\n", getpid());   // 程序自己报出 PID，省得你去 ps 里找
    fflush(stdout);
    sleep(30);                        // 留 30 秒给你观察
    return 0;
}
EOF
gcc -g -O0 sleeper.c -o sleeper && ./sleeper &

# 终端 B：观察它（把 <PID> 换成终端 A 打印的数字）
ps -ef | grep -v grep | grep sleeper
grep -E "^(Name|State|Tgid|Pid|PPid)" /proc/<PID>/status   # 身份：谁、什么状态、父进程是谁
ls -l /proc/<PID>/fd                # 0 输入 1 输出 2 错误 —— 三个文件描述符
ls -l /proc/<PID>/exe               # 指向 /home/lenovo/project0/sleeper
head /proc/<PID>/maps               # 代码段、库、栈各自的地址范围
```

> [!warning] `readlink /proc/self/exe` 的陷阱（实测踩到）
> 敲 `readlink /proc/self/exe` 得到的是 **`/usr/bin/readlink`**，不是你的程序。因为 `/proc/self` 指的是「正在访问 /proc 的那个进程」，也就是 `readlink` 自己。想看目标程序必须用**具体 PID**：`readlink /proc/<PID>/exe`。这个「像 bug 的现象」恰好是理解 /proc 的钥匙——它不是文件，是内核为**每个进程**开的一扇窗。

## 第 6 章 把 WSL 的输出变成 Obsidian 里的证据

### 6.1 三条存证路线（选一条，别混着来）

1. **直接写进库（最推荐）**：重定向到 `/mnt/c/Users/Lenovo/Documents/MyKnowledgeVault/lessons/操作系统基础/project0-证据/xxx.txt`。库就是普通文件夹，WSL 写完 **Obsidian 立刻能看到新文件**（本文第 4.4 节脚本就是这么做的）。
2. **送进剪贴板**：`cat 01-构建日志.txt | clip.exe`，然后到 Obsidian 里 `Ctrl+V`。适合只贴一段。
3. **选中复制**：终端里鼠标选中一段（或 `Ctrl+Shift+C`），粘到笔记的代码块里。

### 6.2 观察记录模板（配合手册下 6.2 节的格式）

| **实验** | **预测（跑之前写）** | **实际观察（跑之后贴）** | **差异与解释** |
| --- | --- | --- | --- |
| `main.i` 行数 | 约 500 行，因为 `#include` 粘贴了 `stdio.h` | 824 行 | 头文件包含关系随编译器版本变化；`gcc 13.3.0` 比手册示例多包含若干层 |
| `objdump -t` 地址 | `main.o` 中 `add` 地址应为 0 | 0x0 / 链接后 0x1149 | 说明链接器负责确定最终地址 |
| 可执行文件地址 | 手册写 0x401126 | 0x1149（PIE） | 默认 PIE + ASLR；想对齐用 `-no-pie` |
| gdb 断点值 | a=3 b=4，返回值在 `%rax` | a=3 b=4，rax=0x7 | 与预测一致，`-g -O0` 条件下变量可见 |
| strace `write` | printf 对应一次 `write(1,…)` | `write(1, "add(3,4) = 7\n", 13) = 13` | 13 = 成功写入的字节数 |

### 6.3 一键体检：把环境本身存成证据

```bash
LOGDIR="/mnt/c/Users/Lenovo/Documents/MyKnowledgeVault/lessons/操作系统基础/project0-证据"
mkdir -p "$LOGDIR"

{
  echo "=== 环境体检 $(date) ==="
  uname -a
  echo
  whoami; echo "$HOME"; echo "$SHELL"
  head -2 /etc/os-release
  gcc --version | head -1
  gdb --version | head -1
  for t in gcc gdb objdump strace tree make file nano; do
    printf "%-9s %s\n" "$t" "$(command -v $t || echo 缺)"
  done
} > "$LOGDIR/00-环境体检.txt" 2>&1

cat "$LOGDIR/00-环境体检.txt"
```

### 6.4 在笔记里怎么引用这些证据

```markdown
## 实验一：四步流水线

构建命令与各步产物（完整日志见 ![[01-构建日志.txt]]）：

\`\`\`text
（这里贴 01-构建日志.txt 的关键几行）
\`\`\`

结论：main.i 824 行 > main.c 11 行，说明预处理阶段发生了头文件展开。
```

> [!tip] 归档原则
> **日志原文进文件，关键几行进笔记。** 日志文件是「原始证据」，可复查、不会被你改写；笔记里贴的是「结论 + 最关键的几行输出」，配合手册要求的「预测—观察—差异」三栏，这样提交物既完整又读得下去。

## 第 7 章 差异清单：手册写的 ↔ 你机器上的

读手册时发现「照抄却出不来一样的结果」，先来这里对号。**每条都实测过。**

| **手册里写的** | **你机器上的现实** | **怎么办** |
| --- | --- | --- |
| 提示符末尾是 `$`（`#` 为 root） | 提示符是 zsh 的 `➜  ~` | 用 `whoami` / `id` 判断身份，别靠提示符 |
| 命令示例按 **bash** 写 | 登录 shell 是 **zsh** | 常用命令语法一致（`cd`、`ls`、`|`、`$( )` 都能用）；差异见下一行 |
| `ls *.c` 无匹配时把 `*.c` 原样交给命令 | **zsh 会直接报错**：`zsh: no matches found: *.c` | 先确认有匹配；临时可用 `ls '*.c'` 或 `setopt nonomatch` |
| 家目录示例 `/home/xiaoming` | `/home/lenovo`，用户 `lenovo` | 凡是路径都换成自己的；`~` 不受影响 |
| `ls -l` 里显示 `10月  1` | 显示 `Oct  2`（locale 为 `C.UTF-8`） | 输出随环境变，命令没变 |
| 目录名带空格要加引号 | 一样，但交互补全更安全 | 本项目目录名一律不带空格，避免自找麻烦 |
| `tree` 可能未安装 | **确实没装** | `sudo apt install -y tree`，或按手册就用 `ls` |
| `strace` 假定已可用 | **没装** | `sudo apt install -y strace`（第 2 章），Drill 10 前必须做 |
| 手册（下）说 `/mnt/c` 会出现「有 x 权限却跑不起来」 | **你机器上不会**：`wsl.conf` 带 `options=metadata`，实测 `chmod +x` 生效、脚本能跑 | 但仍把代码放 `~/project0`（性能与行为保真），只把日志写进 `/mnt/c` |
| 可执行文件地址示例 `0x401126` | 默认 PIE：文件里是 `0x1149`，运行时是 `0x55555555518a` | 想对齐手册加 `-no-pie`（得到 `0x401136`） |
| 反汇编样例开头是 `push %rbp` | 你的多一条 `endbr64`（CET 保护） | 认出来不慌，它不参与运算 |
| `file a.out` 显示 `ELF executable` | 显示 `ELF pie executable` | PIE 是现代默认，不影响 `./a.out` |
| 手册（下）预测 `main.i` 约 500 行 | 实测 **824 行** | 差异写进观察记录（这就是训练） |
| `sudo` 直接用 | **需要密码**，且输入不回显 | 正常；忘了用 `wsl -d Ubuntu -u root passwd lenovo` 重设 |
| `gcc --version` 未给版本 | `gcc 13.3.0`（Ubuntu 24.04.4） | 观察记录里请注明编译器版本，结论才可复现 |
| 文档没提 | 启动 WSL 会有 `localhost 代理` 提示 | 无害，忽略（第 1.4 节） |

## 第 8 章 报错速查（按屏幕原文找）

| **屏幕上的原文** | **真正的原因** | **怎么做** |
| --- | --- | --- |
| `bash: a.out: command not found` | 少了 `./`，Shell 不在当前目录找程序 | `./a.out`（手册 6.3 首条） |
| `zsh: command not found: strace` | 工具没装 | `sudo apt install -y strace` |
| `zsh: no matches found: *.c` | zsh 特有：通配符无匹配直接报错 | 检查拼写/目录；或 `ls '*.c'`；或 `setopt nonomatch` |
| `Permission denied`（跑程序/脚本） | 缺执行位 | `ls -l` 确认 → `chmod +x 文件名` |
| `bash: ./build.sh: cannot execute: required file not found`（文件明明在） | **CRLF**：shebang 成了 `#!/bin/bash\r` | `sed -i 's/\r$//' build.sh`（第 3.4 节） |
| `bash: $'\r': command not found` | 同样是 CRLF，另一副面孔 | 同上 |
| `bash: cd: Main.c: No such file or directory` | 大小写／空格未加引号／多打了 `~` | 用 Tab 补全，别手打全名 |
| `cannot execute binary file: Exec format error` | 把 `main.o`（目标文件）当程序跑 | 只有链接后的可执行文件能跑 |
| gdb 里变量显示 `<optimized out>` | 编译带了优化或没加 `-g` | 用 `gcc -g -O0` 重新编译（手册下 4.4） |
| `gdb: No symbol table is loaded` | 编译时没加 `-g` | 同上 |
| `sudo: 需要密码` / 输密码没反应 | 正常现象，密码不回显 | 直接打完回车；忘了见第 1.3 节 |
| `E: Unable to locate package strace` | 软件包索引没更新 | 先 `sudo apt update` |
| `Text file busy` | 程序正在运行，还要用 `gcc -o` 覆盖它 | 先 `Ctrl+C` 结束或 `kill <PID>`，再编译 |
| `wsl: 检测到 localhost 代理配置…` | Windows 代理不会自动进 WSL（NAT 模式） | 无害，忽略 |
| 终端里出现方块/乱码/问号 | 大多是中文输入或从 Windows 粘贴的编码问题 | 命令与文件一律用英文；乱码就重开一个标签页 |

## 附录 A Windows ↔ WSL 命令对照（急性子版）

| **想干的事** | **Windows (PowerShell)** | **Ubuntu (WSL)** |
| --- | --- | --- |
| 看当前目录 | `Get-Location` / `pwd` | `pwd` |
| 列目录 | `dir` / `ls` | `ls -l` |
| 切目录 | `cd C:\Users\Lenovo` | `cd /mnt/c/Users/Lenovo` |
| 复制文件 | `copy a b` | `cp a b` |
| 移动/改名 | `move a b` | `mv a b` |
| 删除 | `del a` / `Remove-Item` | `rm a`（目录用 `rm -r`） |
| 清屏 | `cls` | `clear` 或 `Ctrl+L` |
| 编辑文本 | `notepad a.txt` | `nano a.txt`（不要在 Windows 侧编辑 .sh） |
| 找命令在哪 | `Get-Command gcc` | `which gcc` |
| 看进程 | `tasklist` | `ps -ef` |
| 打开图形窗口 | `explorer .` | `explorer.exe .` |
| 关掉当前环境 | `exit` | `exit`（回到 Windows） |
| 彻底重启 | 重启电脑 | `wsl --shutdown`（在 PowerShell 里敲） |

## 附录 B 打卡清单（配合手册 6.5 节一起用）

```bash
□ 我能不看文档，从 Windows 桌面三步进入 Ubuntu 终端，并说清自己在哪一层
□ 我的 ~/project0 里能一次跑完 ./build.sh 并生成 i / s / o / a.out 四个产物
□ 我能自己"造"出 Permission denied，并用 chmod 修好
□ 我知道 CRLF 报错长什么样，也知道怎么定位（file / grep -c $'\r'）和修（sed）
□ 我能用重定向 + 2>&1 把任意命令的输出存成证据文件
□ 我能把 gdb 观察结果用 -batch 一行命令存下来
□ 我能说出 /proc/<PID>/fd、/exe、maps 各回答什么问题
□ 我今天至少有一条命令是用管道串起来的
□ 我的证据文件已经躺在 Obsidian 库的 project0-证据/ 目录里
```

## 附录 C 一页速记

```bash
进 Linux：    Windows Terminal → Ubuntu ｜ PowerShell: wsl ｜ 退出: exit
我的锚点：    用户 lenovo ｜ 家目录 /home/lenovo ｜ shell zsh ｜ 发行版 Ubuntu 24.04.4
三块地盘：    ~（代码与产物）｜ /mnt/c、/mnt/d（Windows）｜ 库在 /mnt/c/Users/Lenovo/Documents/MyKnowledgeVault
跨界三招：    explorer.exe . ｜ code . ｜ cat x.txt | clip.exe
缺的工具：    strace、tree → sudo apt update && sudo apt install -y strace tree
建文件三法：  heredoc（cat > f <<'EOF'）｜nano ｜code .
观察四工具：  objdump 看文件 ｜ gdb 看运行 ｜ strace 看请求 ｜ /proc 看身份
必加选项：    gcc -g -O0（调试）｜-no-pie（想和手册地址一致）｜2>&1（存全输出）
两大本机差异：默认 PIE（地址 0x1149 而非 0x401126）｜默认 shell 是 zsh（通配符无匹配会报错）
红字优先查：  command not found → 没装/少 ./ ；required file not found → CRLF
```

> [!info] 写给自学者
> 这一章的每一条命令，都建议**亲手造一次错**：故意去掉 `./`、故意 `chmod -x`、故意用记事本改脚本。看懂报错的人，比背对命令的人走得远——因为手册第 1.2 节那条「从输入到执行」的流水线，只有在你见过它断在第几步时，才真正变成你的直觉。
