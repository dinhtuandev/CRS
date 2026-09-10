import { Router } from "express";
import { query } from "../db.js";
import { authRequired, roleRequired } from "../middleware.js";

const router = Router();
router.use(authRequired, roleRequired("admin"));

// ---------- Danh mục: CRUD chung ----------
const CATALOG = {
  khoa: { table: "KHOA", pk: "MAKHOA", cols: ["MAKHOA", "TENKHOA"] },
  giangvien: { table: "GIANGVIEN", pk: "MAGV", cols: ["MAGV", "HOTEN", "NGAYSINH", "GIOITINH", "HOCVI", "MAKHOA", "EMAIL"] },
  sinhvien: { table: "SINHVIEN", pk: "MASV", cols: ["MASV", "HOTEN", "NGAYSINH", "GIOITINH", "MAKHOA", "NGAYNHAPHOC", "TRANGTHAI"] },
  hocphan: { table: "HOCPHAN", pk: "MAHP", cols: ["MAHP", "TENHP", "SOTINCHI", "SOTIETLT", "SOTIETTH", "LOAIHP", "MAKHOA"] },
  hocky: {
    table: "HOCKY", pk: "MAHK",
    cols: ["MAHK", "NAMHOC", "HOCKYTHU", "NGAYBATDAU", "NGAYKETTHUC", "HANDANGKY_BD", "HANDANGKY_KT", "KHOADIEM"],
  },
  lophocphan: {
    table: "LOPHOCPHAN", pk: "MALHP",
    cols: ["MALHP", "MAHP", "MAHK", "MAGV", "SISOMAX", "PHONGHOC", "THU", "TIETBATDAU", "SOTIET", "TRANGTHAI"],
  },
};

//Annotate Swagger cho các route /api/admin/{table} (CRUD)
/**
 * @swagger
 * /api/admin/{table}:
 *   get:
 *     summary: "Lấy tất cả bản ghi của một bảng (role: admin)"
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema:
 *           type: string
 *           enum: [khoa, giangvien, sinhvien, hocphan, hocky, lophocphan]
 *     responses:
 *       200:
 *         description: Mảng bản ghi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { type: object }
 *       403:
 *         description: Yêu cầu quyền admin
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *
 *   post:
 *     summary: "Thêm bản ghi mới vào một bảng (role: admin)"
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema:
 *           type: string
 *           enum: [khoa, giangvien, sinhvien, hocphan, hocky, lophocphan]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Đối tượng JSON với key = tên cột (UPPERCASE hoặc lowercase)
 *     responses:
 *       200:
 *         description: Thêm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã thêm" }
 *       400:
 *         description: Trùng khóa / lỗi ràng buộc
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */

/**
 * @swagger
 * /api/admin/{table}/{id}:
 *   put:
 *     summary: "Cập nhật bản ghi (role: admin)"
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema:
 *           type: string
 *           enum: [khoa, giangvien, sinhvien, hocphan, hocky, lophocphan]
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Các trường cần cập nhật (trừ PK)
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã cập nhật" }
 *
 *   delete:
 *     summary: "Xoá bản ghi (role: admin)"
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema:
 *           type: string
 *           enum: [khoa, giangvien, sinhvien, hocphan, hocky, lophocphan]
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xoá thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã xoá" }
 *       400:
 *         description: Có dữ liệu liên quan, không thể xoá
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
for (const [name, { table, pk, cols }] of Object.entries(CATALOG)) {
  router.get(`/admin/${name}`, async (_req, res, next) => {
    try { res.json(await query(`SELECT * FROM ${table}`)); } catch (e) { next(e); }
  });

  router.post(`/admin/${name}`, async (req, res, next) => {
    try {
      const vals = cols.map((c) => req.body[c.toLowerCase()] ?? req.body[c] ?? null);
      const ph = cols.map(() => "?").join(", ");
      await query(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${ph})`, vals);
      res.json({ message: "Đã thêm" });
    } catch (e) { next(e); }
  });

  router.put(`/admin/${name}/:id`, async (req, res, next) => {
    try {
      const nonPk = cols.filter((c) => c !== pk);
      const sets = nonPk.map((c) => `${c} = ?`).join(", ");
      const vals = nonPk.map((c) => req.body[c.toLowerCase()] ?? req.body[c] ?? null);
      vals.push(req.params.id);
      await query(`UPDATE ${table} SET ${sets} WHERE ${pk} = ?`, vals);
      res.json({ message: "Đã cập nhật" });
    } catch (e) { next(e); }
  });

  router.delete(`/admin/${name}/:id`, async (req, res, next) => {
    try {
      await query(`DELETE FROM ${table} WHERE ${pk} = ?`, [req.params.id]);
      res.json({ message: "Đã xoá" });
    } catch (e) { next(e); }
  });
}
// Annotation Swagger cho route /api/hocky/{mahk}/cuaso-dangky (put)
/**
 * @swagger
 * /api/hocky/{mahk}/cuaso-dangky:
 *   put:
 *     summary: "Mở/đóng cửa sổ đăng ký học kỳ (role: admin)"
 *     tags: [HocKy]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: mahk
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mo:
 *                 type: boolean
 *                 description: true = mở cửa sổ từ bây giờ + 14 ngày; false = đóng ngay
 *                 example: true
 *     responses:
 *       200:
 *         description: Mở/đóng thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã mở đăng ký" }
 */

