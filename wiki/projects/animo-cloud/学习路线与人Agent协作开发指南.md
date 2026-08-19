---
type: meta
title: "AnimoDoll Cloud · 学习路线与人+Agent协作开发指南"
created: 2026-08-16
updated: 2026-08-16
tags:
  - animo-cloud
  - guide
  - ai-agent
---

# AnimoDoll 云端仓库 · 学习路线与"人 + Agent"协作开发指南（v2）

> **适用对象**：仓库主人。此前主要把开发交给 Agent，现在要：① 完全明白自己的工作流与工作内容；② 能自己动手 + 指挥 Agent 并行开发。
> **v2 相对 v1 补了什么**：登录请求全链路走读、业务全景图、术语词典、"指挥者/开发者"两条路线、Agent 任务全生命周期、验收门禁卡、日常 SOP、排障速查表、可复制的任务模板。
> **更新**：2026-08-16（接口规模同步为 116 操作 / 101 路径，含 portrait）。
> **先读**：《仓库梳理与联调问题核查报告.md》（正确地图）；本指南负责"路线和动作"。

**目录**：§0 选路线 · §1 看懂仓库（地图/登录链路/业务全景/术语/三种流程/文档地图/每日 SOP）· §2 人+Agent 协作 · §3 学习内容分级 · §4 六周计划 · §5 排障速查 · §6 自查清单 · 附录（任务模板 / 开工前考 Agent 四题）

---

## 0. 按你的目标选路线（先花 30 秒）

| 你的目标 | 走哪条路线 | 本文必读 | 可选 |
|---|---|---|---|
| 只想**审 Agent、派活、验收**，不亲自写代码 | 🟢 指挥者路线 | §0、§1.1、§1.4、§1.6、§2 全部、§4 第1/2/6周、§5、附录 | §1.2 粗读、§1.3 浏览 |
| 想**自己也能改代码、加接口** | 🔵 开发者路线 | 全文 + 《教学指南-从零看懂AnimoDoll云端项目.md》 | — |
| 已会编程，只是新接手这个仓库 | ⚪ 速通路 | §1、§2.4～2.7、§5、附录A | §3 跳过 |

**核心心法（永远记住这一句）**：

> 页面 → `api.js` 发请求 → Ktor 路由 → Store 业务函数 → Exposed 操作表 → JSON 返回 → 页面渲染。
> 这个项目里 90% 的功能都是这条流水线的重复；剩下 10%（SSE/短信/部署）是它的变体。

---

## 1. 把仓库看懂：地图层

### 1.1 仓库是三层结构，不是一堆文件

```
① 代码层      backend/  frontend/  services/mailbot/        ← 功能在这里
② 契约交付层   handoff/  scripts/  docs/  AGENTS.md         ← 别人和 Agent 靠这些对接
③ 部署运维层   deploy/  .github/workflows/  .env.example     ← 代码怎么变成线上服务
```

- **改功能**：动 ①；
- **联调/交付**：改 ① 之后必须同步 ②（OpenAPI、endpoint-index、Postman、协议文档）；
- **上线**：走 ③（deploy-prod.ps1 → Docker 镜像 → Nginx）。

### 1.2 主线走读：一次登录请求的完整旅程（本指南最重要的例子）

以 Web 登录为例，**照着代码走一遍**，你就掌握了整个仓库的读法：

