"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, TrashIcon, UserPlusIcon } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/trpc/client";

const schema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().optional().nullable(),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
	status: z.enum(["active", "paused", "completed", "archived"]),
});

type FormValues = z.infer<typeof schema>;

const PROJECT_COLORS = [
	"#6366f1",
	"#8b5cf6",
	"#ec4899",
	"#f43f5e",
	"#f97316",
	"#eab308",
	"#22c55e",
	"#14b8a6",
	"#3b82f6",
	"#06b6d4",
];

interface ProjectSettingsProps {
	projectId: string;
}

export function ProjectSettings({ projectId }: ProjectSettingsProps): React.JSX.Element {
	const utils = trpc.useUtils();
	const { data: project, isLoading } = trpc.organization.project.get.useQuery({
		id: projectId,
	});

	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		values: {
			name: project?.name ?? "",
			description: project?.description ?? "",
			color: project?.color ?? "#6366f1",
			status: (project?.status as FormValues["status"]) ?? "active",
		},
	});

	const updateProject = trpc.organization.project.update.useMutation({
		onSuccess: () => {
			utils.organization.project.get.invalidate({ id: projectId });
			utils.organization.project.list.invalidate();
			toast.success("Project updated");
		},
		onError: (err) => toast.error(err.message),
	});

	const removeMember = trpc.organization.project.removeMember.useMutation({
		onSuccess: () => {
			utils.organization.project.get.invalidate({ id: projectId });
			toast.success("Member removed");
		},
		onError: (err) => toast.error(err.message),
	});

	const addMember = trpc.organization.project.addMember.useMutation({
		onSuccess: () => {
			utils.organization.project.get.invalidate({ id: projectId });
			toast.success("Member added");
		},
		onError: (err) => toast.error(err.message),
	});

	const updateMember = trpc.organization.project.updateMember.useMutation({
		onSuccess: () => {
			utils.organization.project.get.invalidate({ id: projectId });
		},
		onError: (err) => toast.error(err.message),
	});

	const onSubmit = (values: FormValues) => {
		updateProject.mutate({ id: projectId, ...values });
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20">
				<Loader2Icon className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-2xl space-y-6 p-6">
			{/* General settings */}
			<Card>
				<CardHeader>
					<CardTitle>General</CardTitle>
					<CardDescription>Basic project information</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Project Name</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Description</FormLabel>
										<FormControl>
											<Textarea
												className="resize-none"
												rows={3}
												{...field}
												value={field.value ?? ""}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="grid grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="status"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Status</FormLabel>
											<Select
												onValueChange={field.onChange}
												value={field.value}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value="active">Active</SelectItem>
													<SelectItem value="paused">Paused</SelectItem>
													<SelectItem value="completed">Completed</SelectItem>
													<SelectItem value="archived">Archived</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="color"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Color</FormLabel>
											<FormControl>
												<div className="flex flex-wrap gap-1.5">
													{PROJECT_COLORS.map((color) => (
														<button
															className="h-6 w-6 rounded-full transition-transform hover:scale-110"
															key={color}
															onClick={() => field.onChange(color)}
															style={{
																backgroundColor: color,
																outline:
																	field.value === color
																		? `3px solid ${color}`
																		: undefined,
																outlineOffset: "2px",
															}}
															type="button"
														/>
													))}
												</div>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<div className="flex justify-end">
								<Button
									disabled={updateProject.isPending}
									type="submit"
								>
									{updateProject.isPending ? (
										<Loader2Icon className="mr-2 size-4 animate-spin" />
									) : null}
									Save Changes
								</Button>
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>

			{/* Members */}
			<Card>
				<CardHeader>
					<div className="flex items-start justify-between gap-2">
						<div>
							<CardTitle>Members</CardTitle>
							<CardDescription>
								People who have access to this project
							</CardDescription>
						</div>
						<AddMemberButton
							projectId={projectId}
							existingMemberUserIds={
								project?.members.map((m) => m.userId) ?? []
							}
							onAdd={(userId, role) =>
								addMember.mutate({ projectId, userId, role })
							}
							isPending={addMember.isPending}
						/>
					</div>
				</CardHeader>
				<CardContent className="space-y-3">
					{project?.members.length === 0 && (
						<p className="text-muted-foreground text-sm">
							No members yet. Add people from your organization to give them
							access.
						</p>
					)}
					{project?.members.map((member) => (
						<div
							className="flex items-center justify-between"
							key={member.id}
						>
							<div className="flex items-center gap-3">
								<Avatar className="size-8">
									<AvatarImage src={member.user.image ?? undefined} />
									<AvatarFallback className="text-xs">
										{member.user.name.slice(0, 2).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<div>
									<p className="font-medium text-sm">{member.user.name}</p>
									<p className="text-muted-foreground text-xs">
										{member.user.email}
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Select
									value={member.role}
									onValueChange={(role) =>
										updateMember.mutate({
											projectId,
											userId: member.userId,
											role,
										})
									}
								>
									<SelectTrigger className="h-8 w-[110px] text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="manager">Manager</SelectItem>
										<SelectItem value="member">Member</SelectItem>
										<SelectItem value="viewer">Viewer</SelectItem>
									</SelectContent>
								</Select>
								<Button
									className="size-8"
									onClick={() =>
										removeMember.mutate({
											projectId,
											userId: member.userId,
										})
									}
									size="icon"
									title="Remove from project"
									variant="ghost"
								>
									<TrashIcon className="size-3.5 text-muted-foreground" />
								</Button>
							</div>
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	);
}

interface AddMemberButtonProps {
	projectId: string;
	existingMemberUserIds: string[];
	onAdd: (userId: string, role: "manager" | "member" | "viewer") => void;
	isPending: boolean;
}

function AddMemberButton({
	existingMemberUserIds,
	onAdd,
	isPending,
}: AddMemberButtonProps): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const [role, setRole] = React.useState<"manager" | "member" | "viewer">(
		"member",
	);

	const { data: orgMembers, isLoading } =
		trpc.organization.listMembers.useQuery(undefined, { enabled: open });

	const existing = new Set(existingMemberUserIds);
	const candidates = (orgMembers ?? []).filter(
		(m) => !existing.has(m.userId),
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button disabled={isPending} size="sm">
					<UserPlusIcon className="mr-1.5 size-3.5" />
					Add member
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80 p-0">
				<div className="border-b p-2">
					<p className="px-2 py-1 text-muted-foreground text-xs uppercase tracking-wide">
						Add as
					</p>
					<Select
						value={role}
						onValueChange={(v) =>
							setRole(v as "manager" | "member" | "viewer")
						}
					>
						<SelectTrigger className="h-8 w-full text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="manager">Manager — can edit project</SelectItem>
							<SelectItem value="member">Member — can edit tasks</SelectItem>
							<SelectItem value="viewer">Viewer — read only</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<Command>
					<CommandInput placeholder="Search organization…" className="h-9" />
					<CommandList>
						<CommandEmpty>
							{isLoading
								? "Loading members…"
								: "Everyone is already a member of this project."}
						</CommandEmpty>
						<CommandGroup>
							{candidates.map((m) => (
								<CommandItem
									key={m.userId}
									value={`${m.user.name} ${m.user.email}`}
									onSelect={() => {
										onAdd(m.userId, role);
										setOpen(false);
									}}
								>
									<Avatar className="size-6">
										<AvatarImage src={m.user.image ?? undefined} />
										<AvatarFallback className="text-[9px]">
											{m.user.name.slice(0, 2).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="flex flex-1 flex-col overflow-hidden">
										<span className="truncate text-sm">{m.user.name}</span>
										<span className="truncate text-[10px] text-muted-foreground">
											{m.user.email}
										</span>
									</div>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
