import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

test.beforeEach(() =>
	execFileSync(process.execPath, ["--env-file=.env", "tests/e2e/seed.mjs"]),
);

test("browser Back closes a modal without leaving the page", async ({
	page,
}) => {
	await page.goto("/auth/sign-in");
	await page.getByLabel("Email").fill("owner@e2e.local");
	await page.getByLabel("Password", { exact: true }).fill("E2e-password-123!");
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard\/organization$/, {
		timeout: 30_000,
	});
	await page.goto("/dashboard/organization/projects");

	const trigger = page.getByRole("button", { name: "New project" });
	await trigger.click();
	const dialog = page.getByRole("dialog", { name: "New project" });
	await expect(dialog).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(
				() => typeof window.history.state?.niceModalHistoryToken === "string",
			),
		)
		.toBe(true);
	await dialog.getByRole("button", { name: "Close" }).click();
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();
	await expect
		.poll(() =>
			page.evaluate(() => window.history.state?.niceModalHistoryToken ?? null),
		)
		.toBeNull();

	await trigger.click();
	await expect(dialog).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(
				() => typeof window.history.state?.niceModalHistoryToken === "string",
			),
		)
		.toBe(true);

	await page.goBack();

	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();
	await expect(page).toHaveURL(/\/dashboard\/organization\/projects$/);
	await expect
		.poll(() =>
			page.evaluate(() => window.history.state?.niceModalHistoryToken ?? null),
		)
		.toBeNull();
});
