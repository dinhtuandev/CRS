import jwt from "jsonwebtoken";
import "dotenv/config";

const SECRET = process.env.JWT_SECRET || "dev-secret";

export function authRequired(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return res.status(401).json({ error: "Chưa đăng nhập" });
  try {
    req.user = jwt.verify(h.slice(7), SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token không hợp lệ hoặc hết hạn" });
  }
}

export function roleRequired(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (!roles.includes(req.user.vaitro))
      return res.status(403).json({ error: "Không có quyền thực hiện thao tác này" });
    next();
  };
}
