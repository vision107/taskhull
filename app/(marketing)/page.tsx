import { CtaSection } from "@/components/marketing/sections/cta-section";
import { FaqSection } from "@/components/marketing/sections/faq-section";
import { FeaturesSection } from "@/components/marketing/sections/features-section";
import { HeroSection } from "@/components/marketing/sections/hero-section";
import { LatestArticlesSection } from "@/components/marketing/sections/latest-articles-section";
import { LogoCloudSection } from "@/components/marketing/sections/logo-cloud-section";
import { PricingSection } from "@/components/marketing/sections/pricing-section";
import { StatsSection } from "@/components/marketing/sections/stats-section";
import { TestimonialsSection } from "@/components/marketing/sections/testimonials-section";
import { appConfig } from "@/config/app.config";
import { getAllPosts } from "@/lib/marketing/blog/posts";

function OrganizationJsonLd() {
	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: appConfig.appName,
		description: appConfig.description,
		url: appConfig.baseUrl,
		logo: `${appConfig.baseUrl}/favicon.svg`,
		contactPoint: {
			"@type": "ContactPoint",
			email: appConfig.contact.email,
			telephone: appConfig.contact.phone,
			contactType: "customer service",
		},
		address: {
			"@type": "PostalAddress",
			streetAddress: appConfig.contact.address,
		},
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
		/>
	);
}

function WebSiteJsonLd() {
	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: appConfig.appName,
		description: appConfig.description,
		url: appConfig.baseUrl,
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${appConfig.baseUrl}/blog?q={search_term_string}`,
			},
			"query-input": "required name=search_term_string",
		},
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
		/>
	);
}

export default async function HomePage() {
	const posts = await getAllPosts();

	const faqContent = {
		headline: "Questions & Answers",
		items: [
			{
				question: "How do I get started?",
				answer:
					"Getting started is simple. Sign up for a free account, complete the onboarding process and you'll be ready to go in minutes.",
			},
			{
				question: "Is there a free trial available?",
				answer:
					"Yes, we offer a 14-day free trial with full access to all features. No credit card required to start.",
			},
			{
				question: "Can I cancel my subscription anytime?",
				answer:
					"Absolutely. You can cancel your subscription at any time from your account settings. No questions asked.",
			},
			{
				question: "Do you offer customer support?",
				answer:
					"We provide dedicated customer support via email and live chat. Our team typically responds within a few hours.",
			},
			{
				question: "Is my data secure?",
				answer:
					"Security is our top priority. We use industry-standard encryption and follow best practices to keep your data safe.",
			},
		],
	};

	const ctaContent = {
		headline: "Your week. In one hull.",
		description:
			"Stop juggling five apps. Give your tasks a place to live, and yourself a week you can actually finish. Free while we're in beta.",
		primaryCta: {
			text: "Start for free",
			href: "/auth/sign-up",
		},
		secondaryCta: {
			text: "Talk to us",
			href: "/contact",
		},
	};

	return (
		<>
			<OrganizationJsonLd />
			<WebSiteJsonLd />
			<HeroSection />
			<LogoCloudSection />
			<FeaturesSection />
			<StatsSection />
			<TestimonialsSection />
			<FaqSection content={faqContent} />
			<PricingSection />
			<LatestArticlesSection posts={posts} />
			<CtaSection content={ctaContent} />
		</>
	);
}
