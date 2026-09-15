# Quản lý học phần tín chỉ (QLHP)

Ứng dụng demo quản lý đăng ký học phần theo hệ tín chỉ: **MySQL 8 (Docker)** + **API Express (Node.js 22)** + **client React/Vite**, phân 3 vai trò `sinhvien / giangvien / admin`.

---

## Mục lục

1. [Kiến trúc](#kiến-trúc)
2. [Yêu cầu](#yêu-cầu)
3. [Chạy nhanh](#chạy-nhanh-full-docker)
4. [Chạy không dùng Docker](#chạy-không-dùng-docker-setup-tay)
5. [Tài khoản demo](#tài-khoản-demo-mật-khẩu-123456)
6. [API Overview](#api-overview-api-cấu-trúc-endpoint)
7. [Quy tắc nghiệp vụ](#quy-tắc-nghiệp-vụ-chính)
8. [Hướng dẫn demo](#hướng-dẫn-demo)
9. [Kết quả kiểm thử API](#kết-quả-kiểm-thử-api-đã-chạy)
10. [Ghi chú kỹ thuật](#ghi-chú-kỹ-thuật)

---

## Kiến trúc

| Thành phần | Mô tả |
|---|---|
| `db/` | `01_schema.sql` (bảng, function, procedure, trigger, view), `02_security.sql` (role + GRANT), `03_seed.sql` (data demo), `demo/` (5 kịch bản lỗi tương tranh + khắc phục) |
| `docs/` | `demo-concurrency.md` — demo 5 lỗi tương tranh từng bước; `huong-dan-demo-db.md` — chạy demo + soi DB bằng MySQL + dùng Swagger |
| `server/` | Express 5 API + JWT, kết nối MySQL qua user `app_qlhp`, có Swagger UI |
| `client/` | React 19 + Vite, proxy `/api` → `http://localhost:3000` |
| `docker-compose.yml` | 3 service: `db` (MySQL 8.0), `api`, `web` (nginx) |

---

## Yêu cầu

- Docker Desktop (Docker Engine + Compose v2)
- Node.js 22+
- Python 3.10+ (chạy demo giả lập nếu không có Docker)

---

## Chạy nhanh (full Docker — khuyến nghị)

```bash
docker compose up -d --wait
```

| Service | Địa chỉ | Ghi chú |
|---|---|---|
| Web     | http://localhost:8080 | nginx serve bản build + proxy `/api` |
| API     | http://localhost:3000 | Express + JWT + Swagger UI |
| Swagger | http://localhost:3000/api-docs | Tài liệu API (Authorize → dán **chỉ** token `eyJ…`, UI tự thêm `Bearer`) |
| MySQL   | localhost:3307 | user `root`/`root123`, DB `qlhocphan` |

Kiểm tra:

```bash
docker compose ps
docker compose logs db | Select-String "init process done"
```

Dọn toàn bộ (xóa data): `docker compose down -v`

---

## Chạy không dùng Docker (setup tay)

Dành cho máy không cài Docker. Cần MySQL 8.0+ và Node.js 22+.

```bash
# 1. Import schema (bắt buộc charset utf8mb4)
mysql -u root -p --default-character-set=utf8mb4 < db/01_schema.sql
mysql -u root -p --default-character-set=utf8mb4 < db/02_security.sql
mysql -u root -p --default-character-set=utf8mb4 < db/03_seed.sql

# 2. Sinh bcrypt hash cho mật khẩu demo "123456"
cd server
npm install
node --input-type=module -e "import('bcryptjs').then(async (b) => { const h = b.hashSync('123456', 10); const m = await import('mysql2/promise'); const c = await m.default.createConnection({ host:'127.0.0.1', port:3306, user:'root', password:'MAT-KHAU-ROOT', database:'qlhocphan' }); await c.query(\"UPDATE TAIKHOAN SET MATKHAU_HASH=? WHERE MATKHAU_HASH='__BCRYPT__'\", [h]); await c.end(); console.log('patched'); })"

# 3. Cấu hình server (.env) → DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
npm start
# API: http://localhost:3000

# 4. Chạy client (terminal khác)
cd ../client
npm install
npm run dev
# Client: http://localhost:5173
```

---

## Tài khoản demo (mật khẩu: `123456`)

| Tên đăng nhập | Vai trò | Ghi chú |
|---|---|---|
| `admin` | admin | CRUD danh mục, thống kê, mở/khóa |
| `sv001`…`sv006` | sinhvien | Đăng ký/huỷ, TKB, bảng điểm |
| `gv01`…`gv04` | giangvien | Lớp phụ trách, nhập điểm |

Đăng nhập: `POST /api/auth/login` với body `{"tendangnhap":"admin","matkhau":"123456"}` → nhận `token` (JWT 8h), gọi các API khác với header `Authorization: Bearer <token>`.

---

## API Overview (cấu trúc endpoint)

| Nhóm | Method | Endpoint | Vai trò | Ghi chú |
|---|---|---|---|---|
| Auth | POST | `/api/auth/login` | — | Nhận JWT |
| Auth | GET | `/api/auth/me` | all | Thông tin user |
| SinhVien | GET | `/api/lophocphan` | all | Danh sách lớp còn chỗ (`?mahk=`) |
| SinhVien | POST | `/api/dangky` | sinhvien | Đăng ký học phần |
| SinhVien | DELETE | `/api/dangky/{malhp}` | sinhvien | Hủy đăng ký |
| SinhVien | GET | `/api/thoikhoabieu` | sinhvien | Thời khóa biểu |
| SinhVien | GET | `/api/bangdiem` | sinhvien | Bảng điểm + GPA/CPA |
| GiangVien | GET | `/api/lop-cua-toi` | giangvien | Lớp phụ trách |
| GiangVien | GET | `/api/lophocphan/{malhp}/sinhvien` | giangvien | DS sinh viên + điểm |
| GiangVien | PUT | `/api/diem` | giangvien | Nhập điểm |
| Admin | GET/POST | `/api/admin/{table}` | admin | CRUD danh mục (khoa/giangvien/sinhvien/hocphan/hocky/lophocphan) |
| Admin | PUT/DELETE | `/api/admin/{table}/{id}` | admin | Cập nhật/xoá |
| HocKy | PUT | `/api/hocky/{mahk}/cuaso-dangky` | admin | Mở/đóng cửa sổ đăng ký |
| HocKy | PUT | `/api/hocky/{mahk}/khoadiem` | admin | Khoá/mở bảng điểm |
| Admin | GET | `/api/thongke` | admin | Thống kê lấp đầy + cảnh báo CPA |

📖 Tài liệu chi tiết: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

---

## Quy tắc nghiệp vụ chính

**Đăng ký** (`sp_dangky_hocphan`, retry khi deadlock 1213):

1. Trong hạn đăng ký của học kỳ.
2. Không đăng ký lại học phần đã đạt (≥ 4).
3. Hoàn thành học phần tiên quyết (≥ 4).
4. Không trùng lịch cùng học kỳ.
5. ≤ 25 tín chỉ/học kỳ (chặn); dưới 12 tín chỉ trả `canhbao` trong response.
6. Lớp còn chỗ (procedure + trigger chống oversell).

**Huỷ đăng ký** (`sp_huy_dangky`): trong hạn, chưa có điểm, chuyển `TRANGTHAI` → `đã huỷ`.

**Nhập điểm** (`sp_nhap_diem` + trigger): đúng GV phụ trách, kỳ chưa khoá, điểm 0–10; trigger tự tính `DIEMHE10 = 10%CC + 30%GK + 60%CK`, chữ, hệ 4.

---

## Hướng dẫn demo

Dự án cung cấp **2 cách demo giao thức tương tranh** — một chạy trên Docker (MySQL thật), một dùng Python (giả lập, không cần MySQL).

### 2.1 Transaction / View / Trigger (trong schema)

| Thành phần | Triển khai | Nơi |
|---|---|---|
| Transaction | `START TRANSACTION … COMMIT/ROLLBACK` trong procedure | `db/01_schema.sql:271/360/267` (`sp_dangky_hocphan`, `sp_huy_dangky`, `sp_nhap_diem`) |
| View | `v_lophocphan_concho`, `v_bangdiem_sinhvien` | `db/01_schema.sql:499/510` |
| Trigger | 5 trigger (constraint + tự động tính) | `trg_tq_khac_*`, `trg_tk_role_*`, `trg_dangky_before_*` |
| Concurrency – locking | `SELECT … FOR UPDATE` (Exclusive lock) | `sp_dangky_hocphan:275` → Exclusive-2PL |
| Concurrency – retry | Deadlock 1213 → retry tới 3 lần | `server/routes/sinhvien.js:53-54` |
| Isolation level | `REPEATABLE-READ` (mặc định InnoDB) | MySQL config |

### 2.2 Demo 5 lỗi tương tranh — kịch bản + khắc phục

Mỗi lỗi có 2 phần trong cùng 1 file SQL: **Phần A gây lỗi** → quan sát kết quả sai → **Phần B/C khắc phục** và kiểm chứng lại. Hướng dẫn từng bước (bảng thao tác xen kẽ 2 session, kết quả mong đợi): **[docs/demo-concurrency.md](docs/demo-concurrency.md)**

| # | Lỗi | Gây lỗi | Khắc phục |
|---|-----|---------|-----------|
| 1 | Lost Update | READ COMMITTED, 2 tx cùng đọc rồi ghi đè | `FOR UPDATE` (Exclusive-2PL) |
| 2 | Dirty Read | READ UNCOMMITTED thấy dữ liệu chưa commit | READ COMMITTED |
| 3 | Non-repeatable Read | READ COMMITTED thấy giá trị đổi giữa tx | REPEATABLE READ (snapshot) |
| 4 | Phantom | RR: COUNT che hàng ma nhưng UPDATE vẫn sửa phải | next-key lock `FOR UPDATE` / SERIALIZABLE |
| 5 | Deadlock | 2 tx khoá 2 hàng ngược thứ tự → ERROR 1213 | khoá cùng thứ tự + retry |

### 2.3 Demo bằng Python (không cần Docker)

```bash
python db/demo/simulate.py    # chọn 1-6 hoặc 7 để chạy tất cả
```

| Lựa chọn | Hiệu ứng |
|---|---|
| 1. Lost Update | 2 transaction cùng đọc rồi ghi đè → mất +1 |
| 2. Dirty Read | đọc thấy dữ liệu chưa commit, rollback xong dữ liệu "ảo" |
| 3. Non-repeatable Read | cùng tx đọc 2 lần, giá trị đổi giữa chừng |
| 4. Deadlock + retry | cyclic wait → một session bị deadlock → retry (max 3) |
| 5. Phantom | RR tránh phantom (snapshot); RC hiện phantom |
| 6. Exclusive-2PL | `FOR UPDATE` giữ exclusive lock tới COMMIT |

### 2.4 Demo trên MySQL thật (qua Docker)

```bash
# Đảm bảo Docker đang chạy
docker compose up -d --wait

# Nạp CSDL demo (chạy 1 lần)
docker compose exec -T db mysql -uroot -proot123 --default-character-set=utf8mb4 < db/demo/demo.sql

# (Tuỳ chọn) tự động hoá kiểm chứng cả 6 lỗi + fix — 34 PASS (tự reset DB về chuẩn)
cd server && node ../scripts/verify-demos.mjs

# Mở 2 terminal session A và B — demo NGAY TRÊN DB dự án qlhocphan
docker compose exec db mysql -uroot -proot123 --default-character-set=utf8mb4 qlhocphan
docker compose exec db mysql -uroot -proot123 --default-character-set=utf8mb4 qlhocphan
# Gõ lệnh theo BƯỚC đánh số trong db/demo/01_lost_update.sql → 06_oversell_2lop.sql
# (kết quả mong đợi ghi sẵn dưới mỗi lệnh)
```

---

## Kết quả kiểm thử API (đã chạy)

- **Auth**: thiếu trường → 400; sai mật khẩu → 401; thiếu/sai token → 401; `/api/auth/me` 200 cho cả 3 vai trò.
- **Phân quyền**: SV gọi `/api/admin/khoa`, GV gọi `/api/dangky`, admin gọi `/api/lop-cua-toi` → 403.
- **Đọc**: `/api/admin/khoa`, `/api/thongke` (CPA tính đúng, SV001 CPA10 7.38), `/api/lophocphan?mahk=`, `/api/bangdiem`, `/api/lop-cua-toi` → 200.
- **Đăng ký**: thiếu `malhp` → 400; lớp không tồn tại → 400; trùng lịch → 400; thiếu tiên quyết → 400; ngoài hạn → 400; trùng PK → 400 “Dữ liệu trùng”; thành công trả `canhbao` nếu < 12 tín chỉ.
- **Huỷ**: lớp không tồn tại → 400; đã có điểm → 400; trong hạn chưa điểm → 200.
- **Điểm**: sai 0–10 → 400; không phụ trách → 403; không tồn tại → 404; SV chưa đk → 400; kỳ đã khoá → 400; nhập đúng → 200 (trigger tính 8/7/8 → 7.70/B/3.00).
- **Admin**: thêm/trùng/xoá `TMP1` → 200/400/200; xoá Khoa đang dùng → 400 “Không xoá được: đã có dữ liệu liên quan”.

---

## Ghi chú kỹ thuật

- MySQL port **3307** (tránh đụng 3306); server bắt buộc `DB_PORT=3307` qua `.env`.
- `docker-compose.yml` ép `--character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci --skip-character-set-client-handshake` để seed UTF-8 không bị mã hoá kép.
- MySQL 8.0 cấm CHECK trên cột FK → ràng buộc “tiên quyết không tự tham chiếu” và “tài khoản khớp vai trò” dùng trigger.
- Image `api` chạy `node index.js` với `DB_HOST=db`; image `web` multi-stage (node build → nginx + proxy `/api`).
