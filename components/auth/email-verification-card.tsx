"use client";

import { Loader2Icon, MailCheckIcon, MailIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { withQuery } from "ufo";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";
import { getAuthErrorMessage } from "@/lib/auth/constants";
import { getEmailVerificationCallbackPath } from "@/lib/auth/email-verification";
import { forgotPasswordSchema } from "@/schemas/auth-schemas";

type EmailVerificationCardProps = {
	redirectTo: string;
	email?: string;
	errorMessage?: string;
	showSignUpAgain?: boolean;
};

export function EmailVerificationCard({
	redirectTo,
	email,
	errorMessage,
	showSignUpAgain = false,
}: EmailVerificationCardProps): React.JSX.Element {
	const methods = useZodForm({
		schema: forgotPasswordSchema,
		defaultValues: { email: email ?? "" },
	});
	const [resendSucceeded, setResendSucceeded] = React.useState(false);
	const submittingRef = React.useRef(false);
	const successHeadingRef = React.useRef<HTMLSpanElement>(null);

	React.useEffect(() => {
		if (resendSucceeded) {
			successHeadingRef.current?.focus();
		}
	}, [resendSucceeded]);

	const resend = methods.handleSubmit(async (values) => {
		if (submittingRef.current) return;
		submittingRef.current = true;
		methods.clearErrors("root");

		try {
			const normalizedEmail = (email ?? values.email).trim().toLowerCase();
			const { error: resendError } = await authClient.sendVerificationEmail({
				email: normalizedEmail,
				callbackURL: getEmailVerificationCallbackPath(
					redirectTo,
					normalizedEmail,
				),
			});
			if (resendError) throw resendError;
			setResendSucceeded(true);
		} catch (error) {
			methods.setError("root", {
				message: getAuthErrorMessage(
					error && typeof error === "object" && "code" in error
						? String(error.code)
						: undefined,
				),
			});
		} finally {
			submittingRef.current = false;
		}
	});

	return (
		<Card className="w-full border-transparent px-0 py-8 [--card-spacing:--spacing(8)] dark:border-border">
			<CardHeader>
				<div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted">
					<MailCheckIcon className="size-5" />
				</div>
				<CardTitle className="text-base lg:text-lg">
					<span
						ref={successHeadingRef}
						tabIndex={resendSucceeded ? -1 : undefined}
					>
						{resendSucceeded
							? "Check your inbox"
							: errorMessage
								? "Verification link issue"
								: "Verify your email"}
					</span>
				</CardTitle>
				<CardDescription>
					{resendSucceeded ? (
						"We sent a new verification link. Check spam if it does not appear."
					) : errorMessage ? (
						errorMessage
					) : email ? (
						<>
							We sent a link to{" "}
							<span className="font-medium text-foreground">{email}</span>.
							Check your inbox to continue.
						</>
					) : (
						"Enter your email address to request a new verification link."
					)}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{resendSucceeded ? (
					<p aria-live="polite" className="sr-only" role="status">
						New verification link sent.
					</p>
				) : (
					<Form {...methods}>
						<form className="space-y-4" noValidate onSubmit={resend}>
							{email ? null : (
								<FormField
									control={methods.control}
									name="email"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Email</FormLabel>
												<FormControl>
													<InputGroup>
														<InputGroupAddon align="inline-start">
															<InputGroupText>
																<MailIcon className="size-4 shrink-0" />
															</InputGroupText>
														</InputGroupAddon>
														<InputGroupInput
															{...field}
															autoCapitalize="off"
															autoComplete="email"
															disabled={methods.formState.isSubmitting}
															maxLength={255}
															type="email"
														/>
													</InputGroup>
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>
							)}
							{methods.formState.errors.root?.message ? (
								<Alert variant="destructive">
									<AlertDescription>
										{methods.formState.errors.root.message}
									</AlertDescription>
								</Alert>
							) : null}
							<Button
								aria-disabled={methods.formState.isSubmitting}
								className="w-full"
								type="submit"
							>
								{methods.formState.isSubmitting ? (
									<Loader2Icon className="size-4 animate-spin" />
								) : null}
								{methods.formState.isSubmitting
									? "Sending..."
									: "Resend verification email"}
							</Button>
						</form>
					</Form>
				)}
			</CardContent>
			<CardFooter className="flex flex-wrap justify-center gap-x-4 gap-y-2 py-4 text-sm text-muted-foreground">
				<span>
					Already verified?{" "}
					<Link
						className="text-foreground underline"
						href={withQuery("/auth/sign-in", { redirectTo })}
					>
						Sign in
					</Link>
				</span>
				{showSignUpAgain && !resendSucceeded ? (
					<span>
						Wrong email?{" "}
						<Link className="text-foreground underline" href="/auth/sign-up">
							Sign up again
						</Link>
					</span>
				) : null}
			</CardFooter>
		</Card>
	);
}
