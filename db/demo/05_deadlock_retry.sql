-- =====================================================================
-- Demo 5: DEADLOCK RETRY (mô phỏng API server/routes/sinhvien.js:53)
-- Khi nhận lỗi 1213 deadlock, chương trình retry tới 3 lần.
-- Script này chỉ minh họa phía DB; retry được code ở phía Node.js.
-- =====================================================================

-- Chạy trong 2 session paraleng để thúc đẩy deadlock, rồi retry:
-- SESSION B:
--   START TRANSACTION;
--   UPDATE counter SET value = value + 10 WHERE id = 2;
--   UPDATE counter SET value = value + 10 WHERE id = 1;  -- deadlock ở đây
--   COMMIT; -- hoặc rollback + retry

-- Session bị deadlock nhận:
--   ERROR 1213 (40001): Deadlock found when trying to get lock; try restarting transaction

-- Trong code Node.js (sinhvien.js):
--   for (let attempt = 1; attempt <= 3; attempt++) { ... }
