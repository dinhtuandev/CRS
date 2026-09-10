# System Architecture Diagram

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           Internet / Browser (http://localhost:8080)                     │
│                                                                                           │
│   ┌──────────────────────────────────────────────────────────────────────────────┐      │
│   │                              Web Container (nginx)                            │      │
│   │                                                                              │      │
│   │  ┌──────────────────┐    GET /            → index.html                      │      │
│   │  │  /usr/share/nginx│    GET /assets/*   → JS/CSS bundles (Vite build)       │      │
│   │  │     /html        │    proxy_pass /api  → http://api:3000/api               │      │
│   │  └──────────────────┘                                                          │      │
│   └────────────────────────────────────────┬─────────────────────────────────────┘      │
│                                            │                                              │
│                                     HTTP API (proxied)                                  │
└────────────────────────────────────────────┼─────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              API Container (Node.js 22)                              │
│                              http://localhost:3000                                   │
│                                                                                      │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │  auth.js       │  │  sinhvien.js    │  │  giangvien.js   │  │  admin.js      │  │
│  │  POST/login    │  │  GET/lophocph.│  │  GET/lop-cua-toi│  │  CRUD /admin/..│  │
│  │  GET/auth/me   │  │  POST/dangky  │  │  GET/.../sinhvien│  │  PUT/hocky/... │  │
│  └────────┬───────┘  │  DELETE/dangky│  │  PUT/diem       │  │  GET/thongke  │  │
│           │          │  GET/thoikhoa │  └────────┬───────┘  └────────┬───────┘  │
│           │          └────────┬──────┘           │                    │           │
│           │                   │                  │                    │           │
│           └───────────────────┼──────────────────┼────────────────────┘           │
│                               │                  │                                │
│                               ▼                  │                                │
│                      ┌────────────────┐           │                                │
│                      │  middleware    │           │                                │
│                      │  authRequired  │ ◄───────┼───────── JWT Bearer token      │
│                      │  roleRequired  │           │                                │
│                      └────────┬───────┘           │                                │
│                               │                  │                                │
│                               ▼                  │                                │
│                      ┌────────────────┐           │                                │
│                      │  config/       │           │                                │
│                      │  swagger.js    │           │                                │
│                      │  (optional)    │           │                                │
│                      └────────┬───────┘           │                                │
│                               │                  │                                │
│                               ▼                  │                                │
│                      ┌────────────────┐           │                                │
│                      │    db.js       │           │                                │
│                      │  mysql2/promise│           │                                │
│                      │  pool (10 conn)│           │                                │
│                      └────────┬───────┘           │                                │
│                               │                  │                                │
│                               ▼                  │                                │
│  ┌─────────────────────────────────────────────────────────────┐                    │
│  │                      MySQL 8.0                              │                    │
│  │               Port 3307 (host)                              │                    │
│  │                                                             │                    │
│  │  ┌────────────────────────────────────────────────────────┐ │                    │
│  │  │         Database: qlhocphan (utf8mb4)                  │ │                    │
│  │  │                                                          │ │                    │
│  │  │  Tables:                                                 │ │                    │
│  │  │   • KHOA           (MAKHOA, TENKHOA)                    │ │                    │
│  │  │   • GIANGVIEN      (→ KHOA)                              │ │                    │
│  │  │   • SINHVIEN       (→ KHOA)                              │ │                    │
│  │  │   • HOCPHAN        (→ KHOA)                              │ │                    │
│  │  │   • HOCPHAN_TQ     (tự tham chiếu N:N)                   │ │                    │
│  │  │   • HOCKY          (window registration, KHOADIEM)      │ │                    │
│  │  │   • LOPHOCPHAN     (→ HP, HK, GV; slot + room)          │ │                    │
│  │  │   • DANGKYHOCPHAN  (→ SV, LHP; điểm + trạng thái)        │ │                    │
│  │  │   • TAIKHOAN       (→ SV/GV; VAITRO, JWT)               │ │                    │
│  │  │                                                          │ │                    │
│  │  │  Procedures:                                              │ │                    │
│  │  │   sp_dangky_hocphan  — registration txn                  │ │                    │
│  │  │   sp_huy_dangky      — cancel txn                      │ │                    │
│  │  │   sp_nhap_diem       — grade entry                       │ │                    │
│  │  │                                                          │ │                    │
│  │  │  Triggers:                                                │ │                    │
│  │  │   trg_tq_khac_*      — no self-prereq                     │ │                    │
│  │  │   trg_tk_role_*      — account role matching            │ │                    │
│  │  │   trg_dangky_before_*— capacity check + auto-grade       │ │                    │
│  │  │                                                          │ │                    │
│  │  │  Views / Functions:                                        │ │                    │
│  │  │   v_lophocphan_concho, v_bangdiem_sinhvien               │ │                    │
│  │  │   fn_diem_chu (10-point → letter)                        │ │                    │
│  │  │                                                          │ │                    │
│  │  │  Roles:                                                    │ │                    │
│  │  │   app_qlhp (SELECT, INSERT, UPDATE, DELETE on schema)    │ │                    │
│  │  └──────────────────────────────────────────────────────────┘ │                    │
│  └─────────────────────────────────────────────────────────────┘                    │
│                                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │  seed-fix Container (Node:22-alpine, one-shot)                                │   │
│  │  waits for db healthy → fix-seed-password.mjs                                  │   │
│  │  → bcrypt hash "123456" → UPDATE TAIKHOAN                                   │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Docker Compose Service Topology

```
                      ┌──────────────────────────┐
                      │    db (MySQL 8.0)        │
                      │  Port 3307:3307          │
                      │  Health: table check     │
                      │  ├─ Init: 01_schema.sql   │
                      │  ├─ Init: 02_security.sql │
                      │  ├─ Init: 03_seed.sql     │
                      │  └─ Init: scripts/*.mjs   │
                      │  Volumes:                │
                      │    qlhp-data (持久化)      │
                      │    ./db (init, ro)       │
                      └────────────┬─────────────┘
                                   │
                                   │ depends_on (healthy)
                                   │
              ┌─────────────────────┼────────────────────┐
              │                     │                    │
      ┌───────┴───────┐             │           ┌────────┴────────┐
      │ seed-fix      │             │           │ web (nginx)    │
      │ (one-shot)    │             │           │ Port 8080:80    │
      │ node:22       │             │           │ proxy /api→api  │
      │ Fix passwords │             │           └─────────────────┘
      └───────────────┘             │
                                    │ depends_on (healthy)
                                    │
                           ┌────────┴────────┐
                           │ api (Node 22)   │
                           │ Port 3000:3000  │
                           │ ENTRYPOINT=node │
                           │ Health: /me→401 │
                           └─────────────────┘
```
