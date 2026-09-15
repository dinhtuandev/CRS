import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export const ADMIN_CATS = [
  { key: "khoa", label: "Khoa", cols: ["MAKHOA", "TENKHOA"] },
  { key: "giangvien", label: "Giảng viên", cols: ["MAGV", "HOTEN", "MAKHOA", "HOCVI", "EMAIL"] },
  { key: "sinhvien", label: "Sinh viên", cols: ["MASV", "HOTEN", "MAKHOA", "TRANGTHAI"] },
  { key: "hocphan", label: "Học phần", cols: ["MAHP", "TENHP", "SOTINCHI", "LOAIHP", "MAKHOA"] },
  { key: "hocky", label: "Học kỳ", cols: ["MAHK", "NAMHOC", "HOCKYTHU", "KHOADIEM"] },
  { key: "lophocphan", label: "Lớp học phần", cols: ["MALHP", "MAHP", "MAHK", "MAGV", "SISOMAX", "PHONGHOC", "THU", "TIETBATDAU", "SOTIET"] },
];

export default function AdminPage({ section }) {
  if (section === "thongke") return <ThongKe />;
  if (section === "hockyctl") return <HocKyControls />;
  const cat = ADMIN_CATS.find((c) => c.key === section);
  if (!cat) return null;
  return <Crud key={cat.key} cat={cat} />;
}

