# Concurrency Control & Transaction Diagrams

## 1. Transaction Boundaries in Database Layer

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    sp_dangky_hocphan (Transaction)                        │
├─────────────────────────────────────────────────────────────────────────┤
│
│  START TRANSACTION;
│
│  ┌─────────────────────────────────────────────────────┐
│  │ 1. SELECT LOPHOCPHAN ... FOR UPDATE                │
│  │    → Exclusive lock on class row (oversell guard) │
│  │    → Exclusive-2PL locking pattern                │
│  └─────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────┐
│  │ 2. SELECT HANDANGKY_BD/KT FROM HOCKY               │
│  │    → Read registration window                      │
│  │    (shared lock in REPEATABLE-READ snapshot)      │
│  └─────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────┐
│  │ 3. CHECK: already passed (điểm ≥ 4)?               │
│  │    → SELECT DANGKYHOCPHAN ...                     │
│  └─────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────┐
│  │ 4. CHECK: prerequisites?                           │
│  │    → SELECT HOCPHAN_TIENQUYET ...                  │
│  └─────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────┐
│  │ 5. CHECK: schedule conflict?                       │
│  │    → SELECT DANGKYHOCPHAN JOIN LOPHOCPHAN ...     │
│  └─────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────┐
│  │ 6. CHECK: ≤ 25 credits?                             │
│  │    → SELECT SUM(SOTINCHI) ...                      │
│  └─────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────┐
│  │ 7. CHECK: remaining seats?                         │
│  │    → SELECT COUNT(*) ...                           │
│  └─────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────┐
│  │ 8. INSERT INTO DANGKYHOCPHAN                       │
│  │    → Trigger: trg_dangky_before_insert fires        │
│  │      (double-checks capacity — defense in depth)   │
│  └─────────────────────────────────────────────────────┘
│
│  COMMIT;   ← release exclusive lock on LOPHOCPHAN row
│
│  EXIT HANDLER FOR SQLEXCEPTION:
│    ROLLBACK; RESIGNAL;   ← any error → rollback + propagate
│
└─────────────────────────────────────────────────────────────────────────┘
```

## 2. Concurrency Control Protocol — Exclusive-2PL

```
Protocol: Exclusive Strict 2PL (Exclusive-2PL)
  - All locks acquired before first write (growing phase)
  - All locks held until COMMIT (strict phase)
  - Exclusive locks for writes (FOR UPDATE), Shared locks for reads (snapshot)

┌────────────── SV001 ──────────────────────────────────────────────────────┐
│                                                                │         │
│  T1: sp_dangky_hocphan(SV001, LHP01, "lần 1")                  │         │
│  ├─ START TRANSACTION                                        │         │
│  ├─ SELECT LOPHOCPHAN WHERE MALHP='LHP01' FOR UPDATE          │         │
│  │  → Acquires X_LOCK on LHP01 row                              │         │
│  ├─ Checks pass (time, prereq, schedule, credits, seats)        │         │
│  ├─ INSERT INTO DANGKYHOCPHAN                                    │         │
│  │  → Trigger trg_dangky_before_insert fires                     │         │
│  │  → Re-checks SISOMAX (defense in depth)                        │         │
│  ├─ COMMIT                                                    │         │
│  │  → Releases X_LOCK on LHP01                                    │         │
│  │  → Other transactions can now read/write LHP01                 │         │
└────────────────────────────────────────────────────────────────┘         │
                                                                           │
┌────────────── SV002 (concurrent) ─────────────────────────────────────────┐   │
│                                                                │         │   │
│  T2: sp_dangky_hocphan(SV002, LHP01, "lần 1")                  │         │   │
│  ├─ START TRANSACTION                                        │         │   │
│  ├─ SELECT LOPHOCPHAN WHERE MALHP='LHP01' FOR UPDATE            │         │   │
│  │  → BLOCKED (T1 holds X_LOCK)                                 │         │   │
│  │  → Waits in lock queue                                         │         │   │
│  │                                                                │         │   │
│  │  ┌─────────────────────────────────────────────────────┐      │         │   │
│  │  │ Timeline view:                                     │      │         │   │
│  │  │                                                    │      │         │   │
│  │  │ T1: [START]──────────►[X-LOCK]────►[INSERT]────►[COMMIT]│         │   │
│  │  │ T2:        [START]────►[WAIT]────►[X-LOCK]────►[INSERT]►[COMMIT]│         │   │
│  │  │        (blocked)      (acquired)     (after T1 releases)         │         │   │
│  │  └─────────────────────────────────────────────────────┘      │         │   │
│  │                                                                │         │   │
│  └────────────────────────────────────────────────────────────────┘         │
                                                                           │
                                                                           │
  Result: No oversell — LHP01's SISOMAX never exceeded            │         │
         (Exclusive-2PL ensures serializability for writes)      │         │
                                                                                   │
