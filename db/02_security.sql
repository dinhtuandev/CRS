-- =====================================================================
-- Bảo mật: role + GRANT/REVOKE (chương Bảo mật trong giáo trình)
-- Chạy SAU 01_schema.sql. File này không xoá gì, chạy lại an toàn.
-- Lưu ý MySQL định danh user dạng 'user'@'host'.
-- =====================================================================
USE qlhocphan;

CREATE ROLE IF NOT EXISTS 'admin_role', 'giangvien_role', 'sinhvien_role';

-- ---- admin: toàn quyền trên schema ----
GRANT ALL PRIVILEGES ON qlhocphan.* TO 'admin_role';

-- ---- giảng viên: SELECT toàn bộ + UPDATE đúng 3 cột điểm + EXECUTE sp_nhap_diem ----
GRANT SELECT ON qlhocphan.* TO 'giangvien_role';
GRANT UPDATE (DIEMCHUYENCAN, DIEMGIUAKY, DIEMCUOIKY) ON qlhocphan.DANGKYHOCPHAN TO 'giangvien_role';
GRANT EXECUTE ON PROCEDURE qlhocphan.sp_nhap_diem TO 'giangvien_role';

-- ---- sinh viên: SELECT qua 2 view + EXECUTE proc đăng ký/huỷ ----
GRANT SELECT ON qlhocphan.v_lophocphan_concho   TO 'sinhvien_role';
GRANT SELECT ON qlhocphan.v_bangdiem_sinhvien   TO 'sinhvien_role';
GRANT EXECUTE ON PROCEDURE qlhocphan.sp_dangky_hocphan TO 'sinhvien_role';
GRANT EXECUTE ON PROCEDURE qlhocphan.sp_huy_dangky     TO 'sinhvien_role';

-- ---- user demo gắn role (để test GRANT trực tiếp bằng mysql client) ----
CREATE USER IF NOT EXISTS 'admin_demo'@'%' IDENTIFIED BY 'admin123';
CREATE USER IF NOT EXISTS 'gv_demo'@'%'    IDENTIFIED BY 'gv123';
CREATE USER IF NOT EXISTS 'sv_demo'@'%'    IDENTIFIED BY 'sv123';
GRANT 'admin_role'    TO 'admin_demo'@'%';
GRANT 'giangvien_role' TO 'gv_demo'@'%';
GRANT 'sinhvien_role'  TO 'sv_demo'@'%';
SET DEFAULT ROLE ALL TO 'admin_demo'@'%', 'gv_demo'@'%', 'sv_demo'@'%';

-- ---- user cho ứng dụng (server Node dùng user này, quyền vừa đủ) ----
CREATE USER IF NOT EXISTS 'app_qlhp'@'%' IDENTIFIED BY 'app_qlhp_pass';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON qlhocphan.* TO 'app_qlhp'@'%';
FLUSH PRIVILEGES;

-- Ví dụ thu hồi (minh hoạ REVOKE — mặc định không chạy):
-- REVOKE UPDATE (DIEMGIUAKY) ON qlhocphan.DANGKYHOCPHAN FROM 'giangvien_role';
