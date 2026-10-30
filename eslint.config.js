// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

// Import del `colors` estático (shim temporal de src/theme/colors.ts). Aviso para contar lo que
// falta migrar a `useTheme()`; pasa a "error" y se borra con el shim (F6).
const staticColorsPattern = {
  regex: "(^|/)theme(/(index|colors))?$",
  importNames: ["colors"],
  message: "`colors` estático es un shim temporal (solo claro). Usa useTheme().colors de src/theme.",
};

// Fronteras de arquitectura. Nivel "warn" durante la migración; se endurecen a "error" en F6.
module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "_parked/*", "vendor/*", "Design/*"],
  },
  {
    // Scripts y configuración raíz corren en Node (CommonJS).
    files: ["scripts/**/*.js", "*.config.js"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        __filename: "readonly",
        require: "readonly",
        module: "writable",
        exports: "writable",
        process: "readonly",
        console: "readonly",
      },
    },
  },
  {
    files: ["app/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": ["warn", {
        patterns: [
          { regex: "(^|/)src/database(/|$)|^@/database(/|$)|^(\\.{1,2}/)+database(/|$)", message: "app/** no debe importar src/database/**; usa la capa de servicios/hooks." },
          { regex: "^drizzle-orm(/|$)", message: "app/** no debe importar drizzle-orm." },
          staticColorsPattern,
        ],
      }],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx,js,jsx}"],
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-imports": ["warn", { patterns: [staticColorsPattern] }],
    },
  },
  {
    files: ["src/domain/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": ["warn", {
        patterns: [
          { regex: "^expo(-|/|$)", message: "src/domain/** debe ser puro: no importa expo-*." },
          { regex: "^react-native(/|$)", message: "src/domain/** debe ser puro: no importa react-native." },
          { regex: "(^|/)src/platform(/|$)|^@/platform(/|$)|^(\\.{1,2}/)+platform(/|$)", message: "src/domain/** no debe importar src/platform/**." },
          { regex: "(^|/)src/database/client$|^@/database/client$|^(\\.{1,2}/)+database/client$", message: "src/domain/** no debe importar src/database/client." },
        ],
      }],
    },
  },
]);