| 步 | 发生了什么 | 文件/函数 | 你要看懂的 1 件事 |
|---|---|---|---|
| 1 | 登录页渲染，生成一个 UUID 当验证码 id | `frontend/src/pages/login.js` → `render(app)` | 页面就是一个 JS 模块，导出 `render()` |
| 2 | 调 `getPublicConfig()` 拿 SM2 公钥 | `frontend/src/js/api.js` → `request()`；`BASE_URL='/api/v1'` | 所有请求都走这一个 `request()` 封装 |
| 3 | `GET /auth/captchas/{id}` 拿图片，答案从响应头 `X-Captcha-Code` 取 | `backend/ApiV1Routes.kt` 第 84 行路由 → `CloudStore.issueCaptcha()` | Ktor 路由 = 路径 + 处理函数；答案存 `Captchas` 表 |
| 4 | 用户输密码，前端算 `SM2(验证码+密码)`（`sm2.js` 同时生成 C1C3C2 与 C1C2C3 两份密文，登录页先试 C1C3C2，失败回退 C1C2C3） | `frontend/src/js/sm2.js` → `encryptPassword()` | 密文里**先验证码后密码**，这是联调最常见的坑 |
| 5 | `POST /auth/sessions` 提交 `{username, password, captchaId}` | 路由 → `CloudStore.loginV1()` | `consumeCaptchaBoundPassword()` 先解 SM2，再对 `Captchas` 表校验并删除该验证码 |
| 6 | 校验用户名密码哈希，生成两个 token，写 `Sessions`/`AccessTokens` 表 | `CloudStore.loginV1()` | accessToken 1 小时，refreshToken 30 天 |
| 7 | 响应 `{data:{accessToken,refreshToken,...}, meta:{requestId}}` | `ApiPlugins.kt` 的 `respondSuccess()` | 新版信封长这样；旧接口才是 `{code,msg,data}` |
| 8 | 前端存 token，跳首页；之后每个请求自动带 `Authorization: Bearer` | `api.js` + `storage.js` | 401 时 `tryRefresh()` 自动换新 token 并重试一次 |
| 9 | 开发环境由 Vite 代理 `/api/v1 → localhost:8080`；生产由 Nginx 转发 | `frontend/vite.config.js`、`deploy/nginx.conf` | 前端从不直接写死 `http://IP:8080` |

> 练习（指挥者也要做）：用 Postman 按 2→3→5 调一遍，把每一步响应抄在纸上。这一步做过，接口联调就再也骗不到你。

### 1.3 业务全景图：这个项目"有什么"与"在哪"

| 模块 | 主要接口（/api/v1） | 核心文件 | 学习优先级 |
|---|---|---|---|
| 系统/健康 | `GET /health`、`GET /api/v1/health`、`GET /auth/public-config`、`GET /auth/captchas/{id}` | `ApiV1Routes.kt`、`CaptchaService.kt` | ⭐⭐⭐ 必看 |
| 账号 | `POST /auth/sms-codes`、`/auth/registrations`、`/auth/sessions`、`/auth/tokens/refresh`、`DELETE /auth/sessions/current` | `CloudStore.kt`（loginV1/registerV1/refreshV1/logoutV1）、`SmsSender.kt`、`Sm2CryptoService.kt` | ⭐⭐⭐ 必看 |
| 用户资料/隐私 | `GET/PATCH /users/me`、`DELETE /users/me`、`/privacy-exports` | `CloudStore.kt` | ⭐⭐ |
| 伴侣（AI 人设） | `GET/POST /companions`、`PATCH/DELETE /companions/{id}` | `CloudStore.kt` | ⭐⭐⭐ 加接口的样板 |
| 聊天 | `POST /companions/{id}/turns`（SSE 流式）、`/conversations*`、`/agent-tools/web-searches` | `ApiV1Routes.kt`、`DeepSeekService.kt`、`OllamaService.kt` | ⭐⭐⭐ 项目核心 |
| 设备 | `/device-claims`、`/devices*`、`/device-commands` | `CloudStore.kt` | ⭐⭐ |
| OTA/配置 | `/devices/{id}/ota-manifest`、`/ota-reports`、`/capability-policy`、`/model-catalog` | `OtaStore.kt`、`CapabilityStore.kt` | ⭐ 按需 |
| 社交广场 | `/social/posts`、评论/配对/私信/图片 | `SocialStore.kt`、`Routes.kt` 的 social 路由 | ⭐⭐ |
| 增量同步/推送 | `/sync/changes`、`/sync/operations:batch`、`/push-installations*` | `CloudStore.kt` | ⭐ 按需 |
| 北邮邮箱/UCloud | `/mail/oauth/*`、`/ucloud/oauth/*` | `MailRoutes/Store/Service.kt`、`UCloud*` + `services/mailbot/` | ⭐ 按需 |
| 用户画像（新） | `POST /portrait/extract`（三前缀） | `PortraitRoutes/Store/Service/Models.kt` | ⭐ 按需 |
| 网页端 | 登录/注册/主页/伴侣/聊天/设备/社区/UCloud | `frontend/src/pages/` | ⭐⭐⭐ 前端线 |

