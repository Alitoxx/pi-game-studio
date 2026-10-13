import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	RESET,
	BOLD,
	DIM,
	ACCENT as BLUE,
	SECONDARY as CYAN,
	HEADING as LAVENDER,
	WHITE,
	GRAY,
	BORDER,
	YELLOW,
	GREEN,
	truncateAnsi,
	padAnsi,
	PALETTE_CATEGORIES,
	type CommandCategory,
	type StudioCommandItem,
	filterCommands,
	highlightMatch,
} from "./studio-palette.ts";

/**
 * Centered floating TUI overlay component for fuzzy command search.
 */
export class CommandPaletteOverlayComponent {
	public tui: any;
	public theme: any;
	public done: (result?: StudioCommandItem) => void;
	public ctx: ExtensionContext;

	public query: string = "";
	public cursor: number = 0;
	public selectedCategoryIndex: number = 0;
	public selectedIndex: number = 0;
	public filtered: Array<StudioCommandItem & { score: number; indices: number[] }> = [];

	private readonly maxVisibleItems = 8;

	constructor(
		tui: any,
		theme: any,
		done: (result?: StudioCommandItem) => void,
		ctx: ExtensionContext,
	) {
		this.tui = tui;
		this.theme = theme;
		this.done = done;
		this.ctx = ctx;
		this.recomputeFilter();
	}

	public get currentCategory(): (typeof PALETTE_CATEGORIES)[number] {
		return PALETTE_CATEGORIES[this.selectedCategoryIndex] || "All";
	}

	public recomputeFilter(): void {
		this.filtered = filterCommands(this.query, this.currentCategory);
		if (this.selectedIndex >= this.filtered.length) {
			this.selectedIndex = Math.max(0, this.filtered.length - 1);
		}
	}

	public cycleCategory(delta: number = 1): void {
		const total = PALETTE_CATEGORIES.length;
		this.selectedCategoryIndex = (this.selectedCategoryIndex + delta + total) % total;
		this.selectedIndex = 0;
		this.recomputeFilter();
		this.requestRender();
	}

	public handleInput(data: string): void {
		// Escape / Ctrl+C -> Close
		if (data === "\x1b" || data === "\x03") {
			this.done(undefined);
			return;
		}

		// Tab / Shift+Tab -> Category cycling
		if (data === "\t") {
			this.cycleCategory(1);
			return;
		}
		if (data === "\x1b[Z") {
			this.cycleCategory(-1);
			return;
		}

		// Up arrow or Ctrl+P -> Navigate up
		if (data === "\x1b[A" || data === "\x10") {
			if (this.filtered.length > 0) {
				this.selectedIndex =
					(this.selectedIndex - 1 + this.filtered.length) % this.filtered.length;
				this.requestRender();
			}
			return;
		}

		// Down arrow or Ctrl+N -> Navigate down
		if (data === "\x1b[B" || data === "\x0e") {
			if (this.filtered.length > 0) {
				this.selectedIndex = (this.selectedIndex + 1) % this.filtered.length;
				this.requestRender();
			}
			return;
		}

		// Enter / Return -> Select command
		if (data === "\r" || data === "\n") {
			const picked = this.filtered[this.selectedIndex];
			this.done(picked);
			return;
		}

		// Backspace -> Delete left char
		if (data === "\x7f" || data === "\b") {
			if (this.cursor > 0) {
				this.query =
					this.query.slice(0, this.cursor - 1) + this.query.slice(this.cursor);
				this.cursor--;
				this.selectedIndex = 0;
				this.recomputeFilter();
				this.requestRender();
			}
			return;
		}

		// Left / Right arrow -> Cursor navigation
		if (data === "\x1b[D") {
			this.cursor = Math.max(0, this.cursor - 1);
			this.requestRender();
			return;
		}
		if (data === "\x1b[C") {
			this.cursor = Math.min(this.query.length, this.cursor + 1);
			this.requestRender();
			return;
		}

		// Ctrl+U -> Clear query
		if (data === "\x15") {
			this.query = "";
			this.cursor = 0;
			this.selectedIndex = 0;
			this.recomputeFilter();
			this.requestRender();
			return;
		}

		// Printable character typing
		if (data.length === 1 && data.charCodeAt(0) >= 32) {
			this.query =
				this.query.slice(0, this.cursor) + data + this.query.slice(this.cursor);
			this.cursor++;
			this.selectedIndex = 0;
			this.recomputeFilter();
			this.requestRender();
			return;
		}
	}

