import React, { useEffect, useState } from "react";
import { api } from "../api.js";

function fmtLich(l) {
  if (l.THU == null || l.TIETBATDAU == null || l.SOTIET == null) return "—";
  return `T${l.THU}, tiết ${l.TIETBATDAU}–${l.TIETBATDAU + l.SOTIET - 1}`;
}

const SO_TIET = 12;
const THU_LABEL = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];

function Timetable({ rows }) {
  const placed = rows.filter((r) => r.THU != null && r.TIETBATDAU != null && r.SOTIET != null);
  const cells = [];
  for (const r of placed) {
    cells.push(
      <div
        key={r.MALHP}
        className="tt-lop"
        style={{ gridColumn: r.THU, gridRow: `${r.TIETBATDAU + 1} / span ${Math.min(r.SOTIET, SO_TIET)}` }}
        title={`${r.TENHP} — ${r.TENGV ?? ""}`}
      >
        <b>{r.TENHP}</b>
        <span className="tt-ma">{r.MALHP}{r.PHONGHOC ? `, phòng ${r.PHONGHOC}` : ""}</span>
      </div>
    );
  }
  const unplaced = rows.filter((r) => r.THU == null || r.TIETBATDAU == null || r.SOTIET == null);

  return (
    <div>
      <div className="timetable">
        <div className="tt-head" style={{ gridColumn: 1, gridRow: 1 }}>Tiết</div>
        {THU_LABEL.map((t, i) => (
          <div key={t} className="tt-head" style={{ gridColumn: i + 2, gridRow: 1 }}>{t}</div>
        ))}
        {Array.from({ length: SO_TIET }, (_, i) => (
          <div key={i} className="tt-tiet" style={{ gridColumn: 1, gridRow: i + 2 }}>Tiết {i + 1}</div>
        ))}
        {Array.from({ length: SO_TIET * 7 }, (_, i) => {
          const col = (i % 7) + 2;
          const row = Math.floor(i / 7) + 2;
          return <div key={i} className="tt-cell" style={{ gridColumn: col, gridRow: row }} />;
        })}
        {cells}
      </div>
      {unplaced.length > 0 && (
        <p className="hint">
          Lịch chưa xếp: {unplaced.map((r) => `${r.TENHP} (${r.MALHP})`).join(", ")}
        </p>
      )}
    </div>
  );
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
              {lops.length === 0 && <tr><td colSpan={7} className="empty">Không có lớp học phần nào mở trong học kỳ này</td></tr>}
              {lops.map((l) => {
                const daDk = dangky.some((d) => d.MALHP === l.MALHP);
                return (
                  <tr key={l.MALHP}>
                    <td className="mono">{l.MALHP}</td>
                    <td>{l.TENHP} <span className="hint">({l.MAHP})</span></td>
                    <td className="num">{l.SOTINCHI}</td>
                    <td>{l.TENGV}</td>
                    <td>{fmtLich(l)}{l.PHONGHOC ? `, phòng ${l.PHONGHOC}` : ""}</td>
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
        <div>
          <div className="transcript-strip">
            <div className="cell">
              <div className="num">{dangky.length}</div>
              <div className="lbl">Lớp đang theo học</div>
            </div>
            <div className="cell">
              <div className="num">{tongTC}</div>
              <div className="lbl">Tín chỉ học kỳ này</div>
            </div>
            <div className="cell">
              <div className="num">{mahk || "–"}</div>
              <div className="lbl">Học kỳ</div>
            </div>
          </div>
          {dangky.length === 0
            ? <div className="table-wrap"><table><tbody><tr><td className="empty">Chưa đăng ký lớp nào trong học kỳ này — quay lại mục Đăng ký học phần để chọn lớp</td></tr></tbody></table></div>
            : <Timetable rows={dangky} />}
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
      <div className="transcript-strip">
        <div className="cell">
          <div className="num">{data.tong.gpa4 ?? "–"}</div>
          <div className="lbl">GPA hệ 4 toàn khoá</div>
        </div>
        <div className="cell">
          <div className="num">{data.tong.cpa10 ?? "–"}<small> /10</small></div>
          <div className="lbl">CPA hệ 10 toàn khoá</div>
        </div>
        <div className="cell">
          <div className="num">{data.tong.tinchi_dat}</div>
          <div className="lbl">Tín chỉ đã đạt</div>
        </div>
      </div>
      {data.hockys.map((hk) => (
        <div key={hk.mahk} className="card">
          <h3>
            {hk.mahk}, GPA {hk.gpa4 != null ? hk.gpa4.toFixed(2) : null}/4, CPA {hk.cpa10 != null ? hk.cpa10.toFixed(2) : null}/10
            {hk.gpa4 == null && <span className="hint"> (chưa có điểm)</span>}
          </h3>
          <div className="table-wrap" style={{ marginBottom: 0 }}>
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
