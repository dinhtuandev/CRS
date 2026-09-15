-- =====================================================================
-- DEMO 4: PHANTOM — hàng "ma" xuất hiện giữa 2 lần đọc cùng transaction
-- NGAY TRÊN DB DỰ ÁN: bộ đếm là "các lớp HK1 có sĩ số > 45" (5 lớp),
-- trong lúc B thống kê, A MỞ LỚP MỚI (INSERT) sĩ số 50.
--
-- Điểm hay với MySQL 8 (REPEATABLE READ): COUNT vẫn theo snapshot (5),
-- nhưng UPDATE ... WHERE sửa phải 6 hàng — "ma" lộ diện khi GHI.
--
-- Tài liệu: docs/demo-concurrency.md
-- =====================================================================

-- #####################################################################
-- PHẦN A — GÂY LỖI: phantom với INSERT
-- #####################################################################

-- [SESSION B] REPEATABLE READ — mặc định MySQL
START TRANSACTION;

-- BƯỚC 1 — SESSION B: đếm lần 1
SELECT COUNT(*) AS 'lan 1' FROM LOPHOCPHAN
 WHERE MAHK = '2025-2026-HK1' AND SISOMAX > 45;
-- --> 5

-- BƯỚC 2 — SESSION A: mở lớp mới + commit
INSERT INTO LOPHOCPHAN
  (MALHP, MAHP, MAHK, MAGV, SISOMAX, PHONGHOC, THU, TIETBATDAU, SOTIET, TRANGTHAI)
VALUES
  ('LHPTEST', 'IT1010', '2025-2026-HK1', 'GV01', 50, 'D3-999', 2, 8, 2, 'mở');
COMMIT;

-- BƯỚC 3 — SESSION B: đếm lần 2 trong CÙNG transaction
SELECT COUNT(*) AS 'lan 2' FROM LOPHOCPHAN
 WHERE MAHK = '2025-2026-HK1' AND SISOMAX > 45;
-- --> 5  ✅ vẫn 5 — REPEATABLE READ chụp snapshot...
-- NHƯNG HÀNG "MA" ĐÃ CÓ THẬT — chứng minh ngay:

-- BƯỚC 4 — SESSION B: vẫn trong transaction cũ, thử GHI
UPDATE LOPHOCPHAN SET PHONGHOC = 'D3-TANG1'
 WHERE MAHK = '2025-2026-HK1' AND SISOMAX > 45;
-- --> Query OK, 6 rows affected  ❌ COUNT là 5 mà UPDATE sửa 6 hàng
--     = hàng "ma" LHPTEST lộ diện khi ghi (phantom!)
COMMIT;

-- KIỂM CHỨNG:
--   SELECT MALHP, PHONGHOC FROM LOPHOCPHAN
--    WHERE MAHK='2025-2026-HK1' AND SISOMAX > 45;
-- --> 6 hàng, trong đó LHPTEST có PHONGHOC='D3-TANG1' — bị UPDATE "quét" trúng
--     dù COUNT trong cùng transaction vẫn báo 5

-- #####################################################################
-- PHẦN B — KHẮC PHỤC 1: FOR UPDATE (next-key lock) khoá cả khoảng
-- #####################################################################

-- [SESSION A] Dọn lớp mẫu trước:
DELETE FROM LOPHOCPHAN WHERE MALHP = 'LHPTEST';
COMMIT;

-- [SESSION B]
START TRANSACTION;
SELECT COUNT(*) FROM LOPHOCPHAN WHERE MAHK = '2025-2026-HK1' AND SISOMAX > 45 FOR UPDATE;
-- --> 5, đồng thời next-key lock khóa cả "khoảng" SISOMAX > 45

-- [SESSION A]
INSERT INTO LOPHOCPHAN
  (MALHP, MAHP, MAHK, MAGV, SISOMAX, PHONGHOC, THU, TIETBATDAU, SOTIET, TRANGTHAI)
VALUES
  ('LHPTEST', 'IT1010', '2025-2026-HK1', 'GV01', 50, 'D3-999', 2, 8, 2, 'mở');
-- ⏳ A TREO — bị chặn bởi next-key lock, không INSERT được

-- [SESSION B]
COMMIT;
-- A (đang treo) chạy tiếp ngay: Query OK — INSERT vào được sau khi B kết thúc

-- #####################################################################
-- PHẦN C — KHẮC PHỤC 2: SERIALIZABLE (mức cô lập cao nhất)
-- ---------------------------------------------------------------------
-- [SESSION B]
SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE;
START TRANSACTION;
SELECT COUNT(*) FROM LOPHOCPHAN WHERE MAHK = '2025-2026-HK1' AND SISOMAX > 45;
-- --> 5. Plain SELECT ở SERIALIZABLE tự chuyển thành FOR UPDATE

-- [SESSION A]
INSERT INTO LOPHOCPHAN
  (MALHP, MAHP, MAHK, MAGV, SISOMAX, PHONGHOC, THU, TIETBATDAU, SOTIET, TRANGTHAI)
VALUES
  ('LHPTEST2', 'IT1010', '2025-2026-HK1', 'GV01', 50, 'D3-998', 2, 8, 2, 'mở');
-- ⏳ lại bị treo — chứng minh SERIALIZABLE chặn cả plain SELECT

-- [SESSION B]
COMMIT;
-- A vào được. Dọn dẹp:
--   DELETE FROM LOPHOCPHAN WHERE MALHP IN ('LHPTEST','LHPTEST2');

-- #####################################################################
-- RESET sau demo (xóa lớp mẫu, trả sĩ số chuẩn):
--   DELETE FROM LOPHOCPHAN WHERE MALHP LIKE 'LHPTEST%';
--   UPDATE LOPHOCPHAN SET SISOMAX = 60 WHERE MALHP='LHP0102';
-- (hoặc chạy lại db/demo/demo.sql)
-- =====================================================================
