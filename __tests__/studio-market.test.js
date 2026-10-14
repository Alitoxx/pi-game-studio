const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

describe("Studio Market - Boxleiter & Commercial Governance", () => {
	const marketPath = path.join(__dirname, "..", "extensions", "hooks", "studio-market.ts");

	test("studio-market.ts exists and exports required contracts", () => {
		expect(fs.existsSync(marketPath)).toBe(true);
		const content = fs.readFileSync(marketPath, "utf8");
		expect(content).toContain("export function calculateBoxleiterEstimate");
		expect(content).toContain("export function generateProducerFinancialRules");
		expect(content).toContain("export function renderMarketReport");
		expect(content).toContain("export async function analyzeSteamMarket");
	});

	test("TypeScript runtime execution of Boxleiter formulas and Producer financial rules", () => {
		const script = `
			const {
				calculateBoxleiterEstimate,
				generateProducerFinancialRules,
				renderMarketReport,
			} = await import("./extensions/hooks/studio-market.ts");

			// 1. Boxleiter standard & edge cases
			const standard = calculateBoxleiterEstimate(100, 19.99);
			if (standard.copies !== 4000) throw new Error("Copies mismatch: " + standard.copies);
			if (standard.grossUsd !== Math.round(4000 * 19.99 * 0.92)) throw new Error("Gross USD mismatch");
			if (standard.netDevUsd !== Math.round(standard.grossUsd * 0.55)) throw new Error("Net Dev USD mismatch");

			// 0 reviews & free games
			const zero = calculateBoxleiterEstimate(0, 19.99);
			if (zero.copies !== 0 || zero.grossUsd !== 0 || zero.netDevUsd !== 0) throw new Error("Zero reviews failed");

			const free = calculateBoxleiterEstimate(500, 0);
			if (free.copies !== 20000 || free.grossUsd !== 0 || free.netDevUsd !== 0) throw new Error("Free game failed");

			// Non-finite resilient
			const nanEst = calculateBoxleiterEstimate(NaN, NaN);
			if (nanEst.copies !== 0 || nanEst.grossUsd !== 0 || nanEst.netDevUsd !== 0) throw new Error("NaN failed");

			const infEst = calculateBoxleiterEstimate(Infinity, 10);
			if (infEst.copies !== 0 || infEst.grossUsd !== 0 || infEst.netDevUsd !== 0) throw new Error("Infinity failed");

			// 2. Financial rules and scope vetoes
			const ext = generateProducerFinancialRules("any", "Saturación Extrema");
			if (!ext.maxDevBudget.includes("4-6 meses")) throw new Error("Extrema budget mismatch");

			const high = generateProducerFinancialRules("any", "Alta");
			if (!high.maxDevBudget.includes("6-8 meses")) throw new Error("Alta budget mismatch");

			const mod = generateProducerFinancialRules("any", "Moderada");
			if (!mod.maxDevBudget.includes("6-9 meses")) throw new Error("Moderada budget mismatch");

			const deck = generateProducerFinancialRules("Deckbuilder Roguelike", "Alta");
			if (!deck.scopeVeto.includes("150 cartas")) throw new Error("Deckbuilder veto mismatch");

			const souls = generateProducerFinancialRules("Soulslike 2D", "Alta");
			if (!souls.scopeVeto.includes("3 jefes insignia")) throw new Error("Soulslike veto mismatch");

			const surv = generateProducerFinancialRules("Survival Crafting", "Moderada");
			if (!surv.scopeVeto.includes("recetas redundantes")) throw new Error("Survival veto mismatch");

			const horde = generateProducerFinancialRules("Vampire Survivors Horde", "Baja");
			if (!horde.scopeVeto.includes("2.000 proyectiles")) throw new Error("Horde veto mismatch");

			// 3. renderMarketReport integrity
			const mockAnalysis = {
				query: "test roguelike",
				metrics: {
					competitorCount: 50,
					competitorCountFormatted: "50",
					saturationLevel: "Moderada",
					verdict: "LUZ VERDE",
					priceRange: "$9.99 - $19.99",
					releasedCount: 1,
					upcomingCount: 0,
					avgReviewsTop: 100,
					maxReviewsTop: 200,
				},
				competitors: [
					{
						id: 101,
						name: "Sample Competitor",
						steamUrl: "https://store.steampowered.com/app/101",
						ratingDesc: "Very Positive (90%)",
						ratingPercent: 90,
						totalReviews: 200,
						priceFormatted: "$14.99 USD",
						priceUsd: 14.99,
						isReleased: true,
						genres: ["Action"],
						boxleiter: calculateBoxleiterEstimate(200, 14.99),
					},
				],
				ceroFiltro: {
					tropesCritique: "Critique",
					mandatoryHook: "Hook",
				},
				financialRules: generateProducerFinancialRules("test roguelike", "Moderada"),
			};

			const lines = renderMarketReport(mockAnalysis, 76);
			if (!Array.isArray(lines)) throw new Error("renderMarketReport must return string[]");
			const report = lines.join("\\n");
			if (!report.includes("ANÁLISIS FINANCIERO & REGLAS DEL PRODUCTOR")) throw new Error("Missing financial header");
			if (!report.includes("PRESUPUESTO TEMPORAL MÁXIMO")) throw new Error("Missing budget section");
			if (!report.includes("UMBRAL DE WISHLISTS")) throw new Error("Missing wishlist threshold");
			if (!report.includes("VETO DE SCOPE PREVENTIVO")) throw new Error("Missing scope veto");
			if (!report.includes("Ventas Est:")) throw new Error("Missing sales estimate");
			if (!report.includes("Facturación Neta Dev:")) throw new Error("Missing dev net revenue");
		`;

		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			});
		}).not.toThrow();
	});
});
