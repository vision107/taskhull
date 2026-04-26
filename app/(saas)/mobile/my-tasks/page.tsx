import type { Metadata } from "next";
import type * as React from "react";
import { MobileTaskList } from "@/components/mobile/mobile-task-list";

export const metadata: Metadata = {
	title: "My Tasks",
};

export default function MyTasksPage(): React.JSX.Element {
	return <MobileTaskList />;
}
