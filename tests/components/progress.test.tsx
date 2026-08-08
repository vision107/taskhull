import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
	Progress,
	ProgressLabel,
	ProgressValue,
} from "@/components/ui/progress";

describe("Progress", () => {
	it("renders composed label and value content alongside its default track", () => {
		const markup = renderToStaticMarkup(
			<Progress value={50}>
				<ProgressLabel>Upload progress</ProgressLabel>
				<ProgressValue />
			</Progress>,
		);

		expect(markup).toContain("Upload progress");
		expect(markup).toContain('data-slot="progress-value"');
		expect(markup.match(/data-slot="progress-track"/g)).toHaveLength(1);
		expect(markup).toContain('aria-valuenow="50"');
	});
});
