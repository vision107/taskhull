import type { Metadata } from "next";

import { CheckoutReturn } from "@/components/billing/checkout-return";

export const metadata: Metadata = { title: "Confirming checkout" };

export default async function CheckoutReturnPage({
	searchParams,
}: {
	searchParams: Promise<{
		session_id?: string;
		destination?: string;
	}>;
}) {
	const { session_id: sessionId, destination } = await searchParams;

	return (
		<CheckoutReturn
			sessionId={sessionId}
			destination={destination === "credits" ? "credits" : "subscription"}
		/>
	);
}
