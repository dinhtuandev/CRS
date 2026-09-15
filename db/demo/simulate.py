"""
Demo giao thức điều khiển tương tranh — mô phỏng bằng Python threading (không cần MySQL)
Chạy:  python db/demo/simulate.py
"""

import threading
import time

ROWS = {"a": 100, "b": 100}
LOG = []
LOG_LOCK = threading.Lock()
LOCKS = {}
LOCKS_LOCK = threading.Lock()


def log(tag, *parts):
    with LOG_LOCK:
        LOG.append(f"[{tag}] {' '.join(str(p) for p in parts)}")
        print(f"[{tag}] {' '.join(str(p) for p in parts)}")


def reset():
    with LOG_LOCK:
        ROWS.update({"a": 100, "b": 100})
        LOG.clear()
    with LOCKS_LOCK:
        LOCKS.clear()


# ---------------------------------------------------------------- #
# 1. Lost Update — READ COMMITTED (không khóa)
# ---------------------------------------------------------------- #
def lost_update():
    reset()
    log("DEMO", "=== Lost Update (READ COMMITTED, no lock) ===")
    v = {"val": 100}
    barrier = threading.Barrier(2)

    def tx(name):
        read = v["val"]
        log(name, f"READ value = {read}")
        barrier.wait()
        time.sleep(0.3)
        v["val"] = read + 1
        log(name, f"WRITE value = {read + 1}  (computed from {read})")

    a = threading.Thread(target=tx, args=("A",))
    b = threading.Thread(target=tx, args=("B",))
    a.start(); b.start()
    a.join(); b.join()

    log("RESULT", f"final value = {v['val']}  (mong doi: 102, thuc te: {v['val']} -> LOST UPDATE)")


# ---------------------------------------------------------------- #
# 1b. Dirty Read — READ UNCOMMITTED đọc dữ liệu chưa commit
# ---------------------------------------------------------------- #
def dirty_read():
    reset()
    log("DEMO", "=== Dirty Read (READ UNCOMMITTED) ===")
    v = {"val": 100}
    a_committed = threading.Event()
    b_read1 = threading.Event()

    def tx_a():
        log("A", "UPDATE value = value + 30  (CHUA commit)")
        v["val"] += 30
        b_read1.wait()          # đợi B đọc xong lần 1
        log("A", "ROLLBACK")

    def tx_b():
        log("B (RU)", f"READ value = {v['val']}")
        b_read1.set()
        a_committed.wait(timeout=0.5)
        log("B (RU)", f"READ value = {v['val']}  -> da thay du lieu chua commit: DIRTY READ")

    ta = threading.Thread(target=tx_a)
    tb = threading.Thread(target=tx_b)
    ta.start(); tb.start()
    ta.join(); tb.join()
    log("RESULT", f"gia tri that = 100 (da rollback); B da doc thay 130 = DIRTY READ")


# ---------------------------------------------------------------- #
# 1c. Non-repeatable Read — READ COMMITTED thấy giá trị đổi giữa tx
# ---------------------------------------------------------------- #
def nonrepeatable_read():
    reset()
    log("DEMO", "=== Non-repeatable Read (READ COMMITTED) ===")
    state = {"committed": 100}
    first_read = threading.Event()
    a_done = threading.Event()

    def tx_a():
        first_read.wait()
        time.sleep(0.2)
        state["committed"] = 200
        log("A", "UPDATE value = 200 + COMMIT")
        a_done.set()

    def tx_b():
        log("B (RC)", f"READ lan 1: value = {state['committed']}")
        first_read.set()
        a_done.wait()
        time.sleep(0.1)
        log("B (RC)", f"READ lan 2: value = {state['committed']}  -> doi gia tri giua tx!")

    ta = threading.Thread(target=tx_a)
    tb = threading.Thread(target=tx_b)
    ta.start(); tb.start()
    ta.join(); tb.join()
    log("RESULT", "REPEATABLE READ se chup snapshot: lan 2 van thay 100 -> khong lap lai duoc")


# ---------------------------------------------------------------- #
# 2. Deadlock — 2 transaction cố lấy 2 hàng nghịch thứ tự
# ---------------------------------------------------------------- #
def deadlock():
    reset()
    log("DEMO", "=== Deadlock (cyclic wait) ===")
    mgr = LockManager()

    def tx(name, first, second):
        log(name, f"try lock {first}")
        m1 = mgr.acquire(name, first)
        if m1 is None:
            log(name, f"DEADLOCK -> retry / rollback")
            return
        log(name, f"holds {first}, try lock {second}")
        time.sleep(0.3)
        m2 = mgr.acquire(name, second)
        if m2 is None:
            log(name, f"DEADLOCK -> retry / rollback")
            mgr.release(name, first)
            return
        log(name, "got both locks -> COMMIT")
        mgr.release(name, first)
        mgr.release(name, second)

    t1 = threading.Thread(target=tx, args=("A", "a", "b"))
    t2 = threading.Thread(target=tx, args=("B", "b", "a"))
    t1.start(); t2.start()
    t1.join(); t2.join()
    log("RESULT", "mot session COMMIT, session con lai bi deadlock -> ROLLBACK + retry (max 3)")


