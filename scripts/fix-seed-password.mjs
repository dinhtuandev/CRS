// Chạy một lần sau khi MySQL init xong (docker compose gọi service seed-fix):
//  - sinh bcrypt hash cho mật khẩu demo "123456"
//  - thay chỗ trống __BCRYPT__ trong 03_seed.sql (để lần init sau có sẵn hash)
//  - PATCH ngay dữ liệu TAIKHOAN đang chạy (nếu chưa patch)
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const seedPath = "/opt/db/03_seed.sql";
const PLACEHOLDER = "__BCRYPT__";

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8" });
}

let connection;
async function mysql(sql) {
  if (!connection) {
    const mysqlClient = await import("/tmp/node_modules/mysql2/promise.js");
    connection = await mysqlClient.default.createConnection({
      host: "db",
      port: 3307,
      user: "root",
      password: "root123",
      charset: "utf8mb4",
    });
  }
  const [rows] = await connection.query(sql);
  return rows;
}

async function waitForSeed() {
  let lastError;
  for (let attempt = 1; attempt <= 60; attempt++) {
    try {
      const rows = await mysql("SELECT COUNT(*) AS n FROM qlhocphan.TAIKHOAN;");
      if (Number(rows[0]?.n ?? 0) >= 11) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw lastError || new Error("Seed initialization timed out");
}

// 1. Sinh bcrypt hash (cài bcryptjs vào /tmp vì image node-alpine không có sẵn)
sh("npm", ["--prefix", "/tmp", "install", "bcryptjs@3", "mysql2@3", "--no-audit", "--no-fund", "--silent"]);
const { hashSync } = await import("/tmp/node_modules/bcryptjs/index.js");
const hash = hashSync("123456", 10);
console.log("bcrypt hash OK:", hash.slice(0, 7) + "...");

// 2. Patch file seed nếu còn placeholder
if (fs.existsSync(seedPath) && fs.readFileSync(seedPath, "utf8").includes(PLACEHOLDER)) {
  fs.writeFileSync(seedPath, fs.readFileSync(seedPath, "utf8").replaceAll(PLACEHOLDER, hash));
  console.log("Patched 03_seed.sql");
}

await waitForSeed();

// 3. Patch DB đang chạy nếu còn placeholder
const placeholderRows = await mysql(
  "SELECT COUNT(*) AS n FROM qlhocphan.TAIKHOAN WHERE MATKHAU_HASH='__BCRYPT__';"
);
const needPatch = Number(placeholderRows[0]?.n ?? 0) > 0;
if (needPatch) {
  const escaped = hash.replace(/'/g, "''");
  await mysql(
    `UPDATE qlhocphan.TAIKHOAN SET MATKHAU_HASH='${escaped}' WHERE MATKHAU_HASH='__BCRYPT__';`
  );
  console.log("Patched TAIKHOAN rows");
} else {
  console.log("TAIKHOAN already patched");
}
if (connection) await connection.end();
