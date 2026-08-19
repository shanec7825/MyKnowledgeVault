---
type: project
title: "Relational Databases"
created: 2026-08-11
updated: 2026-08-19
status: developing
tags:
  - project
  - database
  - sql
  - postgresql
  - backend
related:
  - "[[PostgreSQL 教程]]"
  - "[[Backend Introduction]]"
sources:
  - "[[wiki/resources/PostgreSQL Tutorial|PostgreSQL Tutorial]]"
goal: "关系数据库入门：以 PostgreSQL 为主线，建立 SQL 查询、表设计、约束、事务、索引与存储过程的系统知识。"
domain: database
complexity: intermediate
---

# Relational Databases

**项目**：关系数据库入门学习——以 PostgreSQL 为主线，从 SQL 基础到高级特性。

## 目标

- 掌握关系数据库核心概念：表结构、约束、事务（ACID）、索引、视图
- 以 PostgreSQL 为实践平台，系统学习 SQL 和数据建模
- 后续扩展：MySQL 对比、数据库设计范式、查询优化、ORM 使用

## 内容

- [[PostgreSQL 教程]] — PostgreSQL 知识体系与学习路线（概念页，17 基础 + 5 高级模块）
- [[wiki/resources/PostgreSQL Tutorial|PostgreSQL Tutorial]] — PostgreSQL 教程完整目录（来源页，neon.com/postgresql/tutorial）

## 待办

- [x] 摄入 PostgreSQL 教程（数据库入门）
- [ ] 练习 SQL 基础查询（SELECT / WHERE / JOIN / GROUP BY）
- [ ] 练习表设计与约束（CREATE TABLE / PK / FK / CHECK）
- [ ] 练习事务操作（BEGIN / COMMIT / ROLLBACK）
- [ ] 探索 PostgreSQL JSON 类型与 hstore
- [ ] 探索 PostgreSQL 索引类型与 EXPLAIN
- [ ] 对比 MySQL 与 PostgreSQL 差异
- [ ] 补充数据库设计范式（1NF / 2NF / 3NF）

## 完成标准

- [ ] 待办中的 SQL 查询、表设计、事务练习全部完成并留下练习笔记
- [ ] PostgreSQL JSON/hstore 与索引 EXPLAIN 各有一页探索笔记
- [ ] 输出《关系数据库选型对照表》（PostgreSQL / MySQL）
- [ ] 与 [[wiki/projects/Backend Introduction/Backend Introduction|Backend Introduction]] 的 API / 服务器主题衔接完成
- [ ] `wiki-lint` 无死链
- [ ] 全部完成后：`status: completed`，项目移入 `wiki/archives/`

## Related

- [[Backend Introduction]] — 后端入门（网络 → 数据库 → API）
- [[PostgreSQL 教程]]
- [[wiki/resources/PostgreSQL Tutorial|PostgreSQL Tutorial]]
