-- =====================================================================
-- Demo 1: LOST UPDATE
-- Khởi động 2 session riêng:
--   mysql -h 127.0.0.1 -P 3307 -u root -proot123 qlhp_demo
-- Mức cô lập mặc định của InnoDB là REPEATABLE-READ; ta chuyển
-- READ COMMITTED ở đây để trường hợp bị mất +1 dễ lộ hơn.
-- =====================================================================

-- SESSION A
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;
SELECT value FROM counter WHERE id = 1;          -- Kết quả: 100

-- SESSION B  (mở trước khi A commit)
-- START TRANSACTION;
-- UPDATE counter SET value = 100 + 1 WHERE id = 1;
-- COMMIT;

-- SESSION A (tiếp tục sau khi B commit)
UPDATE counter SET value = 100 + 1 WHERE id = 1;   -- cập nhật trên giá trị đã đọc cũ
COMMIT;

SELECT value FROM counter WHERE id = 1;          -- Kết quả: 101
-- => B +1 đã bị ghi đè => LOST UPDATE
