"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import {
	AlertCircleIcon,
	ChevronsUpDownIcon,
	RefreshCwIcon,
	UsersIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
	FormDescription,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useZodForm } from "@/hooks/use-zod-form";
import { createNotificationSchema } from "@/schemas/notification-schemas";
import { trpc } from "@/trpc/client";

const audienceItems = {
	user: "Individual user",
	all: "All active users",
};

const typeItems = {
	info: "Information",
	success: "Success",
	warning: "Warning",
};

export type CreateNotificationModalProps = NiceModalHocProps;

export const CreateNotificationModal =
	NiceModal.create<CreateNotificationModalProps>(() => {
		const modal = useEnhancedModal();
		const [recipientOpen, setRecipientOpen] = React.useState(false);
		const [recipientSearch, setRecipientSearch] = React.useState("");
		const [debouncedRecipientSearch, setDebouncedRecipientSearch] =
			React.useState("");
		const [selectedRecipientLabel, setSelectedRecipientLabel] =
			React.useState("");
		const [confirmingBroadcast, setConfirmingBroadcast] = React.useState(false);
		const recipientListId = React.useId();
		const utils = trpc.useUtils();
		React.useEffect(() => {
			const timeout = window.setTimeout(
				() => setDebouncedRecipientSearch(recipientSearch),
				300,
			);
			return () => window.clearTimeout(timeout);
		}, [recipientSearch]);
		const recipients = trpc.admin.notification.recipients.useQuery(
			{ query: debouncedRecipientSearch, limit: 50 },
			{ enabled: modal.visible, staleTime: 0 },
		);
		const form = useZodForm({
			schema: createNotificationSchema,
			defaultValues: {
				target: "user",
				userId: undefined,
				type: "info",
				title: "",
				message: "",
				actionUrl: "",
			},
		});
		const target = form.watch("target");
		const title = form.watch("title");
		const message = form.watch("message");
		const hasNoRecipients = recipients.isSuccess && recipients.data.total === 0;
		const recipientCount = recipients.data?.total;
		const recipientUsers = recipients.data?.users ?? [];
		const handleRecipientOpenChange = (open: boolean) => {
			setRecipientOpen(open);
			if (!open) {
				setRecipientSearch("");
				setDebouncedRecipientSearch("");
			}
		};
		React.useEffect(() => {
			if (!modal.visible) {
				form.reset();
				setRecipientOpen(false);
				setRecipientSearch("");
				setDebouncedRecipientSearch("");
				setSelectedRecipientLabel("");
			}
		}, [form, modal.visible]);
		const create = trpc.admin.notification.create.useMutation({
			onSuccess: ({ count }) => {
				toast.success(`Sent ${count} notification${count === 1 ? "" : "s"}`);
				modal.handleClose();
				void Promise.allSettled([
					utils.admin.notification.list.invalidate(),
					utils.notification.list.invalidate(),
					utils.notification.unreadCount.invalidate(),
				]);
			},
			onError: (error) => toast.error(error.message),
		});
		const handleSheetOpenChange = (open: boolean) => {
			if (!open && (create.isPending || confirmingBroadcast)) return;
			modal.handleOpenChange(open);
		};

		const onSubmit = form.handleSubmit((values) => {
			if (values.target !== "all") {
				create.mutate(values);
				return;
			}
			if (confirmingBroadcast) return;
			const audienceSummary =
				recipientCount === undefined
					? "Every active user will receive this notification."
					: `${recipientCount} active user${recipientCount === 1 ? "" : "s"} will receive this notification.`;

			setConfirmingBroadcast(true);
			void NiceModal.show(ConfirmationModal, {
				title: "Send broadcast?",
				message: `${audienceSummary} The notification is titled “${values.title}”.`,
				confirmLabel: "Send broadcast",
				onConfirm: async () => {
					try {
						await create.mutateAsync(values);
						return true;
					} catch {
						return false;
					}
				},
			})
				.catch(() => undefined)
				.finally(() => setConfirmingBroadcast(false));
		});

		return (
			<Sheet
				open={modal.visible}
				onOpenChange={handleSheetOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<SheetContent className="sm:max-w-lg">
					<SheetHeader>
						<SheetTitle>Send notification</SheetTitle>
						<SheetDescription>
							Notify one active user or broadcast an update to all active
							accounts.
						</SheetDescription>
					</SheetHeader>

					<Form {...form}>
						<form
							onSubmit={onSubmit}
							className="flex flex-1 flex-col overflow-hidden"
						>
							<ScrollArea className="flex-1">
								<div className="space-y-4 px-6 py-4">
									<FormField
										control={form.control}
										name="target"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Audience</FormLabel>
												<Select
													items={audienceItems}
													value={field.value}
													onValueChange={(value) => {
														if (!value) return;
														field.onChange(value);
														if (value === "all") {
															form.setValue("userId", undefined);
															setSelectedRecipientLabel("");
															handleRecipientOpenChange(false);
														}
													}}
												>
													<FormControl>
														<SelectTrigger className="w-full">
															<SelectValue />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="user">
															Individual user
														</SelectItem>
														<SelectItem value="all">
															All active users
														</SelectItem>
													</SelectContent>
												</Select>
												{field.value === "all" ? (
													<FormDescription>
														{recipientCount === undefined
															? recipients.isError
																? "The exact audience count is unavailable."
																: "Counting active users..."
															: recipientCount === 0
																? "There are no users to notify."
																: `This will send to ${recipientCount} active user${recipientCount === 1 ? "" : "s"}.`}
													</FormDescription>
												) : null}
												<FormMessage />
											</FormItem>
										)}
									/>

									{target === "user" && recipients.isError ? (
										<Alert variant="destructive">
											<AlertCircleIcon />
											<AlertTitle>Could not load recipients</AlertTitle>
											<AlertDescription>
												<p>Try loading the user list again.</p>
												<Button
													type="button"
													variant="outline"
													size="xs"
													disabled={recipients.isFetching}
													onClick={() => void recipients.refetch()}
												>
													<RefreshCwIcon
														className={
															recipients.isFetching ? "animate-spin" : undefined
														}
													/>
													Try again
												</Button>
											</AlertDescription>
										</Alert>
									) : target === "user" && hasNoRecipients ? (
										<Alert>
											<UsersIcon />
											<AlertTitle>No recipients available</AlertTitle>
											<AlertDescription>
												Create a user before sending a notification.
											</AlertDescription>
										</Alert>
									) : target === "user" ? (
										<FormField
											control={form.control}
											name="userId"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Recipient</FormLabel>
													<Popover
														open={recipientOpen}
														onOpenChange={handleRecipientOpenChange}
													>
														<PopoverTrigger asChild>
															<FormControl>
																<Button
																	type="button"
																	variant="outline"
																	role="combobox"
																	aria-expanded={recipientOpen}
																	aria-controls={recipientListId}
																	disabled={recipients.isPending}
																	className="w-full justify-between font-normal"
																>
																	<span className="truncate">
																		{recipients.isPending
																			? "Loading users..."
																			: selectedRecipientLabel ||
																				"Select a user"}
																	</span>
																	<ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
																</Button>
															</FormControl>
														</PopoverTrigger>
														<PopoverContent
															className="w-(--anchor-width) p-0"
															align="start"
														>
															<Command value={field.value ?? ""}>
																<CommandInput
																	placeholder="Search users..."
																	value={recipientSearch}
																	onChange={(event) =>
																		setRecipientSearch(event.target.value)
																	}
																/>
																<CommandList id={recipientListId}>
																	<CommandEmpty>
																		{recipients.isFetching
																			? "Searching users..."
																			: "No users found."}
																	</CommandEmpty>
																	<CommandGroup>
																		{recipientUsers.map((user) => (
																			<CommandItem
																				key={user.id}
																				value={user.id}
																				keywords={[user.name, user.email]}
																				onSelect={() => {
																					field.onChange(user.id);
																					setSelectedRecipientLabel(
																						`${user.name} · ${user.email}`,
																					);
																					setRecipientSearch("");
																					setRecipientOpen(false);
																				}}
																			>
																				<div className="min-w-0">
																					<p className="truncate">
																						{user.name}
																					</p>
																					<p className="truncate text-xs text-muted-foreground">
																						{user.email}
																					</p>
																				</div>
																			</CommandItem>
																		))}
																	</CommandGroup>
																</CommandList>
															</Command>
														</PopoverContent>
													</Popover>
													<FormDescription>
														Search active users by name or email.
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>
									) : null}

									<FormField
										control={form.control}
										name="type"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Type</FormLabel>
												<Select
													items={typeItems}
													value={field.value}
													onValueChange={field.onChange}
												>
													<FormControl>
														<SelectTrigger className="w-full">
															<SelectValue />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="info">Information</SelectItem>
														<SelectItem value="success">Success</SelectItem>
														<SelectItem value="warning">Warning</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="title"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Title</FormLabel>
												<FormControl>
													<Input maxLength={120} {...field} />
												</FormControl>
												<FormDescription className="text-right tabular-nums">
													{title.length}/120
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="message"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Message</FormLabel>
												<FormControl>
													<Textarea
														maxLength={2000}
														rows={6}
														className="resize-none"
														{...field}
													/>
												</FormControl>
												<FormDescription className="text-right tabular-nums">
													{message.length}/2000
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="actionUrl"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Action path</FormLabel>
												<FormControl>
													<Input
														placeholder="/dashboard/settings"
														maxLength={500}
														{...field}
														value={field.value ?? ""}
													/>
												</FormControl>
												<FormDescription>
													Optional. Start with /; external URLs are blocked.
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							</ScrollArea>

							<SheetFooter className="flex-row justify-end gap-2 border-t">
								<Button
									type="button"
									variant="outline"
									onClick={modal.handleClose}
									disabled={create.isPending || confirmingBroadcast}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={
										create.isPending ||
										confirmingBroadcast ||
										hasNoRecipients ||
										(target === "user" &&
											(recipients.isPending || recipients.isError))
									}
									loading={create.isPending}
								>
									{target === "all" ? "Send broadcast" : "Send notification"}
								</Button>
							</SheetFooter>
						</form>
					</Form>
				</SheetContent>
			</Sheet>
		);
	});
