"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type * as React from "react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
	content?: unknown;
	onChange?: (content: unknown) => void;
	placeholder?: string;
	editable?: boolean;
	className?: string;
	onBlur?: () => void;
}

export function RichTextEditor({
	content,
	onChange,
	placeholder = "Add a description…",
	editable = true,
	className,
	onBlur,
}: RichTextEditorProps): React.JSX.Element {
	const editor = useEditor({
		extensions: [
			StarterKit,
			Placeholder.configure({
				placeholder,
				emptyEditorClass: "is-editor-empty",
			}),
		],
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		content: content as any,
		editable,
		onUpdate: ({ editor }) => {
			onChange?.(editor.getJSON());
		},
		onBlur: () => {
			onBlur?.();
		},
		editorProps: {
			attributes: {
				class: cn(
					"prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[60px]",
					"[&_.is-editor-empty:first-child::before]:text-muted-foreground",
					"[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
					"[&_.is-editor-empty:first-child::before]:float-left",
					"[&_.is-editor-empty:first-child::before]:pointer-events-none",
					"[&_.is-editor-empty:first-child::before]:h-0",
				),
			},
		},
	});

	return (
		<div
			className={cn(
				"rounded-md",
				editable && "border px-3 py-2 hover:border-primary/50 focus-within:border-primary/70 transition-colors",
				className,
			)}
		>
			{editable && editor && (
				<div className="mb-1 flex gap-1 border-b pb-1">
					{[
						{
							label: "B",
							action: () => editor.chain().focus().toggleBold().run(),
							active: editor.isActive("bold"),
							title: "Bold",
						},
						{
							label: "I",
							action: () => editor.chain().focus().toggleItalic().run(),
							active: editor.isActive("italic"),
							title: "Italic",
						},
						{
							label: "Code",
							action: () => editor.chain().focus().toggleCode().run(),
							active: editor.isActive("code"),
							title: "Inline Code",
						},
						{
							label: "UL",
							action: () =>
								editor.chain().focus().toggleBulletList().run(),
							active: editor.isActive("bulletList"),
							title: "Bullet List",
						},
						{
							label: "OL",
							action: () =>
								editor.chain().focus().toggleOrderedList().run(),
							active: editor.isActive("orderedList"),
							title: "Ordered List",
						},
					].map(({ label, action, active, title }) => (
						<button
							className={cn(
								"rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
								active
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-muted hover:text-foreground",
							)}
							key={label}
							onClick={action}
							title={title}
							type="button"
						>
							{label}
						</button>
					))}
				</div>
			)}
			<EditorContent editor={editor} />
		</div>
	);
}
