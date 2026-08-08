import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

export type SpinnerProps = React.ComponentProps<typeof Loader2Icon>;

function Spinner({ className, ...props }: SpinnerProps) {
	return (
		<Loader2Icon
			data-slot="spinner"
			role="status"
			aria-label="Loading"
			className={cn("size-4 animate-spin", className)}
			{...props}
		/>
	);
}

export type SpinnerElement = import("react").ComponentRef<typeof Spinner>;

export { Spinner };