### 1.4 AnimoDoll 术语词典（联调/看代码遇到就回来查）

| 词                          | 在仓库里的意思                                                              |     |
| -------------------------- | -------------------------------------------------------------------- | --- |
| Companion                  | AI 伴侣（人设），“Agent”的对外叫法；代码里 `Companions`/`companions`                 |     |
| Turn                       | 一轮聊天对话；`POST /companions/{id}/turns` 流式返回                            |     |
| Session                    | ①登录会话（`Sessions` 表，可吊销）；②聊天会话用 `Conversation`，别混                     |     |
| Portrait                   | 用户画像增量提取（2026-08 pull 新增），`POST /portrait/extract` 幂等                |     |
| SM2                        | 国密非对称加密；登录密码 = `SM2(验证码 + 明文密码)`，公钥从 public-config 取                 |     |
| Captcha                    | 图形验证码，4 位，存 `Captchas` 表，5 分钟有效；注册/登录校验通过后即被删除（不要重复 GET 同一 id，会轮换答案） |     |
| accessToken / refreshToken | 1 小时 / 30 天；旧兼容接口用的是 7 天 `Tokens` 表                                  |     |
| Envelope                   | 响应信封：新版 `{data,meta}`/`{error}`，旧版 `{code,msg,data}`                 |     |
| SSE                        | 聊天流式"打字机"效果；事件顺序 `turn.started → text_delta* → turn.completed`       |     |
| Idempotency-Key            | 幂等键：同一写操作重放不重复执行                                                     |     |
| Cursor / ETag              | 游标分页 / 乐观锁版本号（更新先核对版本）                                               |     |
| H2 / PostgreSQL            | 本地内存库（重启清空）/ 生产库                                                     |     |
| mailbot                    | Node + Playwright 无头浏览器旁路服务，跑邮箱/UCloud 登录会话                          |     |
| OTA                        | 固件升级清单与进度上报                                                          |     |
| 三套前缀                       | `/api/v1`（标准）、`/xiaozhi`（旧移动端）、根路径（Android 无前缀）；同一路由注册三次             |     |
| X-Request-ID               | 每个响应都带，报障时**必须提供**，日志按它查                                             |     |

### 1.5 三种开发规模，三种流程（Agent 时代的工作流）

| 规模 | 例子 | 流程 | 用到什么 |
|---|---|---|---|
| 小（<半天） | 改文案、修一个 404、加日志 | 直接改 → 跑测试 → 提交 | `git diff`、`gradlew test` |
| 中（1～3天） | 加 Note 接口、改一个页面 | 分支 `feat/xxx` → 契约先行 → 开发 → 你验收 → 合并 | §2.2 任务模板 |
| 大（>3天） | 新模块（如 portrait、邮件） | OpenSpec 提案 → 计划 → 分任务 → 逐任务验收 → 回归 | `backend/openspec/`、`.superpowers/sdd/`（历史）、`handoff/protocols/` |

### 1.6 文档地图：遇到问题先查哪

| 想找 | 去 |
|---|---|
| 项目约定、常用命令 | `AGENTS.md`（Agent 每次干活先读它） |
| 架构/模块说明（2026-07 时点） | `docs/AnimoDoll云端服务开发概述.md` |
| 仓库现状/联调问题逐项核查/清理方案 | `docs/仓库梳理与联调问题核查报告.md` |
| 零基础概念讲解 + 手把手加接口 | `docs/教学指南-从零看懂AnimoDoll云端项目.md` |
| 全部接口清单 | `handoff/endpoint-index.md`（生成物，改路由后要重生成） |
| 特殊流程协议 | `handoff/protocols/`（chat-sse、sync、ota、mail、ucloud、portrait-extract） |
| 环境/账号/工具 | `handoff/environments/`、`handoff/testing/test-data-index.md`、`handoff/TOOLS-GUIDE.md` |
| 测试即说明书 | `backend/src/test/kotlin/...`（每个接口的正确用法） |
| 设计历史 | `docs/superpowers/`、`.superpowers/sdd/` |

