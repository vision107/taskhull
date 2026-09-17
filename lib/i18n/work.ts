/**
 * Strings for the worker PWA (`components/work/*`) and worker-facing
 * notifications. Deliberately framework-free: one typed object per language,
 * English is the source of truth for the shape.
 *
 * Planner screens stay English for now.
 */

import type { Locale as DateFnsLocale } from "date-fns";
import { de as dateDe, enUS as dateEn } from "date-fns/locale";

import type { BuildTaskStatus } from "@/lib/db/schema/enums";

export const WorkLocales = ["de", "en"] as const;
export type WorkLocale = (typeof WorkLocales)[number];
export const DEFAULT_WORK_LOCALE: WorkLocale = "en";

export function isWorkLocale(value: unknown): value is WorkLocale {
	return (
		typeof value === "string" &&
		(WorkLocales as readonly string[]).includes(value)
	);
}

/**
 * Picks the UI language: explicit user preference first, then the browser
 * language, then English.
 */
export function resolveWorkLocale(
	userLocale: string | null | undefined,
	navigatorLanguage?: string | null,
): WorkLocale {
	if (isWorkLocale(userLocale)) return userLocale;
	const browser = (navigatorLanguage ?? "").toLowerCase().slice(0, 2);
	if (isWorkLocale(browser)) return browser;
	return DEFAULT_WORK_LOCALE;
}

export const workDateLocale: Record<WorkLocale, DateFnsLocale> = {
	de: dateDe,
	en: dateEn,
};

