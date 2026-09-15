# Demo các lỗi điều khiển tương tranh — NGAY TRÊN DB DỰ ÁN `qlhocphan`

Tài liệu hướng dẫn thuyết trình: **mọi demo thao tác trên chính schema của dự án** (`LOPHOCPHAN`, `DANGKYHOCPHAN`, trigger + procedure của dự án) — không dùng database mô phỏng riêng. Mỗi lỗi gồm **kịch bản gây lỗi** (2 cửa sổ terminal MySQL) → **quan sát kết quả sai** → **phương án khắc phục**.

> Bộ số liệu demo: `LHP0101` (IT1010, sĩ số **2**, phòng D3-201, đang có SV005+SV006 — *lớp đầy*) và `LHP0102` (IT1010, sĩ số **60**, phòng D3-202, *trống*). Toàn bộ thay đổi chỉ đụng `SISOMAX`/`PHONGHOC` 2 lớp này + lớp mẫu `LHPTEST*` — kết thúc buổi demo chạy lại `db/demo/demo.sql` là DB về chuẩn.

## Chuẩn bị

```bash
docker compose up -d --wait        # db (MySQL 8.0) healthy
docker compose exec -T db mysql -uroot -proot123 --default-character-set=utf8mb4 < db/demo/demo.sql
```

Mở **2 terminal** (SESSION A và SESSION B):

```bash
docker compose exec db mysql -uroot -proot123 --default-character-set=utf8mb4 qlhocphan
```

Kiểm tra dữ liệu gốc trước khi bắt đầu (chạy session nào cũng được):

```sql
SELECT MALHP, SISOMAX, PHONGHOC, TRANGTHAI FROM LOPHOCPHAN WHERE MALHP IN ('LHP0101','LHP0102');
-- LHP0101 | 2  | D3-201 | mở     (đầy: SV005 + SV006)
-- LHP0102 | 60 | D3-202 | mở     (chưa ai đăng ký)
```

**Sau buổi demo, reset:** chạy lại `demo.sql` hoặc `scripts/verify-demos.mjs` (tự reset).

---

## Demo 1 — LOST UPDATE → khắc phục bằng `FOR UPDATE` (`01_lost_update.sql`)

**Tình huống:** 2 cán bộ phòng đào tạo cùng xử lý 2 phiếu giảm sĩ số LHP0102 (mỗi phiếu −1).

| Bước | SESSION A | SESSION B |
|---|---|---|
| 1 | `START TRANSACTION;` đọc `SISOMAX` → **60** | |
| 2 | | `START TRANSACTION;` đọc `SISOMAX` → **60** |
| 3 | `UPDATE ... SET SISOMAX = 59` (tính từ 60 cũ) | |
| 4 | | `UPDATE ... SET SISOMAX = 59` → ⏳ *đợi khoá của A* |
| 5 | `COMMIT;` | *(được chạy tiếp, ghi 59)* `COMMIT;` |

Kết quả sai: `SELECT SISOMAX ...` → **59** ❌ (2 phiếu nhưng chỉ mất 1 — cập nhật của A bị B ghi đè).
⚠️ Lỗi chỉ xảy ra vì ứng dụng ghi **giá trị tuyệt đối** tính từ lần đọc (`SET SISOMAX = 59`); ghi tương đối (`SISOMAX - 1`) thì không bao giờ mất — bản thân điều này là một bài học.

**Khắc phục (Phần B):** cả 2 đọc `... FOR UPDATE` — B bị chặn đến khi A commit, đọc được số **mới** 59, tính 58. Kết quả: **58** ✅.

## Demo 2 — DIRTY READ (`02_dirty_read.sql`)

**Tình huống:** A gõ nhầm, đổi phòng LHP0101 sang D3-205 rồi rollback; B (đã bật `READ UNCOMMITTED`) đã báo "lớp chuyển phòng" theo dữ liệu ảo.

| Bước | SESSION A | SESSION B |
|---|---|---|
| 0 | | `SET SESSION ... READ UNCOMMITTED; START TRANSACTION;` đọc phòng → **D3-201** |
| 1 | `START TRANSACTION; UPDATE ... SET PHONGHOC='D3-205';` *(chưa commit)* | đọc lại → **D3-205** ❌ *dirty read* |
| 2 | `ROLLBACK;` | |
| 3 | | đọc lại → **D3-201** — D3-205 *chưa từng tồn tại* |

**Khắc phục:** `READ COMMITTED` — B không bao giờ thấy dữ liệu chưa commit. (MySQL mặc định REPEATABLE READ nên dự án này sạch dirty read sẵn; demo chứng minh *vì sao* không ai được bật READ UNCOMMITTED.)

## Demo 3 — NON-REPEATABLE READ (`03_nonrepeatable_read.sql`)

**Tình huống:** B tính học phí theo sĩ số LHP0102, đọc 2 lần trong 1 phiếu; giữa 2 lần A cập nhật sĩ số + commit.

| Bước | SESSION B (READ COMMITTED) | SESSION A |
|---|---|---|
| 1 | `START TRANSACTION;` đọc → **60** | |
| 2 | | `UPDATE ... SET SISOMAX = 55; COMMIT;` |
| 3 | đọc lại (cùng transaction) → **55** ❌ *đổi giá trị giữa phiếu* | |

**Khắc phục (Phần B):** `REPEATABLE READ` (mặc định MySQL) — snapshot: lần 2 vẫn **55**, sau `COMMIT` mới thấy 50. Dự án đang chạy mức này sẵn.

## Demo 4 — PHANTOM (`04_phantom.sql`)

