---
type: concept
title: "PostgreSQL 教程"
created: 2026-08-11
updated: 2026-08-11
status: developing
tags:
  - concept
  - postgresql
  - database
  - sql
  - backend
related:
  - "[[PostgreSQL Tutorial]]"
  - "[[Backend Introduction]]"
sources:
  - "[[PostgreSQL Tutorial]]"
complexity: beginner
domain: backend
aliases:
  - PostgreSQL 入门
  - PostgreSQL 学习路线
  - PostgreSQL Tutorial 解读
  - PostgreSQL 基础知识
---

# PostgreSQL 教程

本文基于 neon.com 的《[[PostgreSQL Tutorial]]》梳理 PostgreSQL 的知识体系，作为 [[Backend Introduction]] 项目的数据库主题：从基本查询到高级特性，构建 PostgreSQL 的系统学习路线。

## 概述

> **总纲**：PostgreSQL 是「最先进的开源数据库管理系统」，以 SQL 标准兼容性、丰富的扩展类型（JSON / hstore / 数组 / 自定义类型）和高级分析能力（CTE / 窗口函数 / 递归查询）著称。

- PostgreSQL 定位：关系型数据库，但远超传统 RDBMS——原生 JSON 支持使其兼具文档数据库能力，PL/pgSQL 使其具备编程语言级的存储过程。
- 与 [[Backend Introduction]] 已有知识衔接：PostgreSQL 即后端技术栈中的**数据库层**，承接 HTTP 请求处理后的持久化存储需求。

## 学习路线

PostgreSQL 知识体系可分为基础操作与高级特性两层：

### 基础层（17 节）

| 模块 | 主题 | 核心概念 |
|------|------|----------|
| **数据查询** | SELECT / 别名 / ORDER BY / DISTINCT | 单表数据检索 |
| **数据过滤** | WHERE / AND / OR / LIMIT / FETCH / IN / BETWEEN / LIKE / IS NULL | 条件筛选与分页 |
| **多表连接** | INNER / LEFT / RIGHT / FULL OUTER / CROSS / NATURAL JOIN / Self-join | 关系代数基础 |
| **数据分组** | GROUP BY / HAVING | 聚合与分组过滤 |
| **集合运算** | UNION / INTERSECT / EXCEPT | 多结果集操作 |
| **高级分组** | GROUPING SETS / CUBE / ROLLUP | 多维聚合与报表 |
| **子查询** | Subquery / Correlated Subquery / ANY / ALL / EXISTS | 嵌套查询 |
| **CTE** | Common Table Expression / Recursive CTE | 可读性与递归 |
| **数据修改** | INSERT / UPDATE / DELETE / UPSERT | CRUD 与合并 |
| **事务** | BEGIN / COMMIT / ROLLBACK | ACID 保证 |
| **导入导出** | COPY（CSV） | 数据迁移 |
| **表管理** | CREATE / ALTER / DROP / TRUNCATE / 临时表 / SERIAL / 序列 / Identity | DDL 操作 |
| **约束** | Primary Key / Foreign Key / CHECK / UNIQUE / NOT NULL / DEFAULT / DELETE CASCADE | 数据完整性 |
| **数据类型** | Boolean / 字符（CHAR/VARCHAR/TEXT）/ 数值（NUMERIC/Integer/Float）/ 日期时间 / UUID / JSON / Array / hstore / Enum / XML / BYTEA / 复合类型 | 类型系统 |
| **条件表达式** | CASE / COALESCE / NULLIF / CAST | 条件逻辑与类型转换 |
| **实用工具** | psql 命令 | 命令行交互 |
| **实用技巧** | 表比较 / 去重 / 随机数 / EXPLAIN / PostgreSQL vs MySQL | 日常运维 |

### 高级层（5 节）

| 模块 | 主题 | 核心概念 |
|------|------|----------|
| **PL/pgSQL** | 存储过程与用户定义函数 | 服务端编程 |
| **触发器** | Trigger 概念与管理 | 事件驱动逻辑 |
| **视图** | View 概念与管理 | 虚拟表抽象 |
| **索引** | 索引类型与查询优化 | 性能调优 |
| **管理** | 角色 / 数据库管理 / 备份 / 恢复 | DBA 运维 |

## PostgreSQL 的独特优势

基于教程涉及的特色功能，PostgreSQL 区别于其他 RDBMS 的关键点：

1. **原生 JSON 支持**：JSON 和 JSONB 类型 + 丰富的 JSON 运算符和函数，兼具关系型与文档数据库能力。
2. **递归 CTE**：支持递归公共表表达式，可处理树形/图结构数据的层次遍历。
3. **窗口函数（CUBE / ROLLUP / GROUPING SETS）**：内置多维聚合能力，无需额外 OLAP 引擎即可生成报表。
4. **丰富的索引类型**：B-tree / Hash / GiST / GIN / BRIN / SP-GiST，覆盖全文搜索、几何数据、JSON 等场景。
5. **hstore / Array / 复合类型**：键值对存储、数组操作、自定义复合类型，提供 NoSQL 般的灵活性。
6. **PL/pgSQL**：成熟的存储过程语言，支持变量、循环、条件、异常处理。
7. **UPSERT**：`INSERT ... ON CONFLICT` 语法，一条语句完成插入或更新。
8. **MVCC 与事务**：多版本并发控制，读写互不阻塞。

## 学习路径建议

按 [[Backend Introduction]] 的递进逻辑，建议分步学习：

1. **新手**：Section 1–2（查询与过滤）+ Section 9（增删改）+ Section 10（事务）
2. **进阶**：Section 3–5（连接、分组、集合）+ Section 12–13（建表与约束）+ Section 14（数据类型选学 JSON/UUID/Date）
3. **高级**：Section 7–8（子查询与 CTE）+ Section 6（窗口函数）+ 高级层 5 节

## Related

- [[Backend Introduction]] — 后端入门项目（含本页作为数据库主题）
- [[PostgreSQL Tutorial]] — 来源参考页（完整目录）
- [[pythonBasics]] — Python 基础（PostgreSQL 常用 psycopg2 / SQLAlchemy 连接）
