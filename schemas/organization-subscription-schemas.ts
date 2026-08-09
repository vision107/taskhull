import { z } from "zod/v4";

import { appConfig } from "@/config/app.config";
import { isAllowedPaymentRedirectUrl } from "@/lib/billing/redirect";

export const paymentRedirectUrlSchema = z
	.string()
	.url()
	.refine(isAllowedPaymentRedirectUrl, {
		message: "Redirect URL must use the application origin",
	});

// Pagination schema for subscription queries
export const listSubscriptionsSchema = z.object({
	limit: z
		.number()
		.min(1)
		.max(appConfig.pagination.maxLimit)
		.default(appConfig.pagination.defaultLimit),
	offset: z.number().min(0).default(0),
});

// Get invoices schema
export const listInvoicesSchema = z.object({
	limit: z
		.number()
		.min(1)
		.max(appConfig.pagination.maxLimit)
		.default(appConfig.pagination.defaultLimit),
});

// Create checkout session schema
export const createCheckoutSchema = z.object({
	priceId: z.string().min(1, "Price ID is required"),
	quantity: z.number().min(1).default(1),
	successUrl: paymentRedirectUrlSchema.optional(),
	cancelUrl: paymentRedirectUrlSchema.optional(),
});

export const checkoutReturnSchema = z.object({
	sessionId: z
		.string()
		.min(4)
		.max(255)
		.regex(/^cs_[A-Za-z0-9_]+$/, "Invalid checkout session ID"),
});

// Create portal session schema
export const createPortalSessionSchema = z.object({
	returnUrl: paymentRedirectUrlSchema.optional(),
});

// Plan change schema (used for both preview and mutation)
export const planChangeSchema = z.object({
	newPriceId: z.string().min(1, "Price ID is required"),
	quantity: z.number().min(1).optional(),
});

// Update seats schema
export const updateSeatsSchema = z.object({
	quantity: z.number().min(1, "At least 1 seat is required"),
});

// Type exports
export type ListSubscriptionsInput = z.infer<typeof listSubscriptionsSchema>;
export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type CreatePortalSessionInput = z.infer<
	typeof createPortalSessionSchema
>;
export type PlanChangeInput = z.infer<typeof planChangeSchema>;
export type UpdateSeatsInput = z.infer<typeof updateSeatsSchema>;