// ---------- Mở/đóng cửa sổ đăng ký theo học kỳ ----------
router.put("/hocky/:mahk/cuaso-dangky", async (req, res, next) => {
  try {
    const { mo } = req.body || {}; // mo=true → mở từ bây giờ + 14 ngày; mo=false → đóng ngay
    if (mo) {
      await query(
        "UPDATE HOCKY SET HANDANGKY_BD = NOW() - INTERVAL 1 MINUTE, HANDANGKY_KT = NOW() + INTERVAL 14 DAY WHERE MAHK = ?",
        [req.params.mahk]
      );
    } else {
      await query("UPDATE HOCKY SET HANDANGKY_KT = NOW() - INTERVAL 1 MINUTE WHERE MAHK = ?", [req.params.mahk]);
    }
    res.json({ message: mo ? "Đã mở đăng ký" : "Đã đóng đăng ký" });
  } catch (e) { next(e); }
});

//Annotation Swagger cho route /api/hocky/{mahk}/khoadiem (put)
/**
 * @swagger
 * /api/hocky/{mahk}/khoadiem:
 *   put:
 *     summary: "Khoá/mở khoá bảng điểm học kỳ (role: admin)"
 *     tags: [HocKy]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: mahk
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               khoa:
 *                 type: boolean
 *                 description: true = khoá bảng điểm; false = mở khoá
 *                 example: true
 *     responses:
 *       200:
 *         description: Khoá/mở khoá thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã khoá bảng điểm" }
 */

// ---------- Khoá/mở khoá bảng điểm học kỳ ----------
router.put("/hocky/:mahk/khoadiem", async (req, res, next) => {
  try {
    const khoa = req.body?.khoa ? 1 : 0;
    await query("UPDATE HOCKY SET KHOADIEM = ? WHERE MAHK = ?", [khoa, req.params.mahk]);
    res.json({ message: khoa ? "Đã khoá bảng điểm" : "Đã mở khoá bảng điểm" });
  } catch (e) { next(e); }
});

// Annotation Swagger cho route /api/thongke (get)
/**
 * @swagger
 * /api/thongke:
 *   get:
 *     summary: "Thống kê lấp đầy lớp + SV cảnh báo học vụ (role: admin)"
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kết quả thống kê
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 lop:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       MALHP: { type: string }
 *                       TENHP: { type: string }
 *                       MAHK: { type: string }
 *                       SISOMAX: { type: integer }
 *                       SISO_HIENTAI: { type: integer }
 *                       CONCHO: { type: integer }
 *                       PHANTRAM_LAPDAY: { type: number, format: float }
 *                 canhbao:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       MASV: { type: string }
 *                       HOTEN: { type: string }
 *                       MAKHOA: { type: string }
 *                       CPA10: { type: number, nullable: true, format: float }
 *                       CPA4: { type: number, nullable: true, format: float }
 */


// ---------- Thống kê: tỷ lệ lấp đầy + SV cảnh báo học vụ (CPA < 2.0) ----------
router.get("/thongke", async (_req, res, next) => {
  try {
    const lop = await query(
      `SELECT MALHP, TENHP, MAHK, SISOMAX, SISO_HIENTAI, CONCHO,
              ROUND(SISO_HIENTAI / SISOMAX * 100, 1) AS PHANTRAM_LAPDAY
         FROM v_lophocphan_concho
        ORDER BY PHANTRAM_LAPDAY DESC`
    );
    const canhbao = await query(
      `SELECT sv.MASV, sv.HOTEN, sv.MAKHOA,
              ROUND(SUM(CASE WHEN dk.DIEMHE10 >= 4 THEN dk.DIEMHE10 * h.SOTINCHI ELSE 0 END)
                    / NULLIF(SUM(CASE WHEN dk.DIEMHE10 >= 4 THEN h.SOTINCHI ELSE 0 END), 0), 2) AS CPA10,
              ROUND(SUM(CASE WHEN dk.DIEMHE10 >= 4 THEN dk.DIEMHE4 * h.SOTINCHI ELSE 0 END)
                    / NULLIF(SUM(CASE WHEN dk.DIEMHE10 >= 4 THEN h.SOTINCHI ELSE 0 END), 0), 2) AS CPA4
         FROM SINHVIEN sv
         LEFT JOIN DANGKYHOCPHAN dk ON dk.MASV = sv.MASV AND dk.TRANGTHAI = 'đăng ký'
         LEFT JOIN LOPHOCPHAN l ON l.MALHP = dk.MALHP
         LEFT JOIN HOCPHAN h ON h.MAHP = l.MAHP
        GROUP BY sv.MASV, sv.HOTEN, sv.MAKHOA
       HAVING CPA10 IS NULL OR CPA10 < 2.0
        ORDER BY CPA10 ASC`
    );
    res.json({ lop, canhbao });
  } catch (e) { next(e); }
});

export default router;
