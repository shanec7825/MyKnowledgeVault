---
address: c-000072
type: source
title: "What is a Domain Name?"
created: 2026-08-11
updated: 2026-08-11
status: seed
source_type: webpage
url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Howto/Web_mechanics/What_is_a_domain_name"
source_id: "src-e649971407a0c4c67296"
sha256: "0473236edd4831acc8e980660a60f90145be9e38d8e9bd962993a1b22c4cc070"
authority: official
independence_key: "mdn-what-is-a-domain-name"
review_state: active
key_claims:
  - "域名是互联网基础设施的关键部分，为互联网上的任何 Web 服务器提供人类可读的地址；计算机实际通过 IP 地址（IPv4/IPv6）通信。"
  - "域名由多个以点分隔的部分组成，从右向左读；每个部分提供关于整个域名的特定信息。"
  - "TLD 位于域名最右侧，最大长度 63 字符（多数 2–3 字符）；.gov 仅限政府、.edu 仅限教育机构；完整 TLD 列表由 ICANN 维护。"
  - "标签（label）大小写不敏感，1–63 字符，仅含 A–Z、0–9 与连字符（不能作首尾字符）；紧邻 TLD 前的标签叫二级域（SLD）。"
  - "对于自有的域名可创建任意子域放置不同内容，如 developer.mozilla.org、support.mozilla.org。"
  - "不能真正购买域名，而是按年付费获得使用权，可续期且有优先权；域名最终会释放给他人使用。"
  - "注册商（registrar）使用域名注册局（registry）记录域名相关的技术与管理信息；某些 TLD（如 .fire）由非注册商机构管理。"
  - "可用注册商 whois 服务或命令行 `whois <domain>` 查询域名可用性；输出 NOT FOUND 表示尚未注册。"
  - "DNS 数据库存储在全球每台 DNS 服务器上，并参照少数权威名称服务器；信息更新后需传播刷新，因此有延迟。"
  - "DNS 请求流程：浏览器查本地缓存 → 询问 DNS 服务器 → 获得 IP 后与 Web 服务器协商内容。"
tags:
  - source
  - tutorial
  - domain
  - dns
  - networking
---

# What is a Domain Name?

- **来源**：[MDN Web Docs — What is a Domain Name?](https://developer.mozilla.org/en-US/docs/Learn_web_development/Howto/Web_mechanics/What_is_a_domain_name)
- **权威性**：official（MDN Web Docs，Mozilla 官方开发者文档）
- **摄入文件**：`inbox/What is a Domain Name.md`
- **摄入日期**：2026-08-11

## Summary

> **总纲**：域名（Domain Name）是互联网基础设施的关键部分，为互联网上的任何 Web 服务器提供**人类可读的地址**。

- 任何联网计算机都能通过公网 IP 地址被访问：IPv4（如 `192.0.2.172`）或 IPv6（如 `2001:db8:8b73:0000:0000:8a2e:0370:1337`）。
- 计算机容易处理 IP 地址，但人很难记住"谁在运行服务器 / 网站提供什么服务"；IP 地址难记且可能随时间变化。
- 为解决这些问题，我们使用**域名**这类人类可读的地址。

## Structure of domain names

- 域名由多个部分组成，以点分隔，**从右向左读**；每个部分提供关于整个域名的特定信息。

### TLD

- TLD（Top-Level Domain，顶级域）位于域名最右侧，告诉用户该域名背后服务的一般用途。
- 通用 TLD（`.com`、`.org`、`.net`）不要求服务满足特定标准；一些 TLD 有更严格的政策：
  - 本地 TLD（`.us`、`.fr`、`.se`）可能要求服务以特定语言提供或托管在特定国家。
  - `.gov` 仅限政府部门使用；`.edu` 仅限教育/学术机构使用。
- TLD 可包含特殊字符与拉丁字符；最大长度 63 字符，多数为 2–3 字符。
- 完整 TLD 列表由 ICANN 维护。

### Label (or component)

- 标签（label）是 TLD 之后的组成部分：大小写不敏感，1–63 字符，仅含字母 `A`–`Z`、数字 `0`–`9` 和连字符 `-`（不能作首尾字符）。`a`、`97`、`hello-strange-person-16-how-are-you` 都是合法 label。
- 紧邻 TLD 前的 label 也叫**二级域（SLD，Secondary Level Domain）**。
- 域名可以有多个 label，并非必须有 3 个：例如 `informatics.ed.ac.uk` 是合法域名。
- 对于自有的域名（如 `mozilla.org`），可创建"子域"放置不同内容：`developer.mozilla.org`、`support.mozilla.org`、`bugzilla.mozilla.org`。

## Buying a domain name

### Who owns a domain name?

- 你**不能真正购买域名**——否则闲置域名会被永久锁死。相反，你**按年付费获得使用权**，可续期且续期有优先权，但从不拥有它。
- 公司类型的**注册商（registrar）**使用**域名注册局（registry）**记录将你与域名连接起来的技术与管理信息。
- 注意：某些域名并非由注册商管理，例如 `.fire` 下的域名由 Amazon 管理。

### Finding an available domain name

- 到注册商网站使用其 `whois` 服务；或在 shell 中执行 `whois <domain>`。
- `whois mozilla.org` 会显示注册人、注册机构、创建/过期日期等；若输出 `NOT FOUND` 表示该域名尚未注册、可申请注册。

### Getting a domain name

1. 访问注册商网站，点击"获取域名"。
2. 填写表单（务必检查拼写——付费后就无法更改）。
3. 注册成功后，几小时内所有 DNS 服务器都会收到你的 DNS 信息。
- 注意：注册商会要求真实地址；在部分国家，若注册商无法提供有效地址，域名可能被强制关闭。

## DNS refreshing

- DNS 数据库存储在全球每台 DNS 服务器上，所有服务器参照少数"**权威名称服务器**"（authoritative name servers / 顶级 DNS 服务器）。
- 注册商创建或更新信息后，必须刷新到每个 DNS 数据库；DNS 服务器会缓存一段时间，到期后自动失效并向权威服务器重新查询。因此 DNS 传播需要时间。

## How does a DNS request work?

- 浏览器访问 `mozilla.org` 的过程：
  1. 浏览器先查本地 DNS 缓存；若命中，名称即翻译为 IP，浏览器与 Web 服务器协商内容。
  2. 若未知，则向 DNS 服务器查询该域名对应的 IP 地址。
  3. 拿到 IP 后，浏览器与 Web 服务器协商内容并建立连接。

## Related

- [[域名详解]] — 概念页（中文综合讲解）
- [[互联网工作原理]] — 网络基础概念页（DNS 与 IP 地址的基础）
- [[Backend Introduction]] — 后端入门项目页
