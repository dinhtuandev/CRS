-- =====================================================================
-- CSDL demo giao thức điều khiển tương tranh
-- Chạy 1 lần trước các demo:
--   docker compose exec -T db mysql -uroot -proot123 \
--     --default-character-set=utf8mb4 < db/demo/demo.sql
-- Sau đó mở 2 terminal:
--   docker compose exec db mysql -uroot -proot123 --default-character-set=utf8mb4 qlhp_demo
-- Xem tài liệu từng bước: docs/demo-concurrency.md
-- =====================================================================

DROP DATABASE IF EXISTS qlhp_demo;
CREATE DATABASE qlhp_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE qlhp_demo;

-- Bảng counter: 4 hàng dùng chung cho cả 5 demo
CREATE TABLE counter (
  id    INT PRIMARY KEY,
  name  VARCHAR(50) NOT NULL,
  value INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

INSERT INTO counter VALUES
  (1,  'A', 100),
  (2,  'B',  40),   -- value <= 50: hàng KHÔNG thỏa điều kiện demo Phantom
  (3,  'C',  60),   -- value >  50 cho demo Phantom
  (99, 'Z',  80);   -- value >  50 cho demo Phantom

-- Reset nhanh giữa các lần demo (chạy trong session bất kỳ):
--   UPDATE counter SET value = 100 WHERE id = 1;
--   UPDATE counter SET value = 40  WHERE id = 2;
