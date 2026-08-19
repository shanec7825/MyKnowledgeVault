---
type: meta
title: "AnimoDoll 短信服务接口说明"
created: 2026-08-19
updated: 2026-08-19
tags:
  - animo-cloud
  - sms
  - api
---

当前代码中，短信服务分两层：**对外 HTTP 接口**（`/api/v1`）和 **Kotlin 内部服务接口**（`com.animo.cloud.sms`）。对外路由定义在 `backend/src/main/kotlin/com/animo/cloud/ApiV1AuthRoutes.kt`，服务实现分别在 `sms/SmsSender.kt` 与 `sms/SmsVerificationService.kt`。

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