---
type: project
title: AnimoDoll 云端项目 · 学习与协作
created: 2026-08-12
updated: 2026-08-30
status: active
area: 后端
domain: software-engineering
complexity: intermediate
goal: 从能读懂 AnimoDoll 云端仓库，到能自己改动或新增一个普通 API，并完成一次可验收的联调交付。
prerequisites:
  - "[[Backend Introduction|Backend Introduction]]"
  - "[[API Styles|API Styles]]"
code:
  - D:/Projects/animodoll/animodoll-cloud
related:
  - "[[animo-cloud#附属文档：仓库梳理与联调问题核查报告|仓库梳理与联调问题核查报告]]"
  - "[[animo-cloud#附属文档：学习路线与人 Agent 协作开发指南|学习路线与人+Agent协作开发指南]]"
  - "[[animo-cloud#附属文档：教学指南——从零看懂 AnimoDoll 云端项目|教学指南：从零看懂 AnimoDoll 云端项目]]"
  - "[[animo-cloud#附属文档：SMS 短信服务接口说明|SMS 短信服务接口说明]]"
  - "[[Backend Introduction|Backend Introduction]]"
  - "[[Relational Databases|Relational Databases]]"
tags:
  - project
  - animo-cloud
  - kotlin
  - ktor
  - backend
  - frontend
  - area/后端
---

# AnimoDoll 云端项目 · 学习与协作

> 项目页：目标、完成标准，以及四份交付文档（合并为本页附属章节，原文未改动）。

## 前置
**前置项目**：[[Backend Introduction]]、[[API Styles]]

**知识框架体系**：概念层（HTTP 请求生命周期、REST 契约、ORM、前后端分离）；技能层（Kotlin/Ktor 路由与 Store、Exposed 建表、OpenAPI 同步、Postman 联调、git PR 流程）；工具层（Gradle、Agent 派活与验收工作流）。

## 目标产出
> 从能读懂 AnimoDoll 云端仓库，到能自己改动或新增一个普通 API，并完成一次可验收的联调交付。

**具体目标**：

1. 完全看懂 AnimoDoll 云端仓库的三层结构（代码层 / 契约交付层 / 部署运维层）。
2. 能自己动手或指挥 Agent 完成一个普通 API 的「路由 → Store → 表 → DTO → 前端调用」闭环。
3. 建立「人 + Agent 协作开发」的工作流：派活、验收、排障、文档同步。

**交付工作区**：`D:/Projects/animo-cloud`（交付成果放此；过时版本移入其 `archive/`。全局映射见 [[wiki/meta/code-repos]]）

**交付物**：

- [ ] 不看文档画出「页面 → api.js → Ktor 路由 → Store → Exposed 表 → JSON」完整链路
- [ ] 按教学指南独立新增或修改一个普通 API，并通过本地测试
- [ ] 同步更新 OpenAPI、endpoint-index、Postman Collection 等契约交付物
- [ ] 完成一次联调问题核查：真错误 / 文档问题 / 客户端问题分得清
- [ ] 六周计划推进到第 6 周，自查清单全部通过
- [ ] 全部完成后：`status: completed` → 移入 `wiki/archives/`

## 项目关键点
**核心内容**：读懂 AnimoDoll 云端仓库的三层结构（代码层 / 契约交付层 / 部署运维层），跑通一个普通 API 的完整闭环，并建立「人 + Agent」协作开发的工作流。

**关键难点**：

- 三层结构里「契约交付层」最容易被忽略——代码改了但 OpenAPI / Postman 没同步，接口就会失真。
- 联调时要能区分真错误、文档问题、客户端问题，三者处理方式完全不同。
- 指挥 Agent 的关键在验收门禁：派活容易，判断交付是否合格难。

