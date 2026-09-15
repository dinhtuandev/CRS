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
    { key: "dk", label: "Đăng ký học phần", desc: "Chọn lớp còn chỗ và đăng ký trong hạn cho phép của học kỳ" },
    { key: "tkb", label: "Thời khoá biểu", desc: "Lịch học theo tuần của các lớp bạn đang theo học" },
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
          <p className="kicker">Trường Đại học — Hệ tín chỉ</p>
          <h1>Đăng ký học phần &amp; học bạ điện tử</h1>
          <p className="sub">
            Một hệ thống, ba vai trò: sinh viên tự đăng ký lớp trong hạn, giảng viên nhập điểm
            trực tiếp vào lớp phụ trách, phòng đào tạo khoá sổ và theo dõi cảnh báo học vụ.
          </p>
          <ul className="role-list">
            <li><b>Sinh viên</b><span>đăng ký, huỷ trong hạn, xem thời khoá biểu và bảng điểm</span></li>
            <li><b>Giảng viên</b><span>lớp phụ trách, nhập điểm chuyên cần — giữa kỳ — cuối kỳ</span></li>
            <li><b>Quản trị</b><span>danh mục, mở/khoá cửa sổ đăng ký và bảng điểm, thống kê</span></li>
          </ul>
        </div>
        <form className="login-form" onSubmit={submit}>
          <div className="login-stamp" aria-hidden="true">
            PHÒNG<br />ĐÀO TẠO<br />— QLHP —<br />BIÊN BẢN
          </div>
          <h2>Đăng nhập</h2>
          <p className="sub">Chọn nhanh một tài khoản demo (mật khẩu <span className="mono">123456</span>):</p>
          <label htmlFor="ten-dang-nhap">Tên đăng nhập</label>
          <input id="ten-dang-nhap" value={tendangnhap} onChange={(e) => setTd(e.target.value)} autoFocus autoComplete="username" />
          <label htmlFor="mat-khau">Mật khẩu</label>
          <input id="mat-khau" type="password" value={matkhau} onChange={(e) => setMk(e.target.value)} autoComplete="current-password" />
          {err && <div className="alert err">{err}</div>}
          <button className="primary" disabled={busy} style={{ marginTop: 10 }}>
            {busy ? "Đang kiểm tra…" : "Đăng nhập"}
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
        <div className="brand">
          <div className="logo">QL<i>&amp;</i>HP</div>
          <small>Quản lý học phần tín chỉ</small>
        </div>
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
            Thoát
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
