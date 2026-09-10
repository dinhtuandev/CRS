import express from "express";
import "dotenv/config";
import { setupSwagger } from "./config/swagger.js";
import authRoutes from "./routes/auth.js";
import sinhvienRoutes from "./routes/sinhvien.js";
import giangvienRoutes from "./routes/giangvien.js";
import adminRoutes from "./routes/admin.js";

const app = express();
app.use(express.json());

//đăng ký Swagger UI
setupSwagger(app);

// CORS cho Vite dev server (5173)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Các route chính
app.use("/api/auth", authRoutes);
app.use("/api", sinhvienRoutes);
app.use("/api", giangvienRoutes);
app.use("/api", adminRoutes);

// Bắt lỗi từ SIGNAL SQLSTATE 45000 — trả message tiếng Việt gốc
app.use((err, req, res, _next) => {
  const msg = err?.sqlMessage || err?.message || "Lỗi không xác định";
  const isBusiness = err?.sqlState === "45000" || err?.errno === 1644;
  if (isBusiness) return res.status(400).json({ error: msg });
  if (err?.code === "ER_DUP_ENTRY" || err?.errno === 1062)
    return res.status(400).json({ error: "Dữ liệu trùng (mã đã tồn tại)" });
  if (err?.code === "ER_NO_REFERENCED_ROW_2" || err?.errno === 1452)
    return res.status(400).json({ error: "Dữ liệu tham chiếu không hợp lệ" });
  if (
    err?.code === "ER_ROW_IS_REFERENCED_2" ||
    err?.code === "ER_ROW_IS_REFERENCED" ||
    err?.errno === 1451 ||
    err?.errno === 1217
  )
    return res.status(400).json({ error: "Không xoá được: đã có dữ liệu liên quan" });
  console.error(err);
  return res.status(500).json({ error: msg });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