## 文档地图
- [[animo-cloud#附属文档：仓库梳理与联调问题核查报告|仓库梳理与联调问题核查报告]] — 仓库正确地图、联调问题清单、清理方案。
- [[animo-cloud#附属文档：学习路线与人 Agent 协作开发指南|学习路线与人+Agent协作开发指南]] — 指挥者/开发者两条路线、六周计划、任务模板与验收门禁。
- [[animo-cloud#附属文档：教学指南——从零看懂 AnimoDoll 云端项目|教学指南：从零看懂 AnimoDoll 云端项目]] — 零基础概念讲解 + 手把手加一个普通 API。
- [[animo-cloud#附属文档：SMS 短信服务接口说明|SMS 短信服务接口说明]] — 短信验证码服务的接口与实现说明（真实接口走读样例）。

## 关联知识
- [[Backend Introduction|Backend Introduction]] — 后端网络 / HTTP / DNS / 服务器基础。
- [[Relational Databases|Relational Databases]] — 本项目用到的 PostgreSQL 与 Exposed ORM。

## 附属文档：仓库梳理与联调问题核查报告
# AnimoDoll Cloud · 仓库梳理与联调问题核查报告

> 生成日期：2026-08-15（基于仓库 `main`：`fa9c121` → pull → `6917c59`，加本地文档修正 `112b0e3`；线上实测 2026-08-15）
> 用途：回答三个问题 —— ① 仓库为什么乱、正确的目录地图是什么；② 联调问题清单里哪些是真错误、哪些是端点/文档/客户端问题；③ 怎么清理。
> 配套文档：《学习路线与人+Agent协作开发指南.md》（本目录）

---

## 〇、刚 pull 进来的服务端新代码是什么（2026-08-15 22:51）
本次 `git pull`（fast-forward）带来 2 个提交，**不影响上文 A/B 联调问题清单的结论**，但影响接口总数与部署/CI：

### 1. `955a420 feat(portrait)`：用户画像增量提取（新功能）

- 新增 4 个源文件：`backend/.../PortraitModels.kt`、`PortraitRoutes.kt`、`PortraitService.kt`、`PortraitStore.kt`（+976 行）；
- 新接口 `POST /portrait/extract`，按惯例注册三套前缀：`/api/v1`、`/xiaozhi`、根路径；
  - 入参 `{turnId, userMessage, assistantMessageId}`，返回白名单画像增量，`turnId` 幂等重试；
  - 上限 16 KiB，429 限流，DeepSeek 不可用返回 502/503 语义；
- 新表 `PortraitExtractions`（已加入 `DatabaseFactory` 自动建表列表）；
- 新环境变量 `ANIMO_PORTRAIT_DEEPSEEK_API_KEY` / `ANIMO_PORTRAIT_DEEPSEEK_BASE_URL`（缺省回落到聊天 DeepSeek 配置）；
- 新增 `handoff/protocols/portrait-extract.md` 协议文档与 2 个测试类（PortraitRoutesTest 425 行 + PortraitServiceTest）。

### 2. `6917c59 ci: optimize ci speed`：CI 拆并行

- `.github/workflows/deploy.yml` 从单个 `deploy-test` 拆成 `backend-verify` / `frontend-verify` / `mailbot-verify` 三个并行 job，产物用 artifact 传递，最后 `build-and-deploy-test` 再部署；
- `backend/build.gradle.kts`：测试 `maxParallelForks` 在 CI 为 2（本地仍串行）；
- `deploy/` 的 test 配置与远端脚本相应微调。

### ✅ 收尾项（2026-08-16 已完成）

- 已在 `backend/` 成功运行 `gradlew test --tests OpenApiDocsTest`，重新导出
  `backend/build/generated-openapi.yaml`（含 portrait）；
- `scripts/check-routes-vs-openapi.py` 校验通过：**239 / 239，0 缺失、0 陈旧**；
- `endpoint-index.md` / `.xlsx` 已重新生成：**116 个操作 / 101 个路径**，portrait 单列
  `PORTRAIT-01/02`（xlsx 由新增的 xlsxwriter 兜底生成）；
- `scripts/generate-postman-collection.py` 已修复旧路径（`animo-cloud-handoff` → `handoff`）并重生成 Collection（含 Portrait 目录，baseUrl=https）。

---

## 一、仓库到底长什么样（一张正确的地图）
### 1.1 一句话结论

**当前唯一的后端是根目录下的 `backend/`。** 仓库里曾经存在的 `server1/ANIMO-CLOUD/` 是历史路径；
现在工作区里那个 1.4GB 的 `server1/` 只是本地残留的旧部署/构建副本（无源码、无提交、无远程），
**必须按"垃圾"处理，绝不能当代码来源**。你手里的文档（尤其《教学指南》《开发概述》）大量引用
`server1/ANIMO-CLOUD/`，这是混乱的核心来源。

### 1.2 正确的目录地图（以代码为准）

```
animodoll-cloud/
├── AGENTS.md                  ← 给 Agent 看的"项目使用说明书"（每次干活先读）
├── README.md                  ← 项目首页说明
├── backend/                   ← ★ 唯一后端：Kotlin + Ktor 3.1.2（约 1.77 万行 Kotlin）
│   ├── build.gradle.kts       ← 依赖、构建、测试配置
│   ├── .env.example           ← 全部环境变量模板（真正的 .env 不入库）
│   ├── Dockerfile             ← 后端镜像
│   ├── src/main/kotlin/com/animo/cloud/
│   │   ├── Application.kt     ← 入口 main() + module()
│   │   ├── Routes.kt          ← 插件安装 + 旧接口（/user /agent /chat /social 等）+ 三套前缀
│   │   ├── ApiV1Routes.kt     ← ★ 新标准接口 /api/v1（auth/users/companions/devices/…）
│   │   ├── CloudStore.kt      ← ★ 核心业务（用户/Auth/伴侣/聊天/设备/同步/隐私…）
│   │   ├── SocialStore.kt     ← 社交广场业务
│   │   ├── PortraitModels/Routes/Service/Store.kt ← 用户画像增量提取（2026-08-15 pull 新增）
│   │   ├── UCloud*.kt / Mail*.kt / OtaStore.kt / CapabilityStore.kt … ← 旁路业务
│   │   ├── Tables.kt          ← 全部数据库表定义（自动建表，含新表 PortraitExtractions）
│   │   ├── ApiModels.kt / ApiContracts.kt / ApiPlugins.kt ← DTO、错误码、响应助手
│   │   ├── AuthUtils.kt / Sm2CryptoService.kt / SmsSender.kt / CaptchaService.kt
│   └── src/test/kotlin/…      ← 22 个测试类（接口行为的最佳说明书，含 2 个 Portrait 测试）
├── frontend/                  ← ★ 网页端：Vite + 原生 JS（无框架 SPA）
│   ├── src/pages/…            ← 每个页面一个模块
│   ├── src/js/api.js          ← 统一请求封装（token/刷新/错误解析）
│   └── vite.config.js         ← 开发代理 /api/v1、/xiaozhi → :8080
├── services/mailbot/          ← 旁路服务：Node + Playwright 无头浏览器（邮箱/UCloud 会话）
├── deploy/                    ← 生产部署：deploy-prod.ps1 + docker-compose.prod.yml + nginx.conf
├── handoff/                   ← 交付/联调资料（OpenAPI、协议、测试报告、Postman、接口索引）
├── docs/                      ← 项目文档、设计稿、周报、本报告与学习路线
├── scripts/                   ← OpenAPI→接口索引/Postman 的生成脚本（自动生成勿手改产物）
├── .github/workflows/         ← CI（测试+部署缓存）
├── .superpowers/sdd/          ← 历史 SDD 任务跟踪（2026-07-28 社区升级）
└── backend/openspec/          ← OpenSpec 工作流配置（Agent 改后端建议走此流程）
```

### 1.3 主线数据流（看懂它就懂了这个项目）

```
浏览器/Android App
   │  fetch('/api/v1/...')，带 Authorization: Bearer <accessToken>
   ▼
Nginx（生产，443） 或 Vite 代理（开发，:3000→:8080）
   ▼
Ktor 路由：ApiV1Routes.kt 命中路径
   ▼
Store 业务函数：CloudStore.kt / SocialStore.kt / …
   ▼
Exposed ORM 读写表：Tables.kt（本地 H2 / 生产 PostgreSQL）
   ▼
响应助手 ApiPlugins.kt 包成 { data, meta } 或 { error } 返回
   ▼
前端 api.js 解析 → 页面渲染
```

### 1.4 新旧两代接口（联调最容易踩的坑）

| | 旧接口（Routes.kt 兼容层） | 新接口（ApiV1Routes.kt，联调基准） |
|---|---|---|
| 前缀 | `/xiaozhi`、`/api/v1`（旧注册）、根路径 `/user/...` 等 | `/api/v1` |
| 成功 | `{"code":0,"msg":"ok","data":{...}}` | `{"data":{...},"meta":{"requestId":"..."}}` |
| 失败 | `{"code":1,"msg":"...","data":null}` | `{"error":{"code":"...","message":"..."}}` + HTTP 状态码 |
| 谁在用 | 旧版 Android/网页兼容 | **新客户端一律用这个** |

线上实测（2026-08-15）确认服务器已部署新版：`/api/v1/health` 返回 `{data, meta}` 新格式；
`/health` 仍返回旧格式，两者都存在。

---

## 二、为什么仓库"感觉混乱"——五根乱源
| #   | 乱源                  | 事实                                                                                                                                                                       |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **后端换过两次路径**        | Git 历史：根目录 Kotlin 工程 → `server1/ANIMO-CLOUD/` → 提交 `5952910` 起改为 `backend/`。旧文档没跟着改。                                                                                     |
| 2   | **工作区残留 1.4GB 旧副本** | `server1/`（未跟踪）里没有 `src/`、git 无提交、无 remote，只有 `.gradle-home` 缓存、构建产物、`.env`（含真实阿里云 AccessKey）和 `ssl/` 私钥。它是垃圾+泄密风险，不是代码。                                                 |
| 3   | **文档互相打架**          | `AGENTS.md`/`README.md` 说后端在 `backend/`（对）；《教学指南》《开发概述》《ICP 说明》、handoff 部分报告仍写 `server1/ANIMO-CLOUD/`（错/过期）。                                                             |
| 4   | **交付物堆在根目录**        | `animo-cloud-handoff.zip`、`animo-cloud-handoff (2).zip`、20MB 的 `numberAuthSDK...zip`、后端 3 个 `hs_err_pid*.log` + `replay_*.log`（JVM 崩溃日志）。全部可删（zip 在 .gitignore，日志也不该入库）。 |
| 5   | **分支多且旧**           | 本地 `main/new_main/master` + 远端 `origin/function/ucloud`、`api`、`docker`、`codex/add-...`、`feature/local-device-smoke`。`origin/function/ucloud` 已全部并入 main，其余需逐一确认后清理。      |

`mindisle-server/` 是另一个参考项目（健康量表服务，自带 `.git` 与 `.env.release`），已在 .gitignore，属于"保留在本机但永不入库"的参考物，不要在里面改代码。

---

## 三、联调问题清单逐项核查（A 类是服务器/接口，B 类是客户端）
核查方式：读 `backend/` 当前代码 + 核对 OpenAPI + 2026-08-15 线上实测（仅公开接口）。

### 结论速览

| 编号                |    你的端点/文档错了吗    |      项目本身有错吗       | 一句话定性                                                                |
| ----------------- | :--------------: | :----------------: | -------------------------------------------------------------------- |
| A1 域名/HTTPS       |        否         |    **是（运维问题）**     | 80 端口确实没开；443 只挂了 IP 上能用的域名证书；域名被 ICP 拦截。                            |
| A2 短信异常           |     否（路径正确）      | **是（阿里云配置/账号侧问题）** | 真实发送被阿里云拒绝；但"注册被阻塞"的说法不成立，注册接口根本不要求短信码。                              |
| A3 验证码答案进响应头      |        否         |    **是（代码缺陷）**     | 代码无条件把 `X-Captcha-Code` 明文答案返回，生产也如此。                                |
| A4 登录验证码 mismatch |        否         |      **未能证实**      | 代码允许同一验证码先发码后登录；大概率是重拉验证码导致轮换，或 SM2 没拼验证码前缀。                         |
| A5 缺密码重置          |        否         |    **是（功能缺失）**     | 新旧路由都没有 reset 接口；历史计划里有，未实现。                                         |
| A6 Base URL 与事实不符 |   **是（文档过期）**    |    是（文档/脚本硬编码）     | 文档写 http://IP（80），实际 80 拒绝、服务在 443。                                  |
| B1 路径             | 否（你给的规范路径全部真实存在） |         否          | 纯客户端未适配，不是服务器错误。                                                     |
| B2 响应信封           |        否         |         否          | 服务器确实是 `{data,meta}/{error}`，客户端解析旧格式。                               |
| B3 SM2            |        否         |         否          | `public-config` 正常返回 04 前缀公钥；客户端缺 SM2。                               |
| B4 图形验证码          |        否         |         否          | 发码/注册/登录都要求验证码；客户端缺 UI。                                              |
| B5 字段语义           |      否（基本对）      |      清单里有一处错误      | **注册不需要 smsCode**（`RegisterRequest` 只有 username/password/captchaId）。 |
| B6 健康检查           |        否         |         否          | 服务器支持 `/api/v1/health` 和 `/health`，客户端却调 `/health/ready`。            |

### A1：域名与 HTTPS 证书未配置 —— 真实运维问题，不是端点错误

线上实测（2026-08-15）：

- `http://47.93.153.35:80` → **连接拒绝**（80 未开放）。
- `https://47.93.153.35/health`（跳过证书校验）→ 200，服务正常。
- 443 证书：`CN=animodoll.com`，有效期到 **2026-08-28**。所以用 IP 直连必须"跳过校验"（证书 CN 与 IP 不匹配）。
- `https://animodoll.com/health` → 连接被重置；结合 `docs/ICP备案与域名访问状况说明.md`，根因是**未完成 ICP 备案，被阿里云 WAF 拦截**，不是 Nginx 配错。

**判定**：清单属实；这是"部署/合规问题"，与接口路径无关。下一步：办 ICP 备案 → 绑定域名证书 → 决定 staging 是否保留 IP+忽略校验的临时方式。

### A2：阿里云短信异常 —— 真实账号/配置问题；但"阻塞注册"是误判

代码事实（`SmsSender.kt` + `CloudStore.smsVerification`）：

- `POST /api/v1/auth/sms-codes` 路径**存在且正确**。
- `ANIMO_SMS_PROVIDER=aliyun` 时走阿里云"号码认证（PNVS）"通道；返回 `Aliyun SMS auth send failed` 表示**阿里云拒绝了请求**（AccessKey 权限、签名、模板 code、套餐/余额、频控任一问题）。
- 第二次请求返回 429 带 `Retry-After` 是**代码设计的冷却**（60 秒 + 同号限 1 条），不是故障。

**重要纠错**：当前服务器的**注册接口不校验短信码**。`RegisterRequest` = `{username, password(SM2密文), captchaId}`，没有 `smsCode` 字段；`registerV1()` 也不查 `SmsCodes` 表。所以"注册链路完全阻塞"不成立——注册只需要图形验证码+密码。若产品层要求"注册必须验短信"，那这是**尚未实现的产品需求**，不是接口故障。

### A3：验证码答案明文返回响应头 —— 真实代码缺陷

`ApiV1Routes.kt` 的 `GET /auth/captchas/{captchaId}` **无条件**执行：

```kotlin
call.response.headers.append("X-Captcha-Code", code)
```

且 `deploy/nginx.conf` 有 `proxy_pass_header X-Captcha-Code;`，会原样透传给客户端。开发模式（`ANIMO_DEV_CAPTCHA_CODE`）返回固定码是设计内；但**生产模式也会把随机验证码答案放进响应头**，验证码确实形同虚设。修复应在生产/无 dev 码时去掉该头（测试旁路单独开关），这是真错误、需改代码。

### A4：登录验证码 mismatch —— 不能证实为服务端 bug

代码事实：

- 发码 `smsVerification()` 校验验证码后**不删除、不轮换** `Captchas` 行；
- 登录 `consumeCaptchaBoundPassword()` 在校验通过后才会删除该行；
- 所以**同一 captchaId+captcha 先发码、后登录在 5 分钟内是允许的**。

什么情况会报 `Captcha mismatch`：

1. 登录前**用同一个 captchaId 再次 GET 验证码** → `issueCaptcha()` 会"幂等刷新"该行，答案已轮换（这是最可能的根因）；
2. SM2 密文里**没有拼验证码前缀**（正确明文必须是 `验证码+密码`）；
3. 验证码过期（5 分钟）；
4. 客户端把 captcha 单独放字段提交——服务器根本不读单独的 captcha 字段，它只认密文里的前缀。

**判定**：需要复现时保留 `X-Request-ID` 与每一步请求时间才能定罪。按现有代码，这是"测试方法/客户端加密理解"问题的概率远大于服务端 bug。端点没有错。

### A5：缺少密码重置 —— 真实功能缺失

`ApiV1Routes.kt` 和 `Routes.kt` 中都不存在 password/reset 路由；`docs/archive/…交付确认书-20260728.md` 中曾有 `AUTH-08 POST /api/v1/auth/password-reset-challenges` 的计划，但从未实现。属于"功能没做"，不是端点写错。补做时建议走 `sms-codes/verify` + `PATCH /users/me` 或独立 reset 接口，并同步 OpenAPI。

### A6：文档 Base URL 与事实不符 —— 文档/脚本过期（已在本轮修复）

`handoff/endpoint-index.md` 与 `handoff/openapi/animo-api-v1.yaml` 均写 `http://47.93.153.35`（隐含 80 端口），而实际服务只在 443。根因是 OpenAPI `servers` 未随部署更新 + 生成脚本兜底值过时。清单属实，但属于**文档错误**；"你给的 endpoint 有问题"的部分只有这一条（以及环境矩阵文档），接口路径本身全对。

### B1-B6：全是客户端适配工作，服务器端路径与规范是真实存在的

线上实测 + 代码确认你给出的新规范端点全部存在：

```
GET    /api/v1/health
GET    /api/v1/auth/public-config
GET    /api/v1/auth/captchas/{captchaId}
POST   /api/v1/auth/sms-codes
POST   /api/v1/auth/sms-codes/verify
POST   /api/v1/auth/registrations
POST   /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/current
POST   /api/v1/auth/tokens/refresh
```

- B1/B6：客户端还在调 `/auth/login/password`、`/auth/register`、`/health/ready` 等旧路径 → 404 是客户端责任，不是服务器。
- B2：服务器确实返回新信封（实测 `/api/v1/health` 已验证）。
- B3：`/auth/public-config` 返回 `04` 开头 SM2 公钥；服务端解密先试 C1C3C2 再试 C1C2C3，与规范一致。
- B4：发码必须带 `captcha+captchaId`；注册/登录的 captcha 以"SM2 明文前缀"形式提交。
- B5：清单唯一事实错误——**注册不需要 smsCode**。客户端注册请求 `{username, password, captchaId}` 即可。
- 总评：B 类是"给客户端开发的任务清单"，不能算服务器接口错误；同样，A 类里只有 A3 是纯代码 bug，A2 是外部配置，A1/A6 是运维/文档，A4 证据不足，A5 是功能缺口。

---

## 四、清理方案（按安全等级排序）
> **执行状态（2026-08-15）**：第 1 级已全部执行——`server1/`（敏感文件已备份至
> `C:\Users\Lenovo\animodoll-secrets-backup-2026-08-15`）、根目录 zip、JVM 崩溃日志均已删除；
> 本地已合并旧分支（master/new_main/function/ucloud）已删除；远端分支因本机 GitHub SSH
> 未配置暂未删除；文档修正已提交 `112b0e3`（该提交基于 pull 后的 `6917c59`）。剩余项见下表。

### ✅ 第 1 级：现在就能做、零风险

1. **删除工作区垃圾**（确认不需要后执行；zip 若想要存档先移出仓库）：
   ```powershell
   # 在仓库根目录
   Remove-Item 'backend\hs_err_pid*.log','backend\replay_pid*.log' -Force
   Remove-Item 'animo-cloud-handoff.zip','animo-cloud-handoff (2).zip',
     'numberAuthSDK_APP_Android_v2.14.23_operator_ui_log_static.zip' -Force
   ```
2. **处理 `server1/`（1.4GB）**：它没有源码、没有提交、没有远程，但**含有真实 `.env`（阿里云 AK/SK、数据库口令）和 `ssl/` 私钥**。建议：
   - 先只保留 `server1/ANIMO-CLOUD/.env` 与 `ssl/` 到你自己的密码管理器/私有网盘；
   - 然后整目录删除：`Remove-Item server1 -Recurse -Force`；
   - 最后**在阿里云控制台轮换 AccessKey**（这仓库曾经交给多个 Agent，密钥按泄露处理）。
3. **把 `server1/` 加入 .gitignore**（防止再次拖入）。

### ⚠️ 第 2 级：确认后执行（破坏性，先备份远端）

4. **清理分支**：默认分支用 `main`；`function/ucloud` 经 `git rev-list` 确认已全部并入 main，可删；
   `master`、`new_main` 与远端 `api`、`docker`、`codex/add-...` 逐一 `git branch --merged` 确认后删除。
5. **重生成接口索引**（改完接口/文档后）：
   ```powershell
   cd backend; .\gradlew.bat test --tests com.animo.cloud.OpenApiDocsTest
   cd ..; python scripts/generate-endpoint-index.py
   ```
   勿手改 `endpoint-index.md/.xlsx`（生成物）。

### 🔁 第 3 级：代码/运维修复（对应 A 类问题）

6. A3：`ApiV1Routes.kt` 只在 dev 模式（`store.isDevCaptchaEnabled`）才返回 `X-Captcha-Code`。
7. A2：核对阿里云 PNVS 控制台的"系统赠送签名/模板"是否与 `.env` 一致、AccessKey 是否具备 `AliyunDypnsFullAccess`；本地先用 `ANIMO_SMS_PROVIDER=mock` + `ANIMO_DEV_SMS_CODE=0000` 联调。
8. A1/A6：ICP 备案 → 域名证书 → 更新 OpenAPI servers 与 `handoff/environments/*`、Postman 环境为 `https://47.93.153.35`（IP 访问需忽略 CN 校验，文档写明）。
9. 本轮已同步的文档修复：旧路径引用（见下节）。

---

## 五、本轮已经顺手修正的内容
- 新增本报告；
- 新增《学习路线与人+Agent协作开发指南.md》；
- 将《教学指南》《开发概述》等文档中 `server1/ANIMO-CLOUD/` 路径改为 `backend/`（历史设计稿另加"历史路径"标注）；
- 修正 `handoff/environments/*`、`handoff/TOOLS-GUIDE.md`、`handoff/testing/test-data-index.md`、Postman 环境的 Staging 协议/端口描述（http:80 → https:443，附忽略证书校验说明）；
- 修正 `scripts/generate-endpoint-index.py` 的 Base URL 兜底值并新增 xlsxwriter 兜底；重新导出 OpenAPI 后生成 `endpoint-index.md/.xlsx`（116 操作 / 101 路径，含 portrait）；`check-routes-vs-openapi.py` 239/239 通过；
- 修正 `scripts/generate-postman-collection.py` 的旧路径并重生成 Postman Collection（含 Portrait 目录，baseUrl=https）；
- 刷新 `handoff/README.md`（V1.2 + 修订记录）、`handoff/operations/known-limitations.md`（修复乱码并更新至当前状态）、`rollout-and-rollback.md`（修复部署路径）、`openapi-validation-report.txt` 与历史测试报告（加当前状态提示）；
- pull 后新增的 portrait 功能已核对：三前缀路由、新表、新环境变量与协议文档齐全，不影响联调问题清单结论。

> 注意事项：`docs/superpowers/` 与 `.superpowers/sdd/` 是历史工作记录，路径保持原样（它们记录的是当时的目录结构），不要"修复"历史文档。

## 附属文档：学习路线与人 Agent 协作开发指南
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

## 附属文档：教学指南——从零看懂 AnimoDoll 云端项目
# AnimoDoll 云端项目 · 从零看懂教学文档

> 写给"技术细节基本不懂、连一个普通 API 都不知道怎么实现"的你。
> 这份文档不讲高深原理，只回答三个问题：
> **这个项目是怎么搭起来的？看代码时从哪里下手？卡住了去查什么、去哪查？**
>
> **最近更新：2026-08-16**（同步 OpenAPI 自动生成工作流、SM2 固定密钥注意事项；2026-08-15 已将历史路径 `server1/ANIMO-CLOUD/` 统一改为当前后端目录 `backend/`；2026-08-16 补充用户画像 Portrait 模块）
>
> 想系统学"自己 + Agent 协作开发"，配合阅读：
> [`学习路线与人Agent协作开发指南.md`](./学习路线与人Agent协作开发指南.md) 与
> [`仓库梳理与联调问题核查报告.md`](./仓库梳理与联调问题核查报告.md)

---

## 0. 这份文档怎么用
建议按顺序读一遍第 1～5 节（大约 30～60 分钟），建立"地图感"。
之后遇到不懂的概念，翻第 4 节"概念速查表"；遇到报错，翻第 8 节"常见问题对照表"；
真想动手加接口，跟着第 5 节"手把手加一个普通 API"做一遍。

你不需要先学完 Kotlin、JavaScript、数据库才能读这份文档。
这个项目的代码风格高度统一，**绝大多数改动都是"照葫芦画瓢"**：
找到一个功能最像的现有代码，复制它的结构，改名字和逻辑。

---

## 1. 这个项目是做什么的（一分钟版）
AnimoDoll 是一个 AI 陪伴玩偶（毛绒玩具/智能硬件）的配套云端服务，主要功能：

- 用户账号：注册、登录、短信验证码、图形验证码、Token 鉴权
- AI 伴侣：创建 Agent（AI 人设）、绑定设备、多模型聊天（DeepSeek API / Ollama 本地模型）
- 社交广场：发帖、评论、找搭子（标签匹配）、私信
- 设备管理：绑定、在线状态、下发指令、OTA 固件升级
- 其他：A 币签到、数据同步、隐私导出、推送、北邮邮箱/UCloud 账号的免登录集成

仓库里实际有**两套服务**，别被弄混：

| 目录 | 是什么 | 你要不要关心 |
|------|--------|------------|
| `backend/` | **主后端**（Kotlin + Ktor），本项目的核心 | ✅ 主要学习对象 |
| `frontend/` | **网页端**（Vite + 原生 JS） | ✅ 主要学习对象 |
| `handoff/` | 联调交付资料：接口索引、OpenAPI、协议说明、测试报告 | ✅ 查资料首选 |
| `docs/` | 项目文档（开发概述、周报、设计文档） | ✅ 看文档 |
| `mindisle-server/` | 另一个独立服务（健康量表相关，风格相似的旧项目） | ⚪ 可以先忽略 |
| `scripts/`、`联调确认文档.md`、zip 包等 | 辅助脚本和交付件 | ⚪ 按需看 |

> 💡 判断项目目录是否重要，先看根目录 `AGENTS.md`（本仓库的"项目使用说明书"，Codex 每次干活前都要读它）和 `docs/AnimoDoll云端服务开发概述.md`（架构图 + 模块说明）。

---

## 2. 技术栈"人话"版
每个技术你只需要知道"它在这个项目里扮演什么角色"就够了。

| 技术                | 它是啥（一句话）             | 在项目里干什么                                           |
| ----------------- | -------------------- | ------------------------------------------------- |
| Kotlin            | 跑在 JVM 上的现代编程语言      | 后端所有代码都用它写                                        |
| Ktor              | Kotlin 的 Web 框架      | 接收 HTTP 请求、注册路由、返回 JSON                           |
| Netty             | 高性能网络引擎              | Ktor 底层处理网络连接                                     |
| Exposed           | Kotlin 的 ORM（对象关系映射） | 用 Kotlin 代码操作数据库，不用手写 SQL 字符串                     |
| HikariCP          | 数据库连接池               | 管理数据库连接，避免每次请求都新建连接                               |
| H2                | 内存数据库                | 本地开发用，零配置，重启后数据清空                                 |
| PostgreSQL        | 生产数据库                | 线上真正的数据存储                                         |
| Bouncy Castle     | 加密算法库                | 实现 SM2 国密加解密                                      |
| SM2               | 国密非对称加密算法            | 密码加密后传输，服务端再解密                                    |
| Gradle            | 构建工具                 | 下载依赖、编译、跑测试、启动服务                                  |
| Docker / Compose  | 容器化部署                | 把后端、数据库、Nginx 打包成容器一键启动                           |
| Nginx             | Web 服务器 / 反向代理       | 生产环境接收浏览器请求，转发给 Ktor，托管前端静态文件                     |
| Vite              | 前端构建工具/开发服务器         | 前端开发热更新、打包                                        |
| 原生 JS + ESM       | 无框架的 JavaScript      | 前端是"裸写"的模块化 JS，没有 React/Vue                       |
| sm-crypto         | JS 加密库               | 浏览器端做 SM2 加密                                      |
| OpenAPI / Swagger | 接口描述规范与可视化文档         | 路由的 `.describe {}` 注释自动生成，`/docs`、`/swagger` 在线查看 |
| SSE               | 服务器推送技术              | 聊天回复"流式打字机"效果                                     |

**为什么是这个组合？** 项目追求轻量：Kotlin 类型安全、Ktor 轻量、Exposed 编译期检查 SQL、H2→PostgreSQL 无缝切换、前端零框架。
你不需要精通每一个，**先用"它是干嘛的"这层理解，代码读多了自然熟悉**。

---

## 3. 构建主线：项目是怎么搭起来的
这一节是整个文档的核心。记住一句话：

> **一个接口 = 路由（收请求） + 业务函数（处理逻辑） + 表（存数据） + DTO（传数据）。**
> 前端一个页面 = 页面文件 + 路由注册 + 统一的 API 调用封装。

### 3.1 整体架构（先看这张图）

```
浏览器 / Android App / 设备
        │
        ▼
   Nginx（生产） 或  Vite 开发服务器（本地）
        │            │  代理 /api/v1、/xiaozhi → localhost:8080
        ▼
   Ktor 后端（backend，端口 8080）
        │
        ├── Exposed（ORM）→ H2（本地）/ PostgreSQL（生产）
        ├── DeepSeek API / Ollama（AI 聊天）
        └── mailbot（Node 无头浏览器，北邮邮箱/UCloud 登录）
```

### 3.2 后端启动过程（入口在哪）

后端入口是 `backend/src/main/kotlin/com/animo/cloud/Application.kt`：

1. `main()` 被 Gradle 调用
2. `loadDotenv()` 读取 `.env` 配置文件（`Dotenv.kt`）
3. `ServerConfig` 读取全部配置（端口、数据库地址、验证码开关等，定义在 `CloudStore.kt` 末尾）
4. `DatabaseFactory.init(config)` 连接数据库并**自动建表**（`DatabaseFactory.kt` + `Tables.kt`）
5. `configureServer(...)` 安装插件、注册所有路由（`Routes.kt`）
6. `embeddedServer(Netty, 8080).start()` 开始监听

`configureServer`（在 `Routes.kt` 里）做了两件事：

- **装插件**：JSON 解析（ContentNegotiation）、日志（CallLogging）、请求 ID（RequestIdPlugin）、统一响应助手（`ApiPlugins.kt`）
- **注册路由**：把几十个接口按前缀分组挂进来

### 3.3 后端代码分层（读代码的顺序）

后端源码都在 `backend/src/main/kotlin/com/animo/cloud/` 下，就一层平铺（没有分包），按文件名分工：

| 文件 | 职责 | 重要度 |
|------|------|--------|
| `Application.kt` | 入口、组装 | ⭐ 看一眼 |
| `Routes.kt` | 插件安装 + **旧接口**（/user、/agent、/device、/chat、/social）+ 兼容前缀 | ⭐⭐⭐ |
| `ApiV1Routes.kt` | **新接口**（/api/v1 下的 auth、users、companions、devices、conversations、sync、ota 等） | ⭐⭐⭐ |
| `CloudStore.kt` | **最大的业务类**：用户、Agent、设备、聊天、签到等所有业务逻辑 + 数据库操作 + 配置 | ⭐⭐⭐ |
| `SocialStore.kt` | 社交广场业务（帖子、评论、配对、私信） | ⭐⭐ |
| `PortraitModels/Routes/Service/Store.kt` | 用户画像增量提取（`POST /portrait/extract`，2026-08 新增） | ⭐ 按需 |
| `Tables.kt` | 所有数据库表定义（一张表 = 一个 `object`） | ⭐⭐⭐ |
| `ApiModels.kt` | 旧接口的请求/响应 DTO | ⭐⭐ |
| `ApiContracts.kt` | 新接口的响应格式、错误码、请求头常量 | ⭐⭐⭐ |
| `ApiPlugins.kt` | 新接口的响应助手（respondSuccess / respondError 等） | ⭐⭐ |
| `AuthUtils.kt` | 鉴权工具：从请求头取 token、查用户 | ⭐⭐⭐ |
| `Sm2CryptoService.kt` | SM2 解密 | ⭐（知道有它即可） |
| `DatabaseFactory.kt` | 数据库连接池 + 自动建表 | ⭐⭐ |
| `Dotenv.kt` | 读 .env 配置 | ⭐ |
| `DeepSeekService.kt` / `OllamaService.kt` | AI 聊天上游调用 | ⭐⭐ |
| `UCloudRoutes/Store/Service.kt`、`MailRoutes/Store/Service.kt` | 北邮云课堂/邮箱集成 | ⭐ 按需 |
| `CapabilityStore.kt`、`OtaStore.kt` | 设备能力、OTA 升级 | ⭐ 按需 |
| `SmsSender.kt`、`CaptchaService.kt` | 短信、图形验证码 | ⭐ 按需 |

**小知识（2026-08 新增）**：路由后面可以挂 `.describe { ... }` 块，给接口写中文说明和响应格式（见 `ApiV1Routes.kt`）。
Ktor 会据此自动生成 OpenAPI 文档——服务跑起来后，浏览器打开 `/docs`（HTML 文档）或 `/swagger`（Swagger UI）就能看到全部接口。

**读代码的正确姿势**：不要从头读到尾。从"你关心的那个接口"出发：

```
接口文档（endpoint-index.md）→ 路由文件（找到路径）→ 业务函数（CloudStore 里找同名方法）
→ 表定义（Tables.kt）→ 测试文件（看预期行为）
```

### 3.4 一次登录请求的完整旅程（把主线走一遍）

以"用户登录"为例，完整走一遍（这也是理解本项目最快的方式）：

1. 浏览器打开登录页 → `frontend/src/pages/login.js` 开始渲染
2. 页面调用 `getPublicConfig()`（`frontend/src/js/api.js`）
3. `api.js` 里的 `request()` 用 `fetch('/api/v1/auth/public-config')` 发请求（`BASE_URL = '/api/v1'` 来自 `config.js`）
4. **本地开发**：Vite 把 `/api/v1` 代理到 `http://localhost:8080`（`frontend/vite.config.js`）
   **生产环境**：Nginx 把 `/api` 转发到后端容器（`deploy/nginx.conf`）
5. Ktor 收到请求 → 路由匹配到 `ApiV1Routes.kt` 里的 `get("/auth/public-config")` → 调用 `store.publicConfig()`（`CloudStore.kt`）→ 返回 SM2 公钥
6. 前端拿到公钥 `setPublicKey(...)`，再请求验证码图片 `getCaptcha()`（`GET /auth/captchas/{id}`，返回 PNG + `X-Captcha-Code` 头）
7. 用户输入密码 → `frontend/src/js/sm2.js` 用 **"验证码 + 明文密码"** 做 SM2 加密 → `POST /auth/sessions` 提交
8. Ktor 路由 `post("/auth/sessions")` → `store.loginV1(...)`：
   - 解密密码（`Sm2CryptoService`）
   - 校验验证码（查 `Captchas` 表）
   - 查 `Users` 表、比对密码哈希
   - 生成 `accessToken`（有效期 1 小时）+ `refreshToken`（30 天），写入 `Sessions`、`AccessTokens` 表
9. 响应回去（新格式 `{ data: {...}, meta: {...} }`），前端 `saveSession()` 存进 localStorage，跳转首页
10. 之后每个需要登录的请求自动带 `Authorization: Bearer <accessToken>`；如果 401，`api.js` 会自动用 refreshToken 换新 token 并重试一次

> ⚠️ 项目文档（AGENTS.md）写"Token 有效期 7 天"，但新 `/api/v1` 代码里实际是 **accessToken 1 小时、refreshToken 30 天**（`CloudStore.kt` 第 743～744 行）。这就是"文档会过期"的例子——**一切以代码为准**。

### 3.5 两套响应格式（最容易踩坑的点）

项目里有**新旧两代接口**，响应格式不一样，前端 `api.js` 两种都兼容：

| | 旧接口（Routes.kt） | 新接口（ApiV1Routes.kt） |
|---|---|---|
| 前缀 | `/xiaozhi`、`/api/v1`（旧）、无前缀 | `/api/v1` |
| 成功响应 | `{ "code": 0, "msg": "ok", "data": {...} }` | `{ "data": {...}, "meta": { "requestId": "..." } }` |
| 失败响应 | `{ "code": 1, "msg": "...", "data": null }` | `{ "error": { "code": "validation_error", "message": "...", ... } }` |
| 响应助手 | `call.respondEnvelope(result)`（Routes.kt） | `call.respondSuccess(...)` / `call.respondError(...)`（ApiPlugins.kt） |

**给新功能写接口，默认走新格式**（`ApiV1Routes.kt` + `ApiPlugins.kt` 的助手函数），不要自己拼 JSON。
错误码清单在 `ApiContracts.kt` 的 `ApiErrorCode` 枚举里（如 `VALIDATION_ERROR`、`AUTHENTICATION_REQUIRED`、`RATE_LIMIT_EXCEEDED`）。

### 3.6 三套前缀兼容（为什么同一个接口注册三次）

不同客户端习惯不同，所以同一组接口注册了三次：

```kotlin
registerCompatRoutes(store, "/xiaozhi")   // 移动端旧版
registerCompatRoutes(store, "/api/v1")    // 兼容旧版 api/v1
registerCompatRoutes(store, "")           // Android 无前缀
registerApiV1Routes(...)                  // 新的标准 /api/v1
```

生产环境 Nginx 还会把无前缀的 `/user/...`、`/agent/...` 等重写为 `/api/v1/...`（`nginx.conf` 里的 `rewrite`）。
**新功能只写 `/api/v1` 一份即可**，除非有旧客户端明确需要。

### 3.7 数据库和"自动建表"

- 所有表定义在 `Tables.kt`，每个表是一个 `object X : Table("表名")`
- 启动时 `DatabaseFactory` 调用 `SchemaUtils.createMissingTablesAndColumns(...)` **自动建表/补列**，所以没有迁移脚本
- 新增表要同时做两件事：① 在 `Tables.kt` 定义；② 把它加进 `DatabaseFactory.init` 的建表列表
- 所有数据库操作包在 `transaction { ... }` 里（Exposed 的事务写法）
- 本地默认 H2 内存库（`jdbc:h2:mem:animodoll`），**每次重启数据就没了**，这是正常的
- 生产用 PostgreSQL，通过 `.env` 的 `DATABASE_URL` 切换

### 3.8 前端结构（网页端怎么组织的）

```
frontend/
├── index.html            # 页面骨架（只有一个挂载点）
├── vite.config.js        # 开发代理 /api/v1、/xiaozhi → :8080
├── package.json          # 依赖：vite、sm-crypto
└── src/
    ├── main.js           # 入口：注册所有页面到路由
    ├── style.css         # 全局样式
    ├── js/
    │   ├── config.js     # BASE_URL 等常量
    │   ├── api.js        # ★ 统一的 API 封装（fetch、token、错误解析）
    │   ├── router.js     # SPA 路由 + 登录拦截
    │   ├── sm2.js        # SM2 密码加密
    │   ├── storage.js    # localStorage 会话持久化
    │   ├── utils.js / uuid.js
    └── pages/            # 每个页面一个模块，导出 render(app)
        ├── login.js / register.js / home.js
        ├── companions.js / chat.js / devices.js
        ├── social*.js / settings.js / ucloud.js
```

前端模式：**页面文件导出 `render(app)` 函数** → `main.js` 里 `register('页面名', render, { auth: true })` → 路由切换时自动渲染。
页面里用 `api.js` 导出的函数发请求，不用直接写 `fetch`（`api.js` 已处理 token、错误、刷新重试）。

### 3.9 部署主线

| 环境 | 怎么跑 | 数据 |
|------|--------|------|
| 本地开发 | 后端 `.\gradlew.bat run`（自动 H2）；前端 `npm run dev` | H2 内存库 |
| 本地联调 | 后端跑在 8080，前端 Vite 代理过去 | H2 内存库 |
| 生产 | `.\deploy-prod.ps1 -ServerIp <IP>`（本地构建镜像→打包→上传→远端启动） | PostgreSQL 16 + Nginx |

生产是 4 个容器（`docker-compose.prod.yml`）：

```
nginx（80/443，静态文件+反代）
  ├── app（Ktor :8080）
  │     ├── postgres（:5432）
  │     └── mailbot（:3000，Node 无头浏览器）
```

---

## 4. 概念速查表（看代码时遇到不懂的词来查）
按字母/使用频率排序。每一项都给了"去查什么"，具体网址见第 7 节。

| 概念 | 一句话解释 | 在本项目哪里出现 |
|------|----------|----------------|
| **JVM** | 运行 Java/Kotlin 程序的虚拟机 | 所有 Kotlin 代码跑在上面 |
| **Gradle** | 构建工具，管依赖、编译、测试 | `build.gradle.kts`、`gradlew.bat` |
| **依赖** | 项目用到的第三方库 | `build.gradle.kts` 的 `dependencies {}` |
| **路由** | "路径 → 处理函数"的映射 | `Routes.kt`、`ApiV1Routes.kt` 里的 `get("/xxx") { }` |
| **HTTP 方法** | GET 读、POST 新建、PUT/PATCH 改、DELETE 删 | 路由定义的第一件事 |
| **状态码** | 200 成功、201 创建成功、400 参数错、401 未登录、404 没有、429 太频繁、500 服务器错 | `HttpStatusCode` |
| **请求头/响应头** | 请求或响应上的附加信息（如 token、验证码） | `Authorization`、`X-Captcha-Code`、`X-Request-ID` |
| **JSON** | 前后端传数据的文本格式 | 几乎每个接口 |
| **序列化/反序列化** | 对象 ↔ JSON 的互相转换 | `@Serializable`、`kotlinx.serialization` |
| **DTO** | 只用来传数据的对象（请求体/响应体） | `ApiModels.kt`、`ApiContracts.kt` |
| **Controller/Handler** | 处理请求的函数（本项目叫"路由处理器"） | 路由块里 `{ }` 中的代码 |
| **Service/Store** | 业务逻辑层（本项目叫 Store） | `CloudStore`、`SocialStore` |
| **ORM** | 用代码操作数据库、不写裸 SQL 的工具 | Exposed |
| **表/行/列** | 数据库结构：一张表 = 一类数据，一行 = 一条记录，一列 = 一个字段 | `Tables.kt` |
| **主键** | 每行数据的唯一标识 | `PrimaryKey(id)` |
| **外键/引用** | 一个表引用另一个表（如笔记属于哪个用户） | `references Users.id` |
| **事务** | 一组数据库操作"要么全成要么全不成" | `transaction { ... }` |
| **连接池** | 复用数据库连接的池子，避免反复建连 | `DatabaseFactory` + HikariCP |
| **Token** | 登录后发给客户端的一张"通行证" | `Sessions`、`AccessTokens` 表 |
| **Bearer Token** | 请求头里 `Authorization: Bearer xxx` 的鉴权方式 | `AuthUtils.kt`、前端 `api.js` |
| **Refresh Token** | 长期 token，用于 accessToken 过期后换新 | `tryRefresh()` |
| **加密/解密** | 明文↔密文转换；SM2 是非对称加密 | `Sm2CryptoService`、`sm2.js` |
| **验证码** | 防止机器人/暴力破解的图形或短信码 | `CaptchaService`、`Captchas`、`SmsCodes` 表 |
| **协程（suspend）** | Kotlin 的异步写法，挂起而不阻塞线程 | 所有 `suspend fun` |
| **Result<T>** | 成功/失败两种结果的容器，配 `fold(onSuccess, onFailure)` | 几乎所有 Store 方法返回它 |
| **runCatching** | 把可能抛异常的代码包成 Result | `Store` 方法开头 |
| **SPA** | 单页应用：不刷新整个页面，JS 动态换内容 | `router.js` |
| **ES Module（ESM）** | JS 的模块化语法 `import` / `export` | 前端所有 `.js` |
| **fetch** | 浏览器发 HTTP 请求的 API | `api.js` |
| **localStorage** | 浏览器本地持久化存储 | `storage.js` |
| **代理（proxy）** | 开发时把某个路径的请求转发到别的地址 | `vite.config.js`、`nginx.conf` |
| **反向代理** | Nginx 收请求再转发给后端 | `nginx.conf` |
| **SSE** | 服务器向浏览器持续推送数据的协议 | 聊天流式输出（`/companions/{id}/turns`） |
| **OpenAPI** | 接口描述的规范格式；Swagger 是它的可视化工具 | 路由的 `.describe {}`、`/docs`、`/swagger` |
| **幂等（Idempotency）** | 同一个操作重复执行结果一致（防重复提交） | `IdempotencyKeys` 表、同步模块 |
| **ETag / If-Match** | 版本号式乐观锁：改数据前先校验版本 | `users/me` 的 `version` 字段 |
| **游标分页** | 用 `nextCursor` 翻页，比页码分页更稳 | `CursorPage` |
| **OOM** | 内存溢出（Out Of Memory） | 构建配置里限制了测试堆内存 |
| **Docker 镜像/容器** | 打包好的运行环境 / 跑起来的实例 | `Dockerfile`、compose 文件 |
| **.env** | 存放配置/密钥的文件，不提交 git | `backend/.env（模板见 backend/.env.example）` |

---

## 5. 想加一个"普通 API"怎么做（手把手）
以"给当前用户加一个便利贴（Note）功能"为例：`GET /api/v1/notes` 查列表，`POST /api/v1/notes` 新建。
**核心心法：找一个最像的现有接口（比如创建 Agent / 创建会话），照着抄结构。**

### 第 1 步：在 `Tables.kt` 定义表

```kotlin
object Notes : Table("notes") {
    val id = varchar("id", 36)
    val userId = varchar("user_id", 36) references Users.id
    val content = text("content")
    val createdAt = long("created_at")

    override val primaryKey = PrimaryKey(id)
}
```

### 第 2 步：把表加进自动建表列表

打开 `DatabaseFactory.kt`，在 `SchemaUtils.createMissingTablesAndColumns(...)` 的参数列表里加上 `Notes`：

```kotlin
SchemaUtils.createMissingTablesAndColumns(
    Users, Tokens, Captchas, SmsCodes, ... , Notes
)
```

### 第 3 步：定义请求/响应 DTO

放在 `ApiModels.kt`（旧 DTO 都在这）或 `ApiContracts.kt` 附近：

```kotlin
@Serializable
data class NoteDto(
    val id: String,
    val content: String,
    val createdAt: Long
)

@Serializable
data class CreateNoteRequest(
    val content: String = ""
)
```

### 第 4 步：在 `CloudStore.kt` 写业务函数

照抄现有函数的结构：`runCatching { ... }` + `transaction { ... }` + 返回 `Result<Dto>`。

```kotlin
fun createNote(token: String, request: CreateNoteRequest): Result<NoteDto> = runCatching {
    val content = request.content.trim()
    require(content.isNotBlank()) { "Content is required." }

    // 用 token 换出当前用户（复用 AuthUtils 里的工具）
    val userId = requireUserByAccessToken(token)[Users.id]
    val id = UUID.randomUUID().toString()
    val now = Instant.now().toEpochMilli()

    transaction {
        Notes.insert {
            it[Notes.id] = id
            it[Notes.userId] = userId
            it[Notes.content] = content
            it[Notes.createdAt] = now
        }
    }
    NoteDto(id = id, content = content, createdAt = now)
}
```

列表查询类似，抄 `listAgents` / `getUserProfileV1` 的写法（`selectAll().where { ... }` + 转 DTO）。

### 第 5 步：在 `ApiV1Routes.kt` 注册路由

在 `route("/api/v1") { ... }` 里加两段（用现成的响应助手，不要自己拼 JSON）：

```kotlin
get("/notes") {
    val token = call.bearerToken()
    val result = store.listNotes(token)
    result.fold(
        onSuccess = {
            val data = v1Json.encodeToJsonElement(it)
            call.respondSuccess(data)
        },
        onFailure = {
            call.respondError(ApiErrorCode.AUTHENTICATION_REQUIRED, it.message ?: "Failed to list notes")
        }
    )
}

post("/notes") {
    val token = call.bearerToken()
    val request = call.receive<CreateNoteRequest>()
    val result = store.createNote(token, request)
    result.fold(
        onSuccess = {
            val data = v1Json.encodeToJsonElement(NoteDto.serializer(), it)
            call.respondCreated(data)
        },
        onFailure = {
            call.respondError(ApiErrorCode.VALIDATION_ERROR, it.message ?: "Create note failed")
        }
    )
}
```

> 💡 想让它出现在 `/docs`、`/swagger` 和自动生成的接口索引里，可以给路由补一个 `.describe { }` 块（照抄 `ApiV1Routes.kt` 里现有接口的写法，比如 `/api/v1/health`）。

### 第 6 步：前端加封装函数

在 `frontend/src/js/api.js` 里加（`auth: true` 会自动带 Bearer token）：

```js
export function getNotes() {
  return request('/notes', { auth: true });
}

export function createNote(content) {
  return request('/notes', { method: 'POST', auth: true, body: { content } });
}
```

### 第 7 步：写测试

照抄 `src/test/kotlin/com/animo/cloud/ApiV1AuthTest.kt` 的结构：`testApplication { application { configureServer()(this) } }`，先注册登录拿 token，再调用新接口断言返回。

### 第 8 步：验证

```powershell
# 后端目录里
.\gradlew.bat test

# 前端目录里
npm run build
```

也可以先手动验证：启动后端后，用 Postman（项目已带 collection：`handoff/postman/`）或 curl 打接口。

---

## 6. 看代码时"看不懂"怎么办：阅读方法论
1. **先看接口文档**：`handoff/endpoint-index.md` 是完整接口清单，含示例请求/响应。
2. **在路由文件里搜路径**：`ApiV1Routes.kt` 或 `Routes.kt` 里搜 `/notes` 这样的片段，定位处理函数。
3. **看它调用了哪个 Store 方法**：顺着路由里的 `store.xxx(...)` 跳到 `CloudStore.kt` / `SocialStore.kt`。
4. **看不懂业务逻辑就看测试**：测试文件就是"这个接口应该怎么用"的最佳说明书。
5. **涉及数据就查 `Tables.kt`**：字段名、类型、外键一目了然。
6. **还是不懂，就把文件路径+行号扔给 AI**："请用最通俗的语言解释 `CloudStore.kt` 第 75 行这段代码在做什么。"
7. **不认识的库/函数**：按住 Ctrl 点击跳进定义看注释；或去官方文档搜函数名。

---

## 7. 需要查知识时：查什么、去哪查
### 7.1 项目内部资料（优先看这些）

| 资料 | 位置 | 能解决什么问题 |
|------|------|--------------|
| 项目说明 | 根目录 `AGENTS.md` | 项目约定、常用命令、技术栈 |
| 开发概述 | `docs/AnimoDoll云端服务开发概述.md` | 架构图、模块说明、技术选型原因 |
| 接口索引 | `handoff/endpoint-index.md`（另有 .xlsx 版） | 每个接口的路径、参数、响应示例；**自动生成，不要手改** |
| OpenAPI 规范 | 由代码自动生成：跑 `gradlew test` 导出 `build/generated-openapi.yaml`；旧 `handoff/openapi/animo-api-v1.yaml` 仅作兜底 | 机器可读的接口定义，可导入工具 |
| 索引生成脚本 | `scripts/generate-endpoint-index.py` | 从 OpenAPI 重新生成 md + xlsx；改完路由后跑它同步 |
| 协议说明 | `handoff/protocols/*.md` | SSE 流式、OTA、同步、免登录等特殊流程 |
| 工具指南 | `handoff/TOOLS-GUIDE.md` | 联调工具使用方式 |
| 测试报告 | `handoff/testing/*.md` | 已知问题、性能数据 |
| 设计文档 | `docs/superpowers/`、`.superpowers/sdd/` | 某个功能当初为什么这么设计 |
| 测试代码 | `backend/src/test/` | "现有接口的正确用法" |

### 7.2 官方文档（每个技术给一个入口 + 搜索词）

规则：**先看官方文档的"概念"页，再看"示例"；搜索时用英文关键词效果最好。**

| 想搞懂 | 去哪查（官方） | 搜什么关键词 |
|--------|---------------|------------|
| Kotlin 语法 | https://kotlinlang.org/docs/home.html | `Kotlin 教程` / `Kotlin data class` |
| Ktor 路由 | https://ktor.io/docs/routing-in-ktor.html | `Ktor routing get post` |
| Ktor 请求/响应 | https://ktor.io/docs/requests.html | `Ktor receive JSON respond` |
| Ktor 测试 | https://ktor.io/docs/testing.html | `Ktor testApplication` |
| kotlinx.serialization | https://github.com/Kotlin/kotlinx.serialization | `kotlinx serialization Json` |
| Exposed 表定义 | https://www.jetbrains.com/help/exposed/table-definition.html | `Exposed Table varchar references` |
| Exposed 增删改查 | https://www.jetbrains.com/help/exposed/ | `Exposed insert select where` |
| HikariCP 配置 | https://github.com/brettwooldridge/HikariCP | `HikariCP configuration maximumPoolSize` |
| PostgreSQL | https://www.postgresql.org/docs/16/index.html | `PostgreSQL tutorial` |
| H2 | https://www.h2database.com/html/main.html | `H2 in-memory database` |
| Gradle | https://docs.gradle.org/current/userguide/userguide.html | `Gradle dependencies kotlin dsl` |
| JavaScript 基础 | https://developer.mozilla.org/zh-CN/docs/Web/JavaScript | `MDN JavaScript 教程` |
| fetch 发请求 | https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API | `MDN fetch` |
| ES Module | https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Modules | `MDN JavaScript modules` |
| localStorage | https://developer.mozilla.org/zh-CN/docs/Web/API/Window/localStorage | `MDN localStorage` |
| HTTP 状态码 | https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Status | `HTTP 状态码 200 401 429` |
| Authorization 头 | https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Authorization | `Bearer token 鉴权` |
| SSE | https://developer.mozilla.org/zh-CN/docs/Web/API/Server-sent_events | `MDN Server-Sent Events` |
| Vite | https://vitejs.dev/guide/ | `Vite dev server proxy` |
| sm-crypto | https://github.com/JuneAndGreen/sm-crypto | `sm-crypto SM2` |
| Nginx 反代 | https://nginx.org/en/docs/http/ngx_http_proxy_module.html | `nginx proxy_pass` |
| Docker Compose | https://docs.docker.com/compose/ | `docker compose services` |
| Dockerfile | https://docs.docker.com/reference/dockerfile/ | `Dockerfile multi-stage` |

### 7.3 中文学习资料（入门更快）

| 平台 | 地址 | 适合学什么 |
|------|------|-----------|
| 菜鸟教程 | https://www.runoob.com/ | Kotlin、JavaScript、SQL 速查 |
| 廖雪峰 | https://liaoxuefeng.com/ | JavaScript 教程（经典） |
| 阮一峰 ES6 | https://es6.ruanyifeng.com/ | 前端模块化、语法 |
| MDN 中文 | https://developer.mozilla.org/zh-CN/ | Web 技术权威手册 |
| B 站 | 搜"Ktor 教程""Exposed 教程""Kotlin 入门" | 视频入门 |
| 掘金/知乎 | 搜"Ktor 踩坑""Exposed 用法" | 中文实战经验 |
| Stack Overflow | https://stackoverflow.com/ | 报错解决（英文） |

### 7.4 怎么搜一个报错

万能模板（中文/英文都行）：

```
<技术名> <报错关键词> example
```

例如：

- `Ktor receive json 404`
- `Exposed table references example`
- `Vite proxy ECONNREFUSED`
- `Gradle 下载依赖慢 镜像`
- `npm install 卡住 淘宝镜像`

把报错原文（比如 `ClassNotFound`、`Cannot access ...`）整段复制去搜，比描述现象更准。

### 7.5 怎么让 AI 帮你（这个很重要）

你现在就在用 Codex——它本身就是最好的"查字典"。提问质量决定答案质量：

| 不好的问法 | 好的问法 |
|-----------|---------|
| "这个报错怎么回事" | "`backend` 下 `gradlew.bat test` 报错 `xxx`，完整堆栈如下：……请解释原因和最简单的修法" |
| "Ktor 是什么" | "我是零基础，请用大白话解释 Ktor 的路由，并用本项目 `ApiV1Routes.kt` 第 38 行举例" |
| "帮我加个接口" | "请模仿 `CloudStore.kt` 里 `register` 的风格，帮我加一个 `GET /api/v1/notes` 接口，先别改代码，先给我计划" |

**安全规则**：不要盲目相信 AI 给的改法；每次改完跑一遍 `gradlew.bat test` 和 `npm run build`。

---

## 8. 常见问题 / 报错对照表
| 现象 | 最常见原因 | 怎么查/怎么修 |
|------|-----------|--------------|
| `gradlew` 不是内部或外部命令 | 没在 `backend` 目录下运行，或没装 JDK 17 | 先 `cd backend`；`java -version` 检查 JDK |
| 后端启动报端口占用 | 8080 被占用 | `netstat -ano \| findstr 8080` 找到 PID，关掉或用 `.env` 改 `PORT` |
| 编译报红（Kotlin） | 缺 import、语法错误、类型不匹配 | 看报错行号；把报错发给 AI；对照最近一个类似文件 |
| 请求返回 404 | 路径/前缀不对；路由没注册；代理没配 | 对照 `endpoint-index.md`；确认 `/api/v1`；检查 `vite.config.js` / `nginx.conf` |
| 返回 401 | token 没带/过期/无效 | 请求头要 `Authorization: Bearer <token>`；重新登录 |
| 前端提示"网络错误" | 后端没启动，或代理目标不对 | 确认后端跑在 8080；浏览器 F12 Network 看请求地址 |
| 跨域（CORS）报错 | 直接跨端口访问了后端 | 开发时走 Vite 代理（`/api/v1` 相对路径）；生产走 Nginx 同域 |
| 登录/验证码一直失败 | 验证码逻辑、SM2 模式不匹配 | 本地开发可设 `ANIMO_DEV_CAPTCHA_CODE`、`ANIMO_DEV_SMS_CODE` 固定验证码 |
| 数据库连接失败 | `.env` 里 `DATABASE_URL` 配错，或 Postgres 没起 | 本地先清空 `DATABASE_URL` 用 H2；生产检查容器状态 |
| 重启后数据不见了 | 用了 H2 内存库 | 正常现象；要持久化就配 PostgreSQL |
| 中文显示乱码 | 文件编码不是 UTF-8，或用 PowerShell 默认编码读 | 编辑器保存为 UTF-8；PowerShell 用 `Get-Content -Encoding UTF8` 读 |
| 重启后端后旧页面登录/加密失败 | SM2 私钥没固定，重启后公钥变了 | 生产环境在 `.env` 配置 `ANIMO_SM2_PRIVATE_KEY_HEX`（64 位十六进制），固定密钥对 |
| 接口索引和实际接口对不上 | `endpoint-index.md` 是生成产物 | 在 `backend` 跑 `gradlew test`（导出 spec），再执行 `python scripts/generate-endpoint-index.py`，不要手改 md/xlsx |
| `npm install` / Gradle 下载慢或失败 | 网络问题 | 配国内镜像（npm 淘宝镜像、Gradle 阿里云镜像） |
| 测试跑挂/内存不足 | 机器内存紧张 | `build.gradle.kts` 已限制测试堆内存（512m）；关掉其他 Java 进程 |
| `hs_err_pid*.log`、`replay_*.log` | JVM 崩溃日志 | 一般可忽略；反复出现说明环境不稳定 |

---

## 9. 想系统学：推荐学习路线
如果你愿意花时间真正学会，按这个顺序（每阶段配"检验标准"）：

1. **HTTP 与 API 基础（1～2 天）**：GET/POST、状态码、JSON。检验：能用 Postman 调通项目里的 `/api/v1/health`。
2. **JavaScript + 浏览器（3～5 天）**：变量、函数、Promise/async、fetch、DOM。检验：能读懂 `frontend/src/js/api.js` 和 `pages/login.js` 在干什么。
3. **Kotlin 基础（3～5 天）**：类、data class、函数、空安全、协程。检验：能读懂 `ApiModels.kt` 和一段 `CloudStore` 函数。
4. **Ktor + Exposed（3～5 天，对照本项目）**：路由、receive/respond、表定义、transaction。检验：跟着第 5 节加一个接口并跑通测试。
5. **SQL 基础（2～3 天）**：SELECT/INSERT/UPDATE、主键外键、索引。检验：能看懂 `Tables.kt` 和 Exposed 查询。
6. **部署（2～3 天）**：Docker、Compose、Nginx。检验：看懂 `docker-compose.prod.yml` 和 `nginx.conf` 每段在干嘛。
7. **进阶**：SSE、Token/刷新、幂等、乐观锁、OTA、无头浏览器集成（按需）。

每个阶段结束时，回来看一眼本文档第 3 节的"构建主线"，你会发现一次比一次清楚。

---

## 10. 附录：关键文件快速索引（一张图看懂去哪改）
| 想改什么 | 去改哪个文件 |
|---------|------------|
| 加数据库表 | `Tables.kt` + `DatabaseFactory.kt`（建表列表） |
| 加请求/响应数据结构 | `ApiModels.kt` 或 `ApiContracts.kt` |
| 加新接口（推荐） | `ApiV1Routes.kt` |
| 重新生成接口索引 | 在 `backend` 跑 `gradlew test` 后执行 `python scripts/generate-endpoint-index.py` |
| 加旧兼容接口 | `Routes.kt` |
| 改业务逻辑/数据操作 | `CloudStore.kt`（用户/AI/设备/聊天）、`SocialStore.kt`（社交） |
| 改配置项 | `.env`（本地）、`CloudStore.kt` 里 `ServerConfig`、`docker-compose.prod.yml` |
| 改后端依赖/构建 | `build.gradle.kts` |
| 改鉴权逻辑 | `AuthUtils.kt`、`CloudStore.kt` 的登录/session 部分 |
| 改加密 | `Sm2CryptoService.kt`（后端）、`sm2.js`（前端） |
| 前端加页面 | `src/pages/新建.js` + `main.js` 注册 + 可加 `router.js` 规则 |
| 前端加接口调用 | `src/js/api.js` |
| 改前端代理 | `vite.config.js` |
| 改生产反代/限流 | `nginx.conf` |
| 改部署 | `deploy-prod.ps1`、`Dockerfile`、`docker-compose.prod.yml` |
| 跑后端测试 | 后端目录 `.\gradlew.bat test` |
| 跑前端构建 | 前端目录 `npm run build` |

---

## 最后的话
这个项目看起来文件很多，但**主干的套路只有一套**：

> 前端页面 → `api.js` 统一发请求 → Ktor 路由 → Store 业务函数 → Exposed 操作表 → JSON 返回 → 页面渲染。

你不需要一次全懂。先把第 3 节"构建主线"读熟，然后找一个你最关心的功能（比如登录），把它从页面到数据库整条线走一遍。
走完一条线，项目对你就不再是迷宫了——剩下的都是"同一套路的重复"。

当前代码中，短信服务分两层：**对外 HTTP 接口**（`/api/v1`）和 **Kotlin 内部服务接口**（`com.animo.cloud.sms`）。对外路由定义在 `backend/src/main/kotlin/com/animo/cloud/ApiV1AuthRoutes.kt`，服务实现分别在 `sms/SmsSender.kt` 与 `sms/SmsVerificationService.kt`。

## 附属文档：SMS 短信服务接口说明

## 一、对外 HTTP 接口
统一使用新 `/api/v1` 响应格式：成功 `{ "data": {...}, "meta": { "requestId": "..." } }`，失败 `{ "error": {...} }`。

### 1. 发送短信验证码

`POST /api/v1/auth/sms-codes`（无需登录）

请求体：

```json
{
  "phone": "13800138000",
  "purpose": "verify"
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `phone` | string | 是 | 大陆手机号，服务端归一化后校验 `^1[3-9]\d{9}$` |
| `purpose` | string | 否 | `verify`（默认，通用验证）或 `reset_password` |

成功响应（HTTP 200）：

```json
{
  "data": {
    "phone": "13800138000",
    "sent": true,
    "devCode": null
  },
  "meta": {
    "requestId": "..."
  }
}
```

`devCode` 仅在 `ANIMO_DEV_SMS_CODE` 配置且使用 Mock 发送通道时返回测试验证码，生产环境为 `null`。

### 2. 校验短信验证码

`POST /api/v1/auth/sms-codes/verify`（无需登录）

请求体：

```json
{
  "phone": "13800138000",
  "code": "123456",
  "purpose": "verify"
}
```

成功响应（HTTP 200）：

```json
{
  "data": {
    "verified": true
  },
  "meta": {
    "requestId": "..."
  }
}
```

验证码为一次性：校验成功即消费，不能重复使用。

### 常见错误

| 场景 | HTTP 状态 | `error.code` |
|------|-----------|--------------|
| 手机号格式错误 / 验证码错误或已使用 | 422 | `validation_error` |
| `purpose=reset_password` 但手机号未绑定账号 | 404 | `not_found` |
| 发送冷却（默认 60s）或超过每日上限（默认 10 条） | 429 | `rate_limit_exceeded`，并带 `Retry-After` |
| 短信供应商发送失败 | 422/500 | 按异常映射 |

错误响应示例：

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "SMS code already sent, retry after 32s",
    "details": [],
    "retryable": false,
    "retryAfterSeconds": 32,
    "requestId": "..."
  }
}
```

## 二、Kotlin 内部服务接口
### 1. `SmsSender` — 短信发送通道抽象

文件：`backend/src/main/kotlin/com/animo/cloud/sms/SmsSender.kt`

```kotlin
interface SmsSender {
    /** 是否只是模拟发送（不真正发出短信） */
    val isMock: Boolean

    /** 向 phone 发送验证码 code */
    fun send(phone: String, code: String)

    /** 由供应商侧校验验证码；默认 false，只有 Aliyun 认证通道远端校验 */
    fun verify(phone: String, code: String): Boolean = false
}
```

实现与工厂：

```kotlin
class MockSmsSender(logger: Logger) : SmsSender
class AliyunSmsSender(...) : SmsSender          // aliyun-legacy：本地生成码，阿里云 Dysmsapi 发送
class AliyunSmsAuthSender(...) : SmsSender      // aliyun / aliyun-auth / pnvs：阿里云生成并校验
fun createSmsSender(config: ServerConfig, logger: Logger): SmsSender
```

### 2. `SmsVerificationService` — 验证码业务服务

文件：`backend/src/main/kotlin/com/animo/cloud/sms/SmsVerificationService.kt`

```kotlin
class SmsVerificationService(
    private val config: ServerConfig,
    private val sender: SmsSender,
    private val logger: Logger
) {
    companion object {
        const val PURPOSE_VERIFY = "verify"
        const val PURPOSE_RESET_PASSWORD = "reset_password"
        val PURPOSES = setOf(PURPOSE_VERIFY, PURPOSE_RESET_PASSWORD)
    }

    class SmsRejectException(message: String, val retryAfterSeconds: Long?) : IllegalStateException(message)

    data class SendOutcome(val phone: String, val devCode: String?)

    fun normalizePhone(raw: String): String
    fun send(rawPhone: String, purpose: String): SendOutcome
    fun verify(rawPhone: String, purpose: String, code: String, consume: Boolean): Boolean
    fun consumeAll(phone: String, purpose: String)
}
```

### 3. `AuthService` 对外封装

文件：`backend/src/main/kotlin/com/animo/cloud/auth/AuthService.kt`

```kotlin
fun sendSmsCode(request: SmsVerificationRequest): SmsVerificationResponse
fun verifySmsCode(request: SmsCodeVerifyRequest): Boolean
```

其中 DTO 定义在 `model/ApiModels.kt`：

```kotlin
data class SmsVerificationRequest(
    val phone: String = "",
    val purpose: String = "verify"
)

data class SmsCodeVerifyRequest(
    val phone: String = "",
    val code: String = "",
    val purpose: String = "verify"
)

data class SmsVerificationResponse(
    val phone: String,
    val sent: Boolean,
    val devCode: String? = null
)

data class SmsCodeVerifyResponse(
    val verified: Boolean
)
```

## 三、核心安全规则
- 验证码明文不落库，只存 `SHA-256(phone:purpose:code)`。
- 验证码绑定 `purpose`，注册码不能用于重置密码。
- 发送侧：同手机号同用途 60s 冷却、每日 10 条上限。
- 校验侧：滑动窗口内最多 5 次失败尝试，超过返回 429。
- 一次性：成功消费原子更新，避免并发重放。
- 发送通道由 `ANIMO_SMS_PROVIDER` 控制：`mock`（默认）、`aliyun`/`aliyun-auth`/`pnvs`（阿里云短信认证，码由阿里云生成和校验）、`aliyun-legacy`（阿里云普通短信，码本地生成和校验）。

---