### 1.7 日常 SOP（每天 10 分钟，作为仓库主人的固定动作）

```text
① 开工：git status（干净吗？有 Agent 留下的一半改动吗？）→ git log --oneline -5（昨天发生了什么）
② 派活前：写 §2.2 任务包，先让 Agent 交"计划"，你批准再动手
③ 收活后：git diff --stat 看范围 → git diff 看关键文件 → 亲手跑测试/构建 → Postman/curl 冒烟
④ 收尾：更新 AGENTS.md/协议文档/接口索引（生成物）→ 小步提交 → 该 push 就 push
⑤ 下班：git status 必须干净或只有你已知的工作；密钥永远不留在新副本里
```

---

## 2. "自己 + Agent"协作工作法（核心章节）

### 2.1 分工原则

| 环节 | 谁负责 | 为什么 |
|---|---|---|
| 需求、验收标准、接口契约 | **你** | 只有你知道业务目标 |
| 查风格、写代码 | Agent | 机械工作，AI 强项 |
| 表结构/鉴权/加密/部署脚本 | Agent 写，**你重点审** | 高风险区域 |
| 跑测试、构建、冒烟 | **你亲手** | 验收不能被代劳 |
| 提交、推送、部署、密钥 | **你** | Agent 不碰生产密钥与远端 |
| 更新 AGENTS.md、协议、接口索引 | Agent 起草，你审 | 下一个 Agent 靠它干活 |

### 2.2 任务包模板：四段式（照抄即可）

```text
【背景】为什么做这件事，关联哪个模块/接口/文档。
【目标】要交付什么，越具体越好（接口路径、字段、错误码、页面行为）。
【边界】只准改哪些文件；不准碰什么；不许重构；沿用哪种风格（举例：照抄 /companions）。
【验收】可执行的命令与现象：
  1) cd backend && .\gradlew.bat test 全绿；
  2) cd frontend && npm run build 通过；
  3) curl/Postman 冒烟脚本（路径+预期响应）；
  4) 生成物已更新：endpoint-index.md / openapi / 协议文档；
  5) 完成后输出：改动文件清单 + 10 行摘要 + 风险点 + 你没把握需要我确认的地方。
```

**差的下单**："帮我加个接口。"
**好的下单**：把上面四段填满，并附上参考文件路径。

### 2.3 一个任务从派单到合并的 10 步（每一步都知道是谁在做）

| # | 动作 | 谁 | 工具/命令 |
|---|---|---|---|
| 1 | 写任务包（背景/目标/边界/验收） | 你 | §2.2 |
| 2 | 建分支 | 你 | `git switch -c feat/notes` |
| 3 | Agent 先交**实施计划**，列出要改的文件与顺序 | Agent | — |
| 4 | 你批准计划（或让它缩小范围） | 你 | 对照 §1.3 判断有没有越界 |
| 5 | Agent 开发 + 自测 | Agent | `gradlew test`、`npm run build` |
| 6 | 你审查：`git diff --stat` → 关键文件 `git diff` | 你 | §2.5 四检查 |
| 7 | 你亲手跑验证 + 冒烟 | 你 | §2.4 门禁卡 |
| 8 | 让 Agent 更新文档/生成物并补测试 | Agent | `generate-endpoint-index.py` 等 |
| 9 | 你合并/提交 | 你 | `git switch main && git merge feat/notes` |
| 10 | 复盘：把新约定写进 AGENTS.md | 你+Agent | 防止下次再问 |

### 2.4 验收门禁卡（打勾才能合并，建议打印贴在屏幕边）

```text
□ 范围：只改了任务允许的文件（git diff --stat 核对）
□ 契约：接口路径/字段/状态码与任务包一致
□ 错误：用 ApiErrorCode/respondError，没有自己拼 JSON 或吞异常
□ 数据库：改了表就同步了 DatabaseFactory 建表列表
□ 安全：无硬编码密钥；.env/日志/构建产物没进 git；SM2/鉴权逻辑未被绕过
□ 测试：gradlew test 全绿；新增行为有测试；npm run build 通过
□ 冒烟：本地 curl/Postman 真实打通过（不是只信单测）
□ 文档：OpenAPI/endpoint-index/协议文档已重新生成
□ 提交：信息清晰、单次提交不混入无关改动
```