function ThongKe() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api("/api/thongke").then(setData).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="alert err">{err}</div>;
  if (!data) return <div className="loading">Đang tải thống kê…</div>;

  const full = data.lop.filter((l) => Number(l.CONCHO) === 0).length;
  const avgFill = data.lop.length
    ? (data.lop.reduce((a, l) => a + Number(l.PHANTRAM_LAPDAY || 0), 0) / data.lop.length).toFixed(1)
    : "–";

  return (
    <div>
      <div className="transcript-strip">
        <div className="cell"><div className="num">{data.lop.length}</div><div className="lbl">Tổng số lớp học phần</div></div>
        <div className="cell"><div className="num">{avgFill}<small> %</small></div><div className="lbl">Lấp đầy trung bình</div></div>
        <div className="cell red"><div className="num">{full}</div><div className="lbl">Lớp đã đầy</div></div>
        <div className="cell"><div className="num">{data.canhbao.length}</div><div className="lbl">Sinh viên cảnh báo học vụ</div></div>
      </div>

      <div className="card">
        <h3>Tỷ lệ lấp đầy theo lớp</h3>
        <div className="table-wrap" style={{ marginBottom: 0, boxShadow: "none" }}>
          <table>
            <thead>
              <tr><th>Mã LHP</th><th>Học phần</th><th>Học kỳ</th><th className="num">Sĩ số</th><th className="num">Lấp đầy</th></tr>
            </thead>
            <tbody>
              {data.lop.map((l) => (
                <tr key={l.MALHP}>
                  <td className="mono">{l.MALHP}</td><td>{l.TENHP}</td><td>{l.MAHK}</td>
                  <td className="num">{l.SISO_HIENTAI}/{l.SISOMAX}</td>
                  <td className="num">
                    <span className={`badge ${Number(l.PHANTRAM_LAPDAY) >= 100 ? "err" : Number(l.PHANTRAM_LAPDAY) >= 70 ? "warn" : "ok"}`}>
                      {l.PHANTRAM_LAPDAY}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Cảnh báo học vụ (CPA &lt; 2.0 hoặc chưa có điểm)</h3>
        <div className="table-wrap" style={{ marginBottom: 0, boxShadow: "none" }}>
          <table>
            <thead>
              <tr><th>MASV</th><th>Họ tên</th><th>Khoa</th><th className="num">CPA hệ 10</th><th className="num">CPA hệ 4</th></tr>
            </thead>
            <tbody>
              {data.canhbao.length === 0 && <tr><td colSpan={5} className="empty">Không có sinh viên nào cần cảnh báo</td></tr>}
              {data.canhbao.map((s) => (
                <tr key={s.MASV}>
                  <td className="mono">{s.MASV}</td><td>{s.HOTEN}</td><td>{s.MAKHOA}</td>
                  <td className="num">{s.CPA10 ?? "chưa có"}</td><td className="num">{s.CPA4 ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HocKyControls() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setRows(await api("/api/admin/hocky"));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function cuaso(mahk, mo) {
    if (!window.confirm(`${mo ? "Mở" : "Đóng"} cửa sổ đăng ký học kỳ ${mahk}?`)) return;
    setMsg(""); setErr("");
    try {
      const m = await api(`/api/hocky/${encodeURIComponent(mahk)}/cuaso-dangky`, { method: "PUT", body: { mo } });
      setMsg(m.message);
      await load();
    } catch (e) { setErr(e.message); }
  }

  async function khoa(mahk, khoa) {
    if (!window.confirm(`${khoa ? "Khoá" : "Mở khoá"} bảng điểm học kỳ ${mahk}?`)) return;
    setMsg(""); setErr("");
    try {
      const m = await api(`/api/hocky/${encodeURIComponent(mahk)}/khoadiem`, { method: "PUT", body: { khoa } });
      setMsg(m.message);
      await load();
    } catch (e) { setErr(e.message); }
  }

  if (loading) return <div className="loading">Đang tải danh sách học kỳ…</div>;

  return (
    <div>
      {msg && <div className="alert ok">{msg}</div>}
      {err && <div className="alert err">{err}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Mã HK</th><th>Năm học</th><th className="center">Kỳ thứ</th><th>Cửa sổ đăng ký</th><th className="center">Bảng điểm</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const dangMo = r.HANDANGKY_BD && r.HANDANGKY_KT && new Date(r.HANDANGKY_BD) <= new Date() && new Date() <= new Date(r.HANDANGKY_KT);
              return (
                <tr key={r.MAHK}>
                  <td className="mono">{r.MAHK}</td>
                  <td>{r.NAMHOC}</td>
                  <td className="center">{r.HOCKYTHU}</td>
                  <td>
                    <span className={`badge ${dangMo ? "ok" : "muted"}`}>{dangMo ? "Đang mở" : "Đóng"}</span>{" "}
                    <span className="hint">{r.HANDANGKY_BD ? new Date(r.HANDANGKY_BD).toLocaleString("vi-VN") : "—"} đến {r.HANDANGKY_KT ? new Date(r.HANDANGKY_KT).toLocaleString("vi-VN") : "—"}</span>
                  </td>
                  <td className="center">
                    <span className={`badge ${Number(r.KHOADIEM) === 1 ? "err" : "ok"}`}>
                      {Number(r.KHOADIEM) === 1 ? "Đã khoá" : "Đang mở"}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {dangMo
                      ? <button className="small" onClick={() => cuaso(r.MAHK, false)}>Đóng ĐK</button>
                      : <button className="small primary" onClick={() => cuaso(r.MAHK, true)}>Mở ĐK</button>}{" "}
                    {Number(r.KHOADIEM) === 1
                      ? <button className="small" onClick={() => khoa(r.MAHK, false)}>Mở điểm</button>
                      : <button className="small danger" onClick={() => khoa(r.MAHK, true)}>Khoá điểm</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Crud({ cat }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({});
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setRows(await api(`/api/admin/${cat.key}`));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); setForm({}); setMsg(""); setErr(""); }, [cat.key]);

  async function add() {
    setMsg(""); setErr("");
    try {
      const m = await api(`/api/admin/${cat.key}`, { method: "POST", body: form });
      setMsg(m.message);
      setForm({});
      await load();
    } catch (e) { setErr(e.message); }
  }

  async function del(id) {
    if (!window.confirm(`Xoá ${cat.cols[0]} = ${id}?`)) return;
    setMsg(""); setErr("");
    try {
      const m = await api(`/api/admin/${cat.key}/${encodeURIComponent(id)}`, { method: "DELETE" });
      setMsg(m.message);
      await load();
    } catch (e) { setErr(e.message); }
  }

  async function save(row) {
    setMsg(""); setErr("");
    try {
      const pk = cat.cols[0];
      const m = await api(`/api/admin/${cat.key}/${encodeURIComponent(row[pk])}`, { method: "PUT", body: row });
      setMsg(m.message);
      await load();
    } catch (e) { setErr(e.message); }
  }

  if (loading) return <div className="loading">Đang tải danh sách…</div>;

  return (
    <div>
      {msg && <div className="alert ok">{msg}</div>}
      {err && <div className="alert err">{err}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{cat.cols.map((c) => <th key={c}>{c}</th>)}<th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cat.cols.length + 1} className="empty">Chưa có dữ liệu</td></tr>}
            {rows.map((r) => (
              <tr key={r[cat.cols[0]]}>
                {cat.cols.map((c, ci) => (
                  <td key={c}>
                    <input
                      className={ci === 0 ? "mono" : ""}
                      disabled={ci === 0}
                      value={r[c] ?? ""}
                      onChange={(e) => setRows((old) => old.map((x) => (x[cat.cols[0]] === r[cat.cols[0]] ? { ...x, [c]: e.target.value } : x)))}
                    />
                  </td>
                ))}
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="small primary" onClick={() => save(r)}>Lưu</button>{" "}
                  <button className="small danger" onClick={() => del(r[cat.cols[0]])}>Xoá</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Thêm mới</h3>
        <div className="form-grid">
          {cat.cols.map((c) => (
            <div className="field" key={c}>
              <label>{c}</label>
              <input
                value={form[c] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [c]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <button className="primary" onClick={add}>Thêm</button>
      </div>
    </div>
  );
}
