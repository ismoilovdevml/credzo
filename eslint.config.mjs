import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "next-env.d.ts",
      ".e2e-data/**",
      "data/**",
      "playwright-report/**",
      "test-results/**",
      "docs/**",
    ],
  },
];

export default eslintConfig;
