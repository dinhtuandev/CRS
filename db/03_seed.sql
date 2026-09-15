-- =====================================================================
-- Dữ liệu mẫu — chạy SAU 01_schema.sql
-- Ngày lấy theo NOW()/CURDATE() nên học kỳ "hiện tại" luôn mở đăng ký.
-- Mật khẩu tất cả tài khoản: 123456 (bcrypt hash đã verify bằng bcryptjs.compareSync)
-- =====================================================================
USE qlhocphan;

-- ---------- KHOA ----------
INSERT INTO KHOA (MAKHOA, TENKHOA) VALUES
('CNTT', 'Khoa Công nghệ thông tin'),
('DTVT', 'Khoa Điện tử - Viễn thông');

-- ---------- GIANGVIEN ----------
INSERT INTO GIANGVIEN (MAGV, HOTEN, NGAYSINH, GIOITINH, HOCVI, MAKHOA, EMAIL) VALUES
('GV01', 'Nguyễn Văn An',    '1980-05-12', 1, 'Tiến sĩ',  'CNTT', 'nvan@example.edu'),
('GV02', 'Trần Thị Bích',    '1985-09-03', 0, 'Thạc sĩ',  'CNTT', 'ttbich@example.edu'),
('GV03', 'Lê Văn Cường',     '1982-01-25', 1, 'Tiến sĩ',  'CNTT', 'lvcuong@example.edu'),
('GV04', 'Phạm Thị Dung',    '1988-11-30', 0, 'Thạc sĩ',  'DTVT', 'ptdung@example.edu');

-- ---------- SINHVIEN ----------
INSERT INTO SINHVIEN (MASV, HOTEN, NGAYSINH, GIOITINH, MAKHOA, NGAYNHAPHOC, TRANGTHAI) VALUES
('SV001', 'Nguyễn Văn Minh',  '2004-03-15', 1, 'CNTT', '2023-08-15', 'đang học'),
('SV002', 'Trần Thị Lan',     '2004-07-22', 0, 'CNTT', '2023-08-15', 'đang học'),
('SV003', 'Lê Hoàng Nam',     '2003-12-01', 1, 'CNTT', '2022-08-15', 'đang học'),
('SV004', 'Phạm Văn Đức',     '2004-09-10', 1, 'CNTT', '2023-08-15', 'đang học'),
('SV005', 'Vũ Thị Hoa',       '2005-02-18', 0, 'CNTT', '2024-08-15', 'đang học'),
('SV006', 'Đặng Quốc Bảo',    '2004-05-05', 1, 'CNTT', '2023-08-15', 'đang học');

-- ---------- HOCPHAN ----------
INSERT INTO HOCPHAN (MAHP, TENHP, SOTINCHI, SOTIETLT, SOTIETTH, LOAIHP, MAKHOA) VALUES
('IT1010', 'Nhập môn lập trình',        3, 30, 30, 'bắt buộc', 'CNTT'),
('IT1020', 'Kỹ thuật lập trình',        3, 30, 30, 'bắt buộc', 'CNTT'),
('IT2030', 'Cấu trúc dữ liệu và giải thuật', 4, 40, 30, 'bắt buộc', 'CNTT'),
('IT2100', 'Toán rời rạc',              3, 45,  0, 'bắt buộc', 'CNTT'),
('IT3050', 'Cơ sở dữ liệu',             3, 30, 30, 'bắt buộc', 'CNTT'),
('IT3060', 'Hệ quản trị CSDL',          3, 30, 30, 'bắt buộc', 'CNTT'),
('IT3070', 'Hệ phân tán',               3, 30, 30, 'tự chọn',  'CNTT'),
('EL2010', 'Tiếng Anh công nghệ',       2, 30,  0, 'tự chọn',  'CNTT');

-- ---------- HOCPHAN_TIENQUYET ----------
INSERT INTO HOCPHAN_TIENQUYET (MAHP, MAHP_TIENQUYET) VALUES
('IT1020', 'IT1010'),
('IT2030', 'IT1020'),
('IT3050', 'IT2030'),
('IT3060', 'IT3050'),
('IT3070', 'IT3060');

