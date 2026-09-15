-- =====================================================================
-- DEMO 6: OVERSELL — vì sao dự án cần "2 lớp bảo vệ"
-- ---------------------------------------------------------------------
-- LHP0101: SISOMAX = 2, đang có SV005 + SV006 (LỚP ĐẦY).
-- Kịch bản: 2 sinh viên nộp đơn xin học lại cùng lúc, 2 cán bộ cùng bấm
-- duyệt ở 2 máy — lớp 2 chỗ nào chứa được 4 người?
--
--   LỚP 1 (ứng dụng/procedure): sp_dangky_hocphan — transaction + FOR UPDATE
--   LỚP 2 (database/trigger)  : trg_dangky_before_insert — chặn ĐƯỜNG GHI
--                               TRỰC TIẾP (SQL client, script, seed...)
--
-- Demo này TẠM GỠ lớp 2 để chứng minh oversell thật xảy ra khi thiếu nó,
-- rồi gắn lại — trả lời câu hỏi thầy hay hỏi: "có trigger thì mất gì?".
--
-- Tài liệu: docs/demo-concurrency.md
-- =====================================================================

-- #####################################################################
-- PHẦN A — GÂY LỖI: TẠM GỠ trigger (lớp 2), 2 phiên cùng "đếm rồi chèn"
-- ---------------------------------------------------------------------
-- Chỉ chạy 1 lần ở session A. Bản trigger lưu sẵn dưới đây (y hệt
-- db/01_schema.sql) để gắn lại ở Phần B — KHÔNG lo mất code.

DROP TRIGGER IF EXISTS trg_dangky_before_insert;

-- BƯỚC 1 — SESSION A:
START TRANSACTION;
SELECT COUNT(*) AS so_dk_hien_tai FROM DANGKYHOCPHAN
 WHERE MALHP = 'LHP0101' AND TRANGTHAI = 'đăng ký';
-- --> 2 (lớp đầy... nhưng chỉ ĐỌC, không khoá gì cả)

-- BƯỚC 2 — SESSION B:
START TRANSACTION;
SELECT COUNT(*) AS so_dk_hien_tai FROM DANGKYHOCPHAN
 WHERE MALHP = 'LHP0101' AND TRANGTHAI = 'đăng ký';
-- --> 2 (cũng thấy "còn gì đâu" — nhưng vẫn chèn theo phiếu duyệt)

-- BƯỚC 3 — SESSION A: duyệt cho SV003
INSERT INTO DANGKYHOCPHAN (MASV, MALHP, LANHOC)
VALUES ('SV003', 'LHP0101', 'học lại');
-- Query OK — KHÔNG có gì chặn nữa.

-- BƯỚC 4 — SESSION B: duyệt cho SV004
INSERT INTO DANGKYHOCPHAN (MASV, MALHP, LANHOC)
VALUES ('SV004', 'LHP0101', 'học lại');
-- Query OK luôn (MASV khác nên không đụng PK).

COMMIT;  -- cả A và B

-- KIỂM CHỨNG — OVERSELL THẬT:
--   SELECT MASV FROM DANGKYHOCPHAN WHERE MALHP='LHP0101' AND TRANGTHAI='đăng ký';
-- --> 4 hàng: SV003, SV004, SV005, SV006  ❌ lớp sĩ số 2 chứa 4 sinh viên!
-- Đây là hậu quả khi chỉ dựa vào "đọc rồi kiểm tra" mà không khoá,
-- và khi không có lớp bảo vệ thứ hai ở mức DB.

-- #####################################################################
-- PHẦN B — GẮN LẠI TRIGGER (lớp 2) — chặn ngay đường ghi trực tiếp
-- ---------------------------------------------------------------------
-- Body y hệt db/01_schema.sql:

