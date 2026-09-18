import type { MetadataRoute } from "next";

import { appConfig } from "@/config/app.config";

/**
 * Web app manifest. Installing from the worker view opens straight into
 * "My tasks" in standalone mode.
 */
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: appConfig.appName,
		short_name: appConfig.appName,
		description: appConfig.description,
		id: "/dashboard",
		start_url: "/dashboard",
		scope: "/",
		display: "standalone",
		orientation: "portrait",
		background_color: "#ffffff",
		theme_color: "#0a0a0a",
		categories: ["productivity", "business"],
		icons: [
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
