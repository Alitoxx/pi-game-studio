import {
	ScrollView,
	VStack,
	visibleWidth,
	type Component,
	type TUI,
	type TuiMouseEvent,
} from "@earendil-works/pi-tui";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { findStudioRoot } from "./studio-root.ts";
import { inspectStudioTasks } from "./studio-tasks.ts";
import { renderStudioStatusCard } from "./studio-hud.ts";
import { renderTasksWidgetCard, isTasksWidgetEnabled } from "./studio-tasks-widget.ts";

export const SIDEBAR_BREAKPOINT = 140;
const RAIL_WIDTH = 50;
const RAIL_PADDING = 1;
const GAP = 2;

const NODE = Symbol.for("@earendil-works/pi-tui/layout-node");
type LayoutNode = {
	type: string;
	entries?: unknown[];
	gap?: number;
	align?: "stretch" | "start" | "center" | "end";
};
type StackLayoutEntry = ConstructorParameters<typeof VStack>[0] extends
	| Array<infer T>
	| undefined
	? Exclude<T, Component>
	: never;
type LayoutRoot = Component & { [NODE]?: () => LayoutNode };
type Host = TUI & { mode?: string; layoutRoot?: LayoutRoot };

const STATE = Symbol.for("pi-game-studio.sidebar.state");

export interface StudioSidebarState {
	active: boolean;
	revision: number;
	ownsHost?: () => boolean;
}

export function getStudioSidebarState(tui: TUI): StudioSidebarState {
	const terminal = tui.terminal as unknown as Record<symbol, StudioSidebarState>;
	return (terminal[STATE] ??= { active: false, revision: 0 });
}

export function invalidateStudioSidebar(tui?: TUI): void {
	if (tui?.terminal) {
		getStudioSidebarState(tui).revision++;
		try {
			tui.requestRender();
		} catch {}
	}
}

/**
 * Checks if the studio sidebar is currently active and owns the fullscreen host layout.
 */
export function isStudioSidebarActive(tui?: TUI): boolean {
	if (!tui?.terminal) return false;
	const state = getStudioSidebarState(tui);
	return state.active && (state.ownsHost ? state.ownsHost() : false);
}

/**
 * Installs the fullscreen right rail in Pi's TUI (matching Gentle Shell).
 * Displays Status + Tasks on the right rail when terminal width >= 140 and in fullscreen mode.
 * Safe fallback to bottom widget if terminal is narrower or not in fullscreen.
 */
