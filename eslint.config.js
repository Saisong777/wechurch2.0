import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "artifacts", "exports"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "no-empty": "warn",
      "no-case-declarations": "warn",
      "no-useless-escape": "warn",
      "prefer-const": "warn",
    },
  },
  {
    files: ['server/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { paths: [
        { name: 'pptxgenjs', message: 'Presentation export is browser-only. Do not load its vulnerable Node image parser on the server.' },
        { name: 'image-size', message: 'No patched image-size release is available; do not introduce server image parsing.' },
      ] }],
    },
  },
);
