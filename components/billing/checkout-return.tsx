"use client";

import { CircleAlertIcon, LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useProgressRouter } from "@/hooks/use-progress-router";
import { trpc } from "@/trpc/client";

const CHECKOUT_SYNC_TIMEOUT_MS = 20_000;

export type CheckoutReturnProps = {
	sessionId?: string;
	destination?: "subscription" | "credits";
};

export function CheckoutReturn({
	sessionId,
	destination = "subscription",
}: CheckoutReturnProps) {
	const router = useProgressRouter();
	const utils = trpc.useUtils();
	const [timedOut, setTimedOut] = useState(false);
	const [attempt, setAttempt] = useState(0);
	const hasRedirected = useRef(false);
	const checkout = trpc.organization.subscription.checkoutReturn.useQuery(
		{ sessionId: sessionId ?? "" },
		{
			enabled: Boolean(sessionId) && !timedOut,
			refetchInterval: (query) =>
				query.state.data?.ready || query.state.status === "error"
					? false
					: 1_000,
			retry: false,
		},
	);

	useEffect(() => {
		if (!sessionId || checkout.data?.ready || checkout.isError) return;

		const timeout = window.setTimeout(
			() => setTimedOut(true),
			CHECKOUT_SYNC_TIMEOUT_MS,
		);
		return () => window.clearTimeout(timeout);
	}, [attempt, checkout.data?.ready, checkout.isError, sessionId]);

	useEffect(() => {
		if (!checkout.data?.ready || hasRedirected.current) return;
		hasRedirected.current = true;

		void Promise.all([
			utils.organization.subscription.getStatus.invalidate(),
			utils.organization.subscription.listInvoices.invalidate(),
			utils.organization.credit.getBalance.invalidate(),
			utils.organization.credit.getTransactions.invalidate(),
			utils.organization.get.invalidate(),
			utils.organization.list.invalidate(),
		]).then(() => {
			const tab = destination === "credits" ? "credits" : "subscription";
			router.replace(
				`/dashboard/organization/settings?tab=${tab}&success=true`,
			);
		});
	}, [checkout.data?.ready, destination, router, utils]);

	const retry = () => {
		setTimedOut(false);
		setAttempt((current) => current + 1);
	};

	const hasError = !sessionId || checkout.isError;
	const returnTab = destination === "credits" ? "credits" : "subscription";
	const title = hasError
		? "We could not verify this checkout"
		: timedOut
			? "Your payment is still processing"
			: "Confirming your purchase";

	return (
		<div className="flex min-h-[60vh] items-center justify-center p-4">
			<Card className="w-full max-w-lg">
				<CardHeader className="text-center">
					<div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full border">
						{hasError || timedOut ? (
							<CircleAlertIcon className="size-5" />
						) : (
							<LoaderCircleIcon className="size-5 animate-spin" />
						)}
					</div>
					<CardTitle>{title}</CardTitle>
					<CardDescription>
						{hasError
							? "The checkout session is invalid or does not belong to the active organization."
							: timedOut
								? "Stripe accepted the checkout, but the update has not reached your account yet. You can safely retry."
								: "Stripe is processing the payment. This page will continue automatically when your account is ready."}
					</CardDescription>
				</CardHeader>
				{(hasError || timedOut) && (
					<CardContent className="flex flex-col gap-2 sm:flex-row sm:justify-center">
						{timedOut && (
							<Button type="button" onClick={retry}>
								Try again
							</Button>
						)}
						<Link
							className={buttonVariants({ variant: "outline" })}
							href={`/dashboard/organization/settings?tab=${returnTab}`}
						>
							Return to billing
						</Link>
					</CardContent>
				)}
			</Card>
		</div>
	);
}
