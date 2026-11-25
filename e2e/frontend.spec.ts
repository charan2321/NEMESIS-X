import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("operator@example.test");
  await page.getByLabel("Password").fill("DemoPass123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

async function expectNoAxeViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map(({ id, impact, description, nodes }) => ({
    id,
    impact,
    description,
    targets: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
  }))).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("auth, protected return route, refresh, and logout", async ({ page }) => {
  await page.goto("/jobs/NX-2408/results");
  await expect(page).toHaveURL(/\/login$/);
  await page.screenshot({ path: "screenshots/login-1440.png", fullPage: true });

  await page.getByLabel("Email address").fill("operator@example.test");
  await page.getByLabel("Password").fill("bad-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("doesn’t match our records");
  await page.screenshot({ path: "screenshots/login-error-1440.png", fullPage: true });
  await page.getByLabel("Password").fill("DemoPass123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/jobs\/NX-2408\/results$/);
  await page.reload();
  await expect(page).toHaveURL(/\/jobs\/NX-2408\/results$/);
  await page.getByRole("button", { name: /Alex Lane/ }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("register and upload validation", async ({ page }) => {
  await page.goto("/register");
  await page.screenshot({ path: "screenshots/register-1440.png", fullPage: true });
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText("Enter your name");
  await page.getByLabel("Full name").fill("Demo Analyst");
  await page.getByLabel("Email address").fill("not-an-email");
  await page.getByLabel("Password").fill("StrongPass123!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText("valid email address");
  await page.getByLabel("Email address").fill("operator@example.test");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText("already exists");

  await page.getByLabel("Full name").fill("Demo Analyst");
  await page.getByLabel("Email address").fill("duplicate@example.test");
  await page.getByLabel("Password").fill("weakpassword");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText("uppercase, lowercase, and a number");
  await page.screenshot({ path: "screenshots/register-validation-1440.png", fullPage: true });
  await page.getByLabel("Email address").fill("analyst+audit@example.test");
  await page.getByLabel("Password").fill("StrongPass123!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");
  await page.screenshot({ path: "screenshots/upload-home-1440.png", fullPage: true });

  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not video"),
  });
  await expect(page.getByRole("alert")).toContainText("Unsupported format");
  await page.screenshot({ path: "screenshots/upload-invalid-1440.png", fullPage: true });
  await page.locator('input[type="file"]').evaluate((input: HTMLInputElement) => {
    const oversizedFile = new File([""], "oversize.mp4", { type: "video/mp4" });
    Object.defineProperty(oversizedFile, "size", { value: 500 * 1024 * 1024 + 1 });
    const transfer = new DataTransfer();
    transfer.items.add(oversizedFile);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByRole("alert")).toContainText("larger than the 500 MB limit");
  await page.screenshot({ path: "screenshots/upload-oversize-1440.png", fullPage: true });
  await page.locator('input[type="file"]').setInputFiles({
    name: "sample.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("sample video bytes"),
  });
  await expect(page.getByText("Uploading your footage")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Drop your footage here")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "valid-sample.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("sample video bytes"),
  });
  await expect(page.getByText("Uploading your footage")).toBeVisible();
  await page.waitForURL(/\/jobs\/NX-\d+$/, { timeout: 8000 });
  const uploadedJobId = new URL(page.url()).pathname.split("/")[2];
  await page.waitForURL(/\/jobs\/NX-\d+\/results$/, { timeout: 16000 });
  await expect(page).toHaveURL(new RegExp(`/jobs/${uploadedJobId}/results$`));
  await expect(page.getByRole("heading", { name: "valid-sample.mp4" })).toBeVisible();
});

test("sample processing, results, drawer, seek, search, and export", async ({ page }) => {
  await signIn(page);
  await page.screenshot({ path: "screenshots/overview-1440.png", fullPage: true });
  await page.getByRole("button", { name: "Station concourse" }).click();
  await page.waitForURL(/\/jobs\/NX-\d+$/, { timeout: 8000 });
  const sampleJobId = new URL(page.url()).pathname.split("/")[2];
  for (const stage of ["Sampling", "Tracking", "Memory", "Interactions", "Anomaly", "Reasoning"]) {
    await expect(page.getByText(stage)).toBeVisible();
  }
  await page.screenshot({ path: "screenshots/processing-1440.png", fullPage: true });
  await page.waitForURL(/\/jobs\/NX-\d+\/results$/, { timeout: 16000 });
  await expect(page).toHaveURL(new RegExp(`/jobs/${sampleJobId}/results$`));
  await expect(page.getByRole("heading", { name: "station_concourse_demo.mp4" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.screenshot({ path: "screenshots/results-1440.png", fullPage: true });

  await page.getByRole("button", { name: /Movement against flow/ }).click();
  const eventDrawer = page.getByRole("dialog", { name: "Movement against flow" });
  await expect(eventDrawer).toBeVisible();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await eventDrawer.getByRole("button", { name: "Copy moment link" }).click();
  await expect(eventDrawer.getByRole("status")).toContainText("Moment link copied");
  await eventDrawer.getByRole("button", { name: "Mark as not interesting" }).click();
  await expect(eventDrawer.getByRole("button", { name: /Feedback recorded/ })).toBeVisible();
  await expect(eventDrawer.locator(".evidence-strip button")).toHaveCount(3);
  await eventDrawer.locator(".evidence-strip button").nth(1).click();
  await expect(page.locator(".timeline-current strong")).toHaveText("00:00:20");
  await expectNoAxeViolations(page);
  await page.screenshot({ path: "screenshots/event-drawer-1440.png", fullPage: true });

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  expect((await download).suggestedFilename()).toContain("ev-2048");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/results$/);
  const timeline = page.getByRole("slider", { name: "Timeline position" });
  await timeline.click();
  await expect(page.locator(".timeline-current strong")).toHaveText("00:01:30");
  await page.keyboard.press("j");
  await expect(page.locator(".timeline-current strong")).toHaveText("00:01:25");
  await page.keyboard.press("l");
  await expect(page.locator(".timeline-current strong")).toHaveText("00:01:30");
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Pause video" })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Play video" })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("dialog", { name: "Movement against flow" })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("dialog", { name: "Unattended object" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Search moments" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.screenshot({ path: "screenshots/search-1440.png", fullPage: true });
  const searchInput = page.getByRole("textbox", { name: "Search analysis moments" });
  await searchInput.fill("?");
  await searchInput.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Search moments" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toHaveCount(0);
  await searchInput.fill("no matching moment");
  await expect(page.getByText("No moments found")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.screenshot({ path: "screenshots/search-no-results-1440.png", fullPage: true });
  await searchInput.fill("unattended object");
  await expect(page.locator(".search-results-heading")).toContainText("1 results");
  await page.getByRole("button", { name: /Unattended object/ }).last().click();
  await expect(page).toHaveURL(/\/events\/EV-2047$/);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/results$/);
  await page.goto("/jobs/NX-2408/events/EV-2047");
  await expect(page.getByRole("dialog", { name: "Unattended object" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Play video" }).click();
  await page.getByRole("button", { name: /Analysis history/ }).first().click();
  await expect(page).toHaveURL(/\/jobs$/);
  await page.getByRole("button", { name: "Open station_concourse_demo.mp4" }).click();
  await expect(page.getByRole("button", { name: "Play video" })).toBeVisible();
});

test("main routes remain within desktop, tablet, and mobile viewport widths", async ({ page }) => {
  const widths = [1920, 1440, 1280, 1024, 768, 390];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/login", "/register"]) {
      await page.goto(route);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `horizontal overflow at ${route} at ${width}px`).toBeLessThanOrEqual(width);
    }
  }
  await signIn(page);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/", "/jobs", "/jobs/NX-2408", "/jobs/NX-2408/results", "/jobs/NX-2408/events/EV-2048"]) {
      await page.goto(route);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `horizontal overflow at ${route} at ${width}px`).toBeLessThanOrEqual(width);
    }
  }
});

test("history deletion persists after refresh and shortcuts work", async ({ page }) => {
  await signIn(page);
  await page.goto("/jobs");
  await page.screenshot({ path: "screenshots/history-1440.png", fullPage: true });
  await page.getByRole("button", { name: "Delete station_west_cam_04.mp4" }).click();
  await expect(page.getByText("Delete this analysis?")).toBeVisible();
  await page.screenshot({ path: "screenshots/history-delete-confirm-1440.png", fullPage: true });
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.reload();
  await expect(page.getByText("station_west_cam_04.mp4")).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem("nemesis-deleted-jobs", JSON.stringify(["NX-2408", "NX-2407", "NX-2406"])));
  await page.reload();
  await expect(page.getByText("No analyses yet")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.screenshot({ path: "screenshots/history-empty-1440.png", fullPage: true });

  await page.goto("/jobs/NX-2408/results");
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("accessibility smoke check for login, upload, processing, results, and history", async ({ page }) => {
  await page.goto("/login");
  await expectNoAxeViolations(page);
  await signIn(page);
  await expectNoAxeViolations(page);
  await page.goto("/jobs/NX-2408");
  await expectNoAxeViolations(page);
  await page.goto("/jobs/NX-2408/results");
  await expectNoAxeViolations(page);
  await page.goto("/jobs");
  await expectNoAxeViolations(page);
});
