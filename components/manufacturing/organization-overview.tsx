"use client";

import { formatDistanceToNow } from "date-fns";
import {
	AlertTriangleIcon,
	ArrowRightIcon,
	FactoryIcon,
	MessageSquareTextIcon,
	UserRoundXIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { BuildsTable } from "@/components/manufacturing/builds-table";
import { CommentBody } from "@/components/manufacturing/comment-body";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user/user-avatar";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

/**
 * Planner landing page: what is running, what is stuck, who is unassigned,
 * and the latest worker comments.
 */
export function OrganizationOverview(): React.JSX.Element {
	const { data: overview, isLoading } =
		trpc.organization.build.overview.useQuery();
	const { data: builds } = trpc.organization.build.list.useQuery({
		status: ["active", "blocked", "planned"],
	});

	if (isLoading || !overview) {
		return (
			<div className="space-y-4">
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{[0, 1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-24 w-full" />
					))}
				</div>
				<Skeleton className="h-48 w-full" />
			</div>
		);
	}

	const stats = [
		{
			label: "Active builds",
			value: overview.builds.active,
			hint: `${overview.builds.planned} planned · ${overview.builds.completed} completed`,
			icon: FactoryIcon,
		},
		{
			label: "Blocked builds",
			value: overview.builds.blocked,
			hint: `${overview.tasks.blocked} blocked tasks`,
			icon: AlertTriangleIcon,
			alert: overview.builds.blocked > 0,
		},
		{
			label: "Unassigned tasks",
			value: overview.tasks.unassigned,
			hint: "on open builds",
			icon: UserRoundXIcon,
			alert: overview.tasks.unassigned > 0,
		},
		{
			label: "Tasks in progress",
			value: overview.tasks.inProgress,
			hint: `${overview.tasks.review} in review · ${overview.tasks.todo} to do`,
			icon: MessageSquareTextIcon,
		},
	];

	return (
		<div className="space-y-6">
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{stats.map((stat) => (
					<Card key={stat.label}>
						<CardContent className="p-4">
							<div className="flex items-center justify-between text-sm text-muted-foreground">
								{stat.label}
								<stat.icon
									className={cn(
										"size-4",
										stat.alert && "text-amber-600 dark:text-amber-400",
									)}
								/>
							</div>
							<p
								className={cn(
									"mt-1 text-3xl font-semibold tabular-nums",
									stat.alert && "text-amber-600 dark:text-amber-400",
								)}
							>
								{stat.value}
							</p>
							<p className="text-xs text-muted-foreground">{stat.hint}</p>
						</CardContent>
					</Card>
				))}
			</div>

			<section className="space-y-2">
				<div className="flex items-center justify-between">
					<h2 className="font-medium">Open projects</h2>
					<Link
						href="/dashboard/organization/projects"
						className={buttonVariants({ variant: "ghost", size: "sm" })}
					>
						All projects
						<ArrowRightIcon />
					</Link>
				</div>
				{!builds ? (
					<Skeleton className="h-40 w-full" />
				) : builds.length === 0 ? (
					<p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
						No open projects.{" "}
						<Link
							href="/dashboard/organization/projects"
							className="underline underline-offset-2"
						>
							Create one.
						</Link>
					</p>
				) : (
					<BuildsTable builds={builds.slice(0, 8)} />
				)}
			</section>

			<section className="space-y-2">
				<h2 className="font-medium">Latest comments from the floor</h2>
				{overview.recentComments.length === 0 ? (
					<p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
						No comments yet.
					</p>
				) : (
					<ul className="divide-y rounded-lg border bg-background">
						{overview.recentComments.map((comment) => (
							<li key={comment.id} className="flex gap-3 px-4 py-3">
								<UserAvatar
									name={comment.author?.name ?? "?"}
									src={comment.author?.image}
									className="size-8"
									fallbackClassName="text-xs"
								/>
								<div className="min-w-0 flex-1">
									<p className="text-xs text-muted-foreground">
										<span className="font-medium text-foreground">
											{comment.author?.name ?? "Former member"}
										</span>{" "}
										on{" "}
										<Link
											href={`/dashboard/organization/projects/${comment.buildTask.buildId}`}
											className="underline-offset-2 hover:underline"
										>
											{comment.buildTask.build.serialNumber} ·{" "}
											{comment.buildTask.title}
										</Link>{" "}
										·{" "}
										{formatDistanceToNow(comment.createdAt, {
											addSuffix: true,
										})}
									</p>
									<CommentBody body={comment.body} className="mt-0.5" />
								</div>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
