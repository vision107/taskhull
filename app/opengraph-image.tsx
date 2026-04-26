import { ImageResponse } from "next/og";
import { appConfig } from "@/config/app.config";

export const runtime = "edge";
export const alt = appConfig.appName;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "flex-start",
				justifyContent: "center",
				padding: "80px",
				background:
					"linear-gradient(135deg, #0a1628 0%, #0f2340 45%, #296ca5 100%)",
				color: "#ffffff",
				fontFamily: "sans-serif",
				position: "relative",
			}}
		>
			<div
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage:
						"radial-gradient(circle at 85% 75%, rgba(144, 205, 230, 0.25) 0%, transparent 50%)",
					display: "flex",
				}}
			/>

			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "16px",
					fontSize: "28px",
					opacity: 0.9,
					letterSpacing: "0.02em",
					zIndex: 1,
				}}
			>
				<span
					style={{
						width: "14px",
						height: "14px",
						borderRadius: "999px",
						background: "#fab02a",
						display: "flex",
					}}
				/>
				{appConfig.appName.toLowerCase()}
			</div>

			<div
				style={{
					display: "flex",
					fontSize: "120px",
					fontWeight: 700,
					letterSpacing: "-0.04em",
					marginTop: "32px",
					lineHeight: 1,
					zIndex: 1,
				}}
			>
				{appConfig.appName}
			</div>

			<div
				style={{
					display: "flex",
					fontSize: "42px",
					marginTop: "28px",
					maxWidth: "900px",
					lineHeight: 1.2,
					opacity: 0.85,
					zIndex: 1,
				}}
			>
				{appConfig.description}
			</div>

			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "12px",
					fontSize: "24px",
					marginTop: "auto",
					opacity: 0.7,
					zIndex: 1,
				}}
			>
				<span
					style={{
						width: "32px",
						height: "2px",
						background: "#ffffff",
						display: "flex",
					}}
				/>
				Plan, track, and ship — without the noise
			</div>
		</div>,
		{ ...size },
	);
}
