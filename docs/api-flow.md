# API Flow & Sequence Diagrams

## Login Flow (JWT Authentication)

```
Client ──1──► POST /api/auth/login
  body: { tendangnhap, matkhau }

API ──2──► SELECT ... FROM TAIKHOAN JOIN SINHVIEN/GIANGVIEN
  WHERE TENDANGNHAP = ?

API ──3──► bcrypt.compare(req.matkhau, tk.MATKHAU_HASH)

API ──4──► jwt.sign({ matk, vaitro, masv, magv, ten }, SECRET, 8h)

API ──5──► 200 OK { token, vaitro, masv, magv, ten }

Client (stores token, uses as: Authorization: Bearer <token>)
```

## Middleware Chain (per request)

```
Incoming Request
  │
  ▼
[app.use(express.json)]    ← parse JSON body
  │
  ▼
[setupSwagger()]           ← Swagger UI mounted (/api-docs)
  │
  ▼
[CORS middleware]          ← allow http://localhost:5173
  │
  ▼
Route Handlers:
  /api/auth/login          ← no auth
  /api/auth/me             ← authRequired
  /api/lophocphan          ← authRequired
  /api/dangky              ← authRequired + roleRequired("sinhvien")
  /api/huy_dangky/:id      ← authRequired + roleRequired("sinhvien")
  /api/thoikhoabieu        ← authRequired + roleRequired("sinhvien")
  /api/bangdiem            ← authRequired + roleRequired("sinhvien")
  /api/lop-cua-toi         ← authRequired + roleRequired("giangvien")
  /api/.../:malhp/sinhvien ← authRequired + roleRequired("giangvien")
  /api/diem                ← authRequired + roleRequired("giangvien")
  /api/admin/*             ← authRequired + roleRequired("admin")
  /api/hocky/...           ← authRequired + roleRequired("admin")
  /api/thongke             ← authRequired + roleRequired("admin")
  │
  ▼
[Error handler middleware] ← translate MySQL error codes → HTTP 400/500
  │
  ▼
Response (JSON)
```

## Registration Flow (sp_dangky_hocphan)

```
Client ──1──► POST /api/dangky
  header: Authorization: Bearer <token>  (role: sinhvien)
  body: { malhp: "LHP01", lanhoc: "lần 1" }

API ──2──► authRequired  → verify JWT
API ──3──► roleRequired("sinhvien")  → check req.user.vaitro
API ──4──► for attempt=1..3:
             ┌──► CALL sp_dangky_hocphan(masv, malhp, lanhoc)
             │        Inside stored procedure:
             │        1. SELECT LOPHOCPHAN FOR UPDATE  ← lock row (Exclusive-2PL)
             │        2. Check: exists class? time window?
             │        3. Check: not already passed (≥4)?
             │        4. Check: all prerequisites?
             │        5. Check: no schedule conflict?
             │        6. Check: total ≤ 25 credits?
             │        7. Check: remaining seats ≥ 1?
             │        8. INSERT INTO DANGKYHOCPHAN
             │        9. COMMIT
             └──── (deadlock 1213?) → continue (retry)
                   (business error 1644?) → 400 { error: sqlMessage }

API ──5──► SELECT SUM(SOTINCHI) ... (count total registered)
API ──6──► if total < 12 → 200 { message, canhbao: "Tổng mới X tín chỉ..." }
              else → 200 { message: "Đăng ký thành công" }
```

## Grade Entry Flow (sp_nhap_diem)