-- ---------- HOCKY ----------
-- Kỳ cũ: đã kết thúc + ĐÃ KHOÁ ĐIỂM (KHOADIEM=1) để demo trigger khoá điểm
INSERT INTO HOCKY (MAHK, NAMHOC, HOCKYTHU, NGAYBATDAU, NGAYKETTHUC, HANDANGKY_BD, HANDANGKY_KT, KHOADIEM) VALUES
('2024-2025-HK2', '2024-2025', 2,
 DATE_SUB(CURDATE(), INTERVAL 6 MONTH), DATE_SUB(CURDATE(), INTERVAL 3 MONTH),
 DATE_SUB(CURDATE(), INTERVAL 6 MONTH), DATE_SUB(CURDATE(), INTERVAL 6 MONTH) + INTERVAL 14 DAY, 1);

-- Kỳ hiện tại: đang mở cửa sổ đăng ký (luôn mở vì tính theo NOW())
INSERT INTO HOCKY (MAHK, NAMHOC, HOCKYTHU, NGAYBATDAU, NGAYKETTHUC, HANDANGKY_BD, HANDANGKY_KT, KHOADIEM) VALUES
('2025-2026-HK1', '2025-2026', 1,
 DATE_SUB(CURDATE(), INTERVAL 7 DAY), DATE_ADD(CURDATE(), INTERVAL 90 DAY),
 NOW() - INTERVAL 3 DAY, NOW() + INTERVAL 14 DAY, 0);

-- ---------- LOPHOCPHAN (kỳ cũ — có điểm, đã khoá) ----------
-- Tạm insert TRANGTHAI='mở' vì trigger trg_dangky_before_insert chặn đăng ký
-- vào lớp 'đóng'; sẽ UPDATE về 'đóng' sau khi seed xong phần đăng ký cũ.
INSERT INTO LOPHOCPHAN (MALHP, MAHP, MAHK, MAGV, SISOMAX, PHONGHOC, THU, TIETBATDAU, SOTIET, TRANGTHAI) VALUES
('LHP9001', 'IT1010', '2024-2025-HK2', 'GV01', 60, 'D3-201', 2, 1, 3, 'mở'),
('LHP9002', 'IT1020', '2024-2025-HK2', 'GV02', 60, 'D3-202', 3, 1, 3, 'mở'),
('LHP9003', 'IT2100', '2024-2025-HK2', 'GV03', 60, 'D4-101', 4, 1, 3, 'mở');

-- ---------- LOPHOCPHAN (kỳ hiện tại) ----------
-- LHP0101: sĩ số tối đa 2 (để demo lỗi "lớp đã đầy")
-- LHP0301 trùng lịch LHP0101 (thứ 2, tiết 1) — demo lỗi trùng lịch
INSERT INTO LOPHOCPHAN (MALHP, MAHP, MAHK, MAGV, SISOMAX, PHONGHOC, THU, TIETBATDAU, SOTIET, TRANGTHAI) VALUES
('LHP0101', 'IT1010', '2025-2026-HK1', 'GV01',  2, 'D3-201', 2, 1, 3, 'mở'),
('LHP0102', 'IT1010', '2025-2026-HK1', 'GV02', 60, 'D3-202', 3, 1, 3, 'mở'),
('LHP0201', 'IT1020', '2025-2026-HK1', 'GV01', 50, 'D3-203', 2, 4, 3, 'mở'),
('LHP0301', 'IT2030', '2025-2026-HK1', 'GV03', 50, 'D4-101', 2, 1, 4, 'mở'),
('LHP0401', 'IT3050', '2025-2026-HK1', 'GV02', 50, 'D4-102', 4, 1, 3, 'mở'),
('LHP0701', 'IT3070', '2025-2026-HK1', 'GV03', 40, 'D5-201', 5, 2, 3, 'mở'),
('LHP0801', 'EL2010', '2025-2026-HK1', 'GV04', 50, 'D1-301', 6, 1, 2, 'mở');