**Tình huống:** thống kê "các lớp HK1 có sĩ số > 45" (**5 lớp**); giữa chừng A mở lớp mới `LHPTEST` (sĩ số 50).

| Bước | SESSION B (REPEATABLE READ) | SESSION A |
|---|---|---|
| 1 | `START TRANSACTION;` `COUNT(*)` → **5** | |
| 2 | | `INSERT INTO LOPHOCPHAN ... LHPTEST ...; COMMIT;` |
| 3 | `COUNT(*)` lần 2 → **vẫn 5** ✅ *(snapshot)* | |
| 4 | `UPDATE ... SET PHONGHOC=... WHERE SISOMAX>45;` → **6 rows affected** ❌ *hàng ma lộ diện khi GHI* | |

Điểm hay của MySQL 8: COUNT theo snapshot nhưng UPDATE quét hàng thật — trong 1 transaction đếm được 5 mà sửa được 6 hàng.

**Khắc phục:** (B) `SELECT ... FOR UPDATE` — next-key lock khoá cả *khoảng*: A INSERT bị **treo** đến khi B commit; (C) `SERIALIZABLE` — plain SELECT tự thành locking read.

## Demo 5 — DEADLOCK + 3 cách khắc phục (`05_deadlock_retry.sql`)

**Tình huống:** 2 cán bộ điều chỉnh sĩ số 2 lớp theo thứ tự **ngược nhau** (±1 chỗ vì `CHECK SISOMAX > 0`).

| Bước | SESSION A | SESSION B |
|---|---|---|
| 1 | `UPDATE ... +1 WHERE MALHP='LHP0101'` *(giữ khoá hàng 1)* | |
| 2 | | `UPDATE ... +1 WHERE MALHP='LHP0102'` *(giữ khoá hàng 2)* |
| 3 | `UPDATE ... -1 WHERE MALHP='LHP0102'` → ⏳ đợi B | |
| 4 | | `UPDATE ... -1 WHERE MALHP='LHP0101'` → 💥 **ERROR 1213** — InnoDB chọn nạn nhân, rollback toàn bộ B |

Xem dấu tích: `SHOW ENGINE INNODB STATUS\G` → mục *LATEST DETECTED DEADLOCK*.

**Khắc phục:**
- **B — Lock ordering:** quy ước luôn chạm `LHP0101` trước → chu trình chờ không thể hình thành.
- **C — Procedure tự retry** (`sp_demo_deadlock_retry`): `EXIT HANDLER FOR 1213` + `LOOP` tối đa 3 lần — đúng mô hình API thật (`sinhvien.js` retry 3 lần khi `errno === 1213`).

## Demo 6 — OVERSELL & "2 LỚP BẢO VỆ" của chính dự án (`06_oversell_2lop.sql`)

Demo điểm mạnh của dự án: lớp 2 chỗ LHP0101 bị 2 phiên **cùng "đếm rồi chèn"**.

**Phần A — tạm GỠ trigger (lớp 2)** → 2 phiên cùng thấy "lớp đầy", cùng INSERT SV003, SV004 → thành công cả hai → `SELECT COUNT(*)` → **4 sinh viên trong lớp 2 chỗ** ❌ oversell thật. (Đây là câu trả lời cho câu hỏi *"có trigger thì mất gì?"* — mất nó thì Client thô cũng phá được sĩ số.)

**Phần B — gắn lại trigger** (body y hệt `01_schema.sql`) → `INSERT` trực tiếp bị chặn: `ERROR 1644: Lớp học phần đã đầy (trigger)` — kể cả SQL client thao tác thẳng DB.

**Phần C — đường chuẩn `sp_dangky_hocphan`:** lớp đầy → chặn đúng; 2 phiên **đồng thời** đăng ký lớp còn chỗ LHP0102 → `FOR UPDATE` xếp tuần tự → đúng 2 đăng ký, không oversell ✅.

---

## Tổng kết mang đi bảo vệ

| Lỗi | Hiện tượng trên dự án | Mức cô lập tối thiểu tránh nó | Công cụ dự án dùng |
|---|---|---|---|
| Lost Update | 2 phiếu −1 chỉ mất 1 chỗ (59 thay vì 58) | REPEATABLE READ + ghi có khoá | `FOR UPDATE` trong `sp_dangky_hocphan` |
| Dirty Read | Báo chuyển phòng theo dữ liệu chưa từng commit | READ COMMITTED | MySQL mặc định RR |
| Non-repeatable Read | Sĩ số đổi giữa 2 lần đọc 1 phiếu | REPEATABLE READ | snapshot mặc định của MySQL |
| Phantom | COUNT = 5 nhưng UPDATE sửa 6 hàng | SERIALIZABLE / locking read phạm vi | next-key lock khi `FOR UPDATE` |
| Deadlock | ERROR 1213, nạn nhân bị rollback | khoá theo thứ tự + retry | lock ordering + retry 3 lần (API) |
| Oversell | Lớp 2 chỗ chứa 4 SV | kiểm tra trong khoá (P-semibold) | procedure + trigger (2 lớp) |

## Kiểm chứng tự động

```bash
cd server && node ../scripts/verify-demos.mjs
```

Script mở 2 kết nối MySQL thật, chạy đủ 6 demo + fix + reset: **34/34 PASS**, bao gồm các chi tiết khó như "B bị treo khi A giữ khoá", "COUNT snapshot 5 nhưng UPDATE phải 6 hàng", "ERROR 1213 nạn nhân bị rollback", "oversell 4/2 khi gỡ trigger", "trigger được gắn lại và chặn đúng".
