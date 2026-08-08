import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Slider } from "@/components/ui/slider";

function countThumbs(markup: string): number {
	return markup.match(/data-slot="slider-thumb"/g)?.length ?? 0;
}

describe("Slider", () => {
	it("renders one thumb when no value is provided", () => {
		expect(countThumbs(renderToStaticMarkup(<Slider />))).toBe(1);
	});

	it("renders one thumb for scalar values", () => {
		expect(countThumbs(renderToStaticMarkup(<Slider value={50} />))).toBe(1);
		expect(
			countThumbs(renderToStaticMarkup(<Slider defaultValue={50} />)),
		).toBe(1);
	});

	it("renders one thumb for each range value", () => {
		expect(countThumbs(renderToStaticMarkup(<Slider value={[20, 80]} />))).toBe(
			2,
		);
	});
});
