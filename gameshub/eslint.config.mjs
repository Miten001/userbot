// ESLint 9 flat config — uses eslint-config-next via FlatCompat.
// See: https://nextjs.org/docs/app/api-reference/config/eslint
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

const config = [
  ...compat.extends("next/core-web-vitals"),
  {
    ignores: [".next/**", "node_modules/**"]
  }
];

export default config;