### 2.5 审查与回滚：Agent 干砸了怎么办

**审查四检查**（按顺序）：
1. 范围：`git diff --stat` 有没有"顺手重构"、"顺手优化"的越界文件？
2. 契约：新接口是否照抄了既有模式；错误码、信封对不对？
3. 高风险点：动了 `Tables.kt`/`DatabaseFactory`/`Sm2CryptoService`/`deploy/` 的，逐行看。
4. 卫生：`git status` 有没有多出 `.env`、日志、zip、build 产物。

**回滚三板斧**（从轻到重）：
```powershell
git restore <file>              # 丢弃某个文件未提交改动
git switch main                # 放弃整条分支（未合并前）
git switch -c rescue <旧hash>  # 回到某个历史提交，保命分支
```

**什么时候叫停 Agent**：它连续两次没按验收标准做、开始改边界外文件、或解释不清楚自己改了什么——让它先交"我改了哪些文件、为什么"的书面说明，再决定继续或重来。

### 2.6 永远不要让 Agent 碰的东西

- 生产服务器 SSH、`.env` 真值、AK/SK、数据库口令、`ssl/` 私钥；
- `git push` / 分支删除 / 远端操作（除非你明确要求并看着）；
- 历史文档"修正"（`docs/superpowers/`、`.superpowers/sdd/` 是当时的记录）；
- 生成物手改（`endpoint-index.md/.xlsx` 要跑脚本生成）。

---

## 3. 学习内容分级：学什么、去哪学、学到什么程度

> 原则：**不为学而学，为看懂流水线而学**；每项达到"检验"标准就停。
> 🟢 = 指挥者路线也要学；🔵 = 开发者路线再加。

### L0 地基（第 1 周，每天 1～2 小时）

| # | 学什么 | 去哪学（首选） | 学到什么程度（检验） |
|---|---|---|---|
| L0-1 🟢 | 命令行：cd/ls/copy/路径 | 菜鸟教程：https://www.runoob.com/ | 能解释 §1.7 每条命令的输出 |
| L0-2 🟢 | Git：提交/分支/合并/回滚 | 廖雪峰 Git：https://liaoxuefeng.com/books/git/introduction/index.html | 能完成 §2.3 里你负责的 6 步 |
| L0-3 🟢 | HTTP：URL/GET/POST/状态码/Header/JSON | MDN：https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Overview | 能说清一次登录请求的 URL、方法、头、状态码 |
| L0-4 🟢 | Postman/curl 调接口 | Postman 学习中心：https://learning.postman.com/ | 调通 `/api/v1/health`、`public-config`、验证码 |
| L0-5 🟢 | Markdown | 菜鸟教程 Markdown | 能写出 §2.2 的任务包 |

### L1 读懂项目（第 2～4 周）

| # | 学什么 | 去哪学 | 学到什么程度（检验） |
|---|---|---|---|
| L1-1 🔵 | JavaScript：变量/函数/对象/Promise/async/fetch | 廖雪峰 JS：https://liaoxuefeng.com/books/javascript/ | 逐行读懂 `frontend/src/js/api.js` 的 `request()` 与 `tryRefresh()` |
| L1-2 🔵 | ES Module | MDN Modules | 说清 `main.js → router.js → pages/*.js → api.js` |
| L1-3 🟢 | Kotlin 最小语法：data class/函数/`?.`/`Result`/`runCatching` | Kotlin 官方中文：https://www.kotlincn.net/docs/reference/ | 读懂 `ApiModels.kt` 一个 DTO 和 `CloudStore.kt` 一个短函数 |
| L1-4 🟢 | Ktor：路由 + receive/respond | Ktor 官方：https://ktor.io/docs/routing-in-ktor.html | 在 `ApiV1Routes.kt` 找到 `/auth/sessions`，说清路由→Store 的调用 |
| L1-5 🔵 | Exposed + SQL 基础 | Exposed：https://www.jetbrains.com/help/exposed/home.html；SQL：https://www.runoob.com/sql/sql-tutorial.html | 看懂 `Tables.kt` 一表和 `transaction { select/insert }` |
| L1-6 🟢 | 本项目鉴权玩法：验证码+SM2+双 token | `handoff/security-privacy/auth-and-key-rotation.md` | 能画 §1.2 的登录时序图 |

