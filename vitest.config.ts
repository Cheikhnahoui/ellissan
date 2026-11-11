import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false, // tests share one real PostgreSQL database
    testTimeout: 20000,
    env: { QR_TOKEN_SECRET: "test-secret-test-secret-test-secret-0123456789" },
    setupFiles: ["dotenv/config"],
  },
});
