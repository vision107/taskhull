import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

test.beforeEach(() =>
	execFileSync(process.execPath, ["--env-file=.env", "tests/e2e/seed.mjs"]),
);

test("a malformed invitation link shows the invalid state", async ({
	page,
}) => {
	await page.goto("/auth/sign-in");
	await page.getByLabel("Email").fill("owner@e2e.local");
	await page.getByLabel("Password", { exact: true }).fill("E2e-password-123!");
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

	await page.goto("/dashboard/organization-invitation/not-a-uuid");

	await expect(
		page.getByRole("heading", {
			level: 1,
			name: "Invitation no longer valid",
		}),
	).toBeVisible();
	await expect(page).toHaveURL(
		/\/dashboard\/organization-invitation\/not-a-uuid$/,
	);
});
