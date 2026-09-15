# Demo các lỗi điều khiển tương tranh & cách khắc phục

Tài liệu thuyết trình: mỗi lỗi gồm **kịch bản gây lỗi** (chạy trên MySQL thật trong Docker, 2 terminal) → **quan sát kết quả sai** → **phương án khắc phục** (chạy ngay để chứng minh).

## Lỗi được demo

| # | Lỗi | Mức cô lập liên quan | Khắc phục |
|---|-----|----------------------|-----------|
| 1 | Lost Update (cập nhật mất) | READ COMMITTED đọc-ghi đè nhau | `SELECT ... FOR UPDATE` (2PL) |
| 2 | Dirty Read (đọc bẩn) | READ UNCOMMITTED đọc dữ liệu chưa commit | READ COMMITTED trở lên |
| 3 | Non-repeatable Read (đọc không lặp lại) | READ COMMITTED thấy giá trị đổi giữa transaction | REPEATABLE READ (snapshot) |
| 4 | Phantom (đọc ma) | REPEATABLE READ vẫn thấy hàng mới (với read thuần) | `FOR UPDATE` / khoá vị từ (next-key lock) |
| 5 | Deadlock (khoá vòng) | bất kỳ mức nào, do thứ tự khoá ngược nhau | khoá đúng thứ tự + retry |

## Chuẩn bị

```bash
docker compose up -d --wait
docker compose exec -T db mysql -uroot -proot123 --default-character-set=utf8mb4 < db/demo/demo.sql
```

Mở **2 terminal**, mỗi terminal vào 1 session MySQL:

```bash
docker compose exec db mysql -uroot -proot123 --default-character-set=utf8mb4 qlhp_demo
```

Ghi chú khi trình bày:
- Terminal **A** và **B** thay phiên nhau gõ lệnh theo thứ tự đánh số trong từng file.
- Kết quả mong đợi đã ghi sẵn dưới mỗi lệnh dạng chú thích `--` để đối chiếu trực tiếp.
- Sau mỗi demo nên chạy `ROLLBACK;` (hoặc `COMMIT;`) ở cả 2 session cho sạch.

## Demo 1 — Lost Update → khắc phục bằng FOR UPDATE

File: `db/demo/01_lost_update.sql`

**Kịch bản:** hai giảng viên cùng mở bảng điểm, cả hai đọc điểm 100 rồi cộng +1. Người ghi sau ghi đè mất phép cộng của người trước → tổng cộng chỉ tăng 1 thay vì 2.

Thứ tự thao tác (chi tiết trong file, gõ theo số):

| Bước | Session A | Session B |
|------|-----------|-----------|
| 1 | `SET ... READ COMMITTED; START TRANSACTION;` | |
| 2 | `SELECT value ...` → **100** | |
| 3 | | `START TRANSACTION; UPDATE value = value + 1; COMMIT;` |
| 4 | `UPDATE value = value + 1` (dựa trên giá trị đã đọc 100) | |
| 5 | `COMMIT; SELECT value` → **101** ❌ (mong 102) | |

**Giải thích:** A đọc 100, tính 100+1=101 và ghi 101 — bước cộng của B bị *mất*. Nguyên nhân: READ COMMITTED không giữ khoá đọc sau khi đọc, nên phép "đọc → tính → ghi" không nguyên tố.

**Khắc phục (ngay trong file, phần B):** chuyển sang `SELECT ... FOR UPDATE` — giữ khoá độc quyền trên hàng từ lúc đọc cho tới COMMIT (đúng tinh thần **Exclusive-2PL**). Chạy lại kịch bản ở phần B của file:

- A `SELECT ... FOR UPDATE` → B `UPDATE` **bị chặn** cho đến khi A `COMMIT`
- B chạy sau A → đọc thấy 101 → cộng thành 102 ✅

> Trong đề tài này, `sp_dangky_hocphan` dùng đúng kỹ thuật này trên bảng `LOPHOCPHAN` để chống "lớp đầy" (oversell).

## Demo 2 — Dirty Read → khắc phục bằng READ COMMITTED

File: `db/demo/02_dirty_read.sql`

**Kịch bản:** phòng đào tạo (A) cộng điểm cho sinh viên +30 nhưng *chưa commit*; giảng viên (B) ở mức READ UNCOMMITTED đọc thấy giá trị mới "bẩn", ra quyết định dựa trên đó; sau đó A ROLLBACK — quyết định của B dựa trên dữ liệu chưa bao giờ tồn tại.

| Bước | Session A | Session B (READ UNCOMMITTED) |
|------|-----------|------------------------------|
| 1 | `START TRANSACTION; UPDATE value = value + 30;` → **chưa commit** | `SET ... READ UNCOMMITTED; START TRANSACTION;` |
| 2 | | `SELECT value` → **130** ❌ (dữ liệu chưa commit!) |
| 3 | `ROLLBACK;` | |
| 4 | | `SELECT value` → **100** — con số 130 vừa rồi là "ảo" |

**Khắc phục:** nâng lên READ COMMITTED (mặc định của hầu hết RDBMS khác; InnoDB mặc định còn cao hơn là REPEATABLE READ). Phần B của file chạy lại: B chỉ thấy **100** ở bước 2, bị chặn cho tới khi A commit/rollback xong.

> Đây là lý do mức cô lập thấp nhất dùng được trong thực tế là READ COMMITTED — InnoDB *không thể* bị dirty read trừ khi chủ động hạ xuống READ UNCOMMITTED.

