import { describe, expect, it } from "vitest";
import { markDone, nextTask, parseTasks, problems } from "../../scripts/tasks-lib.ts";

const MD = `# Tasks
## M1: MVP
### T1.1 First thing \`[x]\`
- **Goal:** do the first thing
- **Files:** \`src/a.ts\`, \`tests/unit/a.test.ts\`
- **Depends on:** none
- **Done when:** tests pass
### T1.2 Second thing \`[ ]\`
- **Goal:** do the second thing
- **Files:** \`src/b.ts\`
- **Depends on:** T1.1
- **Done when:** tests pass
### T1.3 Third thing \`[ ]\`
- **Goal:** ⟨goal⟩
- **Files:** none
- **Depends on:** T1.2, T9.9
## Later
`;

describe("tasks helper", () => {
  it("parses tasks, files and dependencies", () => {
    const t = parseTasks(MD);
    expect(t.map((x) => [x.id, x.done])).toEqual([["T1.1", true], ["T1.2", false], ["T1.3", false]]);
    expect(t[0]!.files).toEqual(["src/a.ts", "tests/unit/a.test.ts"]);
    expect(t[2]!.deps).toEqual(["T1.2", "T9.9"]);
  });
  it("finds the next task whose dependencies are done", () => {
    expect(nextTask(parseTasks(MD))?.id).toBe("T1.2");
    expect(nextTask(parseTasks(markDone(MD, "T1.2")))?.id).toBeUndefined(); // T1.3 waits for T9.9
  });
  it("ticks a box without touching anything else", () => {
    const out = markDone(MD, "T1.2");
    expect(parseTasks(out).find((x) => x.id === "T1.2")!.done).toBe(true);
    expect(out.split("\n").length).toBe(MD.split("\n").length);
    expect(() => markDone(MD, "T7.7")).toThrow(/no task/);
  });
  it("reports incomplete tasks", () => {
    const p = problems(parseTasks(MD));
    expect(p).toContain('T1.3: "Goal" is missing or still a placeholder');
    expect(p).toContain('T1.3: "Done when" is missing or still a placeholder');
    expect(p).toContain("T1.3 depends on unknown task T9.9");
    expect(p.some((x) => x.startsWith("T1.1") || x.startsWith("T1.2"))).toBe(false);
  });
  it("accepts an empty plan", () => {
    expect(problems(parseTasks("# Tasks\n"))).toEqual([]);
  });
  it("ignores tasks inside HTML comments (the format example)", () => {
    const md = "# Tasks\n<!--\n### T1.1 Example `[ ]`\n- **Goal:** x\n-->\n### T1.2 Real `[ ]`\n- **Goal:** y\n";
    expect(parseTasks(md).map((t) => t.id)).toEqual(["T1.2"]);
    expect(parseTasks(md)[0]!.start).toBe(5);
  });
});
