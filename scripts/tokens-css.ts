// Turns design/tokens.json into CSS custom properties (ADR-012). build.mjs writes the result to
// dist/tokens.css; the side panel and src/ui styles use only these variables, never raw colours.
//   color.status.positive.text -> --color-status-positive-text
//   font.scale.body.size: 17   -> --font-body-size: 17px
// Numbers get px, except unitless keys (weight, lineHeight). Metadata keys and $-keys are dropped.

const METADATA = new Set(["role", "contrastOnWhite", "use"]);
const UNITLESS = new Set(["weight", "lineHeight"]);
// A value must not be able to end the declaration or the rule, or open a comment, string or tag.
const UNSAFE = /[;{}<>"\\]|\/\*/;

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function tokensToCss(tokens: unknown): string {
  if (!isObject(tokens)) throw new Error("tokens.json must be an object");
  const lines: string[] = [];
  const visit = (node: unknown, path: string[]) => {
    const name = path.join(".");
    if (isObject(node)) {
      if ("value" in node) return visit(node.value, path);
      for (const [k, v] of Object.entries(node)) if (!k.startsWith("$") && !METADATA.has(k)) visit(v, path[0] === "font" && k === "scale" ? path : [...path, k]);
      return;
    }
    let value: string;
    if (typeof node === "number" && Number.isFinite(node)) value = UNITLESS.has(path.at(-1) ?? "") || node === 0 ? String(node) : `${node}px`;
    else if (typeof node === "string" && node.trim() !== "") value = node;
    else throw new Error(`token ${name} must be a non-empty string or a finite number`);
    // Font families legitimately quote names; allow double quotes only there.
    const check = name === "font.family" ? value.replace(/"[^"\\;{}<>]*"/g, "") : value;
    if (UNSAFE.test(check)) throw new Error(`token ${name} has an unsafe value`);
    lines.push(`  --${path.map(kebab).join("-")}: ${value};`);
  };
  for (const [k, v] of Object.entries(tokens)) if (!k.startsWith("$")) visit(v, [k]);
  return `:root {\n${lines.join("\n")}\n}\n`;
}
