-- =====================================================================
-- Demo 4: EXCLUSIVE-LOCK / 2PL (SELECT ... FOR UPDATE)
-- Minh họa cách sp_dangky_hocphan dùng FOR UPDATE để tránh oversell.
-- =====================================================================

-- SESSION A
START TRANSACTION;
SELECT value FROM counter WHERE id = 1 FOR UPDATE;  -- X-lock hàng 1
-- SELECT ... FOR UPDATE giữ exclusive lock cho đến COMMIT => Exclusive-2PL
-- SELECT value FROM counter WHERE id = 1 FOR UPDATE;  -- ở session B sẽ BỊ BLOCK

-- SESSION B (sẽ chặn ở đây cho đến khi A commit)
-- START TRANSACTION;
-- SELECT value FROM counter WHERE id = 1 FOR UPDATE;

-- SESSION A
UPDATE counter SET value = value + 1 WHERE id = 1;
COMMIT;   -- Bây giờ session B mới lấy lock được

-- Kiểm tra lock hiện hành (trong session A hoặc B):
-- SELECT * FROM performance_schema.data_locks
--   WHERE ENGINE='innodb' AND ENGINE_LOCK_ID IS NOT NULL;
