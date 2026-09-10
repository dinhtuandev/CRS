import { Router } from "express";
import { query } from "../db.js";
import { authRequired, roleRequired } from "../middleware.js";

const router = Router();
//Annotation Swagger cho route /api/lop-cua-toi (get)
/**
 * @swagger
 * /api/lop-cua-toi:
 *   get:
 *     summary: "Lớp học phần giảng viên đang phụ trách (role: giangvien)"
 *     tags: [GiangVien]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách lớp học phần còn chỗ
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
 *                   SISOMAX: { type: integer }
 *                   SISO_HIENTAI: { type: integer }
 *                   CONCHO: { type: integer }
 */
// Các lớp học phần giảng viên đang phụ trách
router.get("/lop-cua-toi", authRequired, roleRequired("giangvien"), async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT v.MALHP, v.MAHP, v.TENHP, v.SOTINCHI, v.MAHK, v.SISOMAX, v.SISO_HIENTAI, v.CONCHO
         FROM v_lophocphan_concho v
        WHERE v.MAGV = ?
        ORDER BY v.MAHK DESC, v.MAHP`,
      [req.user.magv]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Annotation Swagger cho route /api/lophocphan/:malhp/sinhvien (get)
/**
 * @swagger
 * /api/lophocphan/{malhp}/sinhvien:
 *   get:
 *     summary: "Danh sách SV + điểm trong một lớp (role: giangvien)"
 *     tags: [GiangVien]
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
 *         description: Danh sách sinh viên + điểm
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   MASV: { type: string }
 *                   HOTEN: { type: string }
 *                   LANHOC: { type: string }
 *                   DIEMCHUYENCAN: { type: number, nullable: true, format: float }
 *                   DIEMGIUAKY: { type: number, nullable: true, format: float }
 *                   DIEMCUOIKY: { type: number, nullable: true, format: float }
 *                   DIEMHE10: { type: number, nullable: true, format: float }
 *                   DIEMCHU: { type: string, nullable: true }
 *                   DIEMHE4: { type: number, nullable: true, format: float }
 *       403:
 *         description: Không phải giảng viên phụ trách lớp này
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
// Danh sách SV + điểm hiện tại của 1 lớp (chỉ lớp mình phụ trách)
router.get("/lophocphan/:malhp/sinhvien", authRequired, roleRequired("giangvien"), async (req, res, next) => {
  try {
    const chk = await query("SELECT MAGV FROM LOPHOCPHAN WHERE MALHP = ?", [req.params.malhp]);
    if (!chk[0] || chk[0].MAGV !== req.user.magv)
      return res.status(403).json({ error: "Bạn không phụ trách lớp học phần này" });

    const rows = await query(
      `SELECT dk.MASV, sv.HOTEN, dk.LANHOC,
              dk.DIEMCHUYENCAN, dk.DIEMGIUAKY, dk.DIEMCUOIKY, dk.DIEMHE10, dk.DIEMCHU, dk.DIEMHE4
         FROM DANGKYHOCPHAN dk
         JOIN SINHVIEN sv ON sv.MASV = dk.MASV
        WHERE dk.MALHP = ? AND dk.TRANGTHAI = 'đăng ký'
        ORDER BY dk.MASV`,
      [req.params.malhp]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

//Annotation Swagger cho route /api/diem (put)
/**
 * @swagger
 * /api/diem:
 *   put:
 *     summary: "Nhập điểm sinh viên (role: giangvien)"
 *     tags: [GiangVien]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [masv, malhp, diemchuyencan, diemgiuaky, diemcuoiky]
 *             properties:
 *               masv: { type: string, example: "SV001" }
 *               malhp: { type: string, example: "LHP01" }
 *               diemchuyencan: { type: number, format: float, minimum: 0, maximum: 10 }
 *               diemgiuaky: { type: number, format: float, minimum: 0, maximum: 10 }
 *               diemcuoiky: { type: number, format: float, minimum: 0, maximum: 10 }
 *     responses:
 *       200:
 *         description: Lưu điểm thành công (DB tự tính DIEMHE10, DIEMCHU, DIEMHE4)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã lưu điểm" }
 *       400:
 *         description: Thiếu MASV/MALHP, điểm ngoài 0–10, bảng điểm đã khoá, SV chưa đăng ký
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       403:
 *         description: Không phải giảng viên phụ trách lớp
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Lớp học phần không tồn tại
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */

// Nhập điểm qua procedure — DB tự tính DIEMHE10/CHU/HE4 qua trigger
router.put("/diem", authRequired, roleRequired("giangvien"), async (req, res, next) => {
  const { masv, malhp, diemchuyencan, diemgiuaky, diemcuoiky } = req.body || {};
  if (!masv || !malhp)
    return res.status(400).json({ error: "Thiếu MASV/MALHP" });

  // Ràng buộc (8): chỉ GV phụ trách lớp đó được nhập điểm
  const chk = await query("SELECT MAGV, MAHK FROM LOPHOCPHAN WHERE MALHP = ?", [malhp]);
  if (!chk[0]) return res.status(404).json({ error: "Lớp học phần không tồn tại" });
  if (chk[0].MAGV !== req.user.magv)
    return res.status(403).json({ error: "Chỉ giảng viên phụ trách lớp mới được nhập điểm" });

  try {
    await query("CALL sp_nhap_diem(?, ?, ?, ?, ?)", [masv, malhp, diemchuyencan, diemgiuaky, diemcuoiky]);
    res.json({ message: "Đã lưu điểm" });
  } catch (e) {
    if (e.errno === 1644 || e.sqlState === "45000")
      return res.status(400).json({ error: e.sqlMessage || e.message });
    next(e);
  }
});

export default router;
