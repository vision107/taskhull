import type { MetadataRoute } from "next";
import { appConfig } from "@/config/app.config";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: appConfig.appName,
		short_name: appConfig.appName,
		description: appConfig.description,
		lang: "en",
		start_url: "/",
		scope: "/",
		display: "standalone",
		orientation: "any",
		background_color: "#ffffff",
		theme_color: "#296ca5",
		categories: ["productivity", "business"],
		icons: [
			{
				src: "/favicon.svg",
				sizes: "any",
				type: "image/svg+xml",
			},
			{
				src: "/web-app-manifest-192x192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/web-app-manifest-192x192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "maskable",
			},
			{
				src: "/web-app-manifest-512x512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/web-app-manifest-512x512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
	};
}
