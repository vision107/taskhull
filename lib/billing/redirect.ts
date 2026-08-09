import { appConfig } from "@/config/app.config";

const applicationOrigin = new URL(appConfig.baseUrl).origin;

export function isAllowedPaymentRedirectUrl(url: string): boolean {
	try {
		return new URL(url).origin === applicationOrigin;
	} catch {
		return false;
	}
}
