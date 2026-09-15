-- =====================================================================
-- CHUẨN BỊ + RESET cho bộ demo tương tranh — chạy NGAY TRÊN DB DỰ ÁN qlhocphan
-- (không còn database riêng qlhp_demo như bản cũ)
--
-- Chuẩn bị (1 lần, mỗi lần trước buổi demo):
--   docker compose exec -T db mysql -uroot -proot123 \
--     --default-character-set=utf8mb4 < db/demo/demo.sql
--
-- Mở 2 session demo (2 terminal):
--   docker compose exec db mysql -uroot -proot123 \
--     --default-character-set=utf8mb4 qlhocphan
--
-- CHÚ Ý: các demo thao tác trực tiếp lên bảng thật (LOPHOCPHAN,
-- DANGKYHOCPHAN) với đúng các lớp mẫu LHP0101 / LHP0102. Chỉ thay đổi
-- SISOMAX, PHONGHOC của 2 lớp này + thêm/xoá lớp mẫu LHPTEST — sau buổi
-- demo chạy lại file này là DB về trạng thái chuẩn (phần RESET ở dưới).
--
-- Xem tài liệu từng bước: docs/demo-concurrency.md
-- =====================================================================

USE qlhocphan;

-- ---------------------------------------------------------------------
-- Dọn tàn tích của bộ demo cũ (database counter riêng) nếu còn
-- ---------------------------------------------------------------------
DROP DATABASE IF EXISTS qlhp_demo;
DROP PROCEDURE IF EXISTS sp_demo_deadlock_retry;
DELETE FROM DANGKYHOCPHAN WHERE MALHP = 'LHPTEST';
DELETE FROM LOPHOCPHAN WHERE MALHP = 'LHPTEST';

-- ---------------------------------------------------------------------
-- RESET dữ liệu mẫu về trạng thái chuẩn cho 5 demo + demo oversell
-- ---------------------------------------------------------------------
UPDATE LOPHOCPHAN SET SISOMAX = 2, PHONGHOC = 'D3-201' WHERE MALHP = 'LHP0101';
UPDATE LOPHOCPHAN SET SISOMAX = 60, PHONGHOC = 'D3-202' WHERE MALHP = 'LHP0102';

-- ---------------------------------------------------------------------
-- Xem dữ liệu mẫu trước khi demo (2 lớp dùng xuyên suốt)
-- ---------------------------------------------------------------------
SELECT MALHP, MAHP, MAHK, MAGV, SISOMAX, PHONGHOC, TRANGTHAI
  FROM LOPHOCPHAN
 WHERE MALHP IN ('LHP0101', 'LHP0102');

-- Sinh viên đã đăng ký LHP0101 (sĩ số 2 — lớp ĐẦY, dùng cho demo oversell)
SELECT MASV, MALHP, TRANGTHAI
  FROM DANGKYHOCPHAN
 WHERE MALHP = 'LHP0101' AND TRANGTHAI = 'đăng ký';

-- 5 lớp của HK1 có sĩ số > 45 (bộ đếm cho demo Phantom)
SELECT MALHP, MAHP, SISOMAX
  FROM LOPHOCPHAN
 WHERE MAHK = '2025-2026-HK1' AND SISOMAX > 45
 ORDER BY MALHP;

-- =====================================================================
-- RESET NHANH sau khi demo xong (chạy lại toàn bộ file này cũng được):
--   docker compose exec -T db mysql -uroot -proot123 \
--     --default-character-set=utf8mb4 < db/demo/demo.sql
-- Kiểm chứng sau reset:
--   SELECT MALHP, SISOMAX, PHONGHOC FROM LOPHOCPHAN
--    WHERE MALHP IN ('LHP0101','LHP0102');
--   --> LHP0101: 2 / D3-201    LHP0102: 60 / D3-202
--   SELECT * FROM LOPHOCPHAN WHERE MALHP='LHPTEST';   --> rỗng
-- =====================================================================
