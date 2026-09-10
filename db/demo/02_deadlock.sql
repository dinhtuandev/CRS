-- =====================================================================
-- Demo 2: DEADLOCK (vòng tranh khóa)
-- Mở 2 session paralell và chạy xen kẽ (hoặc để mysql tự gây deadlock)
-- =====================================================================

-- SESSION A
START TRANSACTION;
UPDATE counter SET value = value + 50 WHERE id = 1;   -- giữ X-lock trên hàng 1

-- SESSION B
-- START TRANSACTION;
-- UPDATE counter SET value = value + 50 WHERE id = 2;   -- giữ X-lock trên hàng 2

-- SESSION A (giờ cố lấy hàng 2 mà B đang giữ)
-- UPDATE counter SET value = value + 50 WHERE id = 2;

-- SESSION B (cố lấy hàng 1 mà A đang giữ)
-- UPDATE counter SET value = value + 50 WHERE id = 1;

-- => MySQL đánh thức deadlock: một session nhận
--    ERROR 1213 (40001): Deadlock found when trying to get lock
--    và tự động ROLLBACK; session còn lại COMMIT thành công.

-- Kiểm tra log deadlock (trong session còn lại):
-- SHOW ENGINE INNODB STATUS\G
