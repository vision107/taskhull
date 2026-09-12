import type { Metadata } from "next";
import type * as React from "react";

import { MyTasksList } from "@/components/work/my-tasks-list";

export const metadata: Metadata = {
	title: "My tasks",
};

export default function WorkPage(): React.JSX.Element {
	return <MyTasksList />;
}
