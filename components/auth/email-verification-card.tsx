"use client";

import { MailCheckIcon, MailIcon } from "lucide-react";
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
};

export function EmailVerificationCard({
	redirectTo,
	email,
	errorMessage,
}: EmailVerificationCardProps): React.JSX.Element {
	const callbackURL = getEmailVerificationCallbackPath(redirectTo);
	const methods = useZodForm({
		schema: forgotPasswordSchema,
		defaultValues: { email: email ?? "" },
	});
	const [sentTo, setSentTo] = React.useState<string | null>(
		errorMessage ? null : (email ?? null),
	);

	const resend = methods.handleSubmit(async (values) => {
		methods.clearErrors("root");

		try {
			const normalizedEmail = values.email.trim().toLowerCase();
			const { error: resendError } = await authClient.sendVerificationEmail({
				email: normalizedEmail,
				callbackURL,
			});
			if (resendError) throw resendError;
			setSentTo(normalizedEmail);
		} catch (error) {
			methods.setError("root", {
				message: getAuthErrorMessage(
					error && typeof error === "object" && "code" in error
						? String(error.code)
						: undefined,
				),
			});
		}
	});

	return (
		<Card className="w-full border-transparent px-0 py-8 [--card-spacing:--spacing(8)] dark:border-border">
			<CardHeader>
				<div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted">
					<MailCheckIcon className="size-5" />
				</div>
				<CardTitle className="text-base lg:text-lg">
					{errorMessage ? "Verification link issue" : "Check your email"}
				</CardTitle>
				<CardDescription>
					{errorMessage ??
						"Open the verification link we sent to finish setting up your account."}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{sentTo ? (
					<Alert variant="info">
						<AlertDescription>
							If an unverified account exists for{" "}
							<span className="font-medium text-foreground">{sentTo}</span>, a
							new verification link is on its way.
						</AlertDescription>
					</Alert>
				) : null}
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
							className="w-full"
							disabled={methods.formState.isSubmitting}
							loading={methods.formState.isSubmitting}
							type="submit"
							variant={sentTo ? "outline" : "default"}
						>
							{sentTo ? "Resend verification email" : "Send verification email"}
						</Button>
					</form>
				</Form>
			</CardContent>
			<CardFooter className="flex justify-center py-4 text-sm text-muted-foreground">
				<Link
					className="text-foreground underline"
					href={withQuery("/auth/sign-in", { redirectTo })}
				>
					Back to sign in
				</Link>
			</CardFooter>
		</Card>
	);
}
