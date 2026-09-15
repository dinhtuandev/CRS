// Verify concurrency demos with 2 real MySQL connections
// Chạy từ thư mục server (cần mysql2):  node ../scripts/verify-demos.mjs
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
// mysql2 được resolve từ server/node_modules (script nằm ở scripts/)
const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server", "package.json"));
const { createConnection } = require("mysql2/promise");

const conn = (a, b) =>
  createConnection({ host: "127.0.0.1", port: 3307, user: "root", password: "root123", charset: "utf8mb4" });

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const A = await conn(), B = await conn();

// ---------- setup ----------
await A.query("DROP DATABASE IF EXISTS qlhp_demo");
{
  const fs = await import("fs");
  const sql = fs.readFileSync(new URL("../db/demo/demo.sql", import.meta.url), "utf8");
  for (const stmt of sql.split(/;\s*\n/)) {
    const t = stmt.replace(/--.*$/gm, "").trim();
    if (t) await A.query(t);
  }
}
console.log("== Setup demo.sql OK ==");
await A.query("USE qlhp_demo");
await B.query("USE qlhp_demo");

// ---------- Demo 1A: Lost Update ----------
console.log("\n== Demo 1A: Lost Update (READ COMMITTED) ==");
await A.query("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
await A.query("START TRANSACTION");
let [[{ value: v1 }]] = await A.query("SELECT value FROM counter WHERE id = 1");
check("A doc 100", v1 === 100, `got ${v1}`);
await B.query("START TRANSACTION");
await B.query("UPDATE counter SET value = value + 1 WHERE id = 1");
await B.query("COMMIT");
await A.query("UPDATE counter SET value = 100 + 1 WHERE id = 1");
await A.query("COMMIT");
[[{ value: v1 }]] = await A.query("SELECT value FROM counter WHERE id = 1");
check("Ket qua 101 (LOST) - mong 102", v1 === 101, `got ${v1}`);

// ---------- Demo 1B: fix by FOR UPDATE ----------
console.log("\n== Demo 1B: Fix bang FOR UPDATE ==");
await A.query("UPDATE counter SET value = 100 WHERE id = 1");
await A.query("START TRANSACTION");
await A.query("SELECT value FROM counter WHERE id = 1 FOR UPDATE");
let bBlockedDone = false;
const bBlocked = B.query("START TRANSACTION").then(() => B.query("UPDATE counter SET value = value + 1 WHERE id = 1")).then(() => { bBlockedDone = true; });
await sleep(700);
check("B bi chan khi A giu lock", !bBlockedDone);
await A.query("UPDATE counter SET value = value + 1 WHERE id = 1");
await A.query("COMMIT");
await bBlocked;
await B.query("COMMIT");
[[{ value: v1 }]] = await A.query("SELECT value FROM counter WHERE id = 1");
check("Ket qua 102 (khong mat +1)", v1 === 102, `got ${v1}`);

// ---------- Demo 2A: Dirty Read ----------
console.log("\n== Demo 2A: Dirty Read (READ UNCOMMITTED) ==");
await A.query("UPDATE counter SET value = 100 WHERE id = 1");
await B.query("SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED");
await B.query("START TRANSACTION");
await A.query("START TRANSACTION");
await A.query("UPDATE counter SET value = value + 30 WHERE id = 1");
[[{ value: v1 }]] = await B.query("SELECT value FROM counter WHERE id = 1");
check("B (RU) thay 130 CHUA commit (dirty)", v1 === 130, `got ${v1}`);
await A.query("ROLLBACK");
[[{ value: v1 }]] = await B.query("SELECT value FROM counter WHERE id = 1");
check("Sau rollback B thay 100 (du lieu ao)", v1 === 100, `got ${v1}`);
await B.query("COMMIT");

// ---------- Demo 2B: READ COMMITTED khong dirty ----------
console.log("\n== Demo 2B: Fix bang READ COMMITTED ==");
await B.query("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
await B.query("START TRANSACTION");
await A.query("START TRANSACTION");
await A.query("UPDATE counter SET value = value + 30 WHERE id = 1");
[[{ value: v1 }]] = await B.query("SELECT value FROM counter WHERE id = 1");
check("B (RC) van thay 100 (khong dirty)", v1 === 100, `got ${v1}`);
await A.query("COMMIT");
[[{ value: v1 }]] = await B.query("SELECT value FROM counter WHERE id = 1");
check("Sau commit B thay 130 (hop le)", v1 === 130, `got ${v1}`);
await B.query("COMMIT");
await A.query("UPDATE counter SET value = 100 WHERE id = 1");

// ---------- Demo 3A: Non-repeatable ----------
console.log("\n== Demo 3A: Non-repeatable Read (READ COMMITTED) ==");
await B.query("START TRANSACTION");
[[{ value: v1 }]] = await B.query("SELECT value FROM counter WHERE id = 1");
check("B lan 1 = 100", v1 === 100, `got ${v1}`);
await A.query("UPDATE counter SET value = 200 WHERE id = 1");
await A.query("COMMIT");
[[{ value: v1 }]] = await B.query("SELECT value FROM counter WHERE id = 1");
check("B lan 2 = 200 (doi giua tx!)", v1 === 200, `got ${v1}`);
await B.query("COMMIT");

// ---------- Demo 3B: RR snapshot fix ----------
console.log("\n== Demo 3B: Fix bang REPEATABLE READ ==");
await A.query("UPDATE counter SET value = 100 WHERE id = 1");
await B.query("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
await B.query("START TRANSACTION");
[[{ value: v1 }]] = await B.query("SELECT value FROM counter WHERE id = 1");
await A.query("UPDATE counter SET value = 200 WHERE id = 1");
await A.query("COMMIT");
let v1b;
[[{ value: v1b }]] = await B.query("SELECT value FROM counter WHERE id = 1");
check("B lan 2 VAN 100 trong tx (snapshot)", v1b === 100, `got ${v1b}`);
await B.query("COMMIT");
[[{ value: v1 }]] = await B.query("SELECT value FROM counter WHERE id = 1");
check("Tx moi thay 200", v1 === 200, `got ${v1}`);
await A.query("UPDATE counter SET value = 100 WHERE id = 1");

// ---------- Demo 4A: Phantom ----------
console.log("\n== Demo 4A: Phantom (REPEATABLE READ) ==");
await A.query("DELETE FROM counter WHERE id IN (4, 5)");
await A.query("UPDATE counter SET value = 100, name = 'A' WHERE id = 1");
await A.query("UPDATE counter SET value = 40, name = 'B' WHERE id = 2");
await A.query("UPDATE counter SET value = 60, name = 'C' WHERE id = 3");
await A.query("UPDATE counter SET value = 80, name = 'Z' WHERE id = 99");
await B.query("START TRANSACTION");
let [[{ cnt }]] = await B.query("SELECT COUNT(*) AS cnt FROM counter WHERE value > 50");
check("COUNT lan 1 = 3", cnt === 3, `got ${cnt}`);
await A.query("INSERT INTO counter VALUES (4, 'P', 999)");
await A.query("COMMIT");
[[{ cnt }]] = await B.query("SELECT COUNT(*) AS cnt FROM counter WHERE value > 50");
check("COUNT lan 2 VAN 3 (snapshot)", cnt === 3, `got ${cnt}`);
const [upd] = await B.query("UPDATE counter SET name = CONCAT(name, '-x') WHERE value > 50");
check("Nhung UPDATE sua 4 hang (phantom that!)", upd.affectedRows === 4, `got ${upd.affectedRows}`);
await B.query("ROLLBACK");
await A.query("DELETE FROM counter WHERE id = 4");

// ---------- Demo 4B: fix by FOR UPDATE gap lock ----------
console.log("\n== Demo 4B: Fix bang FOR UPDATE (next-key lock) ==");
await A.query("UPDATE counter SET value = 60 WHERE id = 2");
await B.query("START TRANSACTION");
await B.query("SELECT * FROM counter WHERE value > 50 FOR UPDATE");
let insDone = false;
const insP = A.query("START TRANSACTION").then(() => A.query("INSERT INTO counter VALUES (5, 'Q', 777)")).then(() => { insDone = true; });
await sleep(700);
check("A bi chan INSERT khi B giu gap lock", !insDone);
const [upd2] = await B.query("UPDATE counter SET name = CONCAT(name, '-x') WHERE value > 50");
check("B sua dung 4 hang (nhat quan)", upd2.affectedRows === 4, `got ${upd2.affectedRows}`);
await B.query("COMMIT");
await insP;
await A.query("COMMIT");
const [chk] = await A.query("SELECT COUNT(*) AS n FROM counter WHERE name LIKE '%-x'");
check("Chi 4 hang bi sua, hang ma khong lo)", chk[0].n === 4, `got ${chk[0].n}`);
await A.query("DELETE FROM counter WHERE id = 5");
await A.query("UPDATE counter SET name = 'B' WHERE id = 2");
await A.query("UPDATE counter SET name = 'A' WHERE id = 1");

// ---------- Demo 5A: Deadlock ----------
console.log("\n== Demo 5A: Deadlock (cyclic wait) ==");
await A.query("UPDATE counter SET value = 100 WHERE id IN (1, 2)");
await A.query("START TRANSACTION");
await A.query("UPDATE counter SET value = value + 10 WHERE id = 1");
await B.query("START TRANSACTION");
await B.query("UPDATE counter SET value = value + 10 WHERE id = 2");
// fire A's blocked update
const aBlocked = A.query("UPDATE counter SET value = value + 10 WHERE id = 2").catch((e) => ({ __errA: e }));
await sleep(500);
let deadlockErr = null;
try { await B.query("UPDATE counter SET value = value + 10 WHERE id = 1"); }
catch (e) { deadlockErr = e; }
check("Trung ERROR 1213 deadlock", deadlockErr && deadlockErr.errno === 1213, `got ${deadlockErr && deadlockErr.errno}`);
await B.query("COMMIT"); // B's tx was rolled back by InnoDB; COMMIT is no-op-safe
const ra = await aBlocked;
if (ra.__errA) { await A.query("ROLLBACK"); }
else { await A.query("COMMIT"); }
await A.query("UPDATE counter SET value = 100 WHERE id IN (1, 2)");

// ---------- Demo 5B: fix by lock ordering ----------
console.log("\n== Demo 5B: Fix bang thu tu khoa (1 -> 2) ==");
await A.query("START TRANSACTION");
await A.query("UPDATE counter SET value = value + 10 WHERE id = 1");
let b2Done = false;
const b1 = B.query("START TRANSACTION").then(() => B.query("UPDATE counter SET value = value + 10 WHERE id = 1")).then(() => {
  return B.query("UPDATE counter SET value = value + 10 WHERE id = 2").then(() => { b2Done = true; });
});
await sleep(400);
check("B cho o hang 1 (cho 1 chieu)", !b2Done);
await A.query("UPDATE counter SET value = value + 10 WHERE id = 2");
await A.query("COMMIT");
await b1;
await B.query("COMMIT");
check("B chay tiep khong deadlock", b2Done);
await A.query("UPDATE counter SET value = 100 WHERE id IN (1, 2)");

// ---------- Demo 5C: retry procedure ----------
console.log("\n== Demo 5C: Thu tuc retry deadlock ==");
const proc = `DELIMITER $$ CREATE PROCEDURE sp_demo_deadlock_retry() BEGIN ... END$$ DELIMITER ;`;
// (delimiter not usable via protocol; create with raw body)
await A.query(`CREATE PROCEDURE IF NOT EXISTS sp_demo_deadlock_retry() BEGIN DECLARE attempts INT DEFAULT 0; retry_loop: LOOP SET attempts = attempts + 1; BEGIN DECLARE EXIT HANDLER FOR 1213 BEGIN IF attempts >= 3 THEN RESIGNAL; END IF; END; START TRANSACTION; UPDATE counter SET value = value + 10 WHERE id = 2; UPDATE counter SET value = value + 10 WHERE id = 1; COMMIT; LEAVE retry_loop; END; END LOOP; END`);
await A.query("CALL sp_demo_deadlock_retry()");
let [[r1], [r2]] = await Promise.all([
  A.query("SELECT value FROM counter WHERE id = 1"),
  A.query("SELECT value FROM counter WHERE id = 2"),
]);
check("Procedure retry chay OK (ca 2 hang +10)", r1[0].value === 110 && r2[0].value === 110, `got ${r1[0].value}/${r2[0].value}`);
await A.query("DROP PROCEDURE sp_demo_deadlock_retry");

await A.end(); await B.end();
console.log(`\n===== KET QUA: ${pass} PASS, ${fail} FAIL =====`);
process.exit(fail ? 1 : 0);
