"use client";

import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import {
	Controller,
	type ControllerProps,
	type FieldPath,
	type FieldValues,
	FormProvider,
	useFormContext,
	useFormState,
} from "react-hook-form";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const Form = FormProvider;

type FormFieldContextValue<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
	name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue | null>(
	null,
);

const FormField = <
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
	...props
}: ControllerProps<TFieldValues, TName>) => {
	return (
		<FormFieldContext.Provider value={{ name: props.name }}>
			<Controller {...props} />
		</FormFieldContext.Provider>
	);
};

const useFormField = () => {
	const fieldContext = React.useContext(FormFieldContext);
	const itemContext = React.useContext(FormItemContext);
	const { getFieldState } = useFormContext();
	const formState = useFormState({ name: fieldContext?.name });

	if (!fieldContext) {
		throw new Error("useFormField should be used within <FormField>");
	}

	if (!itemContext) {
		throw new Error("useFormField should be used within <FormItem>");
	}

	const fieldState = getFieldState(fieldContext.name, formState);
	const { id } = itemContext;

	return {
		id,
		name: fieldContext.name,
		formItemId: `${id}-form-item`,
		formDescriptionId: `${id}-form-item-description`,
		formMessageId: `${id}-form-item-message`,
		...fieldState,
	};
};

type FormItemContextValue = {
	id: string;
};

const FormItemContext = React.createContext<FormItemContextValue | null>(null);

export type FormItemProps = useRender.ComponentProps<"div"> & {
	asChild?: boolean;
};

function FormItem({
	className,
	asChild = false,
	children,
	render,
	...props
}: FormItemProps): React.JSX.Element {
	const id = React.useId();

	return (
		<FormItemContext.Provider value={{ id }}>
			{useRender({
				defaultTagName: "div",
				render: asChild && React.isValidElement(children) ? children : render,
				props: {
					...props,
					children: asChild ? undefined : children,
					"data-slot": "form-item",
					className: cn("grid gap-2", className),
				},
			})}
		</FormItemContext.Provider>
	);
}

export type FormLabelElement = React.ComponentRef<typeof Label>;
export type FormLabelProps = React.ComponentPropsWithoutRef<typeof Label>;

function FormLabel({ className, ...props }: FormLabelProps): React.JSX.Element {
	const { error, formItemId } = useFormField();

	return (
		<Label
			data-slot="form-label"
			data-error={!!error}
			className={cn("data-[error=true]:text-destructive", className)}
			htmlFor={formItemId}
			{...props}
		/>
	);
}

export type FormControlElement = HTMLElement;
export type FormControlProps = useRender.ComponentProps<"div">;

function FormControl({
	children,
	render,
	...props
}: FormControlProps): React.JSX.Element {
	const { error, formItemId, formDescriptionId, formMessageId } =
		useFormField();

	return useRender({
		defaultTagName: "div",
		render: React.isValidElement(children) ? children : render,
		props: {
			...props,
			children: undefined,
			"data-slot": "form-control",
			id: formItemId,
			"aria-describedby": !error
				? `${formDescriptionId}`
				: `${formDescriptionId} ${formMessageId}`,
			"aria-invalid": !!error,
		},
	});
}

export type FormDescriptionProps = useRender.ComponentProps<"p"> & {
	asChild?: boolean;
};

function FormDescription({
	className,
	asChild = false,
	children,
	render,
	...props
}: FormDescriptionProps): React.JSX.Element {
	const { formDescriptionId } = useFormField();

	return useRender({
		defaultTagName: "p",
		render: asChild && React.isValidElement(children) ? children : render,
		props: {
			...props,
			children: asChild ? undefined : children,
			"data-slot": "form-description",
			id: formDescriptionId,
			className: cn("text-sm text-muted-foreground", className),
		},
	});
}

export type FormMessageProps = useRender.ComponentProps<"p"> & {
	asChild?: boolean;
};

function FormMessage({
	className,
	asChild = false,
	render,
	...props
}: FormMessageProps): React.JSX.Element | null {
	const { error, formMessageId } = useFormField();
	const body = error ? String(error?.message ?? "") : props.children;

	if (!body) {
		return null;
	}

	return useRender({
		defaultTagName: "p",
		render:
			asChild && React.isValidElement(props.children) ? props.children : render,
		props: {
			...props,
			children: asChild ? undefined : body,
			"data-slot": "form-message",
			id: formMessageId,
			className: cn("text-sm text-destructive", className),
		},
	});
}

export {
	useFormField,
	Form,
	FormItem,
	FormLabel,
	FormControl,
	FormDescription,
	FormMessage,
	FormField,
};
