# Client Architecture Diagram

## Component Structure

```
client/src/
├── main.jsx          (entry point — React app router)
├── api.js            (API client — fetch wrapper + localStorage token)
├── styles.css        (global styles — login page, tables, badges)
└── pages/
    ├── SinhVien.jsx  (Student dashboard + 3 sections)
    ├── GiangVien.jsx (Lecturer dashboard)
    └── Admin.jsx     (Admin dashboard + CRUD tables)
```

## Component Hierarchy (main.jsx)

```
<App> (root, createRoot)
├── state: user, ready, section
├── useEffect: auto-login via /api/auth/me
│
├── <Login> (when !user)
│   ├── form: tendangnhap, matkhau
│   ├── api("/api/auth/login", POST) → setToken()
│   └── demo account buttons (admin, sv001, gv01 → autofill)
│
└── (when user)
    ├── <aside className="sidebar">
    │   ├── brand: "QLHP"
    │   ├── nav: role-specific buttons (NAV[user.vaitro])
    │   │   └── onClick → setSection(key)
    │   └── user-card: avatar + name + "Đăng xuất"
    │
    └── <div className="main">
        ├── <header>: active section label + description
        └── <main>:
            ├── user.vaitro === "sinhvien" → <SinhVienPage section={active.key} />
            ├── user.vaitro === "giangvien" → <GiangVienPage />
            └── user.vaitro === "admin" → <AdminPage section={active.key} />
```

## SinhVien.jsx — Section Routing

```
<SinhVienPage section>
├── useEffect: load hockys from /api/lophocphan
├── state: hockys, mahk, lops, dangky, msg, warn, err
│
├── (section === "dk") → Registration Section
│   ├── dropdown: chọn học kỳ
│   ├── dropdown: chọn lần học ("lần 1" / "học lại" / "cải thiện")
│   ├── table: lops (from /api/lophocphan?mahk=...)
│   │   ├── col: Mã LHP, Học phần, TC, Giảng viên, Lịch, Còn chỗ
│   │   └── row actions:
│   │       - not registered → [Đăng ký] button → POST /api/dangky
│   │       - registered → [Huỷ] button → DELETE /api/dangky/:malhp
│   └── footer: tổng số lớp + tín chỉ đã đăng ký
│
├── (section === "tkb") → Schedule Section
│   └── table: dangky (from /api/thoikhoabieu)
│         col: Mã LHP, Học phần, Thứ, Tiết, Phòng, GV
│
└── (section === "diem") → <BangDiem />
    ├── stats: GPA hệ 4, CPA hệ 10, Tín chỉ đạt
    └── per-hocky cards:
        └── table: MAHP, Tên, TC, Lần học, CC, GK, CK, Hệ 10, Chữ, Hệ 4
```

## API Client (api.js)

```
┌─────────────────────────────────────────────────────────┐
│                    localStorage                         │
│  KEY = "qlhp_token"  (JWT string)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ getToken()  │  │ setToken(t)  │  │ clearToken()   │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
            │
            ▼
async api(url, { method, body })
  ├─ GET default, or method override
  ├─ headers: Content-Type: application/json
  ├─ if token → Authorization: Bearer <token>
  ├─ fetch(url, { method, headers, body: JSON.stringify(body) })
  ├─ response.json() (or {} on parse error)
  └─ if !res.ok → throw Error(data.error || HTTP status)
  └─ return data

Usage pattern:
  const token = getToken()    ← at startup
  await api("/api/auth/me")   ← auto-login check
  await api("/api/auth/login", { method: "POST", body })
  await api("/api/lophocphan?mahk=HK01")
  await api("/api/dangky", { method: "POST", body: { malhp, lanhoc}})
  await api("/api/dangky/LHP01", { method: "DELETE" })
  await api("/api/thoikhoabieu")
  await api("/api/bangdiem")
  await api("/api/thongke")
```

## GiangVien.jsx — Lecturer Flow

```
<GiangVienPage>
├── state: lops, selected, sinhvien, msg, err
├── useEffect: load /api/lop-cua-toi
│
├── Section: "Lớp phụ trách"
│   └── table: MALHP, MAHP, TENHP, TC, MAHK, còn chỗ
│       └─ action: click row → load /api/lophocphan/:malhp/sinhvien
│
├── Section: "Nhập điểm"
│   └── table: MASV, HOTEN, LANHOC, CC, GK, CK, Hệ 10, Chữ, Hệ 4
│       ├── click cell → edit mode (input số 0–10)
│       └── save → PUT /api/diem { masv, malhp, cc, gk, ck }
│           (trigger DB tự tính DIEMHE10/CHU/HE4)
```

## Admin.jsx — Admin Flow

```
<AdminPage section>
├── ADMIN_CATS:
│   [khoa, giangvien, sinhvien, hocphan, hocky, lophocphan]
│
├── (section === "thongke") → /api/thongke
│   ├── table: Lớp (MALHP, TENHP, MAHK, % lấp đầy)
│   └── table: Cảnh báo (MASV, HOTEN, MAKHOA, CPA10, CPA4)
│
├── (section === "hockyctl") → mở/đóng cửa sổ + khoá/mở điểm
│   ├── PUT /api/hocky/:mahk/cuaso-dangky { mo: true/false }
│   └── PUT /api/hocky/:mahk/khoadiem { khoa: true/false }
│
└── (section is a catalog) → generic CRUD
    ├── GET /api/admin/:table — load all rows
    ├── POST /api/admin/:table — add (form modal)
    ├── PUT /api/admin/:table/:id — edit row inline
    └── DELETE /api/admin/:table/:id — remove (confirm)
```