const en = {
	languageName: "English",
	header: {
		offline: "Offline",
		youAreOffline: "You are offline",
		toSync: (n: number) => `${n} to sync`,
		changesWaiting: (n: number) => `${n} changes waiting to sync`,
		accountMenu: "Account menu",
		notifications: "Notifications",
		plannerDashboard: "Planner dashboard",
		accountSettings: "Account settings",
		pushOn: "Enable push notifications",
		pushOff: "Turn off push notifications",
		switchLanguage: (name: string) => `Switch to ${name}`,
		signOut: "Sign out",
	},
	nav: {
		label: "Main navigation",
		myTasks: "My tasks",
		dashboard: "Dashboard",
		projects: "Projects",
		templates: "Templates",
	},
	orgPicker: {
		noTeamTitle: "You're not part of a team yet",
		noTeamHint: "Ask your planner to add you to their organization.",
		chooseTeam: "Choose your team",
		couldNotOpen: "Could not open team",
	},
	list: {
		title: "My tasks",
		refresh: "Refresh",
		emptyTitle: "Nothing assigned to you",
		emptyHint: "New tasks show up here as soon as a planner assigns them.",
		ready: "Ready to work on",
		waiting: "Waiting on other tasks",
		finished: "Finished",
		showDone: "Show finished tasks",
		hideDone: "Hide finished tasks",
		unscheduled: "Unscheduled",
		today: "Today",
		photo: "photo",
		comment: "comment",
	},
	privateList: {
		title: "My notes",
		hint: "Only you can see these. They stay with this team.",
		addPlaceholder: "Add a note for yourself and press Enter",
		empty: "Reminders for yourself: parts to ask about, things to check.",
		finished: "Finished notes",
		markDone: "Mark done",
		markOpen: "Mark open",
		noteSavedOffline: "Note saved offline",
		deleted: "Note deleted",
		offlineEdit: "Editing a note needs a connection. Try again when online.",
		edit: {
			title: "Edit note",
			titleLabel: "Title",
			notesLabel: "Notes",
			notesPlaceholder: "Details, part numbers, who to ask…",
			dueLabel: "Due date",
			clearDue: "Clear",
			linkLabel: "Linked task",
			noLink: "No linked task",
			openTask: "Open task",
			delete: "Delete",
			cancel: "Cancel",
			save: "Save",
		},
	},
	status: {
		todo: "To do",
		in_progress: "In progress",
		blocked: "Blocked",
		review: "Review",
		done: "Done",
	} satisfies Record<BuildTaskStatus, string>,
	detail: {
		back: "Back to my tasks",
		unscheduled: "Unscheduled",
		days: (n: number) => `${n}d`,
		hours: (n: number) => `${Math.round(n * 100) / 100}h`,
		waitingOn: "Waiting on",
		viewingAsPlanner: "You're viewing this task as a planner.",
		instructions: "Instructions",
		checklist: "Checklist",
		subtasks: "Subtasks",
		subtasksOpen: (n: number) =>
			n === 1 ? "1 subtask still open" : `${n} subtasks still open`,
		finishSubtasksFirst: "finish all subtasks",
		documents: "Documents",
		photos: "Photos",
		required: "required",
		requiredDone: "✓ required",
		waitingToSync: "waiting to sync",
		discard: (name: string) => `Discard ${name}`,
		remove: (name: string) => `Remove ${name}`,
		unknownUser: "Unknown",
		formerMember: "Former member",
		takePhoto: "Take or add photo",
		addAnother: "Add another",
		comments: "Comments",
		deleteComment: "Delete comment",
		commentPlaceholder: "Write a comment… @ to mention someone",
		newComment: "New comment",
		sendComment: "Send comment",
		mentionNoMatches: "No teammates found",
		mentionLoading: "Loading…",
		history: "History",
		start: "Start",
		blocked: "Blocked",
		markDone: "Mark done",
		resume: "Resume",
		reopen: "Reopen",
		beforeFinishing: (parts: string[]) =>
			`Before finishing: ${parts.join(" and ")}.`,
		addPhoto: "add a photo",
		leaveComment: "leave a comment",
		downloadFailed: "Download failed",
		uploadFailed: "Upload failed",
		photoAdded: "Photo added",
		photosAdded: "Photos added",
		photoSavedOffline: "Photo saved offline",
		photosSavedOffline: "Photos saved offline",
		willUploadOnline: "Will upload when you're back online.",
		savedOffline: "Saved offline",
		willSyncOnline: "Will sync when you're back online.",
		commentSavedOffline: "Comment saved offline",
		taskFinished: "Task finished",
		offlinePhotosUnsupported: "Photos cannot be stored offline on this device.",
	},
	block: {
		title: "What is blocking you?",
		description:
			"The planner gets notified right away and your note is added to the task.",
		placeholder: "e.g. bracket 4711 missing, 2 pcs",
		quick: [
			"Missing parts",
			"Waiting for previous step",
			"Machine or tool not available",
			"Drawing unclear",
		],
		cancel: "Cancel",
		submit: "Mark blocked",
	},
	sync: {
		synced: (n: number) =>
			n === 1 ? "1 offline change synced" : `${n} offline changes synced`,
		rejected: "Change was rejected",
		photoLost: (name: string) => `${name} was lost before it could be uploaded`,
		uploadFailed: (name: string, status: number) =>
			`Upload of ${name} failed (${status})`,
		pushOff: "Push notifications turned off",
		pushBlocked: "Notifications are blocked for this site",
		pushOn: "You'll get a push when tasks are assigned or unblocked",
		pushIncomplete: "Browser returned an incomplete subscription",
		pushFailed: "Could not enable push",
	},
	notifications: {
		newTask: "New task assigned",
		tasksAssigned: (n: number) => `${n} tasks assigned to you`,
		onBuilds: (title: string, n: number) => `${title} on ${n} builds`,
		commented: (actor: string, task: string) => `${actor} commented on ${task}`,
		mentioned: (actor: string, task: string) =>
			`${actor} mentioned you on ${task}`,
		readyToStart: (task: string) => `Ready to start: ${task}`,
		isFinished: (serial: string, task: string) =>
			`${serial} · "${task}" is finished`,
	},
};

export type WorkDictionary = typeof en;

