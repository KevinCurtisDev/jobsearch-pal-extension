// Security rules: no HTML sinks, no eval, no string-to-code. Do NOT weaken them (see CLAUDE.md).
// Build DOM with createElement + textContent. Modules may add stricter blocks below.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nounsanitized from "eslint-plugin-no-unsanitized";
import globals from "globals";

const SINK = "HTML sinks are banned. Use createElement + textContent.";

export default tseslint.config(
  { ignores: ["dist/**", "release/**", "node_modules/**", "coverage/**", "playwright-report/**", "test-results/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,js,mjs}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node, chrome: "readonly", __DEV__: "readonly" } },
    plugins: { "no-unsanitized": nounsanitized },
    rules: {
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",
      "no-restricted-properties": [
        "error",
        { property: "innerHTML", message: SINK },
        { property: "outerHTML", message: SINK },
        { property: "insertAdjacentHTML", message: SINK },
        { object: "document", property: "write", message: SINK },
        { object: "document", property: "writeln", message: SINK },
        { property: "createContextualFragment", message: SINK },
        { property: "srcdoc", message: SINK },
        { property: "setHTMLUnsafe", message: SINK },
        { property: "parseHTMLUnsafe", message: SINK },
        { property: "parseFromString", message: "DOMParser is banned." }
      ],
      "no-restricted-globals": [
        "error",
        { name: "eval", message: "No eval (MV3 CSP)." },
        { name: "DOMParser", message: "DOMParser is banned." }
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name=/^(setAttribute|setAttributeNS)$/] > Literal[value=/^(srcdoc|on[a-z]+)$/i]",
          message: "Inline on* handlers and srcdoc via setAttribute are banned. Use addEventListener."
        },
        {
          selector: "MemberExpression[computed=true] > Literal[value=/^(innerHTML|outerHTML|insertAdjacentHTML|srcdoc|createContextualFragment|setHTMLUnsafe|parseFromString)$/]",
          message: "Computed access to an HTML sink is banned."
        }
      ],
      "no-eval": "error",
      "no-new-func": "error",
      "no-implied-eval": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  }
);
