import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Checkbox } from "@/components/ui/checkbox";

describe("Checkbox", () => {
	it("renders the mixed state with an indeterminate marker", () => {
		const markup = renderToStaticMarkup(
			<Checkbox aria-label="Select all" checked="indeterminate" />,
		);

		expect(markup).toContain("data-indeterminate");
		expect(markup).toContain("lucide-minus");
		expect(markup).not.toContain("lucide-check");
	});

	it("keeps the regular checked marker for a selected checkbox", () => {
		const markup = renderToStaticMarkup(
			<Checkbox aria-label="Select row" checked />,
		);

		expect(markup).toContain("data-checked");
		expect(markup).toContain("lucide-check");
		expect(markup).not.toContain("lucide-minus");
	});
});