DELIMITER $$
CREATE TRIGGER trg_dangky_before_insert
BEFORE INSERT ON DANGKYHOCPHAN
FOR EACH ROW
BEGIN
  DECLARE v_lhp_found TINYINT DEFAULT 0;
  DECLARE v_sisomax INT;
  DECLARE v_lhp_trangthai VARCHAR(10);
  DECLARE v_dadangky INT;

  SELECT 1, SISOMAX, TRANGTHAI INTO v_lhp_found, v_sisomax, v_lhp_trangthai
    FROM LOPHOCPHAN WHERE MALHP = NEW.MALHP FOR UPDATE;
  IF v_lhp_found = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lớp học phần không tồn tại (trigger)';
  END IF;
  IF v_lhp_trangthai <> 'mở' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lớp học phần không mở (trigger)';
  END IF;

  SELECT COUNT(*) INTO v_dadangky FROM DANGKYHOCPHAN
    WHERE MALHP = NEW.MALHP AND TRANGTHAI = 'đăng ký';
  IF v_dadangky >= v_sisomax THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lớp học phần đã đầy (trigger)';
  END IF;

  IF NEW.DIEMCHUYENCAN IS NOT NULL
     AND NEW.DIEMGIUAKY IS NOT NULL
     AND NEW.DIEMCUOIKY IS NOT NULL THEN
    SET NEW.DIEMHE10 = ROUND(
      NEW.DIEMCHUYENCAN*0.1 + NEW.DIEMGIUAKY*0.3 + NEW.DIEMCUOIKY*0.6, 2);
    SET NEW.DIEMCHU  = fn_diem_chu(NEW.DIEMHE10);
    SET NEW.DIEMHE4  = CASE NEW.DIEMCHU
      WHEN 'A' THEN 4.00 WHEN 'B+' THEN 3.50 WHEN 'B' THEN 3.00
      WHEN 'C+' THEN 2.50 WHEN 'C' THEN 2.00 WHEN 'D+' THEN 1.50
      WHEN 'D' THEN 1.00 ELSE 0.00 END;
  ELSE
    SET NEW.DIEMHE10 = NULL;
    SET NEW.DIEMCHU = NULL;
    SET NEW.DIEMHE4 = NULL;
  END IF;
END$$
DELIMITER ;

-- Dọn oversell của Phần A trước khi thử:
DELETE FROM DANGKYHOCPHAN WHERE MASV IN ('SV003','SV004') AND MALHP = 'LHP0101';

-- Giờ thử ghi thẳng lại (không qua API, không qua procedure):
INSERT INTO DANGKYHOCPHAN (MASV, MALHP, LANHOC)
VALUES ('SV003', 'LHP0101', 'học lại');
-- 💥 ERROR 1644 (45000): Lớp học phần đã đầy (trigger)
-- → kể cả ai đó ngồi SQL client thao tác trực tiếp cũng không phá sĩ số được.

-- #####################################################################
-- PHẦN C — ĐƯỜNG ĐÚNG: procedure với 2 phiên ĐỒNG THỜI trên lớp CÒN CHỖ
-- ---------------------------------------------------------------------
-- LHP0102 (sĩ số 60, đang trống). Cả 2 session CHẠY GẦN NHU ĐỒNG THỜI:
--   SESSION A:  CALL sp_dangky_hocphan('SV003', 'LHP0102', 'học lại');
--   SESSION B:  CALL sp_dangky_hocphan('SV004', 'LHP0102', 'học lại');
-- Cả hai thành công — vì FOR UPDATE trong procedure xếp 2 phiên TUẦN TỰ:
-- phiên sau đọc sĩ số/sĩ số hiện tại SAU khi phiên trước commit.
--
-- KIỂM CHỨNG:
--   SELECT COUNT(*) FROM DANGKYHOCPHAN WHERE MALHP='LHP0102' AND TRANGTHAI='đăng ký';
-- --> 2 ✅ đúng 2, không oversell, không mất đăng ký nào.
--
-- Thử lớp ĐẦY qua đường chuẩn:
--   CALL sp_dangky_hocphan('SV004', 'LHP0101', 'học lại');
-- 💥 ERROR 1644: Lớp học phần đã đầy — chặn đúng, không race.

-- #####################################################################
-- RESET sau demo (chạy lại db/demo/demo.sql hoặc):
--   DELETE FROM DANGKYHOCPHAN WHERE MALHP='LHP0102' AND MASV IN ('SV003','SV004');
--   DELETE FROM DANGKYHOCPHAN WHERE MALHP='LHP0101' AND MASV IN ('SV003','SV004');
-- =====================================================================
