import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";

describe("disabled Base UI controls", () => {
	it("styles the visible checkbox from Base UI's data attribute", () => {
		const markup = renderToStaticMarkup(
			<Checkbox aria-label="Disabled checkbox" disabled />,
		);

		expect(markup).toContain("data-disabled");
		expect(markup).toContain("data-disabled:cursor-not-allowed");
		expect(markup).toContain("data-disabled:opacity-50");
	});

	it("styles the visible radio from Base UI's data attribute", () => {
		const markup = renderToStaticMarkup(
			<RadioGroup aria-label="Options">
				<RadioGroupItem disabled value="disabled" />
			</RadioGroup>,
		);

		expect(markup).toContain("data-disabled");
		expect(markup).toContain("data-disabled:cursor-not-allowed");
		expect(markup).toContain("data-disabled:opacity-50");
	});

	it("prevents interaction with Base UI's disabled slider thumb", () => {
		const markup = renderToStaticMarkup(
			<Slider aria-label="Disabled slider" disabled value={50} />,
		);

		expect(markup).toContain("data-disabled");
		expect(markup).toContain("data-disabled:pointer-events-none");
		expect(markup).toContain("data-disabled:cursor-not-allowed");
	});
});
