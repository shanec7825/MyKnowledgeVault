'use strict';

var promises = require('timers/promises');
var zod = require('zod');
var crypto = require('crypto');

// src/storage/sql/sql.ts
function isSerializationConflict(error) {
  if (!(error instanceof Error)) return false;
  if (error.name === "DriverAdapterError" && error.cause && typeof error.cause === "object") {
    const cause = error.cause;
    if (cause.kind === "TransactionWriteConflict" && (cause.originalCode === "40001" || cause.originalCode === "40P01"))
      return true;
  }
  if (!("code" in error)) return false;
  if (error.code === "P2034" || error.code === "40001" || error.code === "40P01") return true;
  if (error.code !== "P2010" || !("meta" in error) || !error.meta || typeof error.meta !== "object")
    return false;
  const meta = error.meta;
  const code = meta.code ?? meta.driverAdapterError?.cause?.originalCode;
  return code === "40001" || code === "40P01";
}
async function retrySerializableTransaction(runTransaction, options = {}) {
  for (let attempt = 0; ; attempt++) {
    options.signal?.throwIfAborted();
    try {
      return await runTransaction();
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === 9) throw error;
      const ceiling = Math.min(10 * 2 ** attempt, 500);
      const backoff = ceiling / 2 + Math.floor(Math.random() * (ceiling / 2 + 1));
      await promises.setTimeout(backoff, void 0, { signal: options.signal });
    }
  }
}
async function optionalSqlWrite(database, operation) {
  const savepoint = `sidedoor_optional_${crypto.randomUUID().replaceAll("-", "")}`;
  await database.query(`SAVEPOINT ${savepoint}`, []);
  let value;
  try {
    value = await operation();
  } catch (error) {
    if (isSerializationConflict(error)) throw error;
    await database.query(`ROLLBACK TO SAVEPOINT ${savepoint}`, []);
    await database.query(`RELEASE SAVEPOINT ${savepoint}`, []);
    return { ok: false, error };
  }
  await database.query(`RELEASE SAVEPOINT ${savepoint}`, []);
  return { ok: true, value };
}
async function sqlStateRows(database, dialect, prefix, after, limit = 100, cursorKind = "digest") {
  zod.z.number().int().min(1).max(100).parse(limit);
  if (!prefix.endsWith(":")) throw new Error("State scan prefix must end with a colon");
  const cursorSchema = cursorKind === "uuid" ? zod.z.uuid() : cursorKind === "compoundDigest" ? zod.z.string().regex(/^[a-f0-9]{64}:[a-f0-9]{64}$/) : zod.z.string().regex(/^[a-f0-9]{64}$/);
  if (after !== null && (!after.startsWith(prefix) || !cursorSchema.safeParse(after.slice(prefix.length)).success))
    throw new Error("State cursor belongs to another namespace");
  const p = (index) => dialect === "postgres" ? `$${index}` : "?";
  const operators = dialect === "postgres" ? { lower: "~>=~", upper: "~<~", after: "~>~", order: " USING ~<~" } : { lower: ">=", upper: "<", after: ">", order: "" };
  return database.query(
    `SELECT "id", "revision", "state" FROM "SidedoorState" WHERE "id" ${operators.lower} ${p(1)} AND "id" ${operators.upper} ${p(2)} AND "id" ${operators.after} ${p(3)} ORDER BY "id"${operators.order} LIMIT ${limit}`,
    [prefix, `${prefix.slice(0, -1)};`, after ?? ""]
  );
}
function sqlStateBackend(database, dialect, id) {
  if (!id || id.length > 200) throw new Error("State namespace must contain 1 to 200 characters");
  const parameter = (index) => dialect === "postgres" ? `$${index}` : "?";
  function snapshot(row) {
    if (typeof row.revision !== "string") throw new Error("Invalid state revision");
    if (dialect === "sqlite" && typeof row.state !== "string") throw new Error("Invalid stored JSON");
    return {
      revision: row.revision,
      state: dialect === "sqlite" ? JSON.parse(row.state) : row.state
    };
  }
  return {
    async read() {
      const rows = await database.query(
        `SELECT "revision", "state" FROM "SidedoorState" WHERE "id" = ${parameter(1)}`,
        [id]
      );
      return rows[0] ? snapshot(rows[0]) : null;
    },
    async compareAndSwap(previous, next) {
      const encoded = JSON.stringify(next.state);
      if (encoded === void 0) throw new Error("State must be JSON serializable");
      const value = dialect === "postgres" ? `${parameter(3)}::jsonb` : parameter(3);
      if (previous === null) {
        const rows2 = await database.query(
          `INSERT INTO "SidedoorState" ("id", "revision", "state") VALUES (${parameter(1)}, ${parameter(2)}, ${value}) ON CONFLICT ("id") DO NOTHING RETURNING "revision"`,
          [id, next.revision, encoded]
        );
        return rows2.length === 1;
      }
      const rows = await database.query(
        `UPDATE "SidedoorState" SET "revision" = ${parameter(1)}, "state" = ${dialect === "postgres" ? `${parameter(2)}::jsonb` : parameter(2)} WHERE "id" = ${parameter(3)} AND "revision" = ${parameter(4)} RETURNING "revision"`,
        [next.revision, encoded, id, previous]
      );
      return rows.length === 1;
    }
  };
}

exports.isSerializationConflict = isSerializationConflict;
exports.optionalSqlWrite = optionalSqlWrite;
exports.retrySerializableTransaction = retrySerializableTransaction;
exports.sqlStateBackend = sqlStateBackend;
exports.sqlStateRows = sqlStateRows;