```
Client ──1──► PUT /api/diem
  header: Bearer <token>  (role: giangvien)
  body: { masv, malhp, diemchuyencan, diemgiuaky, diemcuoiky }

API ──2──► authRequired + roleRequired("giangvien")
API ──3──► SELECT MAGV FROM LOPHOCPHAN WHERE MALHP = ?
API ──4──► if MAGV ≠ req.user.magv → 403 { error: "..." }
API ──5──► CALL sp_nhap_diem(masv, malhp, cc, gk, ck)
  Inside stored procedure:
  1. SELECT MAHK, KHOADIEM FROM LOPHOCPHAN JOIN HOCKY
  2. Check: exists? → 404
  3. Check: KHOADIEM = 1? → 400 "Bảng điểm đã khoá"
  4. Check: cc/gk/ck BETWEEN 0 AND 10? → 400
  5. UPDATE DANGKYHOCPHAN SET ...
  6. Check: ROW_COUNT() = 0? → 400 "SV chưa đăng ký"

API ──6──► Trigger trg_dangky_before_update fires:
  IF NEW.DIEMCUOIKY IS NOT NULL:
    SET NEW.DIEMHE10 = ROUND(cc*0.1 + gk*0.3 + ck*0.6, 2)
    SET NEW.DIEMCHU  = fn_diem_chu(NEW.DIEMHE10)
    SET NEW.DIEMHE4  = ... (A=4.0, B+=3.5, ...)

API ──7──► 200 { message: "Đã lưu điểm" }
```

## Cancel Registration Flow (sp_huy_dangky)

```
Client ──1──► DELETE /api/dangky/:malhp
  header: Bearer <token>  (role: sinhvien)

API ──2──► authRequired + roleRequired("sinhvien")
API ──3──► CALL sp_huy_dangky(masv, malhp)
  Inside stored procedure:
  1. SELECT MAHK, HANDANGKY_BD, HANDANGKY_KT, DIEMHE10 FROM DANGKYHOCPHAN...
  2. Check: found? → 400 "Không tìm thấy đăng ký"
  3. Check: DIEMHE10 IS NOT NULL? → 400 "Đã có điểm, không thể huỷ"
  4. Check: NOW() NOT IN (bd, kt)? → 400 "Ngoài thời gian"
  5. UPDATE TRANGTHAI = 'đã huỷ'

API ──4──► 200 { message: "Đã huỷ đăng ký" }
```

## Statistics Flow (/api/thongke)

```
Client ──1──► GET /api/thongke  (role: admin)
  header: Bearer <token>

API ──2──► authRequired + roleRequired("admin")

API ──3──► Query 1: Thống kê lớp
  SELECT MALHP, TENHP, MAHK, SISOMAX, SISO_HIENTAI, CONCHO,
         ROUND(SISO_HIENTAI / SISOMAX * 100, 1) AS PHANTRAM_LAPDAY
  FROM v_lophocphan_concho
  ORDER BY PHANTRAM_LAPDAY DESC

API ──4──► Query 2: Cảnh báo học vụ
  SELECT sv.MASV, sv.HOTEN, sv.MAKHOA, CPA10, CPA4
  FROM SINHVIEN sv
    LEFT JOIN DANGKYHOCPHAN dk ...
    LEFT JOIN LOPHOCPHAN l ...
    LEFT JOIN HOCPHAN h ...
  GROUP BY sv.MASV, sv.HOTEN, sv.MAKHOA
  HAVING CPA10 IS NULL OR CPA10 < 2.0
  ORDER BY CPA10 ASC

API ──5──► 200 { lop: [...], canhbao: [...] }
```

## Error Handling Strategy

```
MySQL Error           → HTTP Status → Response Body
─────────────────────   ───────────   ─────────────
SQLSTATE 45000 (SIGNAL)  → 400          { error: "<sqlMessage>" }   ← business rules
ER_DUP_ENTRY (1062)      → 400          { error: "Dữ liệu trùng..." }
ER_NO_REFERENCED_ROW_2   → 400          { error: "Dữ liệu tham chiếu..." }
(1452)
ER_ROW_IS_REFERENCED_2   → 400          { error: "Không xoá được: ..." }
(1451/1217)
Deadlock (1213)          → retry x3     (handled in sinhvien.js)
Others                   → 500          { error: "<message>" }
```
