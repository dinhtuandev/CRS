import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { query } from "../db.js";
import { authRequired } from "../middleware.js";

const SECRET = process.env.JWT_SECRET || "dev-secret";
const router = Router();

//Annotation Swagger cho route /api/auth (Post)
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tendangnhap
 *               - matkhau
 *             properties:
 *               tendangnhap:
 *                 type: string
 *                 example: sv001
 *               matkhau:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Thiếu trường
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Sai tên đăng nhập hoặc mật khẩu
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/login", async (req, res, next) => {
  try {
    const { tendangnhap, matkhau } = req.body || {};
    if (!tendangnhap || !matkhau)
      return res.status(400).json({ error: "Thiếu tên đăng nhập hoặc mật khẩu" });

    const rows = await query(
      `SELECT t.MATK, t.TENDANGNHAP, t.MATKHAU_HASH, t.VAITRO, t.MASV, t.MAGV,
              sv.HOTEN AS TEN_SV, gv.HOTEN AS TEN_GV
         FROM TAIKHOAN t
         LEFT JOIN SINHVIEN sv ON sv.MASV = t.MASV
         LEFT JOIN GIANGVIEN gv ON gv.MAGV = t.MAGV
        WHERE t.TENDANGNHAP = ?`,
      [tendangnhap]
    );
    const tk = rows[0];
    if (!tk) return res.status(401).json({ error: "Sai tên đăng nhập hoặc mật khẩu" });

    const ok = await bcrypt.compare(matkhau, tk.MATKHAU_HASH);
    if (!ok) return res.status(401).json({ error: "Sai tên đăng nhập hoặc mật khẩu" });

    const token = jwt.sign(
      { matk: tk.MATK, vaitro: tk.VAITRO, masv: tk.MASV, magv: tk.MAGV, ten: tk.TEN_SV || tk.TEN_GV || tk.TENDANGNHAP },
      SECRET,
      { expiresIn: "8h" }
    );
    res.json({ token, vaitro: tk.VAITRO, masv: tk.MASV, magv: tk.MAGV, ten: tk.TEN_SV || tk.TEN_GV || tk.TENDANGNHAP });
  } catch (e) {
    next(e);
  }
});
//Annotation Swagger cho route /api/auth/me (Get)
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Lấy thông tin tài khoản hiện tại
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin người dùng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vaitro:
 *                   type: string
 *                   enum: [sinhvien, giangvien, admin]
 *                 masv:
 *                   type: string
 *                   nullable: true
 *                 magv:
 *                   type: string
 *                   nullable: true
 *                 ten:
 *                   type: string
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/me", authRequired, (req, res) => {
  res.json({ vaitro: req.user.vaitro, masv: req.user.masv, magv: req.user.magv, ten: req.user.ten });
});

export default router;
