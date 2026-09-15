-- =====================================================================
-- DEMO 2: DIRTY READ — đọc dữ liệu chưa commit
-- NGAY TRÊN DB DỰ ÁN: A đổi phòng học LHP0101 sang D3-205 rồi ROLLBACK —
-- B (READ UNCOMMITTED) đã "thấy" phòng D3-205 chưa từng tồn tại.
--
-- LƯU Ý: MySQL mặc định REPEATABLE READ — dirty read KHÔNG xảy ra.
-- Phải chủ động SET isolation ở Session B (đây chính là nội dung dạy).
--
-- Tài liệu: docs/demo-concurrency.md
-- =====================================================================

-- [SESSION B] Đặt mức cô lập yếu nhất:
SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
START TRANSACTION;

-- BƯỚC 0 — SESSION B: xem phòng học gốc
SELECT MALHP, PHONGHOC FROM LOPHOCPHAN WHERE MALHP = 'LHP0101';
-- --> D3-201

-- [SESSION A] Bắt đầu transaction, đổi phòng học NHƯNG CHỨA COMMIT:
START TRANSACTION;
UPDATE LOPHOCPHAN SET PHONGHOC = 'D3-205' WHERE MALHP = 'LHP0101';

-- BƯỚC 1 — SESSION B: đọc phòng học
SELECT MALHP, PHONGHOC FROM LOPHOCPHAN WHERE MALHP = 'LHP0101';
-- --> D3-205  ❌ B thấy dữ liệu A CHƯA COMMIT = DIRTY READ
-- (B xuất thông báo "lớp chuyển sang D3-205" cho sinh viên — sai sự thật!)

-- BƯỚC 2 — SESSION A: HỦY thao tác
ROLLBACK;
-- A chỉ là gõ nhầm / phát hiện lớp phải giữ nguyên phòng.

-- BƯỚC 3 — SESSION B: đọc lại
SELECT MALHP, PHONGHOC FROM LOPHOCPHAN WHERE MALHP = 'LHP0101';
-- --> D3-201  — con số D3-205 mà B đã dùng KHÔNG TỒN TẠI trong DB.
-- COMMIT phiên B:
COMMIT;

-- KẾT LUẬN: dirty read = quyết định dựa trên dữ liệu "ảo".
-- MySQL mặc định REPEATABLE READ nên không bao giờ xảy ra với dự án này;
-- demo này chứng minh VÌ SAO không ai được bật READ UNCOMMITTED.

-- ---------------------------------------------------------------------
-- KHẮC PHỤC — READ COMMITTED trở lên không bao giờ thấy dữ liệu chưa commit
-- ---------------------------------------------------------------------
-- [SESSION B]
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;

-- [SESSION A]
START TRANSACTION;
UPDATE LOPHOCPHAN SET PHONGHOC = 'D3-205' WHERE MALHP = 'LHP0101';

-- [SESSION B]
SELECT MALHP, PHONGHOC FROM LOPHOCPHAN WHERE MALHP = 'LHP0101';
-- --> D3-201  ✅ vẫn dữ liệu đã commit

-- [SESSION A]
ROLLBACK;

-- [SESSION B]
SELECT MALHP, PHONGHOC FROM LOPHOCPHAN WHERE MALHP = 'LHP0101';
-- --> D3-201  ✅ nhất quán
COMMIT;

-- RESET: phòng học không bao giờ đổi — không cần reset gì thêm.
-- =====================================================================
