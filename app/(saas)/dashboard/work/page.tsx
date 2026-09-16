import { redirect } from "next/navigation";

/** Legacy worker PWA entry point; My tasks now lives in the shared shell. */
export default function WorkPage(): never {
	redirect("/dashboard/organization/my-tasks");
}
