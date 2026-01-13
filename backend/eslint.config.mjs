import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/*.config.js",
      "**/prisma/seed/**",
      "**/scripts/**",
      "**/test-results/**",
      "**/logs/**",
      "**/DmMessagingUI/**",
      "**/project-docs/**",
      // JavaScript dosyalarını ignore et (CommonJS, test dosyaları vb.)
      "**/*.js",
      "**/tests/e2e/socket.io/**/*.js",
      "**/tests/helpers/**/*.js",
      "prisma/seed.js",
      "test_seed.js",
      "swagger-server.js",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
  tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // TypeScript: any kullanımını yasakla
      "@typescript-eslint/no-explicit-any": "error",
      
      // İsteğe bağlı: any kullanımına izin verilen yerler için uyarı ver
      // "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);
