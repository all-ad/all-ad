import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import testConfig from "./config";

const authFile = path.join(testConfig.statePath);

// Create auth file if it doesn't exist
if (!fs.existsSync(path.dirname(authFile))) {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
}
if (!fs.existsSync(authFile)) {
  fs.writeFileSync(authFile, "{}");
}

setup("authenticate", async ({ page }) => {
  console.log("Setting up test authentication...");

  // Navigate to login page
  await page.goto("/login");

  // Check if we need to create a test user or just save empty state
  const needsAuth = process.env.TEST_EMAIL && process.env.TEST_PASSWORD;

  if (needsAuth) {
    // Fill in login form with test credentials
    await page.fill('input[name="email"]', process.env.TEST_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD!);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for successful login
    await page.waitForURL("/dashboard", { timeout: 10000 });
  }

  // Save storage state
  await page.getByTestId("login-submit").click();

  // Wait for the main page to load after login.
  // This is a common pattern to ensure login was successful.
  await expect(page).toHaveURL(/.*dashboard/);
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

  await page.context().storageState({ path: authFile });

  console.log("Test authentication setup completed");
});