### L2 能动手改（第 4～6 周）

| # | 学什么 | 去哪学 | 学到什么程度（检验） |
|---|---|---|---|
| L2-1 🔵 | Gradle 构建/测试 | Gradle 手册：https://docs.gradle.org/current/userguide/userguide.html | 看懂 `backend/build.gradle.kts`，会跑单个测试类 |
| L2-2 🔵 | Ktor 测试 testApplication | Ktor 官方 Testing：https://ktor.io/docs/testing.html | 读懂 `ApiV1AuthTest.kt` 并加一条断言 |
| L2-3 🟢 | OpenAPI 与索引生成流程 | 本仓库 `scripts/generate-endpoint-index.py` 注释 | 改路由后能重导出 spec 并生成 md/xlsx |
| L2-4 🟢 | Docker/Nginx/Compose 基础 | Docker 入门：https://docs.docker.com/get-started/；Nginx：https://nginx.org/en/docs/ | 读懂 `docker-compose.prod.yml` 4 个服务与 `nginx.conf` 反代 |
| L2-5 🟢 | 环境变量与密钥管理 | 搜索"十二要素 配置" | 能解释 `.env.example` 关键项；绝不让 `.env` 进 git |
| L2-6 🟢 | 代码审查 | GitHub PR Review 文档：https://docs.github.com/zh/pull-requests | 能按 §2.5 四检查审 Agent 交付 |

### L3 业务专项（按需）

| 专项 | 什么时候学 | 去哪学 | 程度 |
|---|---|---|---|
| SSE 流式聊天 | 改聊天前 | MDN SSE + `handoff/protocols/chat-sse.md` | 说清事件顺序与 terminal 事件 |
| SM2/国密 | 改登录前 | sm-crypto GitHub；Bouncy Castle 文档 | 知道 C1C3C2/C1C2C3、04 前缀、密钥必须固定 |
| 幂等/游标/乐观锁 | 改同步/更新前 | `handoff/protocols/sync-and-idempotency.md` | 说清 Idempotency-Key 与 ETag |
| OTA | 做固件前 | `handoff/protocols/ota-manifest.md` + `schemas/` | 读懂 manifest |
| CAS/OAuth 无头登录 | 改邮箱/UCloud 前 | `handoff/protocols/mail-headless-login.md`、`ucloud-student-api.md` | 知道 ticket 换会话 |
| Portrait 画像 | 改画像前 | `handoff/protocols/portrait-extract.md` | 知道 turnId 幂等与白名单字段 |
| OpenSpec/SDD | 大功能前 | `backend/openspec/`、`docs/superpowers/` | 按提案→计划→任务→审查组织 |

### L4 把 Agent 用得更稳（持续）

| 学什么 | 去哪学 | 程度 |
|---|---|---|
| 给编程 Agent 写任务 | 所用 Agent 官方文档（Codex/Claude Code 等） | 能稳定产出 §2.2 四段式任务包 |
| 上下文工程 | 搜 "context engineering for coding agents" | 知道 AGENTS.md、小文件、清晰契约为何提升产出 |
| TDD/验收先行 | 搜 "TDD 入门" | 先写验收标准，再让 Agent 开发 |
| CI/CD | GitHub Actions：https://docs.github.com/zh/actions | 看懂 `.github/workflows/deploy.yml`（已拆 3 个并行 job） |

---

## 4. 六周计划（双轨：指挥者 🟢 / 开发者 🔵）

