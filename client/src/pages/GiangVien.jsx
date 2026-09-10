import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export default function GiangVienPage() {
  const [lops, setLops] = useState([]);
  const [malhp, setMalhp] = useState("");
  const [svs, setSvs] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");

  useEffect(() => {
    api("/api/lop-cua-toi")
      .then((rows) => {
        setLops(rows);
        if (rows.length) setMalhp(rows[0].MALHP);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function loadSv(m) {
    if (!m) return setSvs([]);
    const rows = await api(`/api/lophocphan/${encodeURIComponent(m)}/sinhvien`);
    setSvs(
      rows.map((s) => ({
        ...s,
        diemchuyencan: s.DIEMCHUYENCAN ?? "",
        diemgiuaky: s.DIEMGIUAKY ?? "",
        diemcuoiky: s.DIEMCUOIKY ?? "",
      }))
    );
  }
  useEffect(() => { loadSv(malhp).catch((e) => setErr(e.message)); }, [malhp]);

  async function luu(masv, row) {
    setMsg(""); setErr("");
    setSaving(masv);
    try {
      const m = await api("/api/diem", {
        method: "PUT",
        body: {
          masv,
          malhp,
          diemchuyencan: row.diemchuyencan,
          diemgiuaky: row.diemgiuaky,
          diemcuoiky: row.diemcuoiky,
        },
      });
      setMsg(`${masv}: ${m.message}`);
      await loadSv(malhp);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving("");
    }
  }

  function onEdit(masv, field, value) {
    setSvs((old) => old.map((s) => (s.MASV === masv ? { ...s, [field]: value } : s)));
  }

  if (loading) return <div className="loading">Đang tải lớp phụ trách…</div>;
  if (lops.length === 0) return <div className="alert info">Bạn chưa được phân công lớp học phần nào.</div>;

  const lop = lops.find((l) => l.MALHP === malhp);
  const daCoDiem = svs.filter((s) => s.DIEMHE10 != null).length;

  return (
    <div>
      <div className="toolbar">
        <div className="field">
          <label>Lớp phụ trách</label>
          <select value={malhp} onChange={(e) => setMalhp(e.target.value)}>
            {lops.map((l) => (
              <option key={l.MALHP} value={l.MALHP}>
                {l.MALHP} — {l.TENHP} ({l.MAHK})
              </option>
            ))}
          </select>
        </div>
        {lop && (
          <div className="field">
            <label>Sĩ số</label>
            <div style={{ padding: "8px 0" }}>
              <span className="badge info">{svs.length}/{lop.SISOMAX} SV · {daCoDiem} đã có điểm</span>
            </div>
          </div>
        )}
      </div>

      {msg && <div className="alert ok">{msg}</div>}
      {err && <div className="alert err">{err}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>MASV</th><th>Họ tên</th><th>Lần học</th>
              <th className="num">Chuyên cần</th><th className="num">Giữa kỳ</th><th className="num">Cuối kỳ</th>
              <th className="num">Hệ 10</th><th className="center">Chữ</th><th className="num">Hệ 4</th><th></th>
            </tr>
          </thead>
          <tbody>
            {svs.length === 0 && <tr><td colSpan={10} className="empty">Lớp chưa có sinh viên đăng ký</td></tr>}
            {svs.map((s) => (
              <tr key={s.MASV}>
                <td className="mono">{s.MASV}</td>
                <td>{s.HOTEN}</td>
                <td>{s.LANHOC}</td>
                <td className="num"><input className="w60" type="number" step="0.25" min="0" max="10"
                       value={s.diemchuyencan ?? ""} onChange={(e) => onEdit(s.MASV, "diemchuyencan", e.target.value)} /></td>
                <td className="num"><input className="w60" type="number" step="0.25" min="0" max="10"
                       value={s.diemgiuaky ?? ""} onChange={(e) => onEdit(s.MASV, "diemgiuaky", e.target.value)} /></td>
                <td className="num"><input className="w60" type="number" step="0.25" min="0" max="10"
                       value={s.diemcuoiky ?? ""} onChange={(e) => onEdit(s.MASV, "diemcuoiky", e.target.value)} /></td>
                <td className="num"><b>{s.DIEMHE10 ?? "–"}</b></td>
                <td className="center">
                  {s.DIEMCHU == null ? "–" : <span className={`badge ${s.DIEMCHU === "F" ? "err" : "ok"}`}>{s.DIEMCHU}</span>}
                </td>
                <td className="num">{s.DIEMHE4 ?? "–"}</td>
                <td>
                  <button className="small primary" disabled={saving === s.MASV} onClick={() => luu(s.MASV, s)}>
                    {saving === s.MASV ? "Đang lưu…" : "Lưu"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Điểm hệ 10 / chữ / hệ 4 do database tự tính theo công thức 10% CC + 30% GK + 60% CK sau khi lưu.</p>
    </div>
  );
}
