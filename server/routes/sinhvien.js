import { Router } from "express";
import { query } from "../db.js";
import { authRequired, roleRequired } from "../middleware.js";

const router = Router();
// Annotation Swagger cho route /api/lophocphan (Get)
/**
 * @swagger
 * /api/lophocphan:
 *   get:
 *     summary: Lấy danh sách lớp học phần còn chỗ (theo học kỳ)
 *     tags: [SinhVien]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: mahk
 *         schema:
 *           type: string
 *           nullable: true
 *         description: Mã học kỳ, nếu bỏ qua sẽ trả tất cả
 *         example: HK01
 *     responses:
 *       200:
 *         description: Danh sách lớp học phần
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   MALHP: { type: string }
 *                   MAHP: { type: string }
 *                   TENHP: { type: string }
 *                   SOTINCHI: { type: integer }
 *                   MAHK: { type: string }
 *                   MAGV: { type: string }
 *                   TENGV: { type: string }
 *                   SISOMAX: { type: integer }
 *                   SISO_HIENTAI: { type: integer }
 *                   CONCHO: { type: integer }
 */
// Lớp học phần còn chỗ trong 1 học kỳ (dùng view v_lophocphan_concho)
router.get("/lophocphan", authRequired, async (req, res, next) => {
  try {
    const mahk = req.query.mahk;
    const rows = await query(
      `SELECT v.MALHP, v.MAHP, v.TENHP, v.SOTINCHI, v.MAHK, v.MAGV, v.TENGV,
              v.SISOMAX, v.SISO_HIENTAI, v.CONCHO,
              l.THU, l.TIETBATDAU, l.SOTIET, l.PHONGHOC
         FROM v_lophocphan_concho v
         JOIN LOPHOCPHAN l ON l.MALHP = v.MALHP
        WHERE (? IS NULL OR v.MAHK = ?)
        ORDER BY v.MAHK, v.MAHP`,
      [mahk ?? null, mahk ?? null]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Annotation Swagger cho route /api/dangky (Post)
/**
 * @swagger
 * /api/dangky:
 *   post:
 *     summary: "Đăng ký học phần (role: sinh viên)"
 *     tags: [SinhVien]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [malhp]
 *             properties:
 *               malhp:
 *                 type: string
 *                 example: LHP01
 *               lanhoc:
 *                 type: string
 *                 enum: ["lần 1", "học lại", "cải thiện"]
 *                 default: "lần 1"
 *     responses:
 *       200:
 *         description: Đăng ký thành công (có thể kèm cảnh báo nếu < 12 tín chỉ)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đăng ký thành công" }
 *                 canhbao:
 *                   type: string
 *                   nullable: true
 *                   example: "Tổng mới 8 tín chỉ, chưa đủ tối thiểu 12 tín chỉ một học kỳ"
 *       400:
 *         description: Lỗi nghiệp vụ (thiếu malhp, hết chỗ, trùng lịch, chưa xong tiên quyết, ...)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
// Gọi stored procedure đăng ký — retry 2 lần khi gặp deadlock 1213 (mục 1.8 tài liệu)
router.post("/dangky", authRequired, roleRequired("sinhvien"), async (req, res, next) => {
  const { malhp, lanhoc } = req.body || {};
  if (!malhp) return res.status(400).json({ error: "Thiếu mã lớp học phần" });
  const lanhocValid = ["lần 1", "học lại", "cải thiện"];
  const lan = lanhocValid.includes(lanhoc) ? lanhoc : "lần 1";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await query("CALL sp_dangky_hocphan(?, ?, ?)", [req.user.masv, malhp, lan]);
      const totalRows = await query(
        `SELECT COALESCE(SUM(h.SOTINCHI), 0) AS tong
           FROM DANGKYHOCPHAN dk
           JOIN LOPHOCPHAN l ON l.MALHP = dk.MALHP
           JOIN HOCPHAN h ON h.MAHP = l.MAHP
          WHERE dk.MASV = ? AND dk.TRANGTHAI = 'đăng ký'
            AND l.MAHK = (SELECT MAHK FROM LOPHOCPHAN WHERE MALHP = ?)`,
        [req.user.masv, malhp]
      );
      const tong = Number(totalRows[0]?.tong ?? 0);
      if (tong < 12) {
        return res.json({ message: "Đăng ký thành công", canhbao: `Tổng mới ${tong} tín chỉ, chưa đủ tối thiểu 12 tín chỉ một học kỳ` });
      }
      return res.json({ message: "Đăng ký thành công" });
    } catch (e) {
      // 1213 = deadlock, InnoDB đã rollback 1 transaction — đăng ký lại được
      if ((e.errno === 1213 || e.sqlState === "40001") && attempt < 3) continue;
      // 1644 = SIGNAL 45000 từ nghiệp vụ
      if (e.errno === 1644 || e.sqlState === "45000")
        return res.status(400).json({ error: e.sqlMessage || e.message });
      return next(e);
    }
  }
});

// Annotation Swagger cho route /api/dangky/:malhp (Delete)
/**
 * @swagger
 * /api/dangky/{malhp}:
 *   delete:
 *     summary: "Hủy đăng ký học phần (role: sinh viên)"
 *     tags: [SinhVien]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: malhp
 *         required: true
 *         schema:
 *           type: string
 *           example: LHP01
 *     responses:
 *       200:
 *         description: Hủy thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã huỷ đăng ký" }
 *       400:
 *         description: Đã có điểm / ngoài thời gian / lớp không tồn tại
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
// Huỷ đăng ký qua procedure
router.delete("/dangky/:malhp", authRequired, roleRequired("sinhvien"), async (req, res, next) => {
  try {
    await query("CALL sp_huy_dangky(?, ?)", [req.user.masv, req.params.malhp]);
    res.json({ message: "Đã huỷ đăng ký" });
  } catch (e) {
    if (e.errno === 1644 || e.sqlState === "45000")
      return res.status(400).json({ error: e.sqlMessage || e.message });
    next(e);
  }
});

// Annotation Swagger cho route /api/thoikhoabieu (Get)
/**
 * @swagger
 * /api/thoikhoabieu:
 *   get:
 *     summary: "Lấy thời khóa biểu cá nhân (role: sinh viên)"
 *     tags: [SinhVien]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: mahk
 *         schema:
 *           type: string
 *           nullable: true
 *         description: Lọc theo mã học kỳ
 *         example: HK01
 *     responses:
 *       200:
 *         description: Danh sách lớp đã đăng ký
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   MALHP: { type: string }
 *                   MAHP: { type: string }
 *                   TENHP: { type: string }
 *                   THU: { type: integer, nullable: true }
 *                   TIETBATDAU: { type: integer, nullable: true }
 *                   SOTIET: { type: integer, nullable: true }
 *                   PHONGHOC: { type: string, nullable: true }
 *                   TENGV: { type: string }
 *                   MAHK: { type: string }
 *                   TRANGTHAI: { type: string, example: "đăng ký" }
 */

// Thời khoá biểu cá nhân theo học kỳ
router.get("/thoikhoabieu", authRequired, roleRequired("sinhvien"), async (req, res, next) => {
  try {
    const mahk = req.query.mahk ?? null;
    const rows = await query(
      `SELECT dk.MALHP, l.MAHP, h.TENHP, l.THU, l.TIETBATDAU, l.SOTIET, l.PHONGHOC,
              g.HOTEN AS TENGV, l.MAHK, dk.TRANGTHAI
         FROM DANGKYHOCPHAN dk
         JOIN LOPHOCPHAN l ON l.MALHP = dk.MALHP
         JOIN HOCPHAN h ON h.MAHP = l.MAHP
         JOIN GIANGVIEN g ON g.MAGV = l.MAGV
        WHERE dk.MASV = ? AND dk.TRANGTHAI = 'đăng ký'
          AND (? IS NULL OR l.MAHK = ?)
        ORDER BY l.MAHK, l.THU, l.TIETBATDAU`,
      [req.user.masv, mahk, mahk]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

//Announcement Swagger cho route /api/bangdiem (Get)
/**
 * @swagger
 * /api/bangdiem:
 *   get:
 *     summary: "Bảng điểm + GPA hệ 4 & CPA hệ 10 (role: sinh viên)"
 *     tags: [SinhVien]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bảng điểm gộp theo học kỳ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hockys:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       mahk: { type: string }
 *                       namhoc: { type: string }
 *                       hockythu: { type: integer }
 *                       gpa4: { type: number, nullable: true, format: float }
 *                       cpa10: { type: number, nullable: true, format: float }
 *                       monhoc: { type: array, items: { type: object } }
 *                 tong:
 *                   type: object
 *                   properties:
 *                     gpa4: { type: number, nullable: true }
 *                     cpa10: { type: number, nullable: true }
 *                     tinchi_dat: { type: integer }
 */
// Bảng điểm + GPA hệ 4 & CPA hệ 10, gộp theo học kỳ
router.get("/bangdiem", authRequired, roleRequired("sinhvien"), async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT MAHK, NAMHOC, HOCKYTHU, MAHP, TENHP, SOTINCHI, LANHOC,
              DIEMCHUYENCAN, DIEMGIUAKY, DIEMCUOIKY, DIEMHE10, DIEMCHU, DIEMHE4
         FROM v_bangdiem_sinhvien
        WHERE MASV = ? AND TRANGTHAI = 'đăng ký'
        ORDER BY NAMHOC, HOCKYTHU, MAHP`,
      [req.user.masv]
    );

    const hockys = [];
    const byHk = new Map();
    for (const r of rows) {
      if (!byHk.has(r.MAHK)) {
        const hk = { mahk: r.MAHK, namhoc: r.NAMHOC, hockythu: r.HOCKYTHU, monhoc: [], gpa4: null, cpa10: null };
        byHk.set(r.MAHK, hk);
        hockys.push(hk);
      }
      byHk.get(r.MAHK).monhoc.push(r);
    }

    let sumHe4 = 0, sumTin4 = 0, sumHe10 = 0, sumTin10 = 0;
    for (const hk of hockys) {
      let s4 = 0, t4 = 0, s10 = 0, t10 = 0;
      for (const m of hk.monhoc) {
        if (m.DIEMHE4 != null) { s4 += Number(m.DIEMHE4) * m.SOTINCHI; t4 += m.SOTINCHI; }
        if (m.DIEMHE10 != null) { s10 += Number(m.DIEMHE10) * m.SOTINCHI; t10 += m.SOTINCHI; }
      }
      hk.gpa4 = t4 ? Number((s4 / t4).toFixed(2)) : null;
      hk.cpa10 = t10 ? Number((s10 / t10).toFixed(2)) : null;
      sumHe4 += s4; sumTin4 += t4; sumHe10 += s10; sumTin10 += t10;
    }

    res.json({
      hockys,
      tong: {
        gpa4: sumTin4 ? Number((sumHe4 / sumTin4).toFixed(2)) : null,
        cpa10: sumTin10 ? Number((sumHe10 / sumTin10).toFixed(2)) : null,
        tinchi_dat: rows.filter((r) => r.DIEMHE10 >= 4).reduce((a, r) => a + r.SOTINCHI, 0),
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
