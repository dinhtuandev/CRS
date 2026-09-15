-- =====================================================================
-- DEMO 1: LOST UPDATE (cập nhật mất) → khắc phục bằng FOR UPDATE
-- Mở 2 session:
--   docker compose exec db mysql -uroot -proot123 --default-character-set=utf8mb4 qlhp_demo
-- Gõ theo BƯỚC (1..5) xen kẽ giữa SESSION A và SESSION B.
-- Tài liệu: docs/demo-concurrency.md
-- =====================================================================

-- #####################################################################
-- PHẦN A: GÂY LỖI (READ COMMITTED — đọc xong nhả khoá, không giữ tới commit)
-- #####################################################################

-- (A1) SESSION A — chuẩn bị
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;
SELECT value FROM counter WHERE id = 1;   -- Kết quả: 100

-- (A2) SESSION B — cộng +1 và commit
START TRANSACTION;
UPDATE counter SET value = value + 1 WHERE id = 1;
COMMIT;
-- B commit thành công: 100 -> 101

-- (A3) SESSION A — cộng +1 trên giá trị ĐÃ ĐỌC CŨ (100), không phải 101
UPDATE counter SET value = 100 + 1 WHERE id = 1;   -- ghi đè mất +1 của B
COMMIT;

-- (A4) SESSION A — kiểm chứng
SELECT value FROM counter WHERE id = 1;   -- Kết quả: 101  ❌ (mong 102)
-- => Phép +1 của B đã BỊ MẤT => LOST UPDATE

-- Reset trước khi sang phần B:
--   UPDATE counter SET value = 100 WHERE id = 1;

-- #####################################################################
-- PHẦN B: KHẮC PHỤC — SELECT ... FOR UPDATE (Exclusive-2PL)
-- Đọc và giữ khoá độc quyền cho tới COMMIT => "đọc-tính-ghi" nguyên tố.
-- #####################################################################

-- (B1) SESSION A
UPDATE counter SET value = 100 WHERE id = 1;
START TRANSACTION;
SELECT value FROM counter WHERE id = 1 FOR UPDATE;   -- 100, giữ X-lock

-- (B2) SESSION B — sẽ BỊ CHẶN ở lệnh dưới (đừng đóng terminal, chờ A commit)
START TRANSACTION;
UPDATE counter SET value = value + 1 WHERE id = 1;   -- ... đang chờ khoá của A ...

-- (B3) SESSION A — tính trên giá trị mới nhất, commit
UPDATE counter SET value = value + 1 WHERE id = 1;   -- 100 -> 101
COMMIT;                                              -- B giờ được chờ xong và chạy tiếp

-- (B4) SESSION A — kiểm chứng
SELECT value FROM counter WHERE id = 1;   -- 101 (A) rồi B cộng tiếp -> 102 ✅

-- (B5) SESSION B — lệnh UPDATE ở bước B2 giờ chạy xong, gõ COMMIT
COMMIT;
SELECT value FROM counter WHERE id = 1;   -- Kết quả: 102 ✅ (không mất phép cộng nào)

-- Reset: UPDATE counter SET value = 100 WHERE id = 1;