	public render(width: number): string[] {
		const cardWidth = Math.min(76, Math.max(56, width - 4));
		const innerWidth = cardWidth - 4;
		const lines: string[] = [];

		// Header
		const title = `PI GAME STUDIO · PALETA DE COMANDOS [Alt+K]`;
		const topFill = Math.max(0, cardWidth - title.length - 5);
		lines.push(
			`${BORDER}╭─${RESET} ${LAVENDER}${BOLD}${title}${RESET} ${BORDER}${"─".repeat(topFill)}╮${RESET}`,
		);

		// Category tabs
		const categoryTabs = PALETTE_CATEGORIES.map((cat, idx) => {
			if (idx === this.selectedCategoryIndex) {
				return `${BLUE}${BOLD}[${cat}]${RESET}`;
			}
			return `${GRAY}${cat}${RESET}`;
		}).join("  ");
		lines.push(
			`${BORDER}│${RESET} ${padAnsi(categoryTabs, innerWidth)} ${BORDER}│${RESET}`,
		);
		lines.push(
			`${BORDER}├${"─".repeat(cardWidth - 2)}┤${RESET}`,
		);

		// Search input line
		const searchPrompt = `${CYAN}${BOLD}> ${RESET}`;
		let searchDisplay = "";
		if (this.query.length === 0) {
			searchDisplay = `${GRAY}[Escribe para buscar comandos...]${RESET}`;
		} else {
			const beforeCursor = this.query.slice(0, this.cursor);
			const atCursor = this.query[this.cursor] || " ";
			const afterCursor = this.query.slice(this.cursor + 1);
			searchDisplay = `${WHITE}${beforeCursor}${RESET}\x1b[7m${atCursor}\x1b[27m${WHITE}${afterCursor}${RESET}`;
		}
		lines.push(
			`${BORDER}│${RESET} ${padAnsi(`${searchPrompt}${searchDisplay}`, innerWidth)} ${BORDER}│${RESET}`,
		);
		lines.push(
			`${BORDER}├${"─".repeat(cardWidth - 2)}┤${RESET}`,
		);

		// Results slice
		if (this.filtered.length === 0) {
			lines.push(
				`${BORDER}│${RESET} ${padAnsi(`  ${GRAY}No se encontraron comandos coincidentes.${RESET}`, innerWidth)} ${BORDER}│${RESET}`,
			);
		} else {
			// Scrolling window calculation
			let startIdx = 0;
			if (this.filtered.length > this.maxVisibleItems) {
				startIdx = Math.max(
					0,
					Math.min(
						this.selectedIndex - Math.floor(this.maxVisibleItems / 2),
						this.filtered.length - this.maxVisibleItems,
					),
				);
			}
			const visibleSlice = this.filtered.slice(
				startIdx,
				startIdx + this.maxVisibleItems,
			);

			for (let i = 0; i < visibleSlice.length; i++) {
				const itemIdx = startIdx + i;
				const item = visibleSlice[i];
				const isSelected = itemIdx === this.selectedIndex;

				const pointer = isSelected ? `${BLUE}▶${RESET} ` : "  ";
				const highlightedName = highlightMatch(item.name, item.indices, CYAN, WHITE);
				const namePadded = padAnsi(`${WHITE}${highlightedName}${RESET}`, 22);

				const descLen = innerWidth - 26;
				const descTrunc = truncateAnsi(item.description, Math.max(10, descLen));
				const descFormatted = isSelected ? `${WHITE}${descTrunc}${RESET}` : `${GRAY}${descTrunc}${RESET}`;

				const rowContent = `${pointer}${namePadded} ${descFormatted}`;
				lines.push(
					`${BORDER}│${RESET} ${padAnsi(rowContent, innerWidth)} ${BORDER}│${RESET}`,
				);
			}
		}

		// Footer navigation hints
		lines.push(
			`${BORDER}├${"─".repeat(cardWidth - 2)}┤${RESET}`,
		);
		const navHint = `${GRAY}↑/↓ o Ctrl+P/N: Mover · Tab: Categoría · Enter: Elegir · Esc: Cerrar${RESET}`;
		lines.push(
			`${BORDER}│${RESET} ${padAnsi(` ${navHint}`, innerWidth)} ${BORDER}│${RESET}`,
		);
		lines.push(
			`${BORDER}╰${"─".repeat(cardWidth - 2)}╯${RESET}`,
		);

		return lines;
	}

	private requestRender(): void {
		if (this.tui?.requestRender) {
			try {
				this.tui.requestRender();
			} catch {}
		}
	}
}

/**
 * Opens the Command Palette floating overlay.
 */
export async function showCommandPalette(
	ctx: ExtensionContext,
): Promise<StudioCommandItem | undefined> {
	if (ctx.hasUI && typeof (ctx.ui as any)?.custom === "function") {
		const picked = await (ctx.ui as any).custom(
			(tui: any, theme: any, _kb: any, done: (res?: StudioCommandItem) => void) => {
				return new CommandPaletteOverlayComponent(tui, theme, done, ctx);
			},
			{ overlay: true },
		);

		if (picked) {
			if (typeof (ctx.ui as any)?.setEditorText === "function") {
				(ctx.ui as any).setEditorText(picked.name);
			}
			if (typeof (ctx.ui as any)?.notify === "function") {
				(ctx.ui as any).notify(`Comando seleccionado: ${picked.name}`, "info");
			}
		}
		return picked;
	}

	return undefined;
}
