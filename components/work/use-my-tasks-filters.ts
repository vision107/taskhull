"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import type { DueChip } from "@/lib/manufacturing/format";
import { DueChips } from "@/lib/manufacturing/format";
import {
	type WorkListSection,
	type WorkListSort,
	WorkListSections,
	WorkListSorts,
} from "@/lib/manufacturing/work-list";

const urlOptions = { history: "replace" as const, clearOnDefault: true };

export function useMyTasksFilters(): {
	section: WorkListSection | null;
	projectId: string | null;
	phase: string | null;
	due: DueChip | null;
	sort: WorkListSort;
	team: boolean;
	query: string;
	setSection: (value: WorkListSection | null) => void;
	setProjectId: (value: string | null) => void;
	setPhase: (value: string | null) => void;
	setDue: (value: DueChip | null) => void;
	setSort: (value: WorkListSort) => void;
	setTeam: (value: boolean) => void;
	setQuery: (value: string) => void;
	clear: () => void;
	hasFilters: boolean;
} {
	const [section, setSection] = useQueryState(
		"status",
		parseAsStringLiteral(WorkListSections).withOptions(urlOptions),
	);
	const [projectId, setProjectId] = useQueryState(
		"project",
		parseAsString.withOptions(urlOptions),
	);
	const [phase, setPhase] = useQueryState(
		"phase",
		parseAsString.withOptions(urlOptions),
	);
	const [due, setDue] = useQueryState(
		"due",
		parseAsStringLiteral(DueChips).withOptions(urlOptions),
	);
	const [sort, setSort] = useQueryState(
		"sort",
		parseAsStringLiteral(WorkListSorts).withDefault("start").withOptions(urlOptions),
	);
	const [teamValue, setTeamValue] = useQueryState(
		"view",
		parseAsStringLiteral(["team"]).withOptions(urlOptions),
	);
	const [query, setQuery] = useQueryState(
		"q",
		parseAsString.withDefault("").withOptions(urlOptions),
	);

	const hasFilters = Boolean(section || projectId || phase || due || query);

	return {
		section,
		projectId,
		phase,
		due,
		sort,
		team: teamValue === "team",
		query,
		setSection: (value) => {
			void setSection(value);
		},
		setProjectId: (value) => {
			void setProjectId(value);
		},
		setPhase: (value) => {
			void setPhase(value);
		},
		setDue: (value) => {
			void setDue(value);
		},
		setSort: (value) => {
			void setSort(value);
		},
		setTeam: (value) => {
			void setTeamValue(value ? "team" : null);
		},
		setQuery: (value) => {
			void setQuery(value);
		},
		clear: () => {
			void setSection(null);
			void setProjectId(null);
			void setPhase(null);
			void setDue(null);
			void setQuery("");
		},
		hasFilters,
	};
}