export function installStudioSidebar(tui: TUI, ctx: ExtensionContext): () => void {
	if (!tui?.terminal) return () => {};

	const host = tui as Host;
	const state = getStudioSidebarState(tui);
	const cleanups: Array<() => void> = [];
	const roots = new Set<LayoutRoot>();
	let stopped = false;
	let failed = false;
	let railLines: string[] = [];
	let lastRevision = -1;
	let lastWidth = -1;

	state.ownsHost = () =>
		!stopped &&
		host.mode === "fullscreen" &&
		!!host.layoutRoot &&
		roots.has(host.layoutRoot);

	const rail: Component = {
		render: () => railLines,
		invalidate() {
			invalidateStudioSidebar(tui);
		},
	};

	const scroll = new ScrollView(rail, {
		follow: "none",
		primary: false,
		overscroll: "contain",
		scrollbar: "auto",
	});

	scroll.handleMouse = (event: TuiMouseEvent) => {
		if (event.type === "wheel") {
			scroll.scrollBy(event.wheelDelta ?? 0);
			return {
				handled: true,
				render: true,
				target: {
					component: scroll,
					originX: event.screenX - event.x,
					originY: event.screenY - event.y,
					width: event.width,
					height: event.height,
				},
			};
		}
		return undefined;
	};

	const prepare = (width: number): boolean => {
		state.active = false;
		if (stopped || failed || host.mode !== "fullscreen" || width < SIDEBAR_BREAKPOINT) {
			return false;
		}

		if (state.revision === lastRevision && width === lastWidth && railLines.length > 0) {
			state.active = true;
			return true;
		}

		try {
			const studioRoot = findStudioRoot(ctx.cwd) || ctx.cwd;
			const contentWidth = scroll.getContentWidth(RAIL_WIDTH);
			const cardInnerWidth = Math.max(0, contentWidth - RAIL_PADDING * 2);

			// Render Status Card
			const statusLines = renderStudioStatusCard(ctx, studioRoot, cardInnerWidth);

			// Render Tasks Card (if enabled and tasks exist)
			let taskLines: string[] = [];
			if (isTasksWidgetEnabled(studioRoot)) {
				const summary = inspectStudioTasks(studioRoot);
				if (summary.totalCount > 0 && summary.tasks.length > 0) {
					taskLines = renderTasksWidgetCard(summary.tasks, cardInnerWidth);
				}
			}

			railLines = [];
			railLines.push(""); // top margin

			for (const line of statusLines) {
				railLines.push(" ".repeat(RAIL_PADDING) + line);
			}

			if (taskLines.length > 0) {
				railLines.push(""); // gap between cards
				for (const line of taskLines) {
					railLines.push(" ".repeat(RAIL_PADDING) + line);
				}
			}

			const active =
				railLines.length > 0 &&
				railLines.every((l) => visibleWidth(l) <= contentWidth + 4);

			state.active = active;
			lastRevision = state.revision;
			lastWidth = width;
			return active;
		} catch {
			failed = true;
			state.active = false;
			return false;
		}
	};

	const attach = () => {
		if (stopped || failed) return;
		if (host.mode !== "fullscreen") {
			state.active = false;
			return;
		}

		try {
			const root = host.layoutRoot;
			if (!root || typeof root[NODE] !== "function") {
				state.active = false;
				return;
			}
			if (roots.has(root)) return;

			const original = root[NODE]!;
			const descriptor = Object.getOwnPropertyDescriptor(root, NODE);

			// Reclaim dock footer row when host is stretched
			const docks = new WeakMap<Component, VStack>();
			const reclaimFooterRow = (node: LayoutNode): LayoutNode => {
				if (node.type !== "vstack" || !node.entries?.length) return node;
				const entries = node.entries as Array<{
					component: Component & { [NODE]?: () => LayoutNode };
				}>;
				const dock = entries[entries.length - 1]!.component;
				if (typeof dock[NODE] !== "function") return node;
				let wrapped = docks.get(dock);
				if (!wrapped) {
					const inner = dock[NODE]!();
					if (inner.type !== "vstack" || !inner.entries?.length) return node;
					const last = inner.entries.length - 1;
					wrapped = new VStack(
						inner.entries.map((entry, index) =>
							index === last
								? { ...(entry as StackLayoutEntry), minSize: 0 }
								: (entry as StackLayoutEntry),
						),
						{ gap: inner.gap, align: inner.align },
					);
					docks.set(dock, wrapped);
				}
				return {
					...node,
					entries: entries.map((entry, index) =>
						index === entries.length - 1 ? { ...entry, component: wrapped! } : entry,
					),
				};
			};

			// The left component: transcript wrapped with footer reclamation
			const left = {
				render: () => [],
				invalidate() {},
				[NODE]: () => reclaimFooterRow(original.call(root)),
			};

			// hstack with transcript on the left, rail on the right (matching Gentle Shell)
			const hstackHost: Component & { [NODE](): LayoutNode } = {
				render: () => [],
				invalidate() {},
				[NODE]: () => ({
					type: "hstack",
					gap: GAP,
					align: "stretch",
					entries: [
						{ component: left, basis: 0, grow: 1, shrink: 1, minSize: 1 },
						{
							component: scroll,
							basis: RAIL_WIDTH,
							grow: 0,
							shrink: 0,
							minSize: RAIL_WIDTH,
						},
					],
				}),
			};

			const replacement = () => {
				if (!prepare(tui.terminal.columns)) {
					return original.call(root);
				}
				return hstackHost[NODE]();
			};

			root[NODE] = replacement;
			roots.add(root);
			try {
				tui.requestRender();
			} catch {}

			cleanups.push(() => {
				if (root[NODE] !== replacement) return;
				if (descriptor) Object.defineProperty(root, NODE, descriptor);
				else Reflect.deleteProperty(root, NODE);
			});
		} catch {
			failed = true;
			state.active = false;
		}
	};

	attach();

	// Check periodically if Pi replaced the root renderer (e.g. on full rebuild)
	const timer = setInterval(attach, 150);
	if (typeof (timer as any).unref === "function") {
		(timer as any).unref();
	}

	return () => {
		stopped = true;
		state.active = false;
		clearInterval(timer);
		try {
			scroll.hideTransientScrollbar();
		} catch {}
		for (const cleanup of cleanups.reverse()) cleanup();
		try {
			tui.requestRender();
		} catch {}
	};
}