## Demo 3 — Non-repeatable Read → khắc phục bằng REPEATABLE READ

File: `db/demo/03_nonrepeatable_read.sql`

**Kịch bản:** B tính lại điểm tổng kết, đọc 2 lần trong cùng một transaction; giữa 2 lần đọc, A sửa một dòng và commit. B thấy **cùng một mã nhưng hai giá trị khác nhau** trong 1 transaction → không tin được kết quả tính tổng.

| Bước | Session A | Session B (READ COMMITTED) |
|------|-----------|----------------------------|
| 1 | | `SET ... READ COMMITTED; START TRANSACTION;` |
| 2 | | `SELECT value WHERE id=1` → **100** |
| 3 | `UPDATE value = 200 WHERE id=1; COMMIT;` | |
| 4 | | `SELECT value WHERE id=1` → **200** ❌ (đổi giữa chừng!) |

**Khắc phục:** REPEATABLE READ (mặc định của InnoDB) — transaction chụp *snapshot* nhất quán bằng MVCC; lần đọc 2 vẫn thấy **100**. Phần B trong file chạy lại và đối chiếu. Lưu ý: snapshot áp dụng cho *đọc thuần*; cần kết quả đúng cho phép *tính toán trên dữ liệu mới nhất* thì dùng `LOCK IN SHARE MODE` / `FOR UPDATE` / `FOR SHARE`.

## Demo 4 — Phantom → khắc phục bằng khoá vị (next-key lock)

File: `db/demo/04_phantom.sql`

**Kịch bản:** B đếm các dòng `value > 50` hai lần trong 1 transaction. Giữa 2 lần đếm, A thêm hàng mới 999 và commit. Ở mức REPEATABLE READ, đếm *thuần* vẫn ra kết quả cũ (phantom "trông" đã tránh); nhưng **cập nhật dựa trên tập kết quả đó** sẽ thấy hàng ma xuất hiện.

| Bước | Session A | Session B (REPEATABLE READ) |
|------|-----------|------------------------------|
| 1 | | `START TRANSACTION; SELECT COUNT(*) WHERE value > 50` → **3** |
| 2 | `INSERT INTO counter VALUES (99, 'X', 999); COMMIT;` | |
| 3 | | `SELECT COUNT(*) WHERE value > 50` → vẫn **3** (snapshot) |
| 4 | | `UPDATE ... SET name='phantom' WHERE value > 50` → **4 hàng bị sửa!** ❌ |

**Khắc phục (2 cách, đều có trong file):**
1. **Khoá vị / next-key lock:** chạy `SELECT ... FOR UPDATE` trên phạm vi `value > 50` *ngay từ đầu* → A bị chặn, không INSERT được đến khi B commit. Đây là cách InnoDB đạt mức SQL:1999 SERIALIZABLE.
2. **SERIALIZABLE:** `SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE` — mọi SELECT thường tự thành khoá chia sẻ, chặn cả INSERT lẫn UPDATE của A.

## Demo 5 — Deadlock → khắc phục bằng thứ tự khoá + retry

File: `db/demo/05_deadlock_retry.sql`

**Kịch bản:** A khoá hàng 1 rồi muốn hàng 2; B khoá hàng 2 rồi muốn hàng 1. Mỗi bên chờ tài nguyên bên kia giữ → **vòng chờ** (cyclic wait). InnoDB phát hiện bằng wait-for graph và *chọn một nạn nhân* rollback:

```
ERROR 1213 (40001): Deadlock found when trying to get lock; try restarting transaction
```

**Khắc phục — 3 lớp phòng thủ (đủ trong file):**
1. **Khoá tài nguyên theo cùng một thứ tự toàn cục** (ví dụ luôn khoá id nhỏ trước) → về lý thuyết loại trừ deadlock vì không thể tạo chu trình.
2. **Transaction ngắn:** giữ khoá càng ngắn, xác suất vòng chờ càng thấp.
3. **Retry khi trúng 1213:** nạn nhân bị rollback *đầy đủ* (atomic), việc retry là an toàn — đây chính là điều `server/routes/sinhvien.js` làm khi gọi `sp_dangky_hocphan` (tối đa 3 lần, có backoff).

## Phiên bản không cần MySQL

```bash
python db/demo/simulate.py    # menu 1-6, mô phỏng 5 lỗi + 2PL bằng threading
```

Hữu ích khi máy chiếu không chạy được Docker; log in từng bước để thuyết trình kèm lời giải thích.

## Bảng tổng kết mang đi bảo vệ

| Lỗi | Nguyên nhân | Mức cô lập tối thiểu tránh nó | Công cụ khác |
|-----|-------------|-------------------------------|--------------|
| Lost Update | đọc → tính → ghi trên bản sao cũ | (không mức cô lập nào tự sửa — cần khoá ghi) | `FOR UPDATE` |
| Dirty Read | đọc dữ liệu chưa commit | READ COMMITTED | — |
| Non-repeatable | hàng bị UPDATE giữa transaction | REPEATABLE READ | `LOCK IN SHARE MODE` |
| Phantom | hàng mới thỏa điều kiện WHERE xuất hiện | SERIALIZABLE | next-key lock, `FOR UPDATE` |
| Deadlock | thứ tự khoá ngược giữa 2 tx | (không liên quan mức cô lập) | thứ tự khoá, transaction ngắn, retry 1213 |
