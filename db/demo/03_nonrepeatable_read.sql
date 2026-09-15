-- =====================================================================
-- DEMO 3: NON-REPEATABLE READ (đọc không lặp lại) → khắc phục bằng
--         REPEATABLE READ (snapshot MVCC, mặc định của InnoDB)
-- Gõ theo BƯỚC xen kẽ giữa SESSION A và SESSION B.
-- Tài liệu: docs/demo-concurrency.md
-- =====================================================================

-- #####################################################################
-- PHẦN A: GÂY LỖI (READ COMMITTED — mỗi SELECT thấy dữ liệu mới nhất)
-- Tình huống: giảng viên tính điểm tổng kết đọc 2 lần trong cùng 1
-- transaction; giữa 2 lần, một điểm bị sửa + commit => 2 kết quả lệch.
-- #####################################################################

-- (A1) SESSION B
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;
SELECT value FROM counter WHERE id = 1;   -- Kết quả: 100 (lần 1)

-- (A2) SESSION A — sửa và commit
UPDATE counter SET value = 200 WHERE id = 1;
COMMIT;

-- (A3) SESSION B — đọc lại TRONG CÙNG transaction
SELECT value FROM counter WHERE id = 1;   -- Kết quả: 200 ❌ (đổi giữa chừng!)
-- => Cùng 1 transaction, cùng 1 hàng, 2 giá trị khác nhau
--    => phép tính tổng/luỹ tiến dùng 2 kết quả này sẽ sai lệch
COMMIT;

-- Reset: UPDATE counter SET value = 100 WHERE id = 1;

-- #####################################################################
-- PHẦN B: KHẮC PHỤC — REPEATABLE READ (snapshot nhất quán từ lần đọc đầu)
-- #####################################################################

-- (B1) SESSION B — trở về mức mặc định của InnoDB
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;
SELECT value FROM counter WHERE id = 1;   -- 100 (snapshot chụp từ đây)

-- (B2) SESSION A — sửa và commit
UPDATE counter SET value = 200 WHERE id = 1;
COMMIT;

-- (B3) SESSION B — đọc lại trong CÙNG transaction cũ
SELECT value FROM counter WHERE id = 1;   -- VẪN 100 ✅ (đọc từ snapshot, không lộn xộn)
COMMIT;                                   -- commit xong thì lần đọc SAU mới thấy 200

-- (B4) SESSION B — kiểm chứng: sau commit, transaction mới thấy giá trị mới
START TRANSACTION;
SELECT value FROM counter WHERE id = 1;   -- 200 ✅
COMMIT;

-- Reset: UPDATE counter SET value = 100 WHERE id = 1;
--
-- Ghi chú trình bày: REPEATABLE READ chỉ bảo đảm kết quả LẶP LẠI cho
-- ĐỌC THUẦN. Nếu nghiệp vụ cần tính trên dữ liệu MỚI NHẤT một cách
-- nhất quán (ví dụ tổng tiền), thêm khoá: SELECT ... FOR UPDATE / FOR SHARE.