| 周 | 🟢 指挥者路线（每天 1h） | 🔵 开发者路线（每天 2h） | 共同产出/检验 |
|---|---|---|---|
| 1 | L0 全学；读 §1.1/1.4/1.6；调通 health/public-config | 同左 + 画流水线图 | 一张自己的"仓库地图"；Postman 两个接口通 |
| 2 | §2 精读；给 Agent 派一个"解释登录流程"的任务并审查答案 | L1-1/1-2；逐行读 `api.js`、`login.js` | 你能复述登录全链路；能指出 api.js 双信封兼容在哪 |
| 3 | L1-3/1-4 只学"读"；跟着 §1.2 在代码里找每一步 | L1-3～1-6；读 `ApiV1Routes.kt`、`CloudStore.kt` 登录段、`Tables.kt` | 能讲清登录接口"路由→业务→表" |
| 4 | 让 Agent 做 Note 接口，你用 §2.4 门禁卡验收 | L2-1/2-2；先自己写 Note 接口测试，再让 Agent 改 | Note 接口合并；你审出至少 1 处不规范 |
| 5 | L2-3～2-5；本地跑一次 `deploy-prod.ps1 -SkipUpload` 打包 | 同左 + 读 deploy 脚本/nginx/compose | 能解释三个产物（jar/前端/配置）如何拼成线上 |
| 6 | 综合演练：真实小需求，全流程你指挥 | 同左 + 你自己动手改一处并提交 | 完成 §2.3 的 10 步闭环 |

---

## 5. 排障速查表（本仓库最常遇到的 15 个）

| # | 现象 | 最可能原因 | 怎么处理 |
|---|---|---|---|
| 1 | 前端"网络错误" | 后端没起 / Vite 代理没配 | `cd backend; .\gradlew.bat run`；看 F12 Network |
| 2 | 404 | 路径/前缀错；路由没注册；Nginx 没转发 | 对照 `handoff/endpoint-index.md`；确认 `/api/v1`；检查 `vite.config.js`/`deploy/nginx.conf` |
| 3 | 401 | token 没带/过期/会话被吊销 | 带 `Authorization: Bearer <accessToken>`；过期走 refresh 或重新登录 |
| 4 | 422 参数校验失败 | 字段名/类型不符合契约 | 对照 OpenAPI 的 request schema；**注册不需要 smsCode** |
| 5 | `Captcha mismatch` | 密文没拼验证码前缀 / 验证码过期 / 同一个 captchaId 重复 GET（答案已轮换） | 每次流程只 GET 一次；加密明文 = `验证码+密码`；5 分钟有效 |
| 6 | `SM2 decryption failed` | 公钥过期（服务重启换钥）或密文模式不匹配 | 重新拉 public-config；生产配 `ANIMO_SM2_PRIVATE_KEY_HEX` 固定密钥 |
| 7 | 发短信 `Aliyun SMS auth send failed` | AK/SK、签名、模板或套餐问题（阿里云侧） | 本地改 `ANIMO_SMS_PROVIDER=mock` + `ANIMO_DEV_SMS_CODE=0000`；线上核对 PNVS 控制台 |
| 8 | 发短信 429 | 设计内冷却：同号 1 条 + 60 秒间隔 | 看 `Retry-After`，等秒数后重试 |
| 9 | 8080 端口被占 | 上个后端实例没关 | `netstat -ano \| findstr 8080` 找 PID 关掉，或 `.env` 改 PORT |
| 10 | 本地数据重启后没了 | H2 内存库（正常现象） | 要持久化配 `DATABASE_URL` 指向 Postgres |
| 11 | 线上 80 端口拒绝、443 能用但证书告警 | 80 未开放；证书 CN=animodoll.com 与 IP 不匹配；域名被 ICP 拦截 | 联调期用 `curl -k https://47.93.153.35/...`；正式上线先办 ICP + 域名证书 |
| 12 | Gradle/npm 下载慢或失败 | 网络 | 配阿里云 Gradle 镜像、npm 淘宝镜像 |
| 13 | `gradlew 不是命令` | 没在 backend 目录 / 没装 JDK 17 | `cd backend`；`java -version` |
| 14 | 接口索引与实际对不上 | `endpoint-index.md` 是生成物，代码改后没重生成 | 跑 `gradlew test`（导出 spec）→ `python scripts/generate-endpoint-index.py` |
| 15 | 中文乱码 | 文件/终端编码不是 UTF-8 | 保存 UTF-8；PowerShell `Get-Content -Encoding UTF8` |

