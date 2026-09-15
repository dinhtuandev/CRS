-- =====================================================================
-- DEMO 1: LOST UPDATE — cập nhật mất → khắc phục bằng SELECT ... FOR UPDATE
-- NGAY TRÊN DB DỰ ÁN: 2 phòng đào tạo cùng giảm sĩ số LHP0102 từ 60 → 59
-- (tình huống thật: 2 cán bộ cùng xử lý 2 phiếu giảm sĩ số, mỗi phiếu -1)
--
-- QUAN TRỌNG: phép UPDATE phải ghi GIÁ TRỊ TUYỆT ĐỐI tính từ lần ĐỌC
-- (SET SISOMAX = 59, tức 60-1) — như ứng dụng thật đọc rồi ghi lại.
-- Nếu ghi tương đối (SET SISOMAX = SISOMAX - 1) thì KHÔNG bao giờ mất
-- cập nhật — bản thân đây cũng là bài học: cách ghi quyết định lỗi.
--
-- Mở 2 session:
--   docker compose exec db mysql -uroot -proot123 --default-character-set=utf8mb4 qlhocphan
-- Gõ theo BƯỚC (1..5) xen kẽ giữa SESSION A và SESSION B.
-- Tài liệu: docs/demo-concurrency.md
-- =====================================================================

-- #####################################################################
-- PHẦN A — GÂY LỖI: cả 2 session READ COMMITTED, đọc không khoá
-- #####################################################################

-- [CẢ HAI SESSION]
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- BƯỚC 1 — SESSION A: đọc sĩ số (không khoá) và tính phiếu của mình
START TRANSACTION;
SELECT SISOMAX AS 'A doc duoc' FROM LOPHOCPHAN WHERE MALHP = 'LHP0102';
-- --> 60  (A tính: 60 - 1 phiếu = 59)

-- BƯỚC 2 — SESSION B: cũng đọc sĩ số và tính phiếu của mình
START TRANSACTION;
SELECT SISOMAX AS 'B doc duoc' FROM LOPHOCPHAN WHERE MALHP = 'LHP0102';
-- --> 60  (B cũng tính: 60 - 1 phiếu = 59)

-- BƯỚC 3 — SESSION A: ghi KẾT QUẢ TÍNH TOÁN của mình (59 = 60 đọc được - 1)
UPDATE LOPHOCPHAN SET SISOMAX = 59 WHERE MALHP = 'LHP0102';
-- Query OK. Chưa commit → A đang giữ khoá hàng LHP0102.

-- BƯỚC 4 — SESSION B: ghi kết quả của mình (cũng 59, tính từ lần đọc cũ)
UPDATE LOPHOCPHAN SET SISOMAX = 59 WHERE MALHP = 'LHP0102';
-- ⏳ B ĐỢI — hàng đang bị A khoá. ĐỪNG đóng terminal, sang bước 5.

-- BƯỚC 5 — SESSION A: COMMIT
COMMIT;
-- Ngay lập tức SESSION B (đang đợi ở bước 4) chạy tiếp: Query OK —
-- B ghi 59 (giá trị nó tính từ số 60 ĐỌC CŨ, không biết A đã ghi 59).
COMMIT;   -- session B commit

-- KIỂM CHỨNG (session bất kỳ):
--   SELECT SISOMAX FROM LOPHOCPHAN WHERE MALHP='LHP0102';
-- --> 59  ❌ SAI! Hai phiếu giảm sĩ số nhưng chỉ mất đúng 1 (phải là 58) —
--         cập nhật của A bị B ghi đè = LOST UPDATE

-- #####################################################################
-- PHẦN B — KHẮC PHỤC: đọc có khoá SELECT ... FOR UPDATE
-- (đây chính là kỹ thuật sp_dangky_hocphan đang dùng để bảo vệ sĩ số)
-- #####################################################################

-- [CẢ HAI SESSION] Reset về 60:
UPDATE LOPHOCPHAN SET SISOMAX = 60 WHERE MALHP = 'LHP0102';
COMMIT;

-- BƯỚC 1 — SESSION A: đọc CÓ KHOÁ hàng
START TRANSACTION;
SELECT SISOMAX AS 'A doc co khoa' FROM LOPHOCPHAN WHERE MALHP = 'LHP0102' FOR UPDATE;
-- --> 60, đồng thời A giữ khoá độc quyền trên hàng LHP0102

-- BƯỚC 2 — SESSION B: cũng FOR UPDATE
START TRANSACTION;
SELECT SISOMAX FROM LOPHOCPHAN WHERE MALHP = 'LHP0102' FOR UPDATE;
-- ⏳ B TREO ĐỨNG — phải đợi khoá của A. Điểm nói với thầy:
--    "B không đọc được số cũ nữa — nó phải ĐỢI"

-- BƯỚC 3 — SESSION A: ghi 59 (= 60 - 1) + commit (khoá nhả ra khi commit)
UPDATE LOPHOCPHAN SET SISOMAX = 59 WHERE MALHP = 'LHP0102';
COMMIT;
-- B (đang treo ở bước 2) trả kết quả ngay: --> 59 (con số MỚI của A)

-- BƯỚC 4 — SESSION B: tính tiếp từ con số MỚI: 59 - 1 = 58
UPDATE LOPHOCPHAN SET SISOMAX = 58 WHERE MALHP = 'LHP0102';
COMMIT;

-- KIỂM CHỨNG:
--   SELECT SISOMAX FROM LOPHOCPHAN WHERE MALHP='LHP0102';
-- --> 58  ✅ đúng! 60 - 2 phiếu = 58, không mất cập nhật nào

-- #####################################################################
-- RESET sau demo: chạy lại db/demo/demo.sql hoặc:
--   UPDATE LOPHOCPHAN SET SISOMAX = 60 WHERE MALHP='LHP0102';
-- =====================================================================
