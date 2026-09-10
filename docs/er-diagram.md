# Database Schema ER Diagram

## Entity-Relationship Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         qlhocphan Database                               │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐       ┌──────────────────┐      ┌──────────────────┐
│      KHOA        │       │   GIANGVIEN      │      │   SINHVIEN       │
│                  │       │                  │      │                  │
│  MAKHOA (PK) ◄───┼───────┤ MAGV (PK)        │      │ MASV (PK)        │
│  TENKHOA         │       │ HOTEN            │      │ HOTEN            │
│                  │       │ NGAYSINH         │      │ NGAYSINH         │
│                  │       │ GIOITINH         │      │ GIOITINH         │
│                  │       │ HOCVI            │      │ MAKHOA (FK) ─────┼──►
│                  │       │ MAKHOA (FK) ─────┼──►   │ NGAYNHAPHOC      │
│                  │       │ EMAIL (UQ)       │      │ TRANGTHAI        │
└──────────────────┘       └────────┬─────────┘      └────────┬─────────┘
                                    │                     │
                                    │                     │
┌──────────────────┐     ┌────────┴─────────┐     ┌─────────────┐
│ GIANGVIEN ↔ HOCPHAN │ (1:N) LOPHOCPHAN    │ (N:1) │ ┌───────────┐  │
│    MAGV ──► MAGV    │                    │       │ │ HOCPHAN  │  │
│    (FK)            │                    │       │ │          │  │
│    MAHP ◄── MAHP    │                    │       │ │ MAHP (PK)│  │
│    (FK)            │                    │       │ │ TENHP    │  │
│    MAHK ◄── MAHK    │                    │       │ │ SOTINCHI │  │
└──────────────────┘                    │       │ │ SOTIETLT │  │
                                          │       │ │ SOTIETTH │  │
┌──────────────────┐     HOCKY         │       │ │ LOAIHP    │  │
│   HOCPHAN        │      │             │       │ │ MAKHOA (FK)─► KHOA│
│                  │       │             │       │ └───────────┘  │
│ MAHP (PK)        │       │             │       │                │
│ TENHP            │       │             │       │                │
│ SOTINCHI         │       │             │       │                │
│ SOTIETLT         │       │             │       │                │
│ SOTIETTH         │       │             │       │                │
│ LOAIHP           │       │             │       │                │
│ MAKHOA (FK) ─────┼───────┼─────────────┼───────┼──►             │
└────────┬─────────┘       │             │       │                │
         │                 │             │       └────────────────┘
         │ (1:N)     ┌─────┴──────────┐ │               │
         │           │   LOPHOCPHAN   │ │               │
         │           │                │ │               │
         │           │ MALHP (PK)     │ │               │
         │           │ MAHP (FK) ─────┼─┘               │
         │           │ MAHK (FK) ─────┼────────────► HOCKY│
         │           │ MAGV (FK) ─────┼────────────► GIANGVIEN
         │           │ SISOMAX        │               │
         │           │ PHONGHOC       │               │
         │           │ THU            │               │
         │           │ TIETBATDAU     │               │
         │           │ SOTIET         │               │
         │           │ TRANGTHAI      │               │
         │           └────────┬───────┘               │
         │                    │                     │
         │                    │ (1:N)               │
         │                    ▼                     │
         │         ┌──────────────────┐              │
         │         │ DANGKYHOCPHAN    │              │
         │         │                  │              │
         │         │ MASV (PK, FK) ───┼────────────► SINHVIEN│
         │         │ MALHP (PK, FK) ──┼────────────► LOPHOCPHAN│
         │         │ NGAYDANGKY       │              │
         │         │ LANHOC           │              │
         │         │ DIEMCHUYENCAN    │              │
         │         │ DIEMGIUAKY       │              │
         │         │ DIEMCUOIKY       │              │
         │         │ DIEMHE10 (auto)  │              │
         │         │ DIEMCHU (auto)   │              │
         │         │ DIEMHE4 (auto)   │              │
         │         │ TRANGTHAI        │              │
         │         └──────────────────┘              │
         │                                           │
         │         ┌──────────────────┐              │
         │         │   TAIKHOAN       │              │
         │         │                  │              │
         │         │ MATK (PK, AI)    │              │
         │         │ TENDANGNHAP (UQ) │              │
         │         │ MATKHAU_HASH     │              │
         │         │ VAITRO           │              │
         │         │ MASV (FK, Null) ──┼────────────► SINHVIEN│
         │         │ MAGV (FK, Null) ──┼────────────► GIANGVIEN│
         └─────────┼──────────────────┘              │
                   └─────────────────────────────────┘

┌────────────────────┐
│ HOCPHAN_TIENQUYET  │ (self-referencing N:N)
│                    │
│ MAHP (PK, FK) ─────┼──► HOCPHAN
│ MAHP_TQ (PK, FK) ───┼──► HOCPHAN (the same table)
└────────────────────┘
```

## Cardinality

| Relationship | Cardinality | Notes |
|---|---|---|
| KHOA → GIANGVIEN | 1:N | One department, many lecturers |
| KHOA → SINHVIEN | 1:N | One department, many students |
| KHOA → HOCPHAN | 1:N | One department, many subjects |
| HOCPHAN → LOPHOCPHAN | 1:N | One subject, many class sections |
| HOCKY → LOPHOCPHAN | 1:N | One term, many class sections |
| GIANGVIEN → LOPHOCPHAN | 1:N | One lecturer, many class sections |
| LOPHOCPHAN → DANGKYHOCPHAN | 1:N | One class section, many enrollments |
| SINHVIEN → DANGKYHOCPHAN | 1:N | One student, many enrollments |
| SINHVIEN → TAIKHOAN | 1:1 | One student, one account |
| GIANGVIEN → TAIKHOAN | 1:1 | One lecturer, one account |
| HOCPHAN → HOCPHAN_TIENQUYET | 1:N | One subject, many prerequisites |

## Key Constraints Summary

```
KHOA (PK=MAKHOA)
  └─ FK: GIANGVIEN (MAKHOA)
  └─ FK: SINHVIEN  (MAKHOA)
  └─ FK: HOCPHAN  (MAKHOA)

HOCPHAN (PK=MAHP)
  └─ self-reference: HOCPHAN_TIENQUYET (MAHP = MAHP_TIENQUYET)  [trigger: trg_tq_khac_*]

HOCKY (PK=MAHK)
  └─ FK: LOPHOCPHAN (MAHK)

LOPHOCPHAN (PK=MALHP)
  ├─ FK: HOCPHAN   (MAHP)
  ├─ FK: HOCKY     (MAHK)
  └─ FK: GIANGVIEN (MAGV)
     └─ FK: DANGKYHOCPHAN (MALHP)

DANGKYHOCPHAN (PK=MASV,MALHP)
  ├─ FK: SINHVIEN   (MASV)
  └─ FK: LOPHOCPHAN  (MALHP)
     └─ FK: TAIKHOAN (MASV)
     └─ FK: TAIKHOAN (MAGV)
```
