-- =====================================================================
-- DEMO 5: DEADLOCK (khoá vòng) → khắc phục bằng THỨ TỰ KHOÁ + RETRY
-- Gõ theo BƯỚC xen kẽ giữa SESSION A và SESSION B — thực hiện NHANH
-- ở bước 3-4 để hai transaction kịp giữ khoá chéo nhau.
-- Tài liệu: docs/demo-concurrency.md
-- =====================================================================

-- #####################################################################
-- PHẦN A: GÂY LỖI (hai transaction khoá 2 hàng theo thứ tự NGƯỢC nhau)
-- #####################################################################

-- (A1) SESSION A
START TRANSACTION;
UPDATE counter SET value = value + 10 WHERE id = 1;   -- A giữ X-lock hàng 1

-- (A2) SESSION B
START TRANSACTION;
UPDATE counter SET value = value + 10 WHERE id = 2;   -- B giữ X-lock hàng 2

-- (A3) SESSION A — muốn hàng 2 mà B đang giữ (chưa gõ, để B gõ A4 trước)
UPDATE counter SET value = value + 10 WHERE id = 2;   -- A BLOCK (chờ B)

-- (A4) SESSION B — muốn hàng 1 mà A đang giữ => VÒNG CHỜ!
UPDATE counter SET value = value + 10 WHERE id = 1;
-- => InnoDB lập tức chọn một NẠN NHÂN (thường là B) và rollback:
--    ERROR 1213 (40001): Deadlock found when trying to get lock;
--    try restarting transaction
-- Session còn lại (A) vẫn giữ khoá và chạy bình thường.

-- (A5) SESSION A — kết thúc transaction đang treo
COMMIT;

-- Xem thông tin deadlock gần nhất (chạy trong session bất kỳ):
--   SHOW ENGINE INNODB STATUS\G   (mục LATEST DETECTED DEADLOCK)

-- Reset: UPDATE counter SET value = 100 WHERE id IN (1, 2);

-- #####################################################################
-- PHẦN B: KHẮC PHỤC 1 — CẢ HAI transaction khoá theo CÙNG THỨ TỰ
-- (luôn hàng 1 trước, hàng 2 sau) => không thể tạo chu trình.
-- #####################################################################

-- (B1) SESSION A
START TRANSACTION;
UPDATE counter SET value = value + 10 WHERE id = 1;   -- A giữ hàng 1

-- (B2) SESSION B — cũng khoá hàng 1 TRƯỚC (chứ không phải hàng 2)
START TRANSACTION;
UPDATE counter SET value = value + 10 WHERE id = 1;   -- B BLOCK chờ A (chỉ chờ 1 chiều)

-- (B3) SESSION A
UPDATE counter SET value = value + 10 WHERE id = 2;   -- A lấy hàng 2 KHÔNG bị chặn
COMMIT;                                               -- A nhả cả 2 khoá

-- (B4) SESSION B — B2 chạy xong; tiếp tục theo đúng thứ tự
UPDATE counter SET value = value + 10 WHERE id = 2;
COMMIT;
-- Không bao giờ deadlock vì thứ tự khoá toàn cục 1 -> 2 là như nhau ✅

-- Reset: UPDATE counter SET value = 100 WHERE id IN (1, 2);

-- #####################################################################
-- PHẦN C: KHẮC PHỤC 2 — RETRY khi trúng deadlock (1213)
-- InnoDB đã rollback NẠN NHÂN một cách đầy đủ (atomic) nên việc
-- CHẠY LẠI TOÀN BỘ transaction là an toàn.
-- Mô phỏng bằng SQL: thủ tục sp_demo_deadlock_retry thử tối đa 3 lần.
-- #####################################################################

-- (C1) SESSION A — tạo thủ tục retry (gõ 1 lần)
DELIMITER $$
CREATE PROCEDURE sp_demo_deadlock_retry()
BEGIN
  DECLARE attempts INT DEFAULT 0;
  retry_loop: LOOP
    SET attempts = attempts + 1;
    BEGIN
      DECLARE EXIT HANDLER FOR 1213
      BEGIN
        IF attempts >= 3 THEN
          RESIGNAL;                       -- hết lượt: trả lỗi ra ngoài
        END IF;
        -- trúng deadlock: handler tự ROLLBACK, rơi xuống để thử lại
      END;
      START TRANSACTION;
      UPDATE counter SET value = value + 10 WHERE id = 2;   -- (đổi thứ tự 2->1 để cố tình trúng)
      UPDATE counter SET value = value + 10 WHERE id = 1;
      COMMIT;
      LEAVE retry_loop;                   -- thành công: thoát vòng
    END;
  END LOOP;
END$$
DELIMITER ;

-- (C2) SESSION A — thử gọi khi hệ thống rảnh
CALL sp_demo_deadlock_retry();
SELECT value FROM counter WHERE id IN (1, 2);   -- +10 cả hai hàng ✅

-- (C3) Nuôi deadlock thật để thấy retry có tác dụng: mở SESSION B chạy:
--   START TRANSACTION;
--   UPDATE counter SET value = value + 10 WHERE id = 1;
--   -- giữ nguyên, chưa commit...
-- rồi ở SESSION A gọi CALL sp_demo_deadlock_retry(); trong lúc B vẫn giữ
-- hàng 1 -> nếu InnoDB chọn A làm nạn nhân, thủ tục tự thử lại tới khi OK.
-- (Cuối cùng nhớ COMMIT/ROLLBACK ở SESSION B.)
--
-- Reset: UPDATE counter SET value = 100 WHERE id IN (1, 2);
-- Dọn:   DROP PROCEDURE sp_demo_deadlock_retry;
--
-- Trong đề tài này: server/routes/sinhvien.js retry 3 lần (kèm backoff)
-- khi gọi sp_dangky_hocphan trúng errno 1213 — đúng kỹ thuật này.
