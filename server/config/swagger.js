import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cấu hình chung — được biên tập từ các annotation @swagger trong route files
export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "QLHP API — Quản lý học phần tín chỉ",
      version: "1.0.0",
      description: `
API quản lý đăng ký học phần theo hệ tín chỉ.
- 3 vai trò: **sinhvien** / **giangvien** / **admin**
- Xác thực: JWT Bearer token (nhận từ \`POST /api/auth/login\`, thời hạn 8h)
- Mật khẩu demo: **123456**

> Nhấn nút **Authorize** ở góc trên và dán CHỈ phần token (bắt đầu bằng \`eyJ…\`) — UI tự thêm chữ \`Bearer\`. Dán cả chuỗi \`Bearer eyJ…\` sẽ bị 401.
`,
    },
    servers: [
      { url: "http://localhost:3000", description: "Local dev" },
      {
        url: "http://localhost:8080",
        description: "Production (qua nginx proxy)",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        // Định nghĩa schema dùng chung
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string", description: "Thông báo lỗi tiếng Việt" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            token: { type: "string", description: "JWT token để gọi API khác" },
            vaitro: {
              type: "string",
              enum: ["sinhvien", "giangvien", "admin"],
            },
            masv: { type: "string", nullable: true },
            magv: { type: "string", nullable: true },
            ten: { type: "string" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Các file chứa annotation @swagger
  apis: [
    path.join(__dirname, "../routes/auth.js"),
    path.join(__dirname, "../routes/sinhvien.js"),
    path.join(__dirname, "../routes/giangvien.js"),
    path.join(__dirname, "../routes/admin.js"),
  ],
});

// Hàm middleware để đăng ký Swagger UI
// Đặt SWAGGER_ENABLED=false trong .env để tắt UI ở môi trường production
export function setupSwagger(app) {
  if (process.env.SWAGGER_ENABLED === "false") {
    console.log("Swagger UI bị tắt (SWAGGER_ENABLED=false)");
    return;
  }
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: ".swagger-ui-logo { display: none; }",
      customFavicon: false,
    }),
  );
}
