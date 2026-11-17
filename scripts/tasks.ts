// Task helper for docs/TASKS.md, so Claude (and you) read only the task at hand.
//   node scripts/tasks.ts list         all tasks with status
//   node scripts/tasks.ts next         the next task to do (first unchecked with done dependencies)
//   node scripts/tasks.ts show T1.2    one task's block
//   node scripts/tasks.ts done T1.2    tick a task's box
//   node scripts/tasks.ts check        validate the file (every task has Goal, Files, Done when)
import { readFileSync, writeFileSync } from "node:fs";
import { markDone, nextTask, parseTasks, problems } from "./tasks-lib.ts";

const FILE = "docs/TASKS.md";
const md = readFileSync(FILE, "utf8");
const tasks = parseTasks(md);
const [cmd, id] = process.argv.slice(2);
const block = (tid: string) => {
  const t = tasks.find((x) => x.id === tid);
  if (!t) {
    console.error(`✖ no task ${tid}. Run: node scripts/tasks.ts list`);
    process.exit(2);
  }
  return md.split("\n").slice(t.start, t.end).join("\n").trimEnd();
};

switch (cmd) {
  case "list":
    if (!tasks.length) console.log("No tasks yet. Run /plan-feature in Claude Code.");
    for (const t of tasks) console.log(`${t.done ? "[x]" : "[ ]"} ${t.id} ${t.title}${t.deps.length ? `  (after ${t.deps.join(", ")})` : ""}`);
    break;
  case "next": {
    const t = nextTask(tasks);
    console.log(t ? block(t.id) : tasks.length ? "All tasks are done." : "No tasks yet. Run /plan-feature in Claude Code.");
    break;
  }
  case "show":
    console.log(block(id ?? ""));
    break;
  case "done":
    block(id ?? "");
    writeFileSync(FILE, markDone(md, id!));
    console.log(`✔ ${id} ticked in ${FILE}`);
    break;
  case "check": {
    const p = problems(tasks);
    if (p.length) {
      console.error("✖ docs/TASKS.md:\n - " + p.join("\n - "));
      process.exit(1);
    }
    console.log(`✔ docs/TASKS.md OK (${tasks.length} tasks, ${tasks.filter((t) => t.done).length} done)`);
    break;
  }
  default:
    console.log("Usage: node scripts/tasks.ts list | next | show <id> | done <id> | check");
    process.exit(cmd ? 2 : 0);
}