class LockManager:
    def __init__(self):
        self._lock = threading.Lock()
        self._owners = {}

    def acquire(self, tx, row):
        with self._lock:
            owner = self._owners.get(row)
            if owner is None:
                self._owners[row] = tx
                return True
            if owner == tx:
                return True
            log("LOCK-WAIT", f"{tx} blocked on {row} held by {owner}")
            return None

    def release(self, tx, row):
        with self._lock:
            if self._owners.get(row) == tx:
                del self._owners[row]


def deadlock_retry(max_attempts=3):
    reset()
    log("DEMO", f"=== Deadlock + retry (max {max_attempts} lan) ===")
    mgr = LockManager()

    def tx(name, first, second):
        for attempt in range(1, max_attempts + 1):
            log(name, f"attempt {attempt}: lock {first}")
            m1 = mgr.acquire(name, first)
            if m1 is None:
                log(name, "deadlock, wait 0.1s then retry")
                time.sleep(0.1)
                continue
            log(name, f"holds {first}, lock {second}")
            time.sleep(0.2)
            m2 = mgr.acquire(name, second)
            if m2 is None:
                mgr.release(name, first)
                log(name, "deadlock, release + retry")
                time.sleep(0.1)
                continue
            log(name, "COMMIT")
            mgr.release(name, first)
            mgr.release(name, second)
            return
        log(name, "retry het, rollback")

    threads = [
        threading.Thread(target=tx, args=("A", "a", "b")),
        threading.Thread(target=tx, args=("B", "b", "a")),
    ]
    for t in threads: t.start()
    for t in threads: t.join()


# ---------------------------------------------------------------- #
# 3. Phantom — REPEATABLE READ vs READ COMMITTED
# ---------------------------------------------------------------- #
def phantom():
    log("DEMO", "=== Phantom (RR: snapshot; RC: thay doi) ===")

    def run(label, isolation):
        state = {"rows": [10, 20, 30]}
        stop_insert = threading.Event()

        def reader():
            if isolation == "RR":
                snap = list(state["rows"])
                c1 = len([x for x in snap if x > 15])
                log("RR-tx", f"first read COUNT(>15) = {c1}")
                stop_insert.set()
                time.sleep(0.5)
                c2 = len([x for x in snap if x > 15])
                log("RR-tx", f"second read COUNT(>15) = {c2} => phantom TRONg")
            else:
                c1 = len([x for x in state["rows"] if x > 15])
                log("RC-tx", f"first read COUNT(>15) = {c1}")
                stop_insert.set()
                time.sleep(0.5)
                c2 = len([x for x in state["rows"] if x > 15])
                log("RC-tx", f"second read COUNT(>15) = {c2} => phantom xuat hien")

        def inserter():
            stop_insert.wait()
            time.sleep(0.1)
            state["rows"].append(99)
            log("INSERT", "them hang gia tri 99 (>15)")

        threading.Thread(target=reader).start()
        threading.Thread(target=inserter).start()
        stop_insert.clear()
        time.sleep(1.2)
        stop_insert.set()
        time.sleep(0.1)

    run("RR", "RR")
    run("RC", "RC")


# ---------------------------------------------------------------- #
# 4. Exclusive-2PL — SELECT FOR UPDATE giu lock cho toi COMMIT
# ---------------------------------------------------------------- #
def two_pl():
    reset()
    log("DEMO", "=== Exclusive-2PL (SELECT...FOR UPDATE) ===")
    mgr = LockManager()

    def tx(name, row, work):
        log(name, f"FOR UPDATE -> lock {row}")
        m = mgr.acquire(name, row)
        if m is None:
            log(name, "blocked (waiting...)")
            time.sleep(0.6)
            return
        log(name, f"working on {row}: {work}")
        time.sleep(0.3)
        mgr.release(name, row)
        log(name, f"COMMIT -> release {row}")

    t1 = threading.Thread(target=tx, args=("A", "a", "+50"))
    t2 = threading.Thread(target=tx, args=("B", "a", "+50"))
    t2.start(); t1.start()
    t1.join(); t2.join()
    log("RESULT", "A giu lock, B doi cho den khi A commit -> Exclusive-2PL")


# ---------------------------------------------------------------- #
# Menu
# ---------------------------------------------------------------- #
MENU = [
    ("1", "Lost Update (READ COMMITTED)", lost_update),
    ("2", "Dirty Read (READ UNCOMMITTED)", dirty_read),
    ("3", "Non-repeatable Read (READ COMMITTED)", nonrepeatable_read),
    ("4", "Deadlock + retry (2PL)", deadlock_retry),
    ("5", "Phantom (RR vs RC)", phantom),
    ("6", "Exclusive-2PL (FOR UPDATE)", two_pl),
]


def main():
    print("\n=== Demo giao thuc dieu khien tuong tranh (Python) ===\n")
    for key, label, _ in MENU:
        print(f"  {key}. {label}")
    print("  7. Chay ca 6")
    print("  q. Thoat")
    choice = input("\nChon (1-7/q): ").strip().lower()
    if choice == "7":
        for _, _, fn in MENU:
            fn()
            print()
    else:
        for key, _, fn in MENU:
            if key == choice:
                fn()
                break
        else:
            print("Lua chon khong hop le.")
    input("\nNhan Enter de ket thuc...")


if __name__ == "__main__":
    main()
