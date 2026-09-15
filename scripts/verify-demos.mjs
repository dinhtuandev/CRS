// Verify concurrency demos on the REAL project schema (qlhocphan)
// 2 kết nối MySQL thật, chạy đủ 6 demo + fix. Chạy từ thư mục server:
//   node ../scripts/verify-demos.mjs
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
// mysql2 được resolve từ server/node_modules (script nằm ở scripts/)
const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server", "package.json"));
const { createConnection } = require("mysql2/promise");

const DB = { host: "127.0.0.1", port: 3307, user: "root", password: "root123", charset: "utf8mb4" };
const conn = () => createConnection(DB);

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const A = await conn(), B = await conn();
await A.query("USE qlhocphan");
await B.query("USE qlhocphan");

// ---------- setup: reset dữ liệu mẫu như demo.sql ----------
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = 2, PHONGHOC = 'D3-201' WHERE MALHP = 'LHP0101'");
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = 60, PHONGHOC = 'D3-202' WHERE MALHP = 'LHP0102'");
await A.query("DELETE FROM DANGKYHOCPHAN WHERE MALHP = 'LHPTEST' OR (MALHP = 'LHP0101' AND MASV IN ('SV003','SV004')) OR (MALHP = 'LHP0102' AND MASV IN ('SV003','SV004'))");
await A.query("DROP DATABASE IF EXISTS qlhp_demo"); // dọn tàn tích bộ cũ
console.log("== Setup OK: LHP0101=2, LHP0102=60 ==");

