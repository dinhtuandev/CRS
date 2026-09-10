import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, getToken, setToken, clearToken } from "./api.js";
import SinhVienPage from "./pages/SinhVien.jsx";
import GiangVienPage from "./pages/GiangVien.jsx";
import AdminPage, { ADMIN_CATS } from "./pages/Admin.jsx";
import "./styles.css";

const ROLE_LABEL = { sinhvien: "Sinh viên", giangvien: "Giảng viên", admin: "Quản trị" };

const NAV = {
  sinhvien: [
    { key: "dk", label: "Đăng ký học phần", desc: "Xem lớp mở, đăng ký / huỷ trong hạn cho phép" },
    { key: "tkb", label: "Thời khoá biểu", desc: "Lịch học các lớp đang theo học trong học kỳ" },
    { key: "diem", label: "Bảng điểm", desc: "Điểm thành phần, GPA hệ 4 và CPA hệ 10" },
  ],
  giangvien: [
    { key: "lop", label: "Lớp phụ trách", desc: "Danh sách sinh viên và nhập điểm theo lớp" },
  ],
  admin: [
    { key: "thongke", label: "Thống kê", desc: "Tỷ lệ lấp đầy lớp và cảnh báo học vụ" },
    { key: "hockyctl", label: "Điều khiển học kỳ", desc: "Mở/đóng đăng ký, khoá/mở bảng điểm" },
    ...ADMIN_CATS.map((c) => ({ key: c.key, label: c.label, desc: `Quản lý danh mục ${c.label.toLowerCase()}` })),
  ],
};

const DEMO_ACCOUNTS = [
  { user: "admin", label: "admin" },
  { user: "sv001", label: "sv001 (SV)" },
  { user: "gv01", label: "gv01 (GV)" },
];

function Login({ onLogged }) {
  const [tendangnhap, setTd] = useState("");
  const [matkhau, setMk] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const data = await api("/api/auth/login", { method: "POST", body: { tendangnhap, matkhau } });
      setToken(data.token);
      onLogged(data);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="logo">QLHP<span>.</span></div>
          <h1>Quản lý học phần tín chỉ</h1>
          <p>Hệ thống đăng ký học phần, quản lý điểm và thống kê học vụ cho 3 vai trò:</p>
          <ul>
            <li><b>Sinh viên</b> — đăng ký học phần, xem TKB và bảng điểm</li>
            <li><b>Giảng viên</b> — quản lý lớp phụ trách, nhập điểm</li>
            <li><b>Quản trị</b> — danh mục, học kỳ, thống kê</li>
          </ul>
        </div>
        <form className="login-form" onSubmit={submit}>
          <h2>Đăng nhập</h2>
          <p className="sub">Dùng tài khoản demo bên dưới (mật khẩu <span className="mono">123456</span>)</p>
          <label>Tên đăng nhập</label>
          <input value={tendangnhap} onChange={(e) => setTd(e.target.value)} autoFocus autoComplete="username" />
          <label>Mật khẩu</label>
          <input type="password" value={matkhau} onChange={(e) => setMk(e.target.value)} autoComplete="current-password" />
          {err && <div className="alert err">{err}</div>}
          <button className="primary" disabled={busy} style={{ marginTop: 8 }}>
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
          <div className="demo-accounts">
            {DEMO_ACCOUNTS.map((a) => (
              <button type="button" key={a.user} onClick={() => { setTd(a.user); setMk("123456"); }}>
                {a.label}
              </button>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState(null);

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          const me = await api("/api/auth/me");
          setUser(me);
          setSection(NAV[me.vaitro][0].key);
        } catch {
          clearToken();
        }
      }
      setReady(true);
    })();
  }, []);

  if (!ready) return <div className="loading">Đang tải…</div>;
  if (!user) {
    return (
      <Login
        onLogged={(data) => {
          setUser({ vaitro: data.vaitro, masv: data.masv ?? null, magv: data.magv ?? null, ten: data.ten });
          setSection(NAV[data.vaitro][0].key);
        }}
      />
    );
  }

  const items = NAV[user.vaitro];
  const active = items.find((i) => i.key === section) || items[0];
  const initial = (user.ten || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">QLHP<span>Quản lý học phần tín chỉ</span></div>
        <nav>
          <div className="nav-group">{ROLE_LABEL[user.vaitro]}</div>
          {items.map((i) => (
            <button key={i.key} className={active.key === i.key ? "active" : ""} onClick={() => setSection(i.key)}>
              {i.label}
            </button>
          ))}
        </nav>
        <div className="user-card">
          <div className="avatar">{initial}</div>
          <div className="who"><b>{user.ten}</b></div>
          <button
            onClick={() => {
              clearToken();
              setUser(null);
              setSection(null);
            }}
          >
            Đăng xuất
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="pagebar">
          <h2>{active.label}</h2>
          <p>{active.desc}</p>
        </header>
        <main className="content">
          {user.vaitro === "sinhvien" && <SinhVienPage section={active.key} />}
          {user.vaitro === "giangvien" && <GiangVienPage />}
          {user.vaitro === "admin" && <AdminPage section={active.key} />}
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