---

## 6. 自查清单：学成没有？（12 条）

1. 能不看文档说出 `backend/`、`frontend/`、`handoff/`、`deploy/` 的职责。
2. 能画 §1.2 登录请求的 9 步时序，并指出每步的文件。
3. 能说清新旧两代前缀与信封、双代 token 的区别。
4. 能说出至少 8 个业务模块及各自核心接口。
5. 能独立跑通 `gradlew test` 与 `npm run build`，并看懂失败输出。
6. 能写出一份四段式任务包，并让 Agent 先交计划。
7. Agent 交付后能按 §2.5 四检查 + §2.4 门禁卡验收。
8. 能用 curl/Postman 冒烟接口，并解释 401/404/422/429 的区别。
9. 能加一张表并登记建表列表；能照抄现有接口加一个 `/api/v1` 路由（开发者）。
10. 能解释 deploy-prod.ps1 六步、能跳过哪些步骤、上线后怎么查日志。
11. 知道 `.env`/AK/SK/`ssl/` 私钥为什么不能进 git，备份放哪、怎么轮换。
12. 遇到 §5 的 15 个问题，能独立定位原因并给出处理动作。

---

## 7. 最后一句

你不需要成为 Kotlin 或 JS 专家。**这个仓库的主线只有一条：请求 → 路由 → 业务 → 表 → 响应。**
你的角色是"总装和质检"：定义需求、定契约、审代码、跑验证、管密钥与部署；
Agent 的角色是"熟练工"：照你的图纸在正确的位置写代码。
把这张图纸（本文档 + AGENTS.md + 核查报告）维护好，仓库再大也不乱。

---

## 附录 A：三个可直接复制的任务模板

### A1 让 Agent 讲懂一段代码（学习用）

```text
【背景】我在学习本仓库，技术基础较弱。
【目标】用大白话解释 frontend/src/js/api.js 的 request() 函数。
【要求】不要给泛泛理论；按"输入→每一步做什么→输出"讲，引用本仓库真实行号；
最后给我 3 个验证我是否理解的问题，并附答案。
【边界】只读不改。
【验收】我能凭解释向别人复述出 token 附加与 401 刷新的逻辑。
```

### A2 小改动（加接口）

```text
【背景】社区需要给登录用户增加"便利贴"。
【目标】GET /api/v1/notes（我的列表）、POST /api/v1/notes（新建）。
【字段】Note:{id,content,createdAt}；CreateNoteRequest:{content}。
【参考】照抄 CloudStore.listAgents 与 ApiV1Routes 的 /companions；响应用 respondSuccess/respondError。
【边界】只改 backend/；不动前端/鉴权/加密/部署；不重构。
【验收】① gradlew test 全绿；② 新增测试照抄 ApiV1AuthTest；③ curl：登录→建→查；④ 重生成 endpoint-index。
【输出】改动清单 + 10 行摘要 + 风险点。
```

### A3 排障（联调问题）

```text
【背景】联调报错："POST /api/v1/auth/sessions 返回 422 Captcha mismatch"。
【现象】发码接口用同一 captcha+captchaId 通过，登录报 mismatch；请给我 X-Request-ID。
【目标】判定是客户端流程错还是服务端 bug。
【要求】只读代码给出结论与证据（文件:行号）；如需复现，给出最小 curl/脚本；不要改代码。
【输出】结论（1 句）+ 证据（≤5 条）+ 建议修复方（客户端还是后端）。
```

## 附录 B：给 Agent 的"仓库须知"最小清单（检查它是否真的读了）

在派活前，可以让 Agent 先回答下面 4 题，答对再开工：

1. 后端代码在哪个目录？新接口应注册在哪个文件、用什么响应助手？
2. 新旧两代响应信封分别长什么样？
3. 加数据库表需要改哪两个文件？
4. 改完接口后，哪些交付物要重新生成、怎么生成？

> 答案全部在 `AGENTS.md` 与本文档中；答不出的 Agent 没有读上下文，先让它重读，不要直接放它开工。
