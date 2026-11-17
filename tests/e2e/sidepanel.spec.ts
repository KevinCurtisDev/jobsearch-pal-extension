// Side panel shell (SPEC §3 F1, ADR-012).
import { BRAND_NAME } from "../../src/core/brand";
import { expect, test } from "./fixtures";

test("the side panel page shows the brand name and an empty state, styled by token variables", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(BRAND_NAME);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("No saved jobs yet");
  // --color-ink (#1D1D1F) reaches the page only through the generated tokens.css.
  expect(await page.evaluate(() => getComputedStyle(document.body).color)).toBe("rgb(29, 29, 31)");
});

test("the worker keeps openPanelOnActionClick off so toolbar capture still fires", async ({ sw }) => {
  await expect.poll(() => sw.evaluate(() => chrome.sidePanel.getPanelBehavior())).toMatchObject({ openPanelOnActionClick: false });
});

test("the manifest has a side panel and no popup", async ({ manifest }) => {
  const m = await manifest();
  expect(m.side_panel?.default_path).toBe("sidepanel.html");
  expect(m.action?.default_popup).toBeUndefined();
});