// ---------- Demo 1A: Lost Update ----------
console.log("\n== Demo 1A: Lost Update (doc khong khoa, ghi gia tri tuyet doi) ==");
await A.query("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
await B.query("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = 60 WHERE MALHP = 'LHP0102'");
await A.query("START TRANSACTION");
let [[{ s: s1 }]] = await A.query("SELECT SISOMAX s FROM LOPHOCPHAN WHERE MALHP='LHP0102'");
check("A doc 60", s1 === 60, `got ${s1}`);
await B.query("START TRANSACTION");
[[{ s: s1 }]] = await B.query("SELECT SISOMAX s FROM LOPHOCPHAN WHERE MALHP='LHP0102'");
check("B doc 60", s1 === 60, `got ${s1}`);
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = 59 WHERE MALHP='LHP0102'"); // A: 60-1=59
let bWaitDone = false;
const bWait = B.query("UPDATE LOPHOCPHAN SET SISOMAX = 59 WHERE MALHP='LHP0102'")
  .then(() => { bWaitDone = true; });
await sleep(700);
check("B doi khoá khi A chua commit", !bWaitDone);
await A.query("COMMIT");
await bWait;       // B ghi 59 (tính từ số 60 cũ)
await B.query("COMMIT");
[[{ s: s1 }]] = await A.query("SELECT SISOMAX s FROM LOPHOCPHAN WHERE MALHP='LHP0102'");
check("Ket qua 59 (LOST UPDATE, mong 58)", s1 === 59, `got ${s1}`);

// ---------- Demo 1B: fix bằng FOR UPDATE ----------
console.log("\n== Demo 1B: Fix bang FOR UPDATE ==");
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = 60 WHERE MALHP='LHP0102'");
await A.query("START TRANSACTION");
await A.query("SELECT SISOMAX FROM LOPHOCPHAN WHERE MALHP='LHP0102' FOR UPDATE");
let b2Done = false;
const b2 = B.query("START TRANSACTION").then(() => B.query("SELECT SISOMAX FROM LOPHOCPHAN WHERE MALHP='LHP0102' FOR UPDATE")).then(() => { b2Done = true; });
await sleep(700);
check("B bi chan FOR UPDATE khi A giu khoa", !b2Done);
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = 59 WHERE MALHP='LHP0102'");
await A.query("COMMIT");
let [[{ s: sb }]] = await B.query("SELECT SISOMAX s FROM LOPHOCPHAN WHERE MALHP='LHP0102'");
check("B doc du so MOI 59 sau khi A commit", sb === 59, `got ${sb}`);
await b2;
await B.query("UPDATE LOPHOCPHAN SET SISOMAX = 58 WHERE MALHP='LHP0102'");
await B.query("COMMIT");
[[{ s: s1 }]] = await A.query("SELECT SISOMAX s FROM LOPHOCPHAN WHERE MALHP='LHP0102'");
check("Ket qua 58 dung (60 - 2 phieu)", s1 === 58, `got ${s1}`);

// ---------- Demo 2A: Dirty Read ----------
console.log("\n== Demo 2A: Dirty Read (READ UNCOMMITTED) ==");
await B.query("SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED");
await B.query("START TRANSACTION");
await A.query("START TRANSACTION");
await A.query("UPDATE LOPHOCPHAN SET PHONGHOC = 'D3-205' WHERE MALHP='LHP0101'");
let [[{ p: p1 }]] = await B.query("SELECT PHONGHOC p FROM LOPHOCPHAN WHERE MALHP='LHP0101'");
check("B (RU) thay D3-205 CHUA commit (dirty)", p1 === "D3-205", `got ${p1}`);
await A.query("ROLLBACK");
[[{ p: p1 }]] = await B.query("SELECT PHONGHOC p FROM LOPHOCPHAN WHERE MALHP='LHP0101'");
check("Sau rollback B thay D3-201 (du lieu ao)", p1 === "D3-201", `got ${p1}`);
await B.query("COMMIT");

// ---------- Demo 2B: READ COMMITTED không dirty ----------
console.log("\n== Demo 2B: Fix bang READ COMMITTED ==");
await B.query("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
await B.query("START TRANSACTION");
await A.query("START TRANSACTION");
await A.query("UPDATE LOPHOCPHAN SET PHONGHOC = 'D3-205' WHERE MALHP='LHP0101'");
[[{ p: p1 }]] = await B.query("SELECT PHONGHOC p FROM LOPHOCPHAN WHERE MALHP='LHP0101'");
check("B (RC) van thay D3-201 (khong dirty)", p1 === "D3-201", `got ${p1}`);
await A.query("COMMIT");
[[{ p: p1 }]] = await B.query("SELECT PHONGHOC p FROM LOPHOCPHAN WHERE MALHP='LHP0101'");
check("Sau commit B thay gia tri moi (hop le)", p1 === "D3-205", `got ${p1}`);
await B.query("COMMIT");

// ---------- Demo 3A: Non-repeatable ----------
console.log("\n== Demo 3A: Non-repeatable Read (READ COMMITTED) ==");
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = 60 WHERE MALHP='LHP0102'");
await B.query("START TRANSACTION");
[[{ s: s1 }]] = await B.query("SELECT SISOMAX s FROM LOPHOCPHAN WHERE MALHP='LHP0102'");
check("B lan 1 = 60", s1 === 60, `got ${s1}`);
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = 55 WHERE MALHP='LHP0102'");
await A.query("COMMIT");
[[{ s: s1 }]] = await B.query("SELECT SISOMAX s FROM LOPHOCPHAN WHERE MALHP='LHP0102'");
check("B lan 2 = 55 (doi giua tx!)", s1 === 55, `got ${s1}`);
await B.query("COMMIT");

// ---------- Demo 3B: RR snapshot fix ----------
console.log("\n== Demo 3B: Fix bang REPEATABLE READ ==");
await B.query("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
await B.query("START TRANSACTION");
[[{ s: s1 }]] = await B.query("SELECT SISOMAX s FROM LOPHOCPHAN WHERE MALHP='LHP0102'");
check("B lan 1 = 55", s1 === 55, `got ${s1}`);
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = 50 WHERE MALHP='LHP0102'");
await A.query("COMMIT");
let s1b;
[[{ s: s1b }]] = await B.query("SELECT SISOMAX s FROM LOPHOCPHAN WHERE MALHP='LHP0102'");
check("B lan 2 VAN 55 trong tx (snapshot)", s1b === 55, `got ${s1b}`);
await B.query("COMMIT");
[[{ s: s1 }]] = await B.query("SELECT SISOMAX s FROM LOPHOCPHAN WHERE MALHP='LHP0102'");
check("Tx moi thay 50", s1 === 50, `got ${s1}`);

// ---------- Demo 4A: Phantom ----------
console.log("\n== Demo 4A: Phantom (REPEATABLE READ: COUNT snapshot, UPDATE quet phai hang ma) ==");
await A.query("DELETE FROM LOPHOCPHAN WHERE MALHP='LHPTEST'");
await B.query("START TRANSACTION");
let [[{ c }]] = await B.query("SELECT COUNT(*) c FROM LOPHOCPHAN WHERE MAHK='2025-2026-HK1' AND SISOMAX > 45");
check("COUNT lan 1 = 5", c === 5, `got ${c}`);
await A.query("INSERT INTO LOPHOCPHAN (MALHP,MAHP,MAHK,MAGV,SISOMAX,PHONGHOC,THU,TIETBATDAU,SOTIET,TRANGTHAI) VALUES ('LHPTEST','IT1010','2025-2026-HK1','GV01',50,'D3-999',2,8,2,'mở')");
await A.query("COMMIT");
[[{ c }]] = await B.query("SELECT COUNT(*) c FROM LOPHOCPHAN WHERE MAHK='2025-2026-HK1' AND SISOMAX > 45");
check("COUNT lan 2 VAN 5 (snapshot)", c === 5, `got ${c}`);
const [upd] = await B.query("UPDATE LOPHOCPHAN SET PHONGHOC = 'D3-TANG1' WHERE MAHK='2025-2026-HK1' AND SISOMAX > 45");
check("Nhung UPDATE sua 6 hang (phantom that!)", upd.affectedRows === 6, `got ${upd.affectedRows}`);
await B.query("COMMIT");

// ---------- Demo 4B: fix bằng next-key lock ----------
console.log("\n== Demo 4B: Fix bang FOR UPDATE (next-key lock) ==");
await A.query("DELETE FROM LOPHOCPHAN WHERE MALHP='LHPTEST'");
await B.query("START TRANSACTION");
await B.query("SELECT * FROM LOPHOCPHAN WHERE MAHK='2025-2026-HK1' AND SISOMAX > 45 FOR UPDATE");
let insDone = false;
const insP = A.query("INSERT INTO LOPHOCPHAN (MALHP,MAHP,MAHK,MAGV,SISOMAX,PHONGHOC,THU,TIETBATDAU,SOTIET,TRANGTHAI) VALUES ('LHPTEST','IT1010','2025-2026-HK1','GV01',50,'D3-999',2,8,2,'mở')").then(() => { insDone = true; });
await sleep(700);
check("A bi chan INSERT khi B giu next-key lock", !insDone);
const [upd2] = await B.query("UPDATE LOPHOCPHAN SET PHONGHOC = PHONGHOC WHERE MAHK='2025-2026-HK1' AND SISOMAX > 45");
check("B UPDATE dung 5 hang (nhat quan)", upd2.affectedRows === 5, `got ${upd2.affectedRows}`);
await B.query("COMMIT");
await insP;
const [[{ c: cAfter }]] = await A.query("SELECT COUNT(*) c FROM LOPHOCPHAN WHERE MAHK='2025-2026-HK1' AND SISOMAX > 45");
check("Sau khi B commit, INSERT vao duoc (6 hang)", cAfter === 6, `got ${cAfter}`);
await A.query("DELETE FROM LOPHOCPHAN WHERE MALHP='LHPTEST'");

// ---------- Demo 5A: Deadlock ----------
console.log("\n== Demo 5A: Deadlock (khoa cheo 2 lop) ==");
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = 2 WHERE MALHP='LHP0101'");
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = 60 WHERE MALHP='LHP0102'");
await A.query("START TRANSACTION");
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX + 1 WHERE MALHP='LHP0101'");
await B.query("START TRANSACTION");
await B.query("UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX + 1 WHERE MALHP='LHP0102'");
const aBlocked = A.query("UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX - 1 WHERE MALHP='LHP0102'").catch((e) => ({ __errA: e }));
await sleep(500);
let deadlockErr = null;
try { await B.query("UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX - 1 WHERE MALHP='LHP0101'"); }
catch (e) { deadlockErr = e; }
check("Trung ERROR 1213 deadlock (B la nan nhan)", deadlockErr && deadlockErr.errno === 1213, `got ${deadlockErr && deadlockErr.errno}`);
await B.query("COMMIT"); // B đã bị InnoDB rollback; COMMIT chỉ kết thúc trống
const ra = await aBlocked;
if (ra.__errA) await A.query("ROLLBACK"); else await A.query("COMMIT");

// ---------- Demo 5B: fix bằng lock ordering ----------
console.log("\n== Demo 5B: Fix bang thu tu khoa (LHP0101 truoc) ==");
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = 2 WHERE MALHP='LHP0101'");
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = 60 WHERE MALHP='LHP0102'");
await A.query("START TRANSACTION");
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX + 1 WHERE MALHP='LHP0101'");
let b3Done = false;
const b3 = B.query("START TRANSACTION").then(() => B.query("UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX - 1 WHERE MALHP='LHP0101'")).then(() => {
  return B.query("UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX + 1 WHERE MALHP='LHP0102'").then(() => { b3Done = true; });
});
await sleep(400);
check("B cho o LHP0101 (cho 1 chieu, khong vong)", !b3Done);
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX - 1 WHERE MALHP='LHP0102'");
await A.query("COMMIT");
await b3;
await B.query("COMMIT");
check("B chay tiep khong deadlock", b3Done);
const [[rows5b]] = await A.query("SELECT SISOMAX s101, (SELECT SISOMAX FROM LOPHOCPHAN WHERE MALHP='LHP0102') s102 FROM LOPHOCPHAN WHERE MALHP='LHP0101'");
check("Ket qua dung: 2 va 60 (net +1/-1 hai phien)", rows5b.s101 === 2 && rows5b.s102 === 60, `got ${rows5b.s101}/${rows5b.s102}`);

// ---------- Demo 5C: retry procedure ----------
console.log("\n== Demo 5C: Thu tuc tu retry khi deadlock ==");
await A.query(`CREATE PROCEDURE IF NOT EXISTS sp_demo_deadlock_retry() BEGIN DECLARE attempts INT DEFAULT 0; demo_loop: LOOP SET attempts = attempts + 1; BEGIN DECLARE EXIT HANDLER FOR 1213 BEGIN IF attempts >= 3 THEN RESIGNAL; END IF; END; START TRANSACTION; UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX + 1 WHERE MALHP = 'LHP0101'; UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX - 1 WHERE MALHP = 'LHP0102'; COMMIT; LEAVE demo_loop; END; END LOOP; END`);
await A.query("CALL sp_demo_deadlock_retry()");
const [[r1]] = await A.query("SELECT SISOMAX s101, (SELECT SISOMAX FROM LOPHOCPHAN WHERE MALHP='LHP0102') s102 FROM LOPHOCPHAN WHERE MALHP='LHP0101'");
check("Procedure retry chay OK (3/59)", r1.s101 === 3 && r1.s102 === 59, `got ${r1.s101}/${r1.s102}`);
await A.query("DROP PROCEDURE sp_demo_deadlock_retry");

// ---------- Demo 6: Oversell + 2 lớp bảo vệ ----------
console.log("\n== Demo 6A: Tam go trigger -> oversell that ==");
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = 2 WHERE MALHP='LHP0101'");
await A.query("DELETE FROM DANGKYHOCPHAN WHERE MALHP='LHP0101' AND MASV IN ('SV003','SV004')");
await A.query("DROP TRIGGER IF EXISTS trg_dangky_before_insert");
// 2 phiên "đếm rồi chèn" không khoá:
await A.query("START TRANSACTION");
let [[{ n: n1 }]] = await A.query("SELECT COUNT(*) n FROM DANGKYHOCPHAN WHERE MALHP='LHP0101' AND TRANGTHAI='đăng ký'");
check("A dem 2 (lop day)", n1 === 2, `got ${n1}`);
await B.query("START TRANSACTION");
await B.query("SELECT COUNT(*) FROM DANGKYHOCPHAN WHERE MALHP='LHP0101' AND TRANGTHAI='đăng ký'");
await A.query("INSERT INTO DANGKYHOCPHAN (MASV,MALHP,LANHOC) VALUES ('SV003','LHP0101','học lại')");
await B.query("INSERT INTO DANGKYHOCPHAN (MASV,MALHP,LANHOC) VALUES ('SV004','LHP0101','học lại')");
await A.query("COMMIT");
await B.query("COMMIT");
let [[{ n: n2 }]] = await A.query("SELECT COUNT(*) n FROM DANGKYHOCPHAN WHERE MALHP='LHP0101' AND TRANGTHAI='đăng ký'");
check("OVERSELL: lop 2 cho chua 4 SV", n2 === 4, `got ${n2}`);

console.log("\n== Demo 6B: Gan lai trigger -> chan duong ghi truc tiep ==");
// gắn lại y hệt 01_schema.sql
await A.query(`CREATE TRIGGER trg_dangky_before_insert BEFORE INSERT ON DANGKYHOCPHAN FOR EACH ROW BEGIN DECLARE v_lhp_found TINYINT DEFAULT 0; DECLARE v_sisomax INT; DECLARE v_lhp_trangthai VARCHAR(10); DECLARE v_dadangky INT; SELECT 1, SISOMAX, TRANGTHAI INTO v_lhp_found, v_sisomax, v_lhp_trangthai FROM LOPHOCPHAN WHERE MALHP = NEW.MALHP FOR UPDATE; IF v_lhp_found = 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lớp học phần không tồn tại (trigger)'; END IF; IF v_lhp_trangthai <> 'mở' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lớp học phần không mở (trigger)'; END IF; SELECT COUNT(*) INTO v_dadangky FROM DANGKYHOCPHAN WHERE MALHP = NEW.MALHP AND TRANGTHAI = 'đăng ký'; IF v_dadangky >= v_sisomax THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lớp học phần đã đầy (trigger)'; END IF; IF NEW.DIEMCHUYENCAN IS NOT NULL AND NEW.DIEMGIUAKY IS NOT NULL AND NEW.DIEMCUOIKY IS NOT NULL THEN SET NEW.DIEMHE10 = ROUND(NEW.DIEMCHUYENCAN*0.1 + NEW.DIEMGIUAKY*0.3 + NEW.DIEMCUOIKY*0.6, 2); SET NEW.DIEMCHU = fn_diem_chu(NEW.DIEMHE10); SET NEW.DIEMHE4 = CASE NEW.DIEMCHU WHEN 'A' THEN 4.00 WHEN 'B+' THEN 3.50 WHEN 'B' THEN 3.00 WHEN 'C+' THEN 2.50 WHEN 'C' THEN 2.00 WHEN 'D+' THEN 1.50 WHEN 'D' THEN 1.00 ELSE 0.00 END; ELSE SET NEW.DIEMHE10 = NULL; SET NEW.DIEMCHU = NULL; SET NEW.DIEMHE4 = NULL; END IF; END`);
await A.query("DELETE FROM DANGKYHOCPHAN WHERE MALHP='LHP0101' AND MASV IN ('SV003','SV004')");
let trigErr = null;
try { await A.query("INSERT INTO DANGKYHOCPHAN (MASV,MALHP,LANHOC) VALUES ('SV003','LHP0101','học lại')"); }
catch (e) { trigErr = e; }
check("Ghi truc tiep bi trigger chan (1644, lop day)", trigErr && trigErr.errno === 1644 && /đầy/.test(trigErr.sqlMessage || ""), `got ${trigErr && trigErr.errno} ${trigErr && trigErr.sqlMessage}`);

console.log("\n== Demo 6C: Procedure - lop day bi chan, lop con cho 2 phien dong thoi ==");
let procErr = null;
try { await A.query("CALL sp_dangky_hocphan('SV004','LHP0101','học lại')"); }
catch (e) { procErr = e; }
check("Lop day qua procedure bi chan (1644)", procErr && procErr.errno === 1644, `got ${procErr && procErr.errno}`);
// 2 phiên đồng thời trên lớp còn chỗ LHP0102:
await A.query("CALL sp_dangky_hocphan('SV003','LHP0102','học lại')");
await B.query("CALL sp_dangky_hocphan('SV004','LHP0102','học lại')");
let [[{ n: n3 }]] = await A.query("SELECT COUNT(*) n FROM DANGKYHOCPHAN WHERE MALHP='LHP0102' AND TRANGTHAI='đăng ký'");
check("2 phien cung thanh cong, dung 2 dong (FOR UPDATE xep hang)", n3 === 2, `got ${n3}`);

// ---------- RESET về seed ----------
await A.query("DELETE FROM DANGKYHOCPHAN WHERE MALHP='LHP0102' AND MASV IN ('SV003','SV004')");
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = 2, PHONGHOC = 'D3-201' WHERE MALHP='LHP0101'");
await A.query("UPDATE LOPHOCPHAN SET SISOMAX = 60, PHONGHOC = 'D3-202' WHERE MALHP='LHP0102'");
const [[{ n: nTrig }]] = await A.query("SELECT COUNT(*) n FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA='qlhocphan' AND TRIGGER_NAME='trg_dangky_before_insert'");
check("RESET: trigger dang duoc gan lai", nTrig === 1, `got ${nTrig}`);
const [[{ n: n101 }]] = await A.query("SELECT COUNT(*) n FROM DANGKYHOCPHAN WHERE MALHP='LHP0101' AND TRANGTHAI='đăng ký'");
check("RESET: LHP0101 dung 2 SV (SV005, SV006)", n101 === 2, `got ${n101}`);

await A.end(); await B.end();
console.log(`\n===== KET QUA: ${pass} PASS, ${fail} FAIL =====`);
process.exit(fail ? 1 : 0);
