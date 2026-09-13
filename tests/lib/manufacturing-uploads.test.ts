import { describe, expect, it } from "vitest";

import {
	normalizeContentType,
	UPLOAD_LIMITS,
	uploadRejection,
} from "@/lib/manufacturing/uploads";

describe("upload rules", () => {
	it("accepts phone photos and rejects other media", () => {
		expect(
			uploadRejection("photo", {
				fileName: "IMG_0001.HEIC",
				contentType: "image/heic",
				sizeBytes: 3_000_000,
			}),
		).toBeNull();
		expect(
			uploadRejection("photo", {
				fileName: "clip.mp4",
				contentType: "video/mp4",
				sizeBytes: 3_000_000,
			}),
		).toMatch(/only JPEG, PNG, WebP or HEIC/);
		expect(
			uploadRejection("photo", {
				fileName: "drawing.pdf",
				contentType: "application/pdf",
				sizeBytes: 3_000_000,
			}),
		).not.toBeNull();
	});

	it("enforces size caps per kind", () => {
		expect(
			uploadRejection("photo", {
				fileName: "big.jpg",
				contentType: "image/jpeg",
				sizeBytes: UPLOAD_LIMITS.photo.maxBytes + 1,
			}),
		).toMatch(/too large/);
		expect(
			uploadRejection("document", {
				fileName: "big.pdf",
				contentType: "application/pdf",
				sizeBytes: UPLOAD_LIMITS.photo.maxBytes + 1,
			}),
		).toBeNull();
		expect(
			uploadRejection("document", {
				fileName: "empty.pdf",
				contentType: "application/pdf",
				sizeBytes: 0,
			}),
		).toMatch(/empty/);
	});

	it("falls back to the extension when the browser gives no useful type", () => {
		expect(
			uploadRejection("document", {
				fileName: "frame.dxf",
				contentType: "",
				sizeBytes: 1024,
			}),
		).toBeNull();
		expect(
			uploadRejection("document", {
				fileName: "frame.step",
				contentType: "application/octet-stream",
				sizeBytes: 1024,
			}),
		).toBeNull();
		expect(
			uploadRejection("document", {
				fileName: "installer.exe",
				contentType: "application/octet-stream",
				sizeBytes: 1024,
			}),
		).not.toBeNull();
	});

	it("normalizes content types for the presigned PUT", () => {
		expect(normalizeContentType("image/JPEG; charset=binary")).toBe(
			"image/jpeg",
		);
		expect(normalizeContentType("")).toBe("application/octet-stream");
		expect(normalizeContentType(undefined)).toBe("application/octet-stream");
	});
});
