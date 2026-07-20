import {
	Body,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Preview,
	Text,
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";
import type * as React from "react";

export type ContactFormEmailProps = {
	appName: string;
	firstName: string;
	lastName: string;
	email: string;
	message: string;
};

function ContactFormEmail({
	appName,
	firstName,
	lastName,
	email,
	message,
}: ContactFormEmailProps): React.JSX.Element {
	return (
		<Html>
			<Head />
			<Preview>
				New contact form submission from {firstName} {lastName}
			</Preview>
			<Tailwind>
				<Body className="m-auto bg-white px-2 font-sans">
					<Container className="mx-auto my-[40px] max-w-[465px] rounded-sm border border-solid border-[#eaeaea] p-[20px]">
						<Heading className="mx-0 my-[30px] p-0 text-center text-[24px] font-normal text-black">
							New Contact Form Submission
						</Heading>
						<Text className="text-[14px] leading-[24px] text-black">
							You received a new message from the {appName} contact form.
						</Text>
						<Hr className="mx-0 my-[16px] w-full border border-solid border-[#eaeaea]" />
						<Text className="text-[14px] leading-[24px] text-black">
							<strong>Name:</strong> {firstName} {lastName}
						</Text>
						<Text className="text-[14px] leading-[24px] text-black">
							<strong>Email:</strong> {email}
						</Text>
						<Hr className="mx-0 my-[16px] w-full border border-solid border-[#eaeaea]" />
						<Text className="text-[14px] leading-[24px] text-black">
							<strong>Message:</strong>
						</Text>
						<Text className="text-[14px] leading-[24px] whitespace-pre-wrap text-black">
							{message}
						</Text>
						<Hr className="mx-0 my-[26px] w-full border border-solid border-[#eaeaea]" />
						<Text className="text-[12px] leading-[24px] text-[#666666]">
							This email was sent from the contact form on {appName}. Reply
							directly to this email to respond to {firstName}.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

ContactFormEmail.PreviewProps = {
	appName: "Acme",
	firstName: "John",
	lastName: "Doe",
	email: "john.doe@example.com",
	message:
		"Hi there!\n\nI'm interested in learning more about your product. Could you please send me some information?\n\nThanks!",
} satisfies ContactFormEmailProps;

export default ContactFormEmail;
export { ContactFormEmail };
