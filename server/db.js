import mysql from "mysql2/promise";
import "dotenv/config";

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "app_qlhp",
  password: process.env.DB_PASSWORD || "app_qlhp_pass",
  database: process.env.DB_NAME || "qlhocphan",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
  namedPlaceholders: true,
});

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}
