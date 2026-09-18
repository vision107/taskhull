"use client";

import type { inferRouterOutputs } from "@trpc/server";
import * as React from "react";
import { toast } from "sonner";

import { useOffline } from "@/components/work/offline-provider";
import { useWorkLocale } from "@/components/work/work-locale-provider";
import {
	isNetworkError,
	pendingPrivateTaskChanges,
	pendingPrivateTaskCreates,
} from "@/lib/offline/queue";
import { trpc } from "@/trpc/client";
import type { AppRouter } from "@/trpc/routers/app";

type PrivateTask =
	inferRouterOutputs<AppRouter>["organization"]["privateTask"]["list"][number];

/** A row as shown: server data with the offline queue applied on top. */
export type PrivateTaskRow = Pick<
	PrivateTask,
	"id" | "title" | "notes" | "dueDate" | "buildTask"
> & {
	done: boolean;
	/** Created offline and not on the server yet; read-only until synced. */
	pendingCreateId: string | null;
};

export type PrivateTaskValues = {
	title: string;
	notes: string | null;
	dueDate: string | null;
	buildTaskId: string | null;
};

export function overlayPrivateTaskRows(
	data: PrivateTask[] | undefined,
	pending: ReturnType<typeof useOffline>["pending"],
): PrivateTaskRow[] {
	const { done: pendingDone, deleted } = pendingPrivateTaskChanges(pending);
	const fromServer = (data ?? [])
		.filter((task) => !deleted.has(task.id))
		.map((task) => ({
			id: task.id,
			title: task.title,
			notes: task.notes,
			dueDate: task.dueDate,
			buildTask: task.buildTask,
			done: pendingDone.get(task.id) ?? task.completedAt !== null,
			pendingCreateId: null,
		}));
	const created = pendingPrivateTaskCreates(pending).map((row) => ({
		id: row.id,
		title: row.title,
		notes: null,
		dueDate: null,
		buildTask: null,
		done: false,
		pendingCreateId: row.id,
	}));
	return [...fromServer, ...created];
}

/**
 * Create / toggle / edit / delete for the private list. Quick add, tick off
 * and delete work offline; field edits need a connection.
 */
export function usePrivateTaskActions(): {
	add: (title: string) => Promise<string | null>;
	toggle: (row: Pick<PrivateTaskRow, "id">, done: boolean) => Promise<void>;
	save: (id: string, values: Partial<PrivateTaskValues>) => Promise<void>;
	remove: (id: string) => Promise<void>;
} {
	const { t } = useWorkLocale();
	const offline = useOffline();
	const utils = trpc.useUtils();

	const invalidate = React.useCallback(() => {
		void utils.organization.privateTask.list.invalidate();
		void utils.organization.privateTask.get.invalidate();
	}, [utils]);

	const createMutation = trpc.organization.privateTask.create.useMutation({
		onSuccess: invalidate,
	});
	const updateMutation = trpc.organization.privateTask.update.useMutation({
		onSuccess: invalidate,
	});
	const deleteMutation = trpc.organization.privateTask.delete.useMutation({
		onSuccess: invalidate,
	});

	const showError = (error: unknown) =>
		toast.error(error instanceof Error ? error.message : t.sync.rejected);

	const queueCreate = (title: string) => {
		offline.enqueue({
			kind: "createPrivateTask",
			taskId: crypto.randomUUID(),
			input: { title },
		});
		toast(t.privateList.noteSavedOffline, {
			description: t.detail.willSyncOnline,
		});
	};

	const add = async (title: string): Promise<string | null> => {
		if (!offline.online) {
			queueCreate(title);
			return null;
		}
		try {
			const created = await createMutation.mutateAsync({ title });
			return created.id;
		} catch (error) {
			if (!isNetworkError(error)) {
				showError(error);
				throw error;
			}
			queueCreate(title);
			return null;
		}
	};

	const toggle = async (row: Pick<PrivateTaskRow, "id">, done: boolean) => {
		if (!offline.online) {
			offline.enqueue({
				kind: "updatePrivateTask",
				taskId: row.id,
				input: { id: row.id, done },
			});
			toast(t.detail.savedOffline, { description: t.detail.willSyncOnline });
			return;
		}
		try {
			await updateMutation.mutateAsync({ id: row.id, done });
		} catch (error) {
			if (!isNetworkError(error)) {
				showError(error);
				return;
			}
			offline.enqueue({
				kind: "updatePrivateTask",
				taskId: row.id,
				input: { id: row.id, done },
			});
			toast(t.detail.savedOffline, { description: t.detail.willSyncOnline });
		}
	};

	const save = async (id: string, values: Partial<PrivateTaskValues>) => {
		if (!offline.online) {
			toast.error(t.privateList.offlineEdit);
			throw new Error(t.privateList.offlineEdit);
		}
		try {
			await updateMutation.mutateAsync({ id, ...values });
		} catch (error) {
			if (isNetworkError(error)) toast.error(t.privateList.offlineEdit);
			else showError(error);
			throw error;
		}
	};

	const remove = async (id: string) => {
		if (!offline.online) {
			offline.enqueue({
				kind: "deletePrivateTask",
				taskId: id,
				input: { id },
			});
			toast(t.detail.savedOffline, { description: t.detail.willSyncOnline });
			return;
		}
		try {
			await deleteMutation.mutateAsync({ id });
			toast.success(t.privateList.deleted);
		} catch (error) {
			if (!isNetworkError(error)) {
				showError(error);
				throw error;
			}
			offline.enqueue({
				kind: "deletePrivateTask",
				taskId: id,
				input: { id },
			});
			toast(t.detail.savedOffline, { description: t.detail.willSyncOnline });
		}
	};

	return { add, toggle, save, remove };
}
