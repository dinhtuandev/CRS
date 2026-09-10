-- =====================================================================
-- Demo 3: PHANTOM READ (REPEATABLE-READ vs READ COMMITTED)
-- =====================================================================

-- SESSION A   (REPEATABLE READ — mặc định)
START TRANSACTION;
SELECT COUNT(*) AS cnt FROM counter WHERE value > 50;  -- 2

-- SESSION B  (mở transaction riêng)
-- START TRANSACTION;
-- INSERT INTO counter VALUES (3,'C',999);
-- UPDATE counter SET value = 75 WHERE id = 1;  -- value = 75 vẫn > 50
-- COMMIT;

-- SESSION A  (read lại — REPEATABLE READ)
-- SELECT COUNT(*) AS cnt FROM counter WHERE value > 50;  -- vẫn 2  => phantom TRÁNH
COMMIT;

-- Đổi isolation level và lặp lại:
-- SESSION A (READ COMMITTED)
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;
SELECT COUNT(*) AS cnt FROM counter WHERE value > 50;  -- 2 hoặc nhiều hơn tùy B đã insert
-- Sau khi B INSERT + COMMIT, read thứ 2 sẽ thấy hàng mới => PHANTOM xuất hiện
SELECT COUNT(*) AS cnt FROM counter WHERE value > 50;
COMMIT;
