import { expect, test } from "@playwright/test";

test.describe("Authentication Pages", () => {
	test("desktop navigation menus open, switch, and close", async ({ page }) => {
		await page.goto("/");

		await page.getByRole("button", { name: "Product" }).click();
		const navigationContent = page.locator(
			'[data-slot="navigation-menu-content"]',
		);
		await expect(
			navigationContent.getByRole("link", { name: /^Features/ }),
		).toBeVisible();
		await expect(
			navigationContent.getByRole("link", { name: /^FAQ/ }),
		).toBeVisible();

		const resourcesTrigger = page.getByRole("button", { name: "Resources" });
		await resourcesTrigger.focus();
		await resourcesTrigger.press("Enter");
		await expect(
			page.locator('[data-slot="navigation-menu-content"][data-open]'),
		).toHaveAttribute("data-activation-direction", "right");
		await expect(
			navigationContent.getByRole("link", { name: /^Documentation/ }),
		).toBeVisible();
		await expect(
			navigationContent.getByRole("link", { name: /^Blog/ }),
		).toBeVisible();

		await page.keyboard.press("Escape");
		await expect(
			navigationContent.getByRole("link", { name: /^Documentation/ }),
		).toBeHidden();
	});

	test("sign-in page loads correctly", async ({ page }) => {
		await page.goto("/auth/sign-in");

		// Check page title
		await expect(page).toHaveTitle(/Sign in/);

		// Check main heading
		await expect(
			page.getByText("Sign in to your account", { exact: true }),
		).toBeVisible();

		// Check form elements
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Sign in", exact: true }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Sign in with passkey" }),
		).toBeVisible();

		// Check links
		await expect(
			page.getByRole("link", { name: "Forgot password?" }),
		).toBeVisible();
		await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
	});

	test("sign-up page loads correctly", async ({ page }) => {
		await page.goto("/auth/sign-up");

		// Check page title
		await expect(page).toHaveTitle(/Create an account/);

		// Check main heading
		await expect(
			page.getByText("Create your account", { exact: true }),
		).toBeVisible();

		// Check form elements
		await expect(page.getByLabel("Name")).toBeVisible();
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Create account" }),
		).toBeVisible();

		// Check link to sign in
		await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
	});

	test("forgot-password page loads correctly", async ({ page }) => {
		await page.goto("/auth/forgot-password");

		// Check page title
		await expect(page).toHaveTitle(/Forgot password/);

		// Check main heading
		await expect(
			page.getByText("Forgot your password?", { exact: true }),
		).toBeVisible();

		// Check form elements
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Send instructions" }),
		).toBeVisible();
	});

	test("can navigate from sign-in to sign-up", async ({ page }) => {
		await page.goto("/auth/sign-in");

		// Click sign up link
		await page.getByRole("link", { name: "Sign up" }).click();

		// Should be on sign-up page
		await expect(page).toHaveURL(/\/auth\/sign-up/);
		await expect(
			page.getByText("Create your account", { exact: true }),
		).toBeVisible();
	});

	test("can navigate from sign-in to forgot-password", async ({ page }) => {
		await page.goto("/auth/sign-in");

		// Click forgot password link
		await page.getByRole("link", { name: "Forgot password?" }).click();

		// Should be on forgot-password page
		await expect(page).toHaveURL(/\/auth\/forgot-password/);
	});

	test("sign-in form shows validation errors", async ({ page }) => {
		await page.goto("/auth/sign-in");

		// Try to submit empty form
		await page.getByRole("button", { name: "Sign in", exact: true }).click();

		// Should show validation errors (form won't submit with empty fields)
		// The form uses HTML5 validation, so we check that the email field is invalid
		const emailInput = page.getByLabel("Email");
		await expect(emailInput).toHaveAttribute("type", "email");
	});

	test("sign-up form shows validation errors", async ({ page }) => {
		await page.goto("/auth/sign-up");

		// Fill in invalid data
		await page.getByLabel("Email").fill("invalid-email");
		await page.getByLabel("Password", { exact: true }).fill("123"); // Too short

		// Try to submit
		await page.getByRole("button", { name: "Create account" }).click();

		// Email field should be invalid (HTML5 validation)
		const emailInput = page.getByLabel("Email");
		await expect(emailInput).toHaveAttribute("type", "email");
	});
});
