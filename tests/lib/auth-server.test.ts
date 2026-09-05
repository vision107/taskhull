import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getFullOrganization: vi.fn(),
	headers: vi.fn(),
	loggerError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getFullOrganization: mocks.getFullOrganization,
		},
	},
}));

vi.mock("@/lib/logger", () => ({
	logger: {
		error: mocks.loggerError,
	},
}));

vi.mock("next/headers", () => ({
	headers: mocks.headers,
}));

vi.unmock("@/lib/auth/server");

describe.sequential("getOrganizationById", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		mocks.headers.mockResolvedValue(new Headers());
		mocks.getFullOrganization.mockResolvedValue(null);
	});

	it("returns null when Better Auth confirms that the organization is missing", async () => {
		const { getOrganizationById } = await import("@/lib/auth/server");

		await expect(getOrganizationById("missing-org")).resolves.toBeNull();
		expect(mocks.loggerError).not.toHaveBeenCalled();
	});

	it("logs and propagates transient lookup failures", async () => {
		const transientError = new Error("database unavailable");
		mocks.getFullOrganization.mockRejectedValue(transientError);
		const { getOrganizationById } = await import("@/lib/auth/server");

		await expect(getOrganizationById("org-id")).rejects.toBe(transientError);
		expect(mocks.loggerError).toHaveBeenCalledWith(
			{ error: transientError, organizationId: "org-id" },
			"Failed to get organization",
		);
	});

	it("does not turn a transient membership lookup failure into NOT_FOUND", async () => {
		const transientError = new Error("auth API unavailable");
		mocks.getFullOrganization.mockRejectedValue(transientError);
		const { assertUserIsOrgMember } = await import("@/lib/auth/server");

		await expect(assertUserIsOrgMember("org-id", "user-id")).rejects.toBe(
			transientError,
		);
	});
});
