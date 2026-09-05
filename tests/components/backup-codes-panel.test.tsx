import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { BackupCodesPanel } from "@/components/auth/backup-codes-panel";

describe("BackupCodesPanel", () => {
	it("renders every recovery code and requires an explicit saved confirmation", () => {
		const markup = renderToStaticMarkup(
			<BackupCodesPanel
				backupCodes={["alpha-bravo", "charlie-delta"]}
				onSavedChange={vi.fn()}
				saved={false}
			/>,
		);

		expect(markup).toContain("alpha-bravo");
		expect(markup).toContain("charlie-delta");
		expect(markup).toContain("Copy codes");
		expect(markup).toContain("Download codes");
		expect(markup).toContain("I saved these codes");
	});
});
