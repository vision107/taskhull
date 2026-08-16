import { execFileSync } from "node:child_process";

import { expect, type Page, test } from "@playwright/test";

test.beforeEach(() =>
	execFileSync(process.execPath, ["--env-file=.env", "tests/e2e/seed.mjs"]),
);

async function signIn(page: Page) {
	await page.goto("/auth/sign-in");
	await page.getByLabel("Email").fill("owner@e2e.local");
	await page.getByLabel("Password", { exact: true }).fill("E2e-password-123!");
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

test("a user can add, rename, use, and delete a passkey", async ({ page }) => {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("WebAuthn.enable");
	const { authenticatorId } = await cdp.send(
		"WebAuthn.addVirtualAuthenticator",
		{
			options: {
				protocol: "ctap2",
				transport: "internal",
				hasResidentKey: true,
				hasUserVerification: true,
				isUserVerified: true,
				automaticPresenceSimulation: true,
			},
		},
	);

	try {
		await signIn(page);
		const registrationOptionsResponse = await page.request.get(
			"/api/auth/passkey/generate-register-options",
		);
		expect(registrationOptionsResponse.ok()).toBe(true);
		const registrationOptions = (await registrationOptionsResponse.json()) as {
			authenticatorSelection?: { userVerification?: string };
		};
		expect(registrationOptions.authenticatorSelection?.userVerification).toBe(
			"required",
		);

		await page.goto("/dashboard/settings?tab=security");
		await page.getByRole("button", { name: "Add passkey" }).click();

		const renameDialog = page.getByRole("dialog", { name: "Name passkey" });
		await expect(renameDialog).toBeVisible();
		await renameDialog.getByLabel("Passkey name").fill("E2E passkey");
		await renameDialog.getByRole("button", { name: "Save" }).click();
		await expect(page.getByText("E2E passkey", { exact: true })).toBeVisible();

		await page.request.post("/api/auth/sign-out", {
			data: {},
			headers: { Origin: "http://localhost:3000" },
		});
		await page.context().clearCookies();
		await page.goto("/auth/sign-in");
		await cdp.send("WebAuthn.setUserVerified", {
			authenticatorId,
			isUserVerified: false,
		});
		await page.getByRole("button", { name: "Sign in with passkey" }).click();
		await expect(
			page.getByText(
				"Verify your identity with a PIN or biometric to use this passkey.",
			),
		).toBeVisible();

		await cdp.send("WebAuthn.setUserVerified", {
			authenticatorId,
			isUserVerified: true,
		});
		await page.getByRole("button", { name: "Sign in with passkey" }).click();
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

		await page.goto("/dashboard/settings?tab=security");
		await page.getByRole("button", { name: "Delete E2E passkey" }).click();
		const deleteDialog = page.getByRole("alertdialog", {
			name: "Delete passkey",
		});
		await deleteDialog.getByRole("button", { name: "Delete passkey" }).click();
		await expect(page.getByText("No passkeys yet")).toBeVisible();
	} finally {
		await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
	}
});
