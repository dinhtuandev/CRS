-- =====================================================================
-- DEMO 5: DEADLOCK — khoá chéo 2 lớp → ERROR 1213, và 3 cách khắc phục
-- NGAY TRÊN DB DỰ ÁN: 2 cán bộ điều chỉnh sĩ số 2 lớp LHP0101 và LHP0102
-- theo thứ tự NGƯỢC NHAU → chu trình chờ → deadlock.
--
-- Vì sao ±1 chỗ/lớp: LHP0101 chỉ có sĩ số 2 và DB có CHECK SISOMAX > 0 —
-- chỉnh nhiều hơn sẽ vấp CHECK trước khi kịp tạo deadlock.
--
-- Tài liệu: docs/demo-concurrency.md
-- =====================================================================

-- [CẢ HAI SESSION] Đảm bảo giá trị gốc:
--   UPDATE LOPHOCPHAN SET SISOMAX = 2  WHERE MALHP='LHP0101';
--   UPDATE LOPHOCPHAN SET SISOMAX = 60 WHERE MALHP='LHP0102';

-- #####################################################################
-- PHẦN A — GÂY LỖI: 2 transaction khoá chéo 2 hàng
-- #####################################################################

-- BƯỚC 1 — SESSION A (tăng LHP0101 1 chỗ, bù bằng LHP0102):
START TRANSACTION;
UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX + 1 WHERE MALHP = 'LHP0101';
-- A giữ khoá hàng LHP0101

-- BƯỚC 2 — SESSION B (ngược chiều: tăng LHP0102, bù bằng LHP0101):
START TRANSACTION;
UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX + 1 WHERE MALHP = 'LHP0102';
-- B giữ khoá hàng LHP0102 (chưa xung đột với A — YET)

-- BƯỚC 3 — SESSION A: với tới hàng thứ hai
UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX - 1 WHERE MALHP = 'LHP0102';
-- ⏳ A ĐỢI khoá LHP0102 do B giữ

-- BƯỚC 4 — SESSION B: với tới hàng thứ nhất
UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX - 1 WHERE MALHP = 'LHP0101';
-- 💥 InnoDB phát hiện chu trình chờ (A đợi B, B đợi A) — ngay lập tức:
--   ERROR 1213 (40001): Deadlock found when trying to get lock;
--   try restarting transaction
-- InnoDB TỰ CHỌN một transaction làm "nạn nhân": ROLLBACK toàn bộ,
-- nhả khoá — phiên kia chạy tiếp được.

-- BƯỚC 5 — SESSION A (phiên sống sót): COMMIT
COMMIT;

-- KIỂM CHỨNG (session bất kỳ):
--   SELECT MALHP, SISOMAX FROM LOPHOCPHAN WHERE MALHP IN ('LHP0101','LHP0102');
-- --> nạn nhân bị ROLLBACK: chỉnh của nó biến mất; phiên kia +1/-1 đủ cặp.
-- Xem dấu tích deadlock trong InnoDB:
--   SHOW ENGINE INNODB STATUS\G   (mục LATEST DETECTED DEADLOCK)

-- #####################################################################
-- PHẦN B — KHẮC PHỤC 1: khoá theo CÙNG THỨ TỰ (lock ordering)
-- Quy ước dự án: LUÔN chạm lớp có MALHP nhỏ hơn trước.
-- #####################################################################

-- [SESSION A]
START TRANSACTION;
UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX + 1 WHERE MALHP = 'LHP0101'; -- 'LHP0101' < 'LHP0102'
UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX - 1 WHERE MALHP = 'LHP0102';
COMMIT;

-- [SESSION B] — DÙ phiếu ngược chiều, vẫn chạm LHP0101 TRƯỚC:
START TRANSACTION;
UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX - 1 WHERE MALHP = 'LHP0101'; -- khoá TRƯỚC dù sửa sau
UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX + 1 WHERE MALHP = 'LHP0102';
COMMIT;
-- ✅ Không deadlock: B chỉ ĐỢI A ở hàng đầu tiên, rồi chạy tiếp tuần tự.

-- #####################################################################
-- PHẦN C — KHẮC PHỤC 2: STORED PROCEDURE TỰ RETRY khi dính 1213
-- (mô hình API đang dùng: sinhvien.js retry 3 lần khi errno = 1213)
-- #####################################################################

DROP PROCEDURE IF EXISTS sp_demo_deadlock_retry;
DELIMITER $$
CREATE PROCEDURE sp_demo_deadlock_retry()
BEGIN
  DECLARE attempts INT DEFAULT 0;
  demo_loop: LOOP
    SET attempts = attempts + 1;
    BEGIN
      DECLARE EXIT HANDLER FOR 1213
      BEGIN
        -- InnoDB đã tự rollback transaction dính deadlock
        IF attempts >= 3 THEN
          RESIGNAL;  -- hết lượt, ném lỗi cho caller
        END IF;
      END;
      START TRANSACTION;
      UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX + 1 WHERE MALHP = 'LHP0101';
      UPDATE LOPHOCPHAN SET SISOMAX = SISOMAX - 1 WHERE MALHP = 'LHP0102';
      COMMIT;
      LEAVE demo_loop;   -- thành công
    END;
  END LOOP;
END$$
DELIMITER ;

-- Chạy procedure — nếu dính deadlock sẽ tự thử lại tối đa 3 lần:
CALL sp_demo_deadlock_retry();
-- --> Query OK (đã retry ngầm nếu có 1213)

-- Sau demo, xoá procedure mẫu:
DROP PROCEDURE IF EXISTS sp_demo_deadlock_retry;

-- #####################################################################
-- RESET sau demo (chạy lại db/demo/demo.sql hoặc):
--   UPDATE LOPHOCPHAN SET SISOMAX = 2  WHERE MALHP='LHP0101';
--   UPDATE LOPHOCPHAN SET SISOMAX = 60 WHERE MALHP='LHP0102';
-- =====================================================================
