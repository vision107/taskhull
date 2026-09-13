/**
 * Browser-only helpers for preparing photos before upload.
 */

export const PHOTO_MAX_EDGE_PX = 2000;

/**
 * Downscales a photo so its longest edge is at most `maxEdge` pixels and
 * re-encodes it as JPEG (quality 0.85). Returns the original file when it is
 * not a raster image the browser can decode, when it is already small
 * enough, or when re-encoding would not make it smaller.
 */
export async function downscalePhoto(
	file: File,
	maxEdge: number = PHOTO_MAX_EDGE_PX,
): Promise<File> {
	if (typeof window === "undefined") return file;
	if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
		return file;
	}

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
	} catch {
		// HEIC on non-Safari browsers etc. – upload as is, the server accepts it.
		return file;
	}

	try {
		const { width, height } = bitmap;
		const scale = Math.min(1, maxEdge / Math.max(width, height));
		if (scale === 1 && file.type === "image/jpeg") return file;

		const targetWidth = Math.max(1, Math.round(width * scale));
		const targetHeight = Math.max(1, Math.round(height * scale));

		const canvas = document.createElement("canvas");
		canvas.width = targetWidth;
		canvas.height = targetHeight;
		const context = canvas.getContext("2d");
		if (!context) return file;
		context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, "image/jpeg", 0.85),
		);
		if (!blob || blob.size >= file.size) return file;

		const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
		return new File([blob], `${baseName}.jpg`, {
			type: "image/jpeg",
			lastModified: file.lastModified,
		});
	} finally {
		bitmap.close();
	}
}
