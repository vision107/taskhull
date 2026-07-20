import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";
import type * as React from "react";

export type PaymentFailedEmailProps = {
	appName: string;
	organizationName: string;
	userName: string;
	amount: string;
	currency: string;
	updatePaymentLink: string;
	invoiceId?: string;
};

function PaymentFailedEmail({
	appName,
	organizationName,
	userName,
	amount,
	currency,
	updatePaymentLink,
	invoiceId,
}: PaymentFailedEmailProps): React.JSX.Element {
	return (
		<Html>
			<Head />
			<Preview>Payment failed for {organizationName} - Action required</Preview>
			<Tailwind>
				<Body className="m-auto bg-white px-2 font-sans">
					<Container className="mx-auto my-[40px] max-w-[465px] rounded-sm border border-solid border-[#eaeaea] p-[20px]">
						<Heading className="mx-0 my-[30px] p-0 text-center text-[24px] font-normal text-black">
							Payment Failed
						</Heading>
						<Text className="text-[14px] leading-[24px] text-black">
							Hello {userName},
						</Text>
						<Text className="text-[14px] leading-[24px] text-black">
							We were unable to process the payment for{" "}
							<strong>{organizationName}</strong>'s subscription.
						</Text>

						{/* Payment Details */}
						<Section className="my-[24px] rounded-md border border-solid border-[#eaeaea] bg-[#f9f9f9] p-[16px]">
							<Text className="m-0 text-[14px] leading-[24px] text-black">
								<strong>Amount:</strong> {amount} {currency.toUpperCase()}
							</Text>
							{invoiceId && (
								<Text className="m-0 text-[14px] leading-[24px] text-black">
									<strong>Invoice:</strong> {invoiceId}
								</Text>
							)}
						</Section>

						<Text className="text-[14px] leading-[24px] text-black">
							To avoid any interruption to your service, please update your
							payment method as soon as possible. Your subscription will remain
							active for a limited time while we retry the payment.
						</Text>

						<Section className="my-[32px] text-center">
							<Button
								href={updatePaymentLink}
								className="rounded-sm bg-[#dc2626] px-5 py-3 text-center text-[12px] font-semibold text-white no-underline"
							>
								Update Payment Method
							</Button>
						</Section>

						<Text className="text-[14px] leading-[24px] text-black">
							If you believe this is an error or have already updated your
							payment method, please disregard this email. If you have any
							questions, please contact our support team.
						</Text>

						<Hr className="mx-0 my-[26px] w-full border border-solid border-[#eaeaea]" />
						<Text className="text-[12px] leading-[24px] text-[#666666]">
							You receive this email because you are a billing administrator for{" "}
							{organizationName} on {appName}.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

PaymentFailedEmail.PreviewProps = {
	appName: "Acme",
	organizationName: "Evil Corp",
	userName: "John Doe",
	amount: "29.00",
	currency: "usd",
	updatePaymentLink:
		"https://example.com/organization/settings?tab=subscription",
	invoiceId: "INV-2024-001234",
} satisfies PaymentFailedEmailProps;

export default PaymentFailedEmail;
export { PaymentFailedEmail };
