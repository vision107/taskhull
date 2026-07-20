import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";
import type * as React from "react";

export type VerifyEmailAddressEmailProps = {
	name: string;
	verificationLink: string;
};

function VerifyEmailAddressEmail({
	name,
	verificationLink,
}: VerifyEmailAddressEmailProps): React.JSX.Element {
	return (
		<Html>
			<Head />
			<Preview>Email Verification</Preview>
			<Tailwind>
				<Body className="m-auto bg-white px-2 font-sans">
					<Container className="mx-auto my-[40px] max-w-[465px] rounded-sm border border-solid border-[#eaeaea] p-[20px]">
						<Heading className="mx-0 my-[30px] p-0 text-center text-[24px] font-normal text-black">
							Email Verification
						</Heading>
						<Text className="text-[14px] leading-[24px] text-black">
							Hello {name},
						</Text>
						<Text className="text-[14px] leading-[24px] text-black">
							To complete your account, you need verify your email address.
						</Text>
						<Section className="my-[32px] text-center">
							<Button
								href={verificationLink}
								className="rounded-sm bg-[#000000] px-5 py-3 text-center text-[12px] font-semibold text-white no-underline"
							>
								Verify email
							</Button>
						</Section>
						<Text className="text-[14px] leading-[24px] text-black">
							or copy and paste this URL into your browser:{" "}
							<Link
								href={verificationLink}
								className="break-all text-blue-600 no-underline"
							>
								{verificationLink}
							</Link>
						</Text>
						<Hr className="mx-0 my-[26px] w-full border border-solid border-[#eaeaea]" />
						<Text className="text-[12px] leading-[24px] text-[#666666]">
							If you don't want to verify your email or didn't request this,
							just ignore and delete this message. Please don't forward this
							email to anyone.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

VerifyEmailAddressEmail.PreviewProps = {
	name: "John Doe",
	verificationLink:
		"https://example.com/verify-email/request/bcab80ca8eb6ee41d4e7e34bb157a0e205ab3188a78599137b76d883e86e7036",
} satisfies VerifyEmailAddressEmailProps;

export default VerifyEmailAddressEmail;
export { VerifyEmailAddressEmail };
