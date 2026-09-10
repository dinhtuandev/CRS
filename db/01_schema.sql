-- =====================================================================
-- Quản lý học phần tín chỉ — Schema MySQL 8.0+
-- Chạy file này TRƯỚC 02_security.sql và 03_seed.sql
-- =====================================================================

DROP DATABASE IF EXISTS qlhocphan;
CREATE DATABASE qlhocphan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE qlhocphan;

-- ---------------------------------------------------------------
-- 1. KHOA
-- ---------------------------------------------------------------
CREATE TABLE KHOA (
  MAKHOA  VARCHAR(5)   NOT NULL,
  TENKHOA VARCHAR(100) NOT NULL,
  PRIMARY KEY (MAKHOA)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- 2. GIANGVIEN
-- ---------------------------------------------------------------
CREATE TABLE GIANGVIEN (
  MAGV      VARCHAR(10)  NOT NULL,
  HOTEN     VARCHAR(50)  NOT NULL,
  NGAYSINH  DATE         NULL,
  GIOITINH  TINYINT(1)   NULL COMMENT '0=nữ, 1=nam',
  HOCVI     VARCHAR(30)  NULL,
  MAKHOA    VARCHAR(5)   NOT NULL,
  EMAIL     VARCHAR(100) NULL,
  PRIMARY KEY (MAGV),
  CONSTRAINT fk_gv_khoa FOREIGN KEY (MAKHOA) REFERENCES KHOA(MAKHOA)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT uq_gv_email UNIQUE (EMAIL)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- 3. SINHVIEN  (thẳng KHOA — không bảng LOP tuỳ chọn)
-- ---------------------------------------------------------------
CREATE TABLE SINHVIEN (
  MASV        VARCHAR(10) NOT NULL,
  HOTEN       VARCHAR(50) NOT NULL,
  NGAYSINH    DATE        NULL,
  GIOITINH    TINYINT(1)  NULL,
  MAKHOA      VARCHAR(5)  NOT NULL,
  NGAYNHAPHOC DATE        NULL,
  TRANGTHAI   ENUM('đang học','bảo lưu','thôi học','tốt nghiệp') NOT NULL DEFAULT 'đang học',
  PRIMARY KEY (MASV),
  CONSTRAINT fk_sv_khoa FOREIGN KEY (MAKHOA) REFERENCES KHOA(MAKHOA)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- 4. HOCPHAN
-- ---------------------------------------------------------------
CREATE TABLE HOCPHAN (
  MAHP      VARCHAR(10)          NOT NULL,
  TENHP     VARCHAR(100)         NOT NULL,
  SOTINCHI  TINYINT UNSIGNED     NOT NULL,
  SOTIETLT  SMALLINT UNSIGNED    NULL,
  SOTIETTH  SMALLINT UNSIGNED    NULL,
  LOAIHP    ENUM('bắt buộc','tự chọn') NOT NULL,
  MAKHOA    VARCHAR(5)           NOT NULL,
  PRIMARY KEY (MAHP),
  CONSTRAINT chk_hp_tinchi CHECK (SOTINCHI > 0),
  CONSTRAINT fk_hp_khoa FOREIGN KEY (MAKHOA) REFERENCES KHOA(MAKHOA)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- 5. HOCPHAN_TIENQUYET (tự tham chiếu N–N)
-- ---------------------------------------------------------------
CREATE TABLE HOCPHAN_TIENQUYET (
  MAHP           VARCHAR(10) NOT NULL,
  MAHP_TIENQUYET VARCHAR(10) NOT NULL,
  PRIMARY KEY (MAHP, MAHP_TIENQUYET),
  CONSTRAINT fk_tq_hp   FOREIGN KEY (MAHP)           REFERENCES HOCPHAN(MAHP)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_tq_hp_tq FOREIGN KEY (MAHP_TIENQUYET) REFERENCES HOCPHAN(MAHP)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

DELIMITER $$

CREATE TRIGGER trg_tq_khac_before_insert
BEFORE INSERT ON HOCPHAN_TIENQUYET
FOR EACH ROW
BEGIN
  IF NEW.MAHP = NEW.MAHP_TIENQUYET THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Học phần tiên quyết không được trùng với học phần';
  END IF;
END$$

CREATE TRIGGER trg_tq_khac_before_update
BEFORE UPDATE ON HOCPHAN_TIENQUYET
FOR EACH ROW
BEGIN
  IF NEW.MAHP = NEW.MAHP_TIENQUYET THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Học phần tiên quyết không được trùng với học phần';
  END IF;
END$$

DELIMITER ;

-- ---------------------------------------------------------------
-- 6. HOCKY  (KHOADIEM phục vụ trigger khoá bảng điểm)
-- ---------------------------------------------------------------
CREATE TABLE HOCKY (
  MAHK           VARCHAR(20) NOT NULL,
  NAMHOC         VARCHAR(9)  NOT NULL,
  HOCKYTHU       TINYINT     NOT NULL,
  NGAYBATDAU     DATE        NULL,
  NGAYKETTHUC    DATE        NULL,
  HANDANGKY_BD   DATETIME    NULL,
  HANDANGKY_KT   DATETIME    NULL,
  KHOADIEM       TINYINT(1)  NOT NULL DEFAULT 0,
  PRIMARY KEY (MAHK),
  CONSTRAINT chk_hk_thu CHECK (HOCKYTHU BETWEEN 1 AND 3)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- 7. LOPHOCPHAN
-- ---------------------------------------------------------------
CREATE TABLE LOPHOCPHAN (
  MALHP      VARCHAR(15)      NOT NULL,
  MAHP       VARCHAR(10)      NOT NULL,
  MAHK       VARCHAR(20)      NOT NULL,
  MAGV       VARCHAR(10)      NOT NULL,
  SISOMAX    SMALLINT UNSIGNED NOT NULL,
  PHONGHOC   VARCHAR(20)      NULL,
  THU        TINYINT          NULL COMMENT '2..8 (8 = CN)',
  TIETBATDAU TINYINT          NULL,
  SOTIET     TINYINT          NULL,
  TRANGTHAI  ENUM('mở','đóng','huỷ') NOT NULL DEFAULT 'mở',
  PRIMARY KEY (MALHP),
  CONSTRAINT chk_lhp_siso CHECK (SISOMAX > 0),
  CONSTRAINT chk_lhp_thu CHECK (THU IS NULL OR THU BETWEEN 2 AND 8),
  CONSTRAINT chk_lhp_tiet CHECK (TIETBATDAU IS NULL OR (TIETBATDAU BETWEEN 1 AND 12 AND SOTIET BETWEEN 1 AND 12)),
  CONSTRAINT fk_lhp_hp FOREIGN KEY (MAHP) REFERENCES HOCPHAN(MAHP)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_lhp_hk FOREIGN KEY (MAHK) REFERENCES HOCKY(MAHK)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_lhp_gv FOREIGN KEY (MAGV) REFERENCES GIANGVIEN(MAGV)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_lhp_hk (MAHK),
  INDEX idx_lhp_hp (MAHP)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- 8. DANGKYHOCPHAN
-- ---------------------------------------------------------------
CREATE TABLE DANGKYHOCPHAN (
  MASV           VARCHAR(10)   NOT NULL,
  MALHP          VARCHAR(15)   NOT NULL,
  NGAYDANGKY     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  LANHOC         ENUM('lần 1','học lại','cải thiện') NOT NULL DEFAULT 'lần 1',
  DIEMCHUYENCAN  DECIMAL(4,2)  NULL,
  DIEMGIUAKY     DECIMAL(4,2)  NULL,
  DIEMCUOIKY     DECIMAL(4,2)  NULL,
  DIEMHE10       DECIMAL(4,2)  NULL COMMENT 'tự tính: 10%CC + 30%GK + 60%CK',
  DIEMCHU        CHAR(2)       NULL,
  DIEMHE4        DECIMAL(3,2)  NULL,
  TRANGTHAI      ENUM('đăng ký','đã huỷ') NOT NULL DEFAULT 'đăng ký',
  PRIMARY KEY (MASV, MALHP),
  CONSTRAINT chk_dk_cc CHECK (DIEMCHUYENCAN IS NULL OR DIEMCHUYENCAN BETWEEN 0 AND 10),
  CONSTRAINT chk_dk_gk CHECK (DIEMGIUAKY   IS NULL OR DIEMGIUAKY   BETWEEN 0 AND 10),
  CONSTRAINT chk_dk_ck CHECK (DIEMCUOIKY   IS NULL OR DIEMCUOIKY   BETWEEN 0 AND 10),
  CONSTRAINT fk_dk_sv  FOREIGN KEY (MASV) REFERENCES SINHVIEN(MASV)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_dk_lhp FOREIGN KEY (MALHP) REFERENCES LOPHOCPHAN(MALHP)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_dk_lhp (MALHP),
  INDEX idx_dk_sv_trangthai (MASV, TRANGTHAI)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- 9. TAIKHOAN
-- ---------------------------------------------------------------
CREATE TABLE TAIKHOAN (
  MATK          INT AUTO_INCREMENT,
  TENDANGNHAP   VARCHAR(50)  NOT NULL,
  MATKHAU_HASH  VARCHAR(255) NOT NULL,
  VAITRO        ENUM('sinhvien','giangvien','admin') NOT NULL,
  MASV          VARCHAR(10)  NULL,
  MAGV          VARCHAR(10)  NULL,
  PRIMARY KEY (MATK),
  CONSTRAINT uq_tk_tendangnhap UNIQUE (TENDANGNHAP),
  CONSTRAINT fk_tk_sv FOREIGN KEY (MASV) REFERENCES SINHVIEN(MASV)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_tk_gv FOREIGN KEY (MAGV) REFERENCES GIANGVIEN(MAGV)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

DELIMITER $$

CREATE TRIGGER trg_tk_role_before_insert
BEFORE INSERT ON TAIKHOAN
FOR EACH ROW
BEGIN
  IF NOT (
    (NEW.VAITRO = 'sinhvien' AND NEW.MASV IS NOT NULL AND NEW.MAGV IS NULL)
    OR (NEW.VAITRO = 'giangvien' AND NEW.MAGV IS NOT NULL AND NEW.MASV IS NULL)
    OR (NEW.VAITRO = 'admin' AND NEW.MASV IS NULL AND NEW.MAGV IS NULL)
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tài khoản phải khớp vai trò sinh viên, giảng viên hoặc admin';
  END IF;
END$$

CREATE TRIGGER trg_tk_role_before_update
BEFORE UPDATE ON TAIKHOAN
FOR EACH ROW
BEGIN
  IF NOT (
    (NEW.VAITRO = 'sinhvien' AND NEW.MASV IS NOT NULL AND NEW.MAGV IS NULL)
    OR (NEW.VAITRO = 'giangvien' AND NEW.MAGV IS NOT NULL AND NEW.MASV IS NULL)
    OR (NEW.VAITRO = 'admin' AND NEW.MASV IS NULL AND NEW.MAGV IS NULL)
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tài khoản phải khớp vai trò sinh viên, giảng viên hoặc admin';
  END IF;
END$$

DELIMITER ;

-- ===============================================================
-- FUNCTION: điểm hệ 10 → điểm chữ
-- ===============================================================
DELIMITER $$

CREATE FUNCTION fn_diem_chu(diem10 DECIMAL(4,2))
RETURNS CHAR(2)
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE chu CHAR(2);
  IF diem10 IS NULL THEN
    RETURN NULL;
  END IF;
  SET chu = CASE
    WHEN diem10 >= 8.5 THEN 'A'
    WHEN diem10 >= 8.0 THEN 'B+'
    WHEN diem10 >= 7.0 THEN 'B'
    WHEN diem10 >= 6.5 THEN 'C+'
    WHEN diem10 >= 5.5 THEN 'C'
    WHEN diem10 >= 5.0 THEN 'D+'
    WHEN diem10 >= 4.0 THEN 'D'
    ELSE 'F'
  END;
  RETURN chu;
END$$

-- ===============================================================
-- PROCEDURE: đăng ký học phần — 6 kiểm tra nghiệp vụ, 1 transaction
-- ===============================================================

CREATE PROCEDURE sp_dangky_hocphan(IN p_masv VARCHAR(10), IN p_malhp VARCHAR(15), IN p_lanhoc VARCHAR(20))
BEGIN
  DECLARE v_mahp       VARCHAR(10);
  DECLARE v_mahk       VARCHAR(20);
  DECLARE v_sisomax    INT;
  DECLARE v_dadangky   INT;
  DECLARE v_tinchi_dky INT;
  DECLARE v_tinchi_hp  INT;
  DECLARE v_bd         DATETIME;
  DECLARE v_kt         DATETIME;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  -- (6) trong hạn đăng ký + lấy thông tin lớp (lock dòng LHP chống oversell)
  SELECT MAHP, MAHK, SISOMAX INTO v_mahp, v_mahk, v_sisomax
    FROM LOPHOCPHAN WHERE MALHP = p_malhp FOR UPDATE;
  IF v_mahp IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lớp học phần không tồn tại';
  END IF;

  SELECT HANDANGKY_BD, HANDANGKY_KT INTO v_bd, v_kt FROM HOCKY WHERE MAHK = v_mahk;
  IF NOW() < v_bd OR NOW() > v_kt THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ngoài thời gian đăng ký học phần';
  END IF;

  -- (5) không đăng ký lại HP đã đạt (cho phép học lại / cải thiện)
  IF EXISTS (
    SELECT 1 FROM DANGKYHOCPHAN dk
      JOIN LOPHOCPHAN l2 ON l2.MALHP = dk.MALHP
      WHERE dk.MASV = p_masv AND l2.MAHP = v_mahp
        AND dk.TRANGTHAI = 'đăng ký'
        AND dk.DIEMHE10 >= 4
  ) THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Học phần đã đạt, không đăng ký lại (dùng học lại/cải thiện)';
  END IF;

  -- (1) đã hoàn thành mọi học phần tiên quyết (điểm >= 4)
  IF EXISTS (
    SELECT 1 FROM HOCPHAN_TIENQUYET tq
    WHERE tq.MAHP = v_mahp
      AND NOT EXISTS (
        SELECT 1 FROM DANGKYHOCPHAN dk
          JOIN LOPHOCPHAN l2 ON l2.MALHP = dk.MALHP
          WHERE dk.MASV = p_masv AND l2.MAHP = tq.MAHP_TIENQUYET
            AND dk.TRANGTHAI = 'đăng ký' AND dk.DIEMHE10 >= 4
      )
  ) THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chưa hoàn thành học phần tiên quyết';
  END IF;

  -- (3) không trùng lịch trong cùng học kỳ
  IF EXISTS (
    SELECT 1
    FROM DANGKYHOCPHAN dk
    JOIN LOPHOCPHAN l1 ON l1.MALHP = dk.MALHP
    JOIN LOPHOCPHAN l2 ON l2.MALHP = p_malhp
    WHERE dk.MASV = p_masv
      AND dk.TRANGTHAI = 'đăng ký'
      AND l1.MAHK = v_mahk
      AND l1.THU IS NOT NULL AND l2.THU IS NOT NULL
      AND l1.THU = l2.THU
      AND l1.TIETBATDAU < l2.TIETBATDAU + l2.SOTIET
      AND l2.TIETBATDAU < l1.TIETBATDAU + l1.SOTIET
  ) THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Trùng lịch học với lớp học phần đã đăng ký';
  END IF;

  -- Lần học hợp lệ
  IF p_lanhoc NOT IN ('lần 1', 'học lại', 'cải thiện') THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lần học không hợp lệ';
  END IF;

  -- (4) giới hạn tối đa 25 tín chỉ; mức tối thiểu 12 do API cảnh báo sau khi đăng ký
  SELECT COALESCE(SUM(h.SOTINCHI), 0) INTO v_tinchi_dky
    FROM DANGKYHOCPHAN dk
    JOIN LOPHOCPHAN l ON l.MALHP = dk.MALHP
    JOIN HOCPHAN h ON h.MAHP = l.MAHP
    WHERE dk.MASV = p_masv AND dk.TRANGTHAI = 'đăng ký' AND l.MAHK = v_mahk;

  SELECT SOTINCHI INTO v_tinchi_hp FROM HOCPHAN WHERE MAHP = v_mahp;

  IF v_tinchi_dky + v_tinchi_hp > 25 THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Vượt giới hạn 25 tín chỉ một học kỳ';
  END IF;

  -- (2) còn chỗ
  SELECT COUNT(*) INTO v_dadangky FROM DANGKYHOCPHAN
    WHERE MALHP = p_malhp AND TRANGTHAI = 'đăng ký';
  IF v_dadangky >= v_sisomax THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lớp học phần đã đầy';
  END IF;

  INSERT INTO DANGKYHOCPHAN (MASV, MALHP, LANHOC) VALUES (p_masv, p_malhp, p_lanhoc);
  COMMIT;
END$$

-- ===============================================================
-- PROCEDURE: huỷ đăng ký (trong hạn, chưa có điểm)
-- ===============================================================
CREATE PROCEDURE sp_huy_dangky(IN p_masv VARCHAR(10), IN p_malhp VARCHAR(15))
BEGIN
  DECLARE v_mahk  VARCHAR(20);
  DECLARE v_bd    DATETIME;
  DECLARE v_kt    DATETIME;
  DECLARE v_diem  DECIMAL(4,2);

  SELECT l.MAHK, hk.HANDANGKY_BD, hk.HANDANGKY_KT, dk.DIEMHE10
    INTO v_mahk, v_bd, v_kt, v_diem
  FROM DANGKYHOCPHAN dk
  JOIN LOPHOCPHAN l ON l.MALHP = dk.MALHP
  JOIN HOCKY hk ON hk.MAHK = l.MAHK
  WHERE dk.MASV = p_masv AND dk.MALHP = p_malhp AND dk.TRANGTHAI = 'đăng ký';

  IF v_mahk IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Không tìm thấy đăng ký để huỷ';
  END IF;
  IF v_diem IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Đã có điểm, không thể huỷ đăng ký';
  END IF;
  IF NOW() < v_bd OR NOW() > v_kt THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ngoài thời gian được phép huỷ đăng ký';
  END IF;

  UPDATE DANGKYHOCPHAN SET TRANGTHAI = 'đã huỷ'
    WHERE MASV = p_masv AND MALHP = p_malhp AND TRANGTHAI = 'đăng ký';
END$$

-- ===============================================================
-- PROCEDURE: nhập điểm (đúng GV phụ trách, kỳ chưa khoá)
-- ===============================================================
CREATE PROCEDURE sp_nhap_diem(
  IN p_masv VARCHAR(10), IN p_malhp VARCHAR(15),
  IN p_cc DECIMAL(4,2), IN p_gk DECIMAL(4,2), IN p_ck DECIMAL(4,2)
)
BEGIN
  DECLARE v_mahk VARCHAR(20);
  DECLARE v_khoa TINYINT(1);

  SELECT l.MAHK, hk.KHOADIEM INTO v_mahk, v_khoa
    FROM LOPHOCPHAN l JOIN HOCKY hk ON hk.MAHK = l.MAHK
    WHERE l.MALHP = p_malhp;

  IF v_mahk IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lớp học phần không tồn tại';
  END IF;
  IF v_khoa = 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bảng điểm học kỳ đã khoá';
  END IF;
  IF p_cc NOT BETWEEN 0 AND 10 OR p_gk NOT BETWEEN 0 AND 10 OR p_ck NOT BETWEEN 0 AND 10 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Điểm phải trong khoảng 0–10';
  END IF;

  UPDATE DANGKYHOCPHAN
    SET DIEMCHUYENCAN = p_cc, DIEMGIUAKY = p_gk, DIEMCUOIKY = p_ck
    WHERE MASV = p_masv AND MALHP = p_malhp AND TRANGTHAI = 'đăng ký';

  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sinh viên chưa đăng ký lớp học phần này';
  END IF;
END$$

DELIMITER ;

-- ===============================================================
-- TRIGGER 1: BEFORE INSERT — kiểm sĩ số + tự tính DIEMHE10/CHU/HE4
-- (MySQL 1 trigger/timing/event nên gộp 2 nghiệp vụ)
-- ===============================================================
DELIMITER $$

CREATE TRIGGER trg_dangky_before_insert
BEFORE INSERT ON DANGKYHOCPHAN
FOR EACH ROW
BEGIN
  DECLARE v_sisomax INT;
  DECLARE v_dadangky INT;

  -- kiểm tra sĩ số (cơ chế số 2 trong mục 3.3)
  SELECT SISOMAX INTO v_sisomax FROM LOPHOCPHAN WHERE MALHP = NEW.MALHP;
  SELECT COUNT(*) INTO v_dadangky FROM DANGKYHOCPHAN
    WHERE MALHP = NEW.MALHP AND TRANGTHAI = 'đăng ký';
  IF v_dadangky >= v_sisomax THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lớp học phần đã đầy (trigger)';
  END IF;

  -- tự tính điểm nếu nhập 3 cột thành phần (cơ chế tự tính điểm chữ)
  IF NEW.DIEMCUOIKY IS NOT NULL THEN
    SET NEW.DIEMHE10 = ROUND(
      COALESCE(NEW.DIEMCHUYENCAN,0)*0.1 + COALESCE(NEW.DIEMGIUAKY,0)*0.3 + NEW.DIEMCUOIKY*0.6, 2);
    SET NEW.DIEMCHU  = fn_diem_chu(NEW.DIEMHE10);
    SET NEW.DIEMHE4  = CASE NEW.DIEMCHU
      WHEN 'A' THEN 4.00 WHEN 'B+' THEN 3.50 WHEN 'B' THEN 3.00
      WHEN 'C+' THEN 2.50 WHEN 'C' THEN 2.00 WHEN 'D+' THEN 1.50
      WHEN 'D' THEN 1.00 ELSE 0.00 END;
  END IF;
END$$

-- ===============================================================
-- TRIGGER 2: BEFORE UPDATE — chặn sửa khi kỳ khoá điểm + tự tính lại
-- ===============================================================
CREATE TRIGGER trg_dangky_before_update
BEFORE UPDATE ON DANGKYHOCPHAN
FOR EACH ROW
BEGIN
  DECLARE v_khoa TINYINT(1);
  SELECT hk.KHOADIEM INTO v_khoa
    FROM DANGKYHOCPHAN dk
    JOIN LOPHOCPHAN l ON l.MALHP = dk.MALHP
    JOIN HOCKY hk ON hk.MAHK = l.MAHK
    WHERE dk.MASV = NEW.MASV AND dk.MALHP = NEW.MALHP;

  IF v_khoa = 1 AND NOT (OLD.DIEMCHUYENCAN <=> NEW.DIEMCHUYENCAN
                     AND OLD.DIEMGIUAKY   <=> NEW.DIEMGIUAKY
                     AND OLD.DIEMCUOIKY   <=> NEW.DIEMCUOIKY) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bảng điểm học kỳ đã khoá, không thể sửa điểm';
  END IF;

  IF NEW.DIEMCUOIKY IS NOT NULL THEN
    SET NEW.DIEMHE10 = ROUND(
      COALESCE(NEW.DIEMCHUYENCAN,0)*0.10 + COALESCE(NEW.DIEMGIUAKY,0)*0.30 + NEW.DIEMCUOIKY*0.60, 2);
    SET NEW.DIEMCHU  = fn_diem_chu(NEW.DIEMHE10);
    SET NEW.DIEMHE4  = CASE NEW.DIEMCHU
      WHEN 'A' THEN 4.00 WHEN 'B+' THEN 3.50 WHEN 'B' THEN 3.00
      WHEN 'C+' THEN 2.50 WHEN 'C' THEN 2.00 WHEN 'D+' THEN 1.50
      WHEN 'D' THEN 1.00 ELSE 0.00 END;
  END IF;
END$$

DELIMITER ;

-- ===============================================================
-- VIEWS
-- ===============================================================
CREATE VIEW v_lophocphan_concho AS
SELECT l.MALHP, h.MAHP, h.TENHP, h.SOTINCHI, l.MAHK, l.MAGV,
       g.HOTEN AS TENGV, l.SISOMAX,
       (SELECT COUNT(*) FROM DANGKYHOCPHAN dk
         WHERE dk.MALHP = l.MALHP AND dk.TRANGTHAI = 'đăng ký') AS SISO_HIENTAI,
       (l.SISOMAX - (SELECT COUNT(*) FROM DANGKYHOCPHAN dk
         WHERE dk.MALHP = l.MALHP AND dk.TRANGTHAI = 'đăng ký')) AS CONCHO
FROM LOPHOCPHAN l
JOIN HOCPHAN h ON h.MAHP = l.MAHP
JOIN GIANGVIEN g ON g.MAGV = l.MAGV;

CREATE VIEW v_bangdiem_sinhvien AS
SELECT dk.MASV, sv.HOTEN AS HOTEN_SV, l.MALHP, h.MAHP, h.TENHP, h.SOTINCHI,
       l.MAHK, hk.NAMHOC, hk.HOCKYTHU,
       dk.DIEMCHUYENCAN, dk.DIEMGIUAKY, dk.DIEMCUOIKY,
       dk.DIEMHE10, dk.DIEMCHU, dk.DIEMHE4, dk.LANHOC, dk.TRANGTHAI
FROM DANGKYHOCPHAN dk
JOIN SINHVIEN sv ON sv.MASV = dk.MASV
JOIN LOPHOCPHAN l ON l.MALHP = dk.MALHP
JOIN HOCPHAN h ON h.MAHP = l.MAHP
JOIN HOCKY hk ON hk.MAHK = l.MAHK;
