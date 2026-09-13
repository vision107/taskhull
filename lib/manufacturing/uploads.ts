/**
 * Upload rules shared by the client (pre-flight check, error copy) and the
 * server (Zod refinement + presigned PUT pinning). Keep this file free of
 * server-only imports.
 */

export type UploadKind = "photo" | "document";

const MB = 1024 * 1024;

export const UPLOAD_LIMITS: Record<
	UploadKind,
	{ maxBytes: number; label: string }
> = {
	photo: { maxBytes: 15 * MB, label: "15 MB" },
	document: { maxBytes: 50 * MB, label: "50 MB" },
};

const PHOTO_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/heic",
	"image/heif",
]);

const DOCUMENT_TYPES = new Set([
	...PHOTO_TYPES,
	"image/gif",
	"image/svg+xml",
	"application/pdf",
	"text/plain",
	"text/csv",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	// CAD exports; browsers usually report these as octet-stream or a vendor type.
	"application/dxf",
	"image/vnd.dxf",
	"application/step",
	"application/x-step",
	"model/step",
	"application/acad",
	"image/vnd.dwg",
]);

/** Extensions accepted even when the browser reports no/unknown MIME type. */
const DOCUMENT_EXTENSIONS = new Set([
	"pdf",
	"txt",
	"csv",
	"doc",
	"docx",
	"xls",
	"xlsx",
	"ppt",
	"pptx",
	"dxf",
	"dwg",
	"step",
	"stp",
	"jpg",
	"jpeg",
	"png",
	"webp",
	"heic",
	"heif",
	"gif",
	"svg",
]);
const PHOTO_EXTENSIONS = new Set([
	"jpg",
	"jpeg",
	"png",
	"webp",
	"heic",
	"heif",
]);

export const PHOTO_ACCEPT =
	"image/jpeg,image/png,image/webp,image/heic,image/heif";
export const DOCUMENT_ACCEPT = [
	...DOCUMENT_TYPES,
	".dxf",
	".dwg",
	".step",
	".stp",
].join(",");

export function fileExtension(fileName: string): string {
	const dot = fileName.lastIndexOf(".");
	return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

export interface UploadCandidate {
	fileName: string;
	contentType?: string | null;
	sizeBytes?: number | null;
}

/**
 * Returns a human-readable reason when the file must be rejected, or null
 * when it is fine.
 */
export function uploadRejection(
	kind: UploadKind,
	file: UploadCandidate,
): string | null {
	const limit = UPLOAD_LIMITS[kind];
	const size = file.sizeBytes ?? 0;
	if (size <= 0) return "The file is empty.";
	if (size > limit.maxBytes) {
		return `${file.fileName} is too large (max ${limit.label}).`;
	}

	const type =
		(file.contentType ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
	const ext = fileExtension(file.fileName);
	const types = kind === "photo" ? PHOTO_TYPES : DOCUMENT_TYPES;
	const extensions = kind === "photo" ? PHOTO_EXTENSIONS : DOCUMENT_EXTENSIONS;

	const typeOk = type !== "" && types.has(type);
	const extOk = extensions.has(ext);
	const genericType =
		type === "" ||
		type === "application/octet-stream" ||
		type === "binary/octet-stream";

	if (typeOk || (genericType && extOk)) return null;

	return kind === "photo"
		? `${file.fileName}: only JPEG, PNG, WebP or HEIC photos are allowed.`
		: `${file.fileName}: this file type is not allowed.`;
}

export function assertUploadAllowed(
	kind: UploadKind,
	file: UploadCandidate,
): void {
	const reason = uploadRejection(kind, file);
	if (reason) throw new Error(reason);
}

/** Content type to store and to pin into the presigned PUT. */
export function normalizeContentType(
	contentType: string | null | undefined,
): string {
	const type = (contentType ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
	return type === "" ? "application/octet-stream" : type;
}
