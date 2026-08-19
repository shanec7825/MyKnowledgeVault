---
type: source
title: "PostgreSQL Tutorial"
source: "https://neon.com/postgresql/tutorial"
author: Neon
created: 2026-08-11
updated: 2026-08-13
status: active
tags:
  - source
  - postgresql
  - database
  - sql
  - backend
domain: backend
aliases:
  - postgresqltutorial
---

# PostgreSQL Tutorial

> **来源**：[PostgreSQLTutorial.com](https://neon.com/postgresql/tutorial)（Neon 托管）
> **类型**：教程目录 / 学习路线索引
> **定位**：面向数据库管理员和应用开发者的 PostgreSQL 快速入门教程

---

## 教程结构

### 快速入门

[[PostgreSQL 教程#学习路线|Getting Started]] — 安装（Windows / Linux / macOS）、psql 连接、示例数据库加载。

### 基础教程（17 节）

#### 1. 查询数据

- **SELECT** — 从单表查询数据
- **Column Aliases** — 为列或表达式分配临时名称
- **ORDER BY** — 排序结果集
- **SELECT DISTINCT** — 移除重复行

#### 2. 过滤数据

- **WHERE** — 按条件过滤行
- **AND** — 组合布尔表达式（两者为真）
- **OR** — 组合布尔表达式（任一为真）
- **LIMIT** — 检索行的子集
- **FETCH** — 限制返回行数
- **IN** — 匹配值列表中任一值
- **BETWEEN** — 选择值范围
- **LIKE** — 基于模式匹配过滤
- **IS NULL** — 检查值是否为空

#### 3. 多表连接

- **JOINS 概述** — join 类型简介
- **Table Aliases** — 表别名
- **INNER JOIN** — 匹配两表对应行
- **LEFT JOIN** — 保留左表所有行
- **Self-join** — 表自连接
- **FULL OUTER JOIN** — 全外连接
- **CROSS JOIN** — 笛卡尔积
- **NATURAL JOIN** — 基于公共列名的隐式连接

#### 4. 数据分组

- **GROUP BY** — 分组并可选应用聚合函数
- **HAVING** — 对分组应用过滤条件

#### 5. 集合运算

- **UNION** — 合并多个查询结果集
- **INTERSECT** — 返回两结果集的交集
- **EXCEPT** — 返回第一查询中不在第二查询中的行

#### 6. GROUPING SETS / CUBE / ROLLUP

- **GROUPING SETS** — 在报表中生成多种分组集合
- **CUBE** — 定义包含所有维度组合的分组集合
- **ROLLUP** — 生成含合计和小计的报告

#### 7. 子查询

- **Subquery** — 嵌套查询
- **Correlated Subquery** — 依赖外层当前行的子查询
- **ANY** — 将值与子查询返回的值集比较
- **ALL** — 将值与子查询返回的值列表比较
- **EXISTS** — 检查子查询返回行是否存在

#### 8. 公共表表达式（CTE）

- **CTE** — 公共表表达式基础
- **Recursive CTE** — 递归查询及应用

#### 9. 修改数据

- **INSERT** — 插入单行
- **INSERT 多行** — 批量插入
- **UPDATE** — 更新现有数据
- **UPDATE JOIN** — 基于另一表更新
- **DELETE** — 删除数据
- **UPSERT** — 存在则更新、不存在则插入（`ON CONFLICT`）

#### 10. 事务

- **Transactions** — `BEGIN` / `COMMIT` / `ROLLBACK`

#### 11. 导入导出

- **导入 CSV** — `COPY` 命令导入 CSV 文件
- **导出 CSV** — `COPY` 命令导出到 CSV 文件

#### 12. 管理表

- **Data Types** — 常用数据类型概览
- **CREATE TABLE** — 创建新表
- **SELECT INTO / CREATE TABLE AS** — 从查询结果创建新表
- **SERIAL** — 自增列
- **Sequences** — 序列对象与数字生成
- **Identity Column** — 标识列（`GENERATED AS IDENTITY`）
- **ALTER TABLE** — 修改表结构
- **RENAME TABLE** — 重命名表
- **ADD COLUMN** — 添加列
- **DROP COLUMN** — 删除列
- **Change Column Type** — 修改列数据类型
- **RENAME COLUMN** — 重命名列
- **DROP TABLE** — 删除表及依赖对象
- **TRUNCATE TABLE** — 快速清空大表
- **Temporary Table** — 临时表
- **Copy Table** — 复制表

#### 13. 约束

- **PRIMARY KEY** — 主键（创建时或后续添加）
- **FOREIGN KEY** — 外键约束
- **DELETE CASCADE** — 级联删除
- **CHECK** — 布尔表达式校验
- **UNIQUE** — 唯一值约束
- **NOT NULL** — 非空约束
- **DEFAULT** — 默认值

#### 14. 数据类型详解

- **Boolean** — `TRUE` / `FALSE`
- **CHAR / VARCHAR / TEXT** — 字符类型
- **NUMERIC** — 精确数值
- **DOUBLE PRECISION** — 不精确变精度浮点数（即 `FLOAT`）
- **REAL** — 单精度浮点数
- **Integer** — `SMALLINT` / `INT` / `BIGINT`
- **DATE** — 日期值
- **Timestamp** — 时间戳
- **Interval** — 时间段
- **TIME** — 时间
- **UUID** — 通用唯一标识符
- **Array** — 数组类型与操作函数
- **hstore** — 键值对集合
- **JSON** — JSON 类型与运算符
- **User-defined Types** — `CREATE DOMAIN` / `CREATE TYPE`
- **Enum** — 枚举类型
- **XML** — XML 文档存储
- **BYTEA** — 二进制字符串
- **Composite Types** — 多字段复合类型

#### 15. 条件表达式与运算符

- **CASE** — 条件查询
- **COALESCE** — 返回第一个非空参数
- **NULLIF** — 参数相等时返回 NULL
- **CAST** — 类型转换

#### 16. 实用工具

- **psql Commands** — 常用 psql 交互命令

#### 17. 实用技巧

- **比较两表** — 数据比较方法
- **删除重复行** — 多种去重方式
- **生成范围内随机数** — `RANDOM()` 函数
- **EXPLAIN** — 查询执行计划
- **PostgreSQL vs MySQL** — 功能对比

### 高级教程

- **PL/pgSQL** — 存储过程与用户定义函数
- **Triggers** — 触发器概念与管理
- **Views** — 视图概念与管理
- **Indexes** — 索引类型与性能优化
- **Administration** — 角色管理 / 数据库管理 / 备份 / 恢复
