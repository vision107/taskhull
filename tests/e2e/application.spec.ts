import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.beforeEach(() =>
	execFileSync(process.execPath, ["--env-file=.env", "tests/e2e/seed.mjs"]),
);

async function signIn(page: Page, email: string) {
	await page.goto("/auth/sign-in");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password", { exact: true }).fill("E2e-password-123!");
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

async function waitForModalHistoryRelease(page: Page) {
	await page.waitForFunction(
		() => !window.history.state?.niceModalHistoryToken,
	);
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

async function stableTotp(secret: string) {
	const elapsed = Date.now() % 30_000;
	if (elapsed > 15_000) {
		await new Promise((resolve) => setTimeout(resolve, 30_500 - elapsed));
	}
	return totp(secret);
}

test("owner can navigate account and organization surfaces", async ({
	page,
}) => {
	await signIn(page, "owner@e2e.local");
	// A user with a single organization lands straight on its dashboard;
	// there is no personal area.
	await expect(page).toHaveURL(/\/dashboard\/organization$/);
	await expect(
		page.getByRole("button", { name: /E2E Organization/ }),
	).toBeVisible();
	await page.getByRole("button", { name: /E2E Organization/ }).click();
	await expect(page.getByText("Personal", { exact: true })).toBeHidden();
	await page.getByRole("button", { name: "Create an Organization" }).click();
	const createOrganizationDialog = page.getByRole("dialog", {
		name: "Create Organization",
	});
	await expect(createOrganizationDialog).toBeVisible();
	await expect(
		createOrganizationDialog.getByLabel("Organization Name"),
	).toBeVisible();
	await createOrganizationDialog.getByRole("button", { name: "Close" }).click();
	await expect(createOrganizationDialog).toBeHidden();
	await waitForModalHistoryRelease(page);
	await page.getByRole("button", { name: /E2E Owner/ }).click();
	await page.getByRole("menuitem", { name: /Command Menu/ }).click();
	const commandDialog = page.getByRole("dialog", { name: "Command Palette" });
	await expect(commandDialog).toBeVisible();
	await commandDialog
		.getByPlaceholder("Type a command or search...")
		.fill("Profile");
	await expect(
		commandDialog.getByText("Profile", { exact: true }),
	).toBeVisible();
	await expect(commandDialog.getByText("Home", { exact: true })).toBeHidden();
	await commandDialog.getByText("Profile", { exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard\/settings\?tab=profile/);
	await expect(page.getByLabel("Current Email")).toBeDisabled();
	// Account settings keep the organization sidebar.
	await expect(
		page.getByRole("button", { name: /E2E Organization/ }),
	).toBeVisible();
	await expect(page.getByRole("link", { name: "Projects" })).toBeVisible();
	await page.getByRole("button", { name: /E2E Owner/ }).click();
	await page.getByRole("menuitem", { name: /Command Menu/ }).click();
	await expect(commandDialog).toBeVisible();
	const commandInput = commandDialog.getByPlaceholder(
		"Type a command or search...",
	);
	await commandInput.fill("Sessions");
	await commandInput.press("Enter");
	await expect(page).toHaveURL(/\/dashboard\/settings\?tab=sessions/);
	await page.getByRole("button", { name: /E2E Owner/ }).click();
	await page.getByRole("menuitem", { name: /Command Menu/ }).click();
	await expect(commandDialog).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(commandDialog).toBeHidden();
	await waitForModalHistoryRelease(page);
	// /dashboard always resolves to the active organization.
	await page.goto("/dashboard");
	await expect(page).toHaveURL(/\/dashboard\/organization$/);
	await page.getByRole("button", { name: /E2E Organization/ }).click();
	const organizationSearch = page.getByPlaceholder("Search...");
	await organizationSearch.fill("E2E Organization");
	await organizationSearch.press("Enter");
	await expect(page).toHaveURL(/\/dashboard\/organization/);
	await expect(
		page.getByRole("button", { name: /E2E Organization/ }),
	).toBeVisible();
	await page.goto("/dashboard/organization/settings?tab=general");
	await expect(page.getByText("Danger Zone", { exact: true })).toBeVisible();
	await page.goto("/dashboard/organization/settings?tab=members");
	await expect(
		page.getByRole("heading", { name: "Organization Settings" }),
	).toBeVisible();
	const roleSelect = page.getByRole("combobox", { name: "Role" });
	await roleSelect.click();
	await page.getByRole("option", { name: "Admin" }).click();
	await expect(roleSelect).toContainText("Admin");
	await page.getByRole("tab", { name: "Pending Invitations" }).click();
	await expect(
		page.getByRole("tab", { name: "Pending Invitations" }),
	).toHaveAttribute("data-active");
	for (const path of ["templates", "projects", "settings"]) {
		await page.goto(`/dashboard/organization/${path}`);
		await expect(page).not.toHaveURL(/auth\/sign-in/);
	}
	await page.goto("/dashboard/settings");
	await expect(
		page.getByRole("heading", { name: "Account Settings" }),
	).toBeVisible();

	const sidebarWrapper = page.locator('[data-slot="sidebar-wrapper"]');
	const sidebarRail = page.locator('[data-slot="sidebar-rail"]');
	const railBounds = await sidebarRail.boundingBox();
	expect(railBounds).not.toBeNull();
	const initialSidebarWidth = await sidebarWrapper.evaluate((element) =>
		Number.parseFloat(
			getComputedStyle(element).getPropertyValue("--sidebar-width"),
		),
	);
	await page.mouse.move(
		railBounds!.x + railBounds!.width / 2,
		railBounds!.y + railBounds!.height / 2,
	);
	await page.mouse.down();
	await page.mouse.move(railBounds!.x + 48, railBounds!.y + 40);
	await page.mouse.up();
	const resizedSidebarWidth = await sidebarWrapper.evaluate((element) =>
		Number.parseFloat(
			getComputedStyle(element).getPropertyValue("--sidebar-width"),
		),
	);
	expect(resizedSidebarWidth).toBeGreaterThan(initialSidebarWidth);
	await expect
		.poll(() => page.evaluate(() => document.cookie.includes("sidebar_width=")))
		.toBe(true);

	await page.setViewportSize({ width: 390, height: 844 });
	const sidebarTrigger = page.getByRole("button", { name: "Toggle Sidebar" });
	await sidebarTrigger.click();
	const mobileSidebar = page.getByRole("dialog", { name: "Sidebar" });
	await expect(mobileSidebar).toBeVisible();
	await expect(
		mobileSidebar.getByRole("link", { name: "Members" }),
	).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(mobileSidebar).toBeHidden();
	await expect(sidebarTrigger).toBeFocused();

	await sidebarTrigger.click();
	await mobileSidebar.getByRole("link", { name: "Members" }).click();
	await expect(page).toHaveURL(
		/\/dashboard\/organization\/settings\?tab=members/,
	);
	await expect(mobileSidebar).toBeHidden();
});

test("owner can enroll in and authenticate with TOTP", async ({ page }) => {
	// The preceding navigation test intentionally visits several authenticated
	// pages in quick succession. Let Better Auth's short in-memory rate-limit
	// window reset before beginning a separate authentication flow.
	await page.waitForTimeout(10_500);
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
	await dialog.locator("input").fill(await stableTotp(secret!));
	await dialog.getByRole("button", { name: "Save" }).click();
	await expect(
		page.getByText("You have two-factor authentication enabled"),
	).toBeVisible();
	await page.request.post("/api/auth/sign-out", {
		data: {},
		headers: { Origin: "http://localhost:3000" },
	});
	await page.context().clearCookies();
	await page.goto("/auth/sign-in");
	await page.getByLabel("Email").fill("owner@e2e.local");
	await page.getByLabel("Password", { exact: true }).fill("E2e-password-123!");
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await expect(page).toHaveURL(/\/auth\/verify/);
	await page.getByLabel("One-time password").fill(await stableTotp(secret!));
	await expect(page).toHaveURL(/\/dashboard/);
});

test("administrator can access every admin surface", async ({ page }) => {
	test.setTimeout(60_000);

	// The preceding scenarios use all three credential sign-in attempts allowed
	// in Better Auth's short protection window.
	await page.waitForTimeout(10_500);
	await signIn(page, "admin@e2e.local");
	await page.goto("/dashboard/admin/users");
	await page.getByRole("button", { name: /Admin Panel/ }).click();
	await expect(page.getByRole("link", { name: "Admin Panel" })).toBeVisible();
	await page.keyboard.press("Escape");
	for (const [path, heading] of [
		["users", "Users"],
		["organizations", "Organizations"],
		["app-config", "App Config"],
	] as const) {
		await page.goto(`/dashboard/admin/${path}`);
		await expect(page.getByRole("heading", { name: heading })).toBeVisible();
	}
	await page.goto("/dashboard/admin/users");
	const ownerRow = page.getByRole("row").filter({ hasText: "owner@e2e.local" });
	await ownerRow.getByRole("button", { name: "Open menu" }).click();
	await page.getByRole("menuitem", { name: "Ban user" }).click();
	const banDialog = page.getByRole("dialog", { name: "Ban User" });
	await expect(banDialog).toBeVisible();
	await banDialog
		.getByRole("button", { name: "Ban expiration (optional)" })
		.click();
	await expect(page.locator('[data-slot="calendar"]')).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.locator('[data-slot="calendar"]')).toBeHidden();
	await banDialog.getByRole("button", { name: "Cancel" }).click();
	await expect(banDialog).toBeHidden();
	await waitForModalHistoryRelease(page);

	await ownerRow.getByRole("checkbox", { name: "Select row" }).click();
	await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: /Bulk actions/ }).click();
	await page.getByRole("menuitem", { name: "Export to CSV" }).click();
	const exportDialog = page.getByRole("dialog", { name: "Export to CSV" });
	await expect(exportDialog).toBeVisible();
	const semicolonOption = exportDialog.getByRole("radio", {
		name: "Semicolon (;)",
	});
	await semicolonOption.click();
	await expect(semicolonOption).toBeChecked();
	await exportDialog.getByRole("button", { name: "Cancel" }).click();
	await expect(exportDialog).toBeHidden();
	await waitForModalHistoryRelease(page);

	await page.goto("/dashboard/admin/organizations");
	const organizationRow = page
		.getByRole("row")
		.filter({ hasText: "E2E Organization" });
	const organizationMenuTrigger = organizationRow.getByRole("button", {
		name: "Open menu",
	});
	await organizationMenuTrigger.click();
	await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
	const deleteOrganizationDialog = page.getByRole("alertdialog", {
		name: "Delete organization",
	});
	await expect(deleteOrganizationDialog).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(deleteOrganizationDialog).toBeHidden();
	await waitForModalHistoryRelease(page);
	await expect(organizationMenuTrigger).toBeFocused();
});

