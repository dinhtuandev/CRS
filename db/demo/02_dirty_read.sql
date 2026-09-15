-- =====================================================================
-- DEMO 2: DIRTY READ (đọc bẩn) → khắc phục bằng READ COMMITTED
-- Gõ theo BƯỚC xen kẽ giữa SESSION A và SESSION B.
-- Tài liệu: docs/demo-concurrency.md
-- =====================================================================

-- #####################################################################
-- PHẦN A: GÂY LỖI (READ UNCOMMITTED — đọc được dữ liệu CHƯA commit)
-- Tình huống: phòng đào tạo cộng điểm +30 nhưng chưa chốt; giảng viên
-- đọc thấy số "bẩn" và ra quyết định dựa trên dữ liệu chưa tồn tại.
-- #####################################################################

-- (A1) SESSION B — hạ mức cô lập thấp nhất để đọc bẩn
SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
START TRANSACTION;
SELECT value FROM counter WHERE id = 1;   -- 100 (giá trị sạch ban đầu)

-- (A2) SESSION A — sửa nhưng CHƯA commit
START TRANSACTION;
UPDATE counter SET value = value + 30 WHERE id = 1;
-- ... không gõ COMMIT ở đây!

-- (A3) SESSION B — đọc lại
SELECT value FROM counter WHERE id = 1;   -- Kết quả: 130 ❌ (chưa commit mà đã thấy!)
-- => B cho rằng SV có thêm 30 điểm -> quyết định sai trên dữ liệu "ảo"

-- (A4) SESSION A — thu hồi thao tác
ROLLBACK;

-- (A5) SESSION B — đọc lại lần nữa
SELECT value FROM counter WHERE id = 1;   -- 100 — con số 130 vừa rồi không từng tồn tại
COMMIT;

-- Reset: UPDATE counter SET value = 100 WHERE id = 1;

-- #####################################################################
-- PHẦN B: KHẮC PHỤC — READ COMMITTED (chỉ đọc dữ liệu đã commit)
-- #####################################################################

-- (B1) SESSION B
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;
SELECT value FROM counter WHERE id = 1;   -- 100

-- (B2) SESSION A
START TRANSACTION;
UPDATE counter SET value = value + 30 WHERE id = 1;

-- (B3) SESSION B — đọc lại: vẫn 100, KHÔNG thấy dữ liệu chưa commit
SELECT value FROM counter WHERE id = 1;   -- 100 ✅ (đang bị chặn thấy bản ghi cũ qua MVCC)

-- (B4) SESSION A
COMMIT;

-- (B5) SESSION B — giờ mới thấy giá trị mới
SELECT value FROM counter WHERE id = 1;   -- 130 ✅ (đã commit, đọc được là hợp lệ)
COMMIT;

-- Reset: UPDATE counter SET value = 100 WHERE id = 1;
-- Ghi chú: InnoDB mặc định là REPEATABLE READ (cao hơn READ COMMITTED),
-- nên dirty read KHÔNG THỂ xảy ra trừ khi chủ động hạ xuống READ UNCOMMITTED.