const de: WorkDictionary = {
	languageName: "Deutsch",
	header: {
		offline: "Offline",
		youAreOffline: "Du bist offline",
		toSync: (n) => `${n} ausstehend`,
		changesWaiting: (n) => `${n} Änderungen warten auf Synchronisation`,
		accountMenu: "Kontomenü",
		notifications: "Benachrichtigungen",
		plannerDashboard: "Planer-Ansicht",
		accountSettings: "Kontoeinstellungen",
		pushOn: "Push-Benachrichtigungen einschalten",
		pushOff: "Push-Benachrichtigungen ausschalten",
		switchLanguage: (name) => `Sprache: ${name}`,
		signOut: "Abmelden",
	},
	nav: {
		label: "Hauptnavigation",
		myTasks: "Meine Aufgaben",
		dashboard: "Übersicht",
		projects: "Projekte",
		templates: "Vorlagen",
	},
	orgPicker: {
		noTeamTitle: "Du bist noch in keinem Team",
		noTeamHint: "Bitte deinen Planer, dich zur Organisation hinzuzufügen.",
		chooseTeam: "Team auswählen",
		couldNotOpen: "Team konnte nicht geöffnet werden",
	},
	list: {
		title: "Meine Aufgaben",
		refresh: "Aktualisieren",
		emptyTitle: "Dir ist nichts zugewiesen",
		emptyHint:
			"Neue Aufgaben erscheinen hier, sobald ein Planer sie dir zuweist.",
		ready: "Bereit zum Bearbeiten",
		waiting: "Wartet auf andere Aufgaben",
		finished: "Erledigt",
		showDone: "Erledigte Aufgaben anzeigen",
		hideDone: "Erledigte Aufgaben ausblenden",
		unscheduled: "Nicht geplant",
		today: "Heute",
		photo: "Foto",
		comment: "Kommentar",
	},
	privateList: {
		title: "Meine Notizen",
		hint: "Nur du siehst diese Einträge. Sie gehören zu diesem Team.",
		addPlaceholder: "Notiz für dich hinzufügen und Enter drücken",
		empty: "Erinnerungen für dich: Teile nachfragen, Dinge prüfen.",
		finished: "Erledigte Notizen",
		markDone: "Als erledigt markieren",
		markOpen: "Als offen markieren",
		noteSavedOffline: "Notiz offline gespeichert",
		deleted: "Notiz gelöscht",
		offlineEdit:
			"Zum Bearbeiten einer Notiz brauchst du eine Verbindung. Versuch es online noch einmal.",
		edit: {
			title: "Notiz bearbeiten",
			titleLabel: "Titel",
			notesLabel: "Notizen",
			notesPlaceholder: "Details, Teilenummern, wen fragen…",
			dueLabel: "Fällig am",
			clearDue: "Löschen",
			linkLabel: "Verknüpfte Aufgabe",
			noLink: "Keine verknüpfte Aufgabe",
			openTask: "Aufgabe öffnen",
			delete: "Löschen",
			cancel: "Abbrechen",
			save: "Speichern",
		},
	},
	status: {
		todo: "Offen",
		in_progress: "In Arbeit",
		blocked: "Blockiert",
		review: "Prüfung",
		done: "Erledigt",
	},
	detail: {
		back: "Zurück zu meinen Aufgaben",
		unscheduled: "Nicht geplant",
		days: (n) => `${n} T`,
		hours: (n) => `${Math.round(n * 100) / 100} h`,
		waitingOn: "Wartet auf",
		viewingAsPlanner: "Du siehst diese Aufgabe als Planer.",
		instructions: "Anleitung",
		checklist: "Checkliste",
		subtasks: "Unteraufgaben",
		subtasksOpen: (n) =>
			n === 1 ? "1 Unteraufgabe noch offen" : `${n} Unteraufgaben noch offen`,
		finishSubtasksFirst: "alle Unteraufgaben abschließen",
		documents: "Dokumente",
		photos: "Fotos",
		required: "erforderlich",
		requiredDone: "✓ erforderlich",
		waitingToSync: "wartet auf Synchronisation",
		discard: (name) => `${name} verwerfen`,
		remove: (name) => `${name} entfernen`,
		unknownUser: "Unbekannt",
		formerMember: "Ehemaliges Mitglied",
		takePhoto: "Foto aufnehmen oder hinzufügen",
		addAnother: "Weiteres hinzufügen",
		comments: "Kommentare",
		deleteComment: "Kommentar löschen",
		commentPlaceholder: "Kommentar schreiben… @ um jemanden zu erwähnen",
		newComment: "Neuer Kommentar",
		sendComment: "Kommentar senden",
		mentionNoMatches: "Keine Teammitglieder gefunden",
		mentionLoading: "Lädt…",
		history: "Verlauf",
		start: "Starten",
		blocked: "Blockiert",
		markDone: "Erledigt",
		resume: "Weiter",
		reopen: "Wieder öffnen",
		beforeFinishing: (parts) => `Vor dem Abschließen: ${parts.join(" und ")}.`,
		addPhoto: "ein Foto hinzufügen",
		leaveComment: "einen Kommentar hinterlassen",
		downloadFailed: "Download fehlgeschlagen",
		uploadFailed: "Upload fehlgeschlagen",
		photoAdded: "Foto hinzugefügt",
		photosAdded: "Fotos hinzugefügt",
		photoSavedOffline: "Foto offline gespeichert",
		photosSavedOffline: "Fotos offline gespeichert",
		willUploadOnline: "Wird hochgeladen, sobald du wieder online bist.",
		savedOffline: "Offline gespeichert",
		willSyncOnline: "Wird synchronisiert, sobald du wieder online bist.",
		commentSavedOffline: "Kommentar offline gespeichert",
		taskFinished: "Aufgabe erledigt",
		offlinePhotosUnsupported:
			"Fotos können auf diesem Gerät nicht offline gespeichert werden.",
	},
	block: {
		title: "Was blockiert dich?",
		description:
			"Der Planer wird sofort benachrichtigt und deine Notiz an der Aufgabe gespeichert.",
		placeholder: "z. B. Halter 4711 fehlt, 2 Stk.",
		quick: [
			"Teile fehlen",
			"Warte auf vorherigen Schritt",
			"Maschine oder Werkzeug nicht verfügbar",
			"Zeichnung unklar",
		],
		cancel: "Abbrechen",
		submit: "Als blockiert melden",
	},
	sync: {
		synced: (n) =>
			n === 1
				? "1 Offline-Änderung synchronisiert"
				: `${n} Offline-Änderungen synchronisiert`,
		rejected: "Änderung wurde abgelehnt",
		photoLost: (name) => `${name} ging vor dem Hochladen verloren`,
		uploadFailed: (name, status) =>
			`Upload von ${name} fehlgeschlagen (${status})`,
		pushOff: "Push-Benachrichtigungen ausgeschaltet",
		pushBlocked: "Benachrichtigungen sind für diese Seite blockiert",
		pushOn:
			"Du bekommst eine Push-Nachricht, wenn Aufgaben zugewiesen oder freigegeben werden",
		pushIncomplete:
			"Der Browser hat ein unvollständiges Abonnement zurückgegeben",
		pushFailed: "Push konnte nicht aktiviert werden",
	},
	notifications: {
		newTask: "Neue Aufgabe zugewiesen",
		tasksAssigned: (n) => `${n} Aufgaben für dich`,
		onBuilds: (title, n) => `${title} auf ${n} Einheiten`,
		commented: (actor, task) => `${actor} hat ${task} kommentiert`,
		mentioned: (actor, task) => `${actor} hat dich bei ${task} erwähnt`,
		readyToStart: (task) => `Kann starten: ${task}`,
		isFinished: (serial, task) => `${serial} · „${task}“ ist erledigt`,
	},
};

export const workDictionaries: Record<WorkLocale, WorkDictionary> = { en, de };

export function getWorkDictionary(locale: WorkLocale): WorkDictionary {
	return workDictionaries[locale];
}
