import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Project overrides: keep lint actionable (avoid false-positives)
  {
    rules: {
      // This rule is too strict for common data-fetch/loading patterns (useEffect -> setLoading, etc.)
      "react-hooks/set-state-in-effect": "off",
      // Overly opinionated about useCallback/useMemo wrappers in this codebase
      "react-hooks/use-memo": "off",
      // Ref assignment during render is sometimes used intentionally; we handle case-by-case
      "react-hooks/refs": "off",
    },
  },
]);

export default eslintConfig;
