# Hướng dẫn chạy Demo & quan sát Database thay đổi bằng MySQL + Swagger

Tài liệu này trả lời 3 câu hỏi khi demo cho thầy:

1. **`simulate.py` chạy thì nó thay đổi ở đâu?** → *Nó KHÔNG đổi MySQL.* Chi tiết ở [Phần A](#phan-a--simulatepy-mo-phong-không-cần-mysql).
2. **Muốn thấy DB thay đổi thật thì truy vấn MySQL thế nào?** → [Phần B](#phan-b--bo-demo-tương-tranh-ngay-trên-db-dự-án-qlhocphan) (bộ demo tương tranh **ngay trên schema dự án**) và [Phần C](#phan-c--swagger-thao-tác-đổi-db-thật-qlhocphan) (Swagger thao tác đổi DB của ứng dụng).
3. **Swagger dùng sao?** → [Phần C](#phan-c--swagger-thao-tác-đổi-db-thật-qlhocphan).

## Tổng quan: công cụ nào đổi database nào?

| Công cụ | Đổi gì trong MySQL? | Dùng để làm gì khi demo |
|---|---|---|
| `db/demo/simulate.py` | **Không đổi gì** — mô phỏng bằng biến trong bộ nhớ Python | Minh hoạ *khái niệm* 6 cơ chế (nhanh, không cần DB) |
| `db/demo/*.sql` (chạy 2 session) | Đổi dữ liệu mẫu **ngay trong `qlhocphan`**: sĩ số/phòng học 2 lớp mẫu `LHP0101`/`LHP0102` + lớp tạm `LHPTEST*` | Demo lỗi tương tranh **trên MySQL thật** với bảng thật của dự án |
| Swagger UI (`/api-docs`) | Đổi dữ liệu nghiệp vụ của `qlhocphan` (đăng ký, điểm, khoá kỳ…) | Chứng minh nghiệp vụ API + xem DB thay đổi bằng truy vấn |

> Kiểm chứng nhanh rằng `simulate.py` không đổi gì — chạy nó rồi hỏi MySQL:
> ```bash
> docker compose exec db mysql -uroot -proot123 -e "SHOW DATABASES;"
> ```
> Danh sách database y nguyên trước/sau khi chạy `simulate.py` — vì toàn bộ "bảng", "khoá", "transaction" trong file đó chỉ là `dict` + `threading.Lock` của Python (xem đầu file `db/demo/simulate.py`: `ROWS = {"a": 100, "b": 100}`).

Các lệnh dưới đây giả định stack chạy bằng Docker Compose (service tên `db`). Nếu chạy lẻ container, thay `docker compose exec db` bằng `docker exec` + tên container (vd `qlhp-mysql`).

---

## Phần A — `simulate.py` (mô phỏng, KHÔNG cần MySQL)

```bash
python db/demo/simulate.py
```

Menu `1..6` chạy từng cơ chế, `7` chạy cả 6, `q` thoát. Ví dụ chọn `1`:

```
[DEMO] === Lost Update (READ COMMITTED, no lock) ===
[A] READ value = 100
[B] READ value = 100
[A] WRITE value = 101  (computed from 100)
[B] WRITE value = 101  (computed from 100)
[RESULT] final value = 101  (mong doi: 102, thuc te: 101 -> LOST UPDATE)
```

Khi demo, nói rõ với thầy: **"Đây là mô phỏng ý tưởng bằng Python; ngay sau đây tôi chứng minh cùng hiện tượng trên chính database của dự án."** rồi chuyển sang Phần B.

---

## Phần B — Bộ demo tương tranh NGAY TRÊN DB dự án (`qlhocphan`)

Toàn bộ demo thao tác trên **bảng thật** của dự án (`LOPHOCPHAN`, `DANGKYHOCPHAN`) và dùng đúng **trigger/procedure** của dự án. Chi tiết từng bước (bảng thao tác xen kẽ 2 session): **[docs/demo-concurrency.md](demo-concurrency.md)**.

### B1. Chuẩn bị (1 lần trước buổi demo)

```bash
docker compose exec -T db mysql -uroot -proot123 --default-character-set=utf8mb4 < db/demo/demo.sql
```

File này chỉ reset dữ liệu mẫu (`LHP0101` sĩ số 2/phòng D3-201 — lớp đầy; `LHP0102` sĩ số 60/phòng D3-202 — trống) và xoá lớp tạm `LHPTEST*`. **Kết thúc buổi demo chạy lại chính file này để trả DB về chuẩn.**

### B2. Mở 2 session MySQL (2 terminal)

```bash
# terminal 1 và terminal 2 đều chạy:
docker compose exec db mysql -uroot -proot123 --default-character-set=utf8mb4 qlhocphan
```

### B3. Xem dữ liệu gốc (session bất kỳ)

```sql
SELECT MALHP, SISOMAX, PHONGHOC, TRANGTHAI
  FROM LOPHOCPHAN WHERE MALHP IN ('LHP0101','LHP0102');
```

```
+---------+---------+----------+-----------+
| MALHP   | SISOMAX | PHONGHOC | TRANGTHAI |
+---------+---------+----------+-----------+
| LHP0101 |       2 | D3-201   | mở        |   <- LỚP ĐẦY (SV005 + SV006)
| LHP0102 |      60 | D3-202   | mở        |   <- TRỐNG
+---------+---------+----------+-----------+
```

### B4. Chạy demo và QUAN SÁT DB thay đổi

Mỗi file có phần **A) gây lỗi** và **B/C) khắc phục**, đánh bước 1,2,3… để gõ xen kẽ 2 session. Sau mỗi phần, chạy truy vấn đối chiếu:

| Demo | Thao tác trên bảng thật | Truy vấn kiểm chứng | Gây lỗi thấy | Sau khắc phục |
|---|---|---|---|---|
| `01_lost_update.sql` | 2 cán bộ cùng giảm sĩ số LHP0102 | `SELECT SISOMAX FROM LOPHOCPHAN WHERE MALHP='LHP0102';` | **59** (2 phiếu −1 chỉ mất 1: phải là 58) ❌ | **58** ✅ nhờ `FOR UPDATE` |
| `02_dirty_read.sql` | Đổi phòng LHP0101 sang D3-205 rồi rollback | `SELECT PHONGHOC FROM LOPHOCPHAN WHERE MALHP='LHP0101';` | B (READ UNCOMMITTED) từng thấy **D3-205** — phòng *chưa từng tồn tại* | READ COMMITTED: không bao giờ thấy |
| `03_nonrepeatable_read.sql` | Sĩ số LHP0102 đổi giữa 2 lần đọc 1 phiếu | cùng truy vấn trên | Đọc lần 1 **60** → lần 2 **55** trong cùng transaction ❌ | REPEATABLE READ: lần 2 vẫn 60 ✅ |
| `04_phantom.sql` | Mở lớp mới `LHPTEST` (sĩ số 50) giữa lúc thống kê | `SELECT COUNT(*) FROM LOPHOCPHAN WHERE MAHK='2025-2026-HK1' AND SISOMAX>45;` | COUNT snapshot **5** nhưng `UPDATE ... WHERE SISOMAX>45` sửa **6 hàng** ❌ | Next-key lock: INSERT bị treo; SERIALIZABLE |
| `05_deadlock_retry.sql` | 2 phiếu chỉnh sĩ số 2 lớp ngược thứ tự | `SHOW ENGINE INNODB STATUS\G` (LATEST DETECTED DEADLOCK) | **ERROR 1213**, nạn nhân bị rollback | Khoá cùng thứ tự / procedure retry 3 lần |
| `06_oversell_2lop.sql` | 2 phiên "đếm rồi chèn" vào lớp đầy LHP0101 | `SELECT COUNT(*) FROM DANGKYHOCPHAN WHERE MALHP='LHP0101' AND TRANGTHAI='đăng ký';` | (tạm gỡ trigger) **4 SV trong lớp 2 chỗ** ❌ oversell thật | Gắn lại trigger → chặn 1644; procedure → không bao giờ oversell ✅ |

Ví dụ màn hình sau demo Lost Update phần gây lỗi (đối chiếu khi trình bày):

```sql
mysql> SELECT SISOMAX FROM LOPHOCPHAN WHERE MALHP='LHP0102';
+---------+
| SISOMAX |
+---------+
|      59 |   -- sai! 2 phiếu -1 phải còn 58
+---------+
```

Sau phần khắc phục (`FOR UPDATE`), chạy lại cùng truy vấn:

```sql
mysql> SELECT SISOMAX FROM LOPHOCPHAN WHERE MALHP='LHP0102';
+---------+
| SISOMAX |
+---------+
|      58 |   -- đúng
+---------+
```

### B5. Dọn dẹp + sửa chữa

```bash
# Trả DB về trạng thái chuẩn (sĩ số, phòng học, xoá LHPTEST*):
docker compose exec -T db mysql -uroot -proot123 --default-character-set=utf8mb4 < db/demo/demo.sql

# Kiểm chứng tự động toàn bộ 6 demo (tự reset + tự gắn lại trigger nếu thiếu):
cd server && node ../scripts/verify-demos.mjs     # 34/34 PASS
```

⚠️ Riêng demo 6 có bước **tạm gỡ trigger** `trg_dangky_before_insert` — nếu dở dang giữa chừng (bật terminal rồi), gắn lại bằng Phần B trong `06_oversell_2lop.sql` hoặc chạy script verify ở trên (tự gắn lại và báo `PASS trigger đang được gắn lại`).

> Reset không đụng dữ liệu nghiệp vụ khác — kiểm chứng: `SELECT COUNT(*) FROM TAIKHOAN;` vẫn 11, điểm các SV nguyên vẹn.

---

## Phần C — Swagger: thao tác đổi DB thật (`qlhocphan`)

Đây là phần **thay đổi dữ liệu thật** — mỗi thao tác trên Swagger đều kèm truy vấn MySQL để xem trước/sau.

### C1. Mở Swagger UI

| Cách chạy | Địa chỉ Swagger |
|---|---|
| Docker Compose (khuyến nghị) | **http://localhost:3000/api-docs** |
| Chạy `node server/index.js` trực tiếp | http://localhost:3000/api-docs |

> Lưu ý: qua cổng web `http://localhost:8080` **không có** `/api-docs` — nginx chỉ proxy đường `/api/`. Mở thẳng cổng 3000. Muốn tắt Swagger (prod): đặt `SWAGGER_ENABLED=false` trong `.env`.

### C2. Lấy token và Authorize

1. Trong Swagger, mở **`POST /api/auth/login`** → *Try it out* → body:
   ```json
   { "tendangnhap": "sv001", "matkhau": "123456" }
   ```
   → Execute → copy trường `token` trong Response (**chỉ phần bắt đầu `eyJ…`**).
2. Nhấn nút **Authorize** (góc trên bên phải) → dán token → Authorize.
   - ⚠️ Dán **chỉ token**. UI tự thêm chữ `Bearer` — dán cả chuỗi `Bearer eyJ…` sẽ bị 401.
   - Token hết hạn sau 8 giờ — 401 thì login lại.
3. Muốn đổi vai trò (GV/admin) thì login lại bằng `gv01` / `admin` rồi Authorize token mới.

### C3. Kịch bản thao tác + truy vấn MySQL xem thay đổi

Mở 1 terminal MySQL để soi DB trong khi bấm Swagger:

```bash
docker compose exec db mysql -uroot -proot123 --default-character-set=utf8mb4 qlhocphan
```

**Trạng thái gốc của dữ liệu dùng trong kịch bản** (kiểm tra trước khi bắt đầu):

```sql
SELECT MALHP, MAHP, SISOMAX, TRANGTHAI FROM LOPHOCPHAN WHERE MALHP IN ('LHP0101','LHP0102');
SELECT * FROM DANGKYHOCPHAN WHERE MASV='SV001' AND MALHP='LHP0102';
```

- `LHP0101` (IT1010, sĩ số 2): đã có SV005, SV006 → **hết chỗ**.
- `LHP0102` (IT1010, sĩ số 60): trống. SV001 từng đạt IT1010 với 7.70 → đăng ký lại phải khai `học lại`.

#### Bước 1 — Thử bấm lớp hết chỗ (bị chặn, DB không đổi)

Swagger: **`POST /api/dangky`**, body `{"malhp": "LHP0101"}`. Tuỳ tài khoản, procedure chặn bằng 2 thông báo khác nhau:

- `sv004` (từng học IT1010 nhưng chỉ được 3.75 — *chưa đạt*): → 400 **`Lớp học phần đã đầy`** — đúng chạm check sĩ số.
- `sv001` (đã đạt IT1010 7.70): → 400 **`Học phần đã đạt; dùng học lại hoặc cải thiện`** — check *đã đạt* chạy *trước* check sĩ số.

Cả hai đều 400 và **không để lại dấu vết trong DB**:

```sql
SELECT MASV, MALHP FROM DANGKYHOCPHAN WHERE MALHP='LHP0101';
-- vẫn chỉ SV005, SV006 — thao tác bị chặn không thêm hàng
```

#### Bước 2 — Đăng ký thành công (DB thay đổi: thêm hàng)

Swagger: **`POST /api/dangky`**, body:
```json
{ "malhp": "LHP0102", "lanhoc": "học lại" }
```
→ 200 `Đăng ký thành công`.

```sql
SELECT MASV, MALHP, LANHOC, NGAYDANGKY, TRANGTHAI
  FROM DANGKYHOCPHAN WHERE MASV='SV001' AND MALHP='LHP0102';
-- 1 hàng mới: LANHOC='học lại', NGAYDANGKY=thời điểm bấm, TRANGTHAI='đăng ký'

SELECT MALHP, SISOMAX, SISO_HIENTAI, CONCHO
  FROM v_lophocphan_concho WHERE MALHP='LHP0102';
-- SISO_HIENTAI tăng 1, CONCHO giảm 1 — view tính lại tự động
```

(Nếu bấm `lanhoc: "lần 1"` sẽ bị chặn 400 `Học phần đã đạt; dùng học lại hoặc cải thiện` — DB vẫn không có hàng mới.)

#### Bước 3 — Nhập điểm (DB thay đổi: 3 cột điểm + 3 cột tự tính)

Đăng nhập `gv02` (GV phụ trách `LHP0102`), Authorize token mới. Swagger: **`PUT /api/diem`**, body:
```json
{ "masv": "SV001", "malhp": "LHP0102", "diemchuyencan": 8, "diemgiuaky": 7, "diemcuoiky": 8 }
```
→ 200 `Đã lưu điểm`.

```sql
SELECT DIEMCHUYENCAN, DIEMGIUAKY, DIEMCUOIKY,
       DIEMHE10, DIEMCHU, DIEMHE4
  FROM DANGKYHOCPHAN WHERE MASV='SV001' AND MALHP='LHP0102';
-- 8.00 | 7.00 | 8.00 | 7.70 | B | 3.00
-- DIEMHE10/CHU/HE4 không ai nhập — trigger tự tính: 0.1*8 + 0.3*7 + 0.6*8 = 7.70
```

(Đăng nhập nhầm `gv01` sẽ 403 `Chỉ giảng viên phụ trách lớp mới được nhập điểm` — DB không đổi.)

#### Bước 4 — Huỷ đăng ký khi đã có điểm (bị chặn)

Đăng nhập `sv001` lại. Swagger: **`DELETE /api/dangky/LHP0102`** → 400 `Đã có điểm, không thể huỷ đăng ký`.

```sql
SELECT TRANGTHAI FROM DANGKYHOCPHAN WHERE MASV='SV001' AND MALHP='LHP0102';
-- vẫn 'đăng ký' — quy tắc nghiệp vụ bảo vệ bảng điểm
```

#### Bước 5 — Admin khoá bảng điểm → sửa điểm bị chặn (DB thay đổi: cột KHOADIEM)

Đăng nhập `admin`. Swagger: **`PUT /api/hocky/2025-2026-HK1/khoadiem`**, body `{"khoa": true}` → 200.

```sql
SELECT MAHK, KHOADIEM FROM HOCKY WHERE MAHK='2025-2026-HK1';
-- KHOADIEM = 1
```

`gv02` sửa điểm lại (`PUT /api/diem` như bước 3, đổi `diemcuoiky: 9`) → 400 `Bảng điểm học kỳ đã khoá` — chặn ở **procedure** `sp_nhap_diem` (lớp DB thứ nhất). Trigger `trg_dangky_before_update` là lớp 2, chỉ dính vào các đường ghi *trực tiếp* lên bảng (không qua procedure).

Mở khoá lại khi trình bày xong: `{"khoa": false}` → `KHOADIEM` về 0.

#### Bước 6 — Huỷ đăng ký khi chưa có điểm (thành công, hàng KHÔNG bị xoá)

> Tài khoản `sv001` hết lớp khả dụng để đăng ký thêm (Thứ 3 trùng IT1010, các lớp còn lại chặn tiên quyết chuỗi IT2030→IT3050→IT3060→IT3070) — bước này dùng **`sv006`** (đã đạt IT1010 4.00, còn rảnh Thứ 3).

Đăng nhập `sv006`. Swagger: **`POST /api/dangky`**, body `{"malhp": "LHP0102", "lanhoc": "học lại"}` → 200, rồi **`DELETE /api/dangky/LHP0102`** → 200 `Đã huỷ đăng ký`.

```sql
SELECT MASV, MALHP, TRANGTHAI FROM DANGKYHOCPHAN WHERE MASV='SV006' AND MALHP='LHP0102';
-- hàng vẫn còn, TRANGTHAI='đã huỷ' — huỷ = UPDATE, không phải DELETE
```

> Đây cũng là lý do **không đăng ký lại được cùng một lớp** sau khi huỷ (PK `MASV+MALHP` + check trạng thái) — giới hạn đã ghi trong tài liệu review.

### C4. Trả DB về trạng thái seed ban đầu

```sql
DELETE FROM DANGKYHOCPHAN
 WHERE (MASV='SV001' AND MALHP='LHP0102')
    OR (MASV='SV006' AND MALHP='LHP0102');
UPDATE HOCKY SET KHOADIEM = 0 WHERE MAHK = '2025-2026-HK1';
```

### C5. Bảng ánh xạ nhanh: thao tác Swagger → truy vấn soi DB

| Thao tác Swagger | Endpoint | Truy vấn MySQL soi thay đổi |
|---|---|---|
| Xem lớp còn chỗ | `GET /api/lophocphan` | `SELECT * FROM v_lophocphan_concho;` |
| Đăng ký | `POST /api/dangky` | `SELECT * FROM DANGKYHOCPHAN WHERE MASV='...';` |
| Huỷ đăng ký | `DELETE /api/dangky/{malhp}` | `SELECT TRANGTHAI FROM DANGKYHOCPHAN WHERE MASV='...' AND MALHP='...';` |
| Thời khoá biểu | `GET /api/thoikhoabieu` | `SELECT ... FROM DANGKYHOCPHAN dk JOIN LOPHOCPHAN l ... WHERE TRANGTHAI='đăng ký';` |
| Nhập điểm | `PUT /api/diem` | `SELECT DIEMCHUYENCAN, DIEMGIUAKY, DIEMCUOIKY, DIEMHE10, DIEMCHU, DIEMHE4 FROM DANGKYHOCPHAN WHERE MASV='...' AND MALHP='...';` |
| Khoá/mở đăng ký | `PUT /api/hocky/{mahk}/cuaso-dangky` | `SELECT HANDANGKY_BD, HANDANGKY_KT FROM HOCKY WHERE MAHK='...';` |
| Khoá bảng điểm | `PUT /api/hocky/{mahk}/khoadiem` | `SELECT KHOADIEM FROM HOCKY WHERE MAHK='...';` |
| Thống kê | `GET /api/thongke` | `SELECT MALHP, SISO_HIENTAI, CONCHO FROM v_lophocphan_concho;` |

---

## Sự cố thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Swagger 401 dù đã Authorize | Dán cả chữ `Bearer`, hoặc token quá 8 giờ | Authorize lại, dán **chỉ** `eyJ…` |
| Không mở được `/api-docs` qua cổng 8080 | nginx chỉ proxy `/api/` | Mở thẳng `http://localhost:3000/api-docs` |
| Sĩ số/phòng học 2 lớp mẫu bị lệch sau demo | Demo đã thay đổi dữ liệu | Chạy lại `db/demo/demo.sql` |
| Lớp mẫu `LHPTEST*` còn sót | Demo 4 dở dang | Chạy lại `db/demo/demo.sql` (tự xoá) |
| Mất trigger `trg_dangky_before_insert` | Demo 6 dở dang sau bước DROP TRIGGER | Chạy Phần B của `06_oversell_2lop.sql`, hoặc `cd server && node ../scripts/verify-demos.mjs` (tự gắn lại) |
| MySQL báo không nối được | Container `db` chưa lên | `docker compose up -d --wait` rồi chạy lại |
| Đăng ký lại lớp vừa huỷ bị chặn | PK `MASV+MALHP` + check `đăng ký` | Giới hạn đã biết của bản demo — dùng lớp khác |
