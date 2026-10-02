---
type: project
title: "Relational Databases"
created: 2026-08-11
updated: 2026-08-30
status: active
area: "后端"
domain: database
complexity: intermediate
goal: "关系数据库入门：以 PostgreSQL 为主线，建立 SQL 查询、表设计、约束、事务、索引与存储过程的系统知识。"
code:
  - "D:/Projects/Relational Databases"
related:
  - "[[PostgreSQL 教程]]"
  - "[[Backend Introduction]]"
tags:
  - project
  - database
  - sql
  - postgresql
  - backend
  - area/后端
---

# Relational Databases

## 前置
**前置项目**：无

**知识框架体系**：概念层（关系模型、约束、ACID 事务、索引、设计范式）；技能层（写 SELECT/JOIN/GROUP BY、设计表与约束、使用事务、看 EXPLAIN）；工具层（PostgreSQL、psql、Exposed ORM）。

## 目标产出
> 关系数据库入门：以 PostgreSQL 为主线，建立 SQL 查询、表设计、约束、事务、索引与存储过程的系统知识。

**具体目标**：

- 掌握关系数据库核心概念：表结构、约束、事务（ACID）、索引、视图
- 以 PostgreSQL 为实践平台，系统学习 SQL 和数据建模
- 后续扩展：MySQL 对比、数据库设计范式、查询优化、ORM 使用

**交付工作区**：`D:/Projects/Relational Databases`（交付成果放此；过时版本移入其 `archive/`。全局映射见 [[wiki/meta/code-repos]]）

**交付物**：

- [ ] SQL 查询、表设计、事务三组练习笔记
- [ ] PostgreSQL JSON/hstore 与索引 EXPLAIN 各一页探索笔记
- [ ] 《关系数据库选型对照表》（PostgreSQL / MySQL）
- [ ] 与 Backend Introduction 的 API 主题衔接
- [ ] 全部完成后：`status: completed` → 移入 `wiki/archives/`

## 项目关键点
**核心内容**：以 PostgreSQL 为主线建立关系数据库体系，从 SQL 查询到表设计、事务、索引与 JSON 高级特性。

**关键难点**：

- 事务隔离级别与并发异常是概念硬点，背定义不如亲手造出脏读/不可重复读。
- 索引不是「加上就快」，要用 EXPLAIN 验证查询计划。
- 范式与反范式是权衡题，需要真实表设计经验才体会得到。

## 内容
- [[PostgreSQL 教程]] — PostgreSQL 知识体系与学习路线（概念页，17 基础 + 5 高级模块）
- PostgreSQL Tutorial — PostgreSQL 教程完整目录（来源页，neon.com/postgresql/tutorial）

## 待办
- [x] 摄入 PostgreSQL 教程（数据库入门）
- [ ] 练习 SQL 基础查询（SELECT / WHERE / JOIN / GROUP BY）
- [ ] 练习表设计与约束（CREATE TABLE / PK / FK / CHECK）
- [ ] 练习事务操作（BEGIN / COMMIT / ROLLBACK）
- [ ] 探索 PostgreSQL JSON 类型与 hstore
- [ ] 探索 PostgreSQL 索引类型与 EXPLAIN
- [ ] 对比 MySQL 与 PostgreSQL 差异
- [ ] 补充数据库设计范式（1NF / 2NF / 3NF）

## Related
- [[Backend Introduction]] — 后端入门（网络 → 数据库 → API）
- [[PostgreSQL 教程]]
- PostgreSQL Tutorial

---