-- ---------- DANGKYHOCPHAN (kỳ cũ, đã có điểm — trigger tự tính DIEMHE10/CHU/HE4) ----------
INSERT INTO DANGKYHOCPHAN (MASV, MALHP, LANHOC, DIEMCHUYENCAN, DIEMGIUAKY, DIEMCUOIKY, TRANGTHAI) VALUES
('SV001', 'LHP9001', 'lần 1', 8.0, 7.0, 8.0, 'đăng ký'),
('SV001', 'LHP9002', 'lần 1', 9.0, 8.5, 9.0, 'đăng ký'),
('SV001', 'LHP9003', 'lần 1', 5.0, 5.0, 6.0, 'đăng ký'),
('SV002', 'LHP9001', 'lần 1', 6.0, 6.5, 7.0, 'đăng ký'),
('SV002', 'LHP9002', 'lần 1', 6.5, 7.0, 7.5, 'đăng ký'),
('SV003', 'LHP9001', 'lần 1', 9.0, 9.0, 9.0, 'đăng ký'),
('SV003', 'LHP9002', 'lần 1', 8.5, 8.0, 8.0, 'đăng ký'),
('SV004', 'LHP9001', 'lần 1', 3.0, 3.5, 4.0, 'đăng ký'),   -- trượt IT1010 → demo lỗi tiên quyết
('SV006', 'LHP9001', 'lần 1', 4.0, 4.0, 4.0, 'đăng ký'),   -- đạt D, học lại được
('SV006', 'LHP9002', 'lần 1', 2.0, 3.0, 3.5, 'đăng ký');   -- trượt IT1020

-- Đóng lại các lớp học kỳ cũ sau khi seed xong đăng ký cũ
UPDATE LOPHOCPHAN SET TRANGTHAI = 'đóng' WHERE MALHP IN ('LHP9001', 'LHP9002', 'LHP9003');

-- ---------- DANGKYHOCPHAN (kỳ hiện tại, chưa có điểm) ----------
INSERT INTO DANGKYHOCPHAN (MASV, MALHP, LANHOC, TRANGTHAI) VALUES
('SV001', 'LHP0301', 'lần 1',    'đăng ký'),
('SV001', 'LHP0801', 'lần 1',    'đăng ký'),
('SV002', 'LHP0201', 'học lại',  'đăng ký'),
('SV002', 'LHP0801', 'lần 1',    'đăng ký'),
('SV003', 'LHP0301', 'lần 1',    'đăng ký'),
('SV003', 'LHP0801', 'lần 1',    'đăng ký'),
('SV005', 'LHP0101', 'lần 1',    'đăng ký'),   -- LHP0101 còn đúng 1 chỗ
('SV006', 'LHP0101', 'học lại',  'đăng ký');   -- LHP0101 giờ ĐẦY (2/2)

-- ---------- TAIKHOAN (mật khẩu tất cả: 123456) ----------
INSERT INTO TAIKHOAN (TENDANGNHAP, MATKHAU_HASH, VAITRO, MASV, MAGV) VALUES
('admin',  '$2b$10$BMLCRQT40UYzFmhI5qNuKeK4OHs8p.610xyojuAGdMevyc5afX6GG', 'admin',     NULL,   NULL),
('sv001',  '$2b$10$BMLCRQT40UYzFmhI5qNuKeK4OHs8p.610xyojuAGdMevyc5afX6GG', 'sinhvien',  'SV001', NULL),
('sv002',  '$2b$10$BMLCRQT40UYzFmhI5qNuKeK4OHs8p.610xyojuAGdMevyc5afX6GG', 'sinhvien',  'SV002', NULL),
('sv003',  '$2b$10$BMLCRQT40UYzFmhI5qNuKeK4OHs8p.610xyojuAGdMevyc5afX6GG', 'sinhvien',  'SV003', NULL),
('sv004',  '$2b$10$BMLCRQT40UYzFmhI5qNuKeK4OHs8p.610xyojuAGdMevyc5afX6GG', 'sinhvien',  'SV004', NULL),
('sv005',  '$2b$10$BMLCRQT40UYzFmhI5qNuKeK4OHs8p.610xyojuAGdMevyc5afX6GG', 'sinhvien',  'SV005', NULL),
('sv006',  '$2b$10$BMLCRQT40UYzFmhI5qNuKeK4OHs8p.610xyojuAGdMevyc5afX6GG', 'sinhvien',  'SV006', NULL),
('gv01',   '$2b$10$BMLCRQT40UYzFmhI5qNuKeK4OHs8p.610xyojuAGdMevyc5afX6GG', 'giangvien', NULL,   'GV01'),
('gv02',   '$2b$10$BMLCRQT40UYzFmhI5qNuKeK4OHs8p.610xyojuAGdMevyc5afX6GG', 'giangvien', NULL,   'GV02'),
('gv03',   '$2b$10$BMLCRQT40UYzFmhI5qNuKeK4OHs8p.610xyojuAGdMevyc5afX6GG', 'giangvien', NULL,   'GV03'),
('gv04',   '$2b$10$BMLCRQT40UYzFmhI5qNuKeK4OHs8p.610xyojuAGdMevyc5afX6GG', 'giangvien', NULL,   'GV04');