┌────────────────── Application-Level Retry ───────────────────────────────┐       │
│                                                                      │       │
│  In server/routes/sinhvien.js:53-54                                 │       │
│                                                                      │       │
│  for (let attempt = 1; attempt <= 3; attempt++) {                    │       │
│    try {                                                             │       │
│      await query("CALL sp_dangky_hocphan(...)", [...]);             │       │
│      // success → return                                             │       │
│    } catch (e) {                                                    │       │
│      ├─ errno 1213 (deadlock) → continue (retry)                   │       │
│      ├─ errno 1644 (business rule) → 400 { error: msg }              │       │
│      └─ other → next(e) → 500                                       │       │
│    }                                                                 │       │
│  }                                                                   │       │
│  → Deadlock: InnoDB detects cycle, kills 1 txn, returns 1213       │       │
│  → App catches 1213, retries up to 3 times                          │       │
│                                                                      │       │
└──────────────────────────────────────────────────────────────────────┘       │
                                                                               │
┌─────────────────────── Isolation Level ────────────────────────────────────┐
│                                                                      │       │
│  MySQL 8.0 default: REPEATABLE-READ (snapshot isolation)            │       │
│  ┌────────────────────────────────────────────────────────────┐      │       │
│  │ Transaction T reads consistent snapshot from               │      │       │
│  │ undo log (MVCC). Phantom reads are prevented by             │      │       │
│  │ next-key locks on range scans.                              │      │       │
│  └────────────────────────────────────────────────────────────┘      │       │
│                                                                      │       │
│  Demo: db/demo/simulate.py (choice 5)                                 │       │
│    - RC (Read Committed): phantom possible                          │       │
│    - RR (Repeatable Read): no phantom (snapshot)                    │       │
│                                                                      │       │
└──────────────────────────────────────────────────────────────────────┘       │
                                                                               │
┌─────────────────────── Trigger-Based Concurrency ────────────────────────────┐
│                                                                      │       │
│  trg_dangky_before_insert:                                            │       │
│    SELECT COUNT(*) ... SISOMAX check AGAIN                            │       │
│    → Defense in depth (in case direct INSERT bypasses procedure)      │       │
│    → Also catches race in non-SP paths                                │       │
│                                                                      │       │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 3. Concurrency Demo Scripts

Mỗi file SQL gồm 2 phần: **Phần A gây lỗi** trên MySQL thật (2 session) → **Phần B/C khắc phục + kiểm chứng**. Hướng dẫn từng bước xem `docs/demo-concurrency.md`; bộ test tự động 22 kiểm chứng xem `scripts/verify-demos.mjs`.

```
db/demo/
│
├── simulate.py               — Python threading simulator (no MySQL needed)
│   Menu: 1. Lost Update  2. Dirty Read  3. Non-repeatable Read
│          4. Deadlock + retry  5. Phantom  6. Exclusive-2PL  7. Run all
│
├── demo.sql                  — SQL setup: bảng counter + dữ liệu mẫu
├── 01_lost_update.sql        — A: mất +1 (RC)     | B: FOR UPDATE (2PL)
├── 02_dirty_read.sql         — A: đọc bẩn (RU)    | B: READ COMMITTED
├── 03_nonrepeatable_read.sql — A: giá trị đổi (RC)| B: REPEATABLE READ snapshot
├── 04_phantom.sql            — A: hàng ma (RR)    | B/C: next-key lock, SERIALIZABLE
└── 05_deadlock_retry.sql     — A: ERROR 1213      | B/C: lock ordering, retry proc
```

## 4. Concurrency Matrix: Protocols vs Scenarios

```
┌─────────────────────────────────────┬──────────────────────────────────────┐
│ Scenario                            │ Mechanism in QLHP                      │
├─────────────────────────────────────┼──────────────────────────────────────┤
│ Lost Update                         │ Prevented by FOR UPDATE                │
│                                      │ (exclusive-2PL on LOPHOCPHAN row)    │
├─────────────────────────────────────┼──────────────────────────────────────┤
│ Dirty Read                          │ Prevented by REPEATABLE-READ            │
│                                      │ (MVCC snapshot isolation)             │
├─────────────────────────────────────┼──────────────────────────────────────┤
│ Non-repeatable Read                 │ Prevented by REPEATABLE-READ            │
│                                      │ (snapshot within same transaction)     │
├─────────────────────────────────────┼──────────────────────────────────────┤
│ Phantom Read                        │ Prevented by REPEATABLE-READ            │
│                                      │ (next-key locks on range scans)        │
├─────────────────────────────────────┼──────────────────────────────────────┤
│ Deadlock                           │ Detected by InnoDB                     │
│                                      │ → kill victim (return 1213)            │
│                                      │ → app retries (max 3 attempts)       │
├─────────────────────────────────────┼──────────────────────────────────────┤
│ Oversell (capacity exceeded)        │ Preventive: FOR UPDATE + trigger       │
│                                      │ double-check SISOMAX                   │
├─────────────────────────────────────┼──────────────────────────────────────┤
│ Write Skew                          │ Not applicable (single-row writes)     │
└─────────────────────────────────────┴──────────────────────────────────────┘
```
