import { authConfig } from "@/config/auth.config";
import {
	canDeleteOrganization,
	canManageOrganizationMembers,
} from "@/lib/auth/organization-permissions";
import type { Organization } from "@/types/organization";

function getOrganizationRole(
	organization?: Organization | null,
	user?: { id: string } | null,
): string | undefined {
	return organization?.members.find((member) => member.userId === user?.id)
		?.role;
}

export function isOrganizationAdmin(
	organization?: Organization | null,
	user?: {
		id: string;
		role?: string | null;
	} | null,
): boolean {
	return canManageOrganizationMembers(getOrganizationRole(organization, user));
}

export function isOrganizationOwner(
	organization?: Organization | null,
	user?: { id: string } | null,
): boolean {
	return canDeleteOrganization(getOrganizationRole(organization, user));
}

class PasswordValidator {
	public containsLowerAndUpperCase(str?: string | null): boolean {
		return this.isNotNullOrEmpty(str) && str !== str!.toLowerCase();
	}

	public hasMinimumLength(str?: string | null): boolean {
		return (
			this.isNotNullOrEmpty(str) &&
			str!.length >= authConfig.minimumPasswordLength
		);
	}

	public containsNumber(str?: string | null): boolean {
		return this.isNotNullOrEmpty(str) && /\d/.test(str!);
	}

	public validate(str?: string | null): { success: boolean; errors: string[] } {
		let success = true;
		const errors: string[] = [];

		if (!this.containsLowerAndUpperCase(str)) {
			success = false;
			errors.push(
				"The password should contain lower and upper case characters.",
			);
		}

		if (!this.hasMinimumLength(str)) {
			success = false;
			errors.push(
				`The password should be at least ${authConfig.minimumPasswordLength} characters long.`,
			);
		}

		if (!this.containsNumber(str)) {
			success = false;
			errors.push("The password should contain at least one number.");
		}

		return { success, errors };
	}

	private isNotNullOrEmpty(str?: string | null): boolean {
		return !!str;
	}
}

export const passwordValidator = new PasswordValidator();
