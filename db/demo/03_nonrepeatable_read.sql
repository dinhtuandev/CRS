-- =====================================================================
-- DEMO 3: NON-REPEATABLE READ — cùng 1 transaction đọc 2 lần, giá trị đổi
-- NGAY TRÊN DB DỰ ÁN: B tính học phí dựa trên sĩ số LHP0102 đọc 2 lần,
-- giữa 2 lần đọc A cập nhật sĩ số + commit → 2 lần đọc khác nhau.
--
-- Mặc định MySQL = REPEATABLE READ: demo này PHẢI SET READ COMMITTED.
--
-- Tài liệu: docs/demo-concurrency.md
-- =====================================================================

-- #####################################################################
-- PHẦN A — GÂY LỖI: READ COMMITTED cho phép non-repeatable read
-- #####################################################################

-- [SESSION B]
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;

-- BƯỚC 1 — SESSION B: lần đọc thứ nhất
SELECT SISOMAX AS 'lan 1' FROM LOPHOCPHAN WHERE MALHP = 'LHP0102';
-- --> 60

-- BƯỚC 2 — SESSION A: cập nhật + commit
START TRANSACTION;
UPDATE LOPHOCPHAN SET SISOMAX = 55 WHERE MALHP = 'LHP0102';
COMMIT;

-- BƯỚC 3 — SESSION B: lần đọc thứ hai — TRONG CÙNG transaction cũ
SELECT SISOMAX AS 'lan 2' FROM LOPHOCPHAN WHERE MALHP = 'LHP0102';
-- --> 55  ❌ khác lần 1! Non-repeatable read.

-- BƯỚC 4 — SESSION B: kết thúc
COMMIT;

-- #####################################################################
-- PHẦN B — KHẮC PHỤC: REPEATABLE READ (mặc định của MySQL) chụp snapshot
-- #####################################################################

-- [SESSION B]
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;

SELECT SISOMAX AS 'lan 1' FROM LOPHOCPHAN WHERE MALHP = 'LHP0102';
-- --> 55

-- [SESSION A]
START TRANSACTION;
UPDATE LOPHOCPHAN SET SISOMAX = 50 WHERE MALHP = 'LHP0102';
COMMIT;

-- [SESSION B]
SELECT SISOMAX AS 'lan 2' FROM LOPHOCPHAN WHERE MALHP = 'LHP0102';
-- --> 55  ✅ vẫn 55! REPEATABLE READ chụp snapshot khi START TRANSACTION
COMMIT;

-- [SESSION B] Sau commit, đọc tiếp sẽ thấy giá trị mới:
SELECT SISOMAX AS 'sau commit' FROM LOPHOCPHAN WHERE MALHP = 'LHP0102';
-- --> 50  — snapshot chỉ tồn tại trong transaction

-- #####################################################################
-- RESET sau demo:
--   UPDATE LOPHOCPHAN SET SISOMAX = 60 WHERE MALHP='LHP0102';
-- (hoặc chạy lại db/demo/demo.sql)
-- =====================================================================
