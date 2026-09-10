import React, { useEffect, useState } from "react";
import { api } from "../api.js";

function fmtLich(l) {
  if (l.THU == null || l.TIETBATDAU == null || l.SOTIET == null) return "—";
  return `T${l.THU} · tiết ${l.TIETBATDAU}–${l.TIETBATDAU + l.SOTIET - 1}`;
}

export default function SinhVienPage({ section }) {
  const [hockys, setHockys] = useState([]);
  const [mahk, setMahk] = useState("");
  const [lops, setLops] = useState([]);
  const [dangky, setDangky] = useState([]);
  const [msg, setMsg] = useState("");
  const [warn, setWarn] = useState("");
  const [err, setErr] = useState("");
  const [lanhoc, setLanhoc] = useState("lần 1");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/api/lophocphan")
      .then((rows) => {
        const ks = [...new Set(rows.map((r) => r.MAHK))];
        setHockys(ks);
        if (ks.length) setMahk(ks[ks.length - 1]);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function load() {
    if (!mahk) return;
    const [ls, tkb] = await Promise.all([
      api(`/api/lophocphan?mahk=${encodeURIComponent(mahk)}`),
      api("/api/thoikhoabieu"),
    ]);
    setLops(ls.filter((l) => l.MAHK === mahk));
    setDangky(tkb.filter((r) => r.MAHK === mahk));
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [mahk]);

  async function dangKy(l) {
    setMsg(""); setWarn(""); setErr("");
    setBusy(true);
    try {
      const m = await api("/api/dangky", { method: "POST", body: { malhp: l.MALHP, lanhoc } });
      setMsg(m.message);
      if (m.canhbao) setWarn(m.canhbao);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function huy(malhp) {
    if (!window.confirm(`Huỷ đăng ký lớp ${malhp}?`)) return;
    setMsg(""); setWarn(""); setErr("");
    try {
      const m = await api(`/api/dangky/${encodeURIComponent(malhp)}`, { method: "DELETE" });
      setMsg(m.message);
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  if (loading) return <div className="loading">Đang tải dữ liệu…</div>;

  const tcByMalhp = Object.fromEntries(lops.map((l) => [l.MALHP, l.SOTINCHI ?? 0]));
  const tongTC = dangky.reduce((a, d) => a + (tcByMalhp[d.MALHP] ?? 0), 0);

  return (
    <div>
      {section !== "diem" && (
        <div className="toolbar">
          <div className="field">
            <label>Học kỳ</label>
            <select value={mahk} onChange={(e) => setMahk(e.target.value)}>
              {hockys.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          {section === "dk" && (
            <div className="field">
              <label>Lần học</label>
              <select value={lanhoc} onChange={(e) => setLanhoc(e.target.value)}>
                <option value="lần 1">Lần 1</option>
                <option value="học lại">Học lại</option>
                <option value="cải thiện">Cải thiện</option>
              </select>
            </div>
          )}
          {section === "tkb" && (
            <div className="field">
              <label>Đã đăng ký</label>
              <div style={{ padding: "8px 0" }}><span className="badge info">{dangky.length} lớp · {tongTC} tín chỉ</span></div>
            </div>
          )}
        </div>
      )}

      {msg && <div className="alert ok">{msg}</div>}
      {warn && <div className="alert warn">{warn}</div>}
      {err && <div className="alert err">{err}</div>}

      {section === "dk" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Mã LHP</th><th>Học phần</th><th className="num">TC</th><th>Giảng viên</th><th>Lịch học</th><th className="center">Còn chỗ</th><th></th></tr>
            </thead>
            <tbody>
              {lops.length === 0 && <tr><td colSpan={7} className="empty">Không có lớp học phần trong học kỳ này</td></tr>}
              {lops.map((l) => {
                const daDk = dangky.some((d) => d.MALHP === l.MALHP);
                return (
                  <tr key={l.MALHP}>
                    <td className="mono">{l.MALHP}</td>
                    <td>{l.TENHP} <span className="hint">({l.MAHP})</span></td>
                    <td className="num">{l.SOTINCHI}</td>
                    <td>{l.TENGV}</td>
                    <td>{fmtLich(l)}{l.PHONGHOC ? ` · ${l.PHONGHOC}` : ""}</td>
                    <td className="center">
                      <span className={`badge ${l.CONCHO <= 0 ? "err" : l.CONCHO <= 5 ? "warn" : "ok"}`}>
                        {l.CONCHO}/{l.SISOMAX}
                      </span>
                    </td>
                    <td>
                      {daDk ? (
                        <button className="small danger" onClick={() => huy(l.MALHP)}>Huỷ</button>
                      ) : (
                        <button className="small primary" disabled={l.CONCHO <= 0 || busy} onClick={() => dangKy(l)}>
                          Đăng ký
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {section === "tkb" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Mã LHP</th><th>Học phần</th><th className="center">Thứ</th><th>Tiết</th><th>Phòng</th><th>Giảng viên</th></tr>
            </thead>
            <tbody>
              {dangky.length === 0 && <tr><td colSpan={6} className="empty">Chưa đăng ký lớp nào trong học kỳ này</td></tr>}
              {dangky.map((d) => (
                <tr key={d.MALHP}>
                  <td className="mono">{d.MALHP}</td>
                  <td>{d.TENHP}</td>
                  <td className="center">{d.THU ?? "—"}</td>
                  <td>{d.TIETBATDAU != null && d.SOTIET != null ? `${d.TIETBATDAU} → ${d.TIETBATDAU + d.SOTIET - 1}` : "—"}</td>
                  <td>{d.PHONGHOC ?? "—"}</td>
                  <td>{d.TENGV}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {section === "diem" && <BangDiem />}
    </div>
  );
}

function gradeBadge(chu) {
  if (chu == null) return <span className="badge muted">–</span>;
  if (chu === "F") return <span className="badge err">F</span>;
  if (chu === "A" || chu === "B+") return <span className="badge ok">{chu}</span>;
  return <span className="badge info">{chu}</span>;
}

function BangDiem() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api("/api/bangdiem").then(setData).catch((e) => setData({ error: e.message }));
  }, []);
  if (!data) return <div className="loading">Đang tải bảng điểm…</div>;
  if (data.error) return <div className="alert err">{data.error}</div>;

  return (
    <div>
      <div className="stats">
        <div className="stat green"><div className="num">{data.tong.gpa4 ?? "–"}</div><div className="lbl">GPA hệ 4 toàn khoá</div></div>
        <div className="stat"><div className="num">{data.tong.cpa10 ?? "–"}</div><div className="lbl">CPA hệ 10 toàn khoá</div></div>
        <div className="stat amber"><div className="num">{data.tong.tinchi_dat}</div><div className="lbl">Tín chỉ đã đạt</div></div>
      </div>
      {data.hockys.map((hk) => (
        <div key={hk.mahk} className="card">
          <h3>{hk.mahk} — GPA {hk.gpa4 ?? "–"} · CPA {hk.cpa10 ?? "–"}</h3>
          <div className="table-wrap" style={{ marginBottom: 0, boxShadow: "none" }}>
            <table>
              <thead>
                <tr><th>Mã HP</th><th>Tên</th><th className="num">TC</th><th>Lần học</th><th className="num">CC</th><th className="num">GK</th><th className="num">CK</th><th className="num">Hệ 10</th><th className="center">Chữ</th><th className="num">Hệ 4</th></tr>
              </thead>
              <tbody>
                {hk.monhoc.map((m) => (
                  <tr key={`${m.MAHK}-${m.MAHP}-${m.LANHOC}`}>
                    <td className="mono">{m.MAHP}</td><td>{m.TENHP}</td><td className="num">{m.SOTINCHI}</td>
                    <td>{m.LANHOC}</td>
                    <td className="num">{m.DIEMCHUYENCAN ?? "–"}</td><td className="num">{m.DIEMGIUAKY ?? "–"}</td><td className="num">{m.DIEMCUOIKY ?? "–"}</td>
                    <td className="num"><b>{m.DIEMHE10 ?? "–"}</b></td><td className="center">{gradeBadge(m.DIEMCHU)}</td><td className="num">{m.DIEMHE4 ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
