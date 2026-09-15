-- =====================================================================
-- DEMO 4: PHANTOM (đọc ma) → khắc phục bằng khoá vị (next-key lock)
--         hoặc SERIALIZABLE
-- Gõ theo BƯỚC xen kẽ giữa SESSION A và SESSION B.
-- Tài liệu: docs/demo-concurrency.md
-- =====================================================================
-- Bảng counter có sẵn 3 hàng value > 50 (id 1, 3, 99) và 1 hàng <= 50 (id 2).

-- #####################################################################
-- PHẦN A: GÂY LỖI (REPEATABLE READ che được SELECT nhưng che không hết)
-- #####################################################################

-- (A1) SESSION B
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;
SELECT COUNT(*) AS cnt FROM counter WHERE value > 50;   -- Kết quả: 3

-- (A2) SESSION A — thêm hàng ma và commit
START TRANSACTION;
INSERT INTO counter VALUES (4, 'P', 999);   -- 999 > 50, sẽ thỏa WHERE của B
COMMIT;

-- (A3) SESSION B — đếm lại trong cùng transaction
SELECT COUNT(*) AS cnt FROM counter WHERE value > 50;   -- VẪN 3 (snapshot) — trông có vẻ ổn...

-- (A4) SESSION B — nhưng khi CẬP NHẬT dựa trên tập kết quả đó:
UPDATE counter SET name = CONCAT(name, '-x') WHERE value > 50;
-- Query OK, 4 rows affected  ❌ —— hàng "ma" (id 4) vừa Bị SỬA, dù COUNT vẫn báo 3!
SELECT name, value FROM counter WHERE value > 50;   -- thấy 4 hàng, hàng id 4 cũng có '-x'
ROLLBACK;                                           -- hoàn tác để sang phần B

-- => Bước A4 cho thấy phantom THẬT: tập dòng mà transaction "nhìn thấy"
--    khi ghi khác với tập dòng khi đọc => kết quả nghiệp vụ thiếu nhất quán.

-- Reset: DELETE FROM counter WHERE id = 4;

-- #####################################################################
-- PHẦN B: KHẮC PHỤC 1 — khoá vị (next-key lock) qua FOR UPDATE
-- Khoá luôn "khoảng trống" nơi hàng mới có thể xuất hiện.
-- #####################################################################

-- (B1) SESSION B — khoá phạm vi NGAY TỪ ĐẦU
UPDATE counter SET value = 60 WHERE id = 2;   -- thêm 1 hàng >50, tổng 4 hàng cho rõ
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;
SELECT * FROM counter WHERE value > 50 FOR UPDATE;   -- X-lock 4 hàng + khoảng trống (gap)

-- (B2) SESSION A — sẽ BỊ CHẶN ở lệnh dưới (chờ tới khi B commit)
START TRANSACTION;
INSERT INTO counter VALUES (5, 'Q', 777);   -- ... đang chờ gap-lock của B ...

-- (B3) SESSION B — làm việc với tập kết quả đã khoá, rồi nhả khoá
UPDATE counter SET name = CONCAT(name, '-x') WHERE value > 50;   -- đúng 4 hàng
COMMIT;                                                          -- A giờ chạy tiếp được

-- (B4) SESSION A — lệnh INSERT ở B2 chạy xong, kiểm tra
COMMIT;
SELECT id, name, value FROM counter WHERE name LIKE '%-x';   -- chỉ 4 hàng B sửa ✅
-- hàng id 5 không bị sửa => tập ghi nhất quán với tập đọc ✅

-- Reset:
--   UPDATE counter SET name = 'B' WHERE id = 2;
--   UPDATE counter SET name = 'A' WHERE id = 1;
--   DELETE FROM counter WHERE id = 5;

-- #####################################################################
-- PHẦN C: KHẮC PHỤC 2 — SERIALIZABLE (mọi SELECT thành khoá chia sẻ)
-- #####################################################################

-- (C1) SESSION B
SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE;
START TRANSACTION;
SELECT COUNT(*) AS cnt FROM counter WHERE value > 50;   -- 4, đồng thời giữ S-lock phạm vi

-- (C2) SESSION A — INSERT sẽ BỊ CHẶN (chờ tới khi B commit)
START TRANSACTION;
INSERT INTO counter VALUES (5, 'Q', 777);   -- ... đang chờ ...

-- (C3) SESSION B
COMMIT;   -- A chạy tiếp được

-- (C4) SESSION A
COMMIT;
-- Reset: DELETE FROM counter WHERE id = 5;
--
-- Ghi chú: SERIALIZABLE đúng chuẩn SQL:1999 nhưng giảm thông lượng đáng kể
-- (mọi đọc thường đều khoá). Trong đề tài này dùng kỹ thuật next-key lock
-- có chọn lọc (FOR UPDATE) là đủ và hiệu quả hơn.