test("non-owners see but cannot delete an organization", async ({
	browser,
}) => {
	test.setTimeout(120_000);
	await new Promise((resolve) => setTimeout(resolve, 10_500));

	for (const [index, email] of [
		"organization-admin@e2e.local",
		"admin@e2e.local",
		"member@e2e.local",
	].entries()) {
		if (index > 0) {
			await new Promise((resolve) => setTimeout(resolve, 10_500));
		}

		const context = await browser.newContext();
		const page = await context.newPage();
		await signIn(page, email);

		const organizationsResponse = await page.request.get(
			"/api/auth/organization/list",
		);
		expect(organizationsResponse.ok()).toBe(true);
		const organizations = (await organizationsResponse.json()) as Array<{
			id: string;
			slug: string;
		}>;
		const organization = organizations.find(
			(item) => item.slug === "e2e-organization",
		);
		expect(organization).toBeDefined();

		const setActiveResponse = await page.request.post(
			"/api/auth/organization/set-active",
			{
				data: { organizationId: organization!.id },
				headers: { Origin: "http://localhost:3000" },
			},
		);
		expect(setActiveResponse.ok()).toBe(true);

		await page.goto("/dashboard/organization/settings?tab=general");
		await expect(page.getByText("Danger Zone", { exact: true })).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Delete Organization" }),
		).toBeDisabled();

		const deleteResponse = await page.request.post(
			"/api/auth/organization/delete",
			{
				data: { organizationId: organization!.id },
				headers: { Origin: "http://localhost:3000" },
			},
		);
		expect(deleteResponse.status()).toBe(403);

		await context.close();
	}
});
