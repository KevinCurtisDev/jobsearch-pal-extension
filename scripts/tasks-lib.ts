// Pure parser for docs/TASKS.md. Task heading format:  ### T1.2 Short title `[ ]`   (`[x]` when done)
// followed by "- **Field:** value" lines (Goal, Files, Depends on, Spec, Done when, Manual check).
export type Task = { id: string; title: string; done: boolean; fields: Record<string, string>; files: string[]; deps: string[]; start: number; end: number };

const HEAD = /^### (T\d+\.\d+) (.+?) `\[( |x)\]`\s*$/;
export const REQUIRED_FIELDS = ["Goal", "Files", "Done when"];

/** Blanks out HTML comments (e.g. the format example in a new TASKS.md), keeping line numbers. */
function withoutComments(md: string): string {
  return md.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ""));
}

export function parseTasks(md: string): Task[] {
  const lines = withoutComments(md).split("\n");
  const tasks: Task[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = HEAD.exec(lines[i]!);
    if (!m) continue;
    let end = i + 1;
    while (end < lines.length && !/^#{2,3} /.test(lines[end]!)) end++;
    const fields: Record<string, string> = {};
    for (const l of lines.slice(i + 1, end)) {
      const f = /^- \*\*(.+?):\*\*\s*(.*)$/.exec(l);
      if (f) fields[f[1]!] = f[2]!.trim();
    }
    const files = [...(fields.Files ?? "").matchAll(/`([^`]+)`/g)].map((x) => x[1]!);
    const deps = [...(fields["Depends on"] ?? "").matchAll(/T\d+\.\d+/g)].map((x) => x[0]);
    tasks.push({ id: m[1]!, title: m[2]!, done: m[3] === "x", fields, files, deps, start: i, end });
  }
  return tasks;
}

/** First unchecked task whose dependencies are all done. */
export function nextTask(tasks: Task[]): Task | null {
  const done = new Set(tasks.filter((t) => t.done).map((t) => t.id));
  return tasks.find((t) => !t.done && t.deps.every((d) => done.has(d))) ?? null;
}

export function markDone(md: string, id: string): string {
  const lines = md.split("\n");
  const t = parseTasks(md).find((x) => x.id === id);
  if (!t) throw new Error(`no task ${id} in docs/TASKS.md`);
  lines[t.start] = lines[t.start]!.replace("`[ ]`", "`[x]`");
  return lines.join("\n");
}

export function problems(tasks: Task[]): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const t of tasks) {
    if (ids.has(t.id)) out.push(`${t.id} appears twice`);
    ids.add(t.id);
    for (const f of REQUIRED_FIELDS) if (!t.fields[f] || t.fields[f]!.includes("⟨")) out.push(`${t.id}: "${f}" is missing or still a placeholder`);
    if (!t.files.length) out.push(`${t.id}: list the files it touches in backticks under Files`);
  }
  for (const t of tasks) for (const d of t.deps) if (!ids.has(d)) out.push(`${t.id} depends on unknown task ${d}`);
  return out;
}
