import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.beforeAll(() =>
	execFileSync(process.execPath, ["--env-file=.env", "tests/e2e/seed.mjs"]),
);

async function signIn(page: Page, email: string) {
	await page.goto("/auth/sign-in");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill("E2e-password-123!");
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page).toHaveURL(/\/dashboard/);
}

function totp(secret: string) {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
	let bits = "";
	for (const char of secret)
		bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
	const key = Buffer.from(
		(bits.match(/.{8}/g) ?? []).map((byte) => Number.parseInt(byte, 2)),
	);
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
	const hash = createHmac("sha1", key).update(counter).digest();
	const offset = hash[19]! & 15;
	return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000)
		.toString()
		.padStart(6, "0");
}

test("owner can navigate account and organization surfaces", async ({
	page,
}) => {
	await signIn(page, "owner@e2e.local");
	await expect(
		page.getByRole("heading", { name: "Your Organizations" }),
	).toBeVisible();
	await page.getByText("Open", { exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard\/organization/);
	for (const path of ["leads", "settings", "chatbot"]) {
		await page.goto(`/dashboard/organization/${path}`);
		await expect(page).not.toHaveURL(/auth\/sign-in/);
	}
	await page.goto("/dashboard/settings");
	await expect(
		page.getByRole("heading", { name: "Account Settings" }),
	).toBeVisible();
});

test("owner can enroll in and authenticate with TOTP", async ({ page }) => {
	await signIn(page, "owner@e2e.local");
	await page.goto("/dashboard/settings?tab=security");
	await page.getByRole("button", { name: "Set up a new Factor" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.locator("input").fill("E2e-password-123!");
	await dialog.getByRole("button", { name: "Continue" }).click();
	const secret = await dialog
		.locator("p")
		.filter({ hasText: /^[A-Z2-7]{32,}$/ })
		.textContent();
	expect(secret).toBeTruthy();
	await dialog.locator("input").fill(totp(secret!));
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(
		page.getByText("You have two-factor authentication enabled"),
	).toBeVisible();
	await page.request.post("/api/auth/sign-out");
	await page.context().clearCookies();
	await page.goto("/auth/sign-in");
	await page.getByLabel("Email").fill("owner@e2e.local");
	await page.getByLabel("Password", { exact: true }).fill("E2e-password-123!");
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page).toHaveURL(/\/auth\/verify/);
	await page.getByLabel("One-time password").fill(totp(secret!));
	await expect(page).toHaveURL(/\/dashboard/);
	execFileSync(process.execPath, ["--env-file=.env", "tests/e2e/seed.mjs"]);
});

test("AI chat enforces organization credits", async ({ page }) => {
	await signIn(page, "owner@e2e.local");
	await page.getByText("Open", { exact: true }).click();
	await page.goto("/dashboard/organization/chatbot");
	await page.getByPlaceholder("Ask me anything...").fill("E2E message");
	await page.getByRole("button", { name: "Submit" }).click();
	await expect(page.getByText("Not enough credits").first()).toBeVisible();
});

test("administrator can access every admin surface", async ({ page }) => {
	await signIn(page, "admin@e2e.local");
	for (const [path, heading] of [
		["users", "Users"],
		["organizations", "Organizations"],
		["app-config", "App Config"],
	] as const) {
		await page.goto(`/dashboard/admin/${path}`);
		await expect(page.getByRole("heading", { name: heading })).toBeVisible();
	}
});
