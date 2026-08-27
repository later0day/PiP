import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * pi-qwen-rotate
 *
 * Registers a DashScope/Bailian (Qwen) provider and rotates across multiple
 * API keys. Each outbound request to this provider gets the next key in the
 * pool via the `before_provider_headers` hook. Keys that return auth/rate-limit
 * failures (via `after_provider_response`) are put on a temporary cooldown so
 * the pool self-heals instead of hammering a dead key.
 *
 * Keys are never hard-coded here. They are loaded, in priority order, from:
 *   1. env QWEN_ROTATE_KEYS         (comma/space/newline separated)
 *   2. env QWEN_ROTATE_CONFIG       (path to a JSON config file)
 *   3. ./qwen-rotate.config.json    (next to this extension)
 *   4. ~/.pi/qwen-rotate.config.json
 */

/**
 * DashScope's OpenAI-compatible endpoint only accepts the classic roles
 * (system/assistant/user/tool/function) and uses Qwen's thinking convention.
 * These defaults keep pi from sending the newer `developer` role, `store`, or
 * `reasoning_effort` fields that DashScope rejects with a 400. Any model may
 * override individual flags via its `compat` block in the config.
 */
const DEFAULT_COMPAT = {
	thinkingFormat: "qwen" as const,
	supportsDeveloperRole: false,
	supportsStore: false,
	supportsReasoningEffort: false,
};

interface ModelConfig {
	id: string;
	name?: string;
	reasoning?: boolean;
	input?: ("text" | "image")[];
	contextWindow?: number;
	maxTokens?: number;
	compat?: Record<string, unknown>;
}

interface RotateConfig {
	baseUrl: string;
	providerId: string;
	providerName: string;
	keys: string[];
	strategy: "round-robin";
	cooldownMs: number;
	models: ModelConfig[];
}

const DEFAULTS = {
	baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
	providerId: "qwen-rotate",
	providerName: "Qwen Rotate (DashScope)",
	strategy: "round-robin" as const,
	cooldownMs: 60_000,
	models: [
		{ id: "glm-5.2", name: "GLM-5.2 (rotate)", reasoning: true, contextWindow: 131072, maxTokens: 16384 },
	] satisfies ModelConfig[],
};

function parseKeyList(raw: string): string[] {
	return raw
		.split(/[\s,]+/)
		.map((k) => k.trim())
		.filter((k) => k.length > 0);
}

function loadConfig(): RotateConfig {
	const here = new URL(".", import.meta.url).pathname;
	const candidates = [
		process.env.QWEN_ROTATE_CONFIG,
		join(here, "qwen-rotate.config.json"),
		join(homedir(), ".pi", "qwen-rotate.config.json"),
	].filter((p): p is string => typeof p === "string" && p.length > 0);

	let fileCfg: Partial<RotateConfig> = {};
	for (const path of candidates) {
		if (existsSync(path)) {
			try {
				fileCfg = JSON.parse(readFileSync(path, "utf8")) as Partial<RotateConfig>;
				break;
			} catch (err) {
				console.error(`[qwen-rotate] failed to parse config ${path}:`, err);
			}
		}
	}

	const envKeys = process.env.QWEN_ROTATE_KEYS ? parseKeyList(process.env.QWEN_ROTATE_KEYS) : [];
	const keys = envKeys.length > 0 ? envKeys : (fileCfg.keys ?? []).map((k) => k.trim()).filter(Boolean);

	return {
		baseUrl: fileCfg.baseUrl ?? DEFAULTS.baseUrl,
		providerId: fileCfg.providerId ?? DEFAULTS.providerId,
		providerName: fileCfg.providerName ?? DEFAULTS.providerName,
		keys,
		strategy: DEFAULTS.strategy,
		cooldownMs: fileCfg.cooldownMs ?? DEFAULTS.cooldownMs,
		models: fileCfg.models && fileCfg.models.length > 0 ? fileCfg.models : DEFAULTS.models,
	};
}

/** Round-robin key pool with per-key cooldown after failures. */
class KeyPool {
	private cursor = 0;
	private cooldownUntil: number[];

	constructor(
		private readonly keys: string[],
		private readonly cooldownMs: number,
	) {
		this.cooldownUntil = keys.map(() => 0);
	}

	get size(): number {
		return this.keys.length;
	}

	/** Pick the next key that is not on cooldown; fall back to the least-recently-cooled one. */
	next(): { key: string; index: number } | undefined {
		if (this.keys.length === 0) return undefined;
		const now = Date.now();
		for (let i = 0; i < this.keys.length; i++) {
			const idx = (this.cursor + i) % this.keys.length;
			if (this.cooldownUntil[idx] <= now) {
				this.cursor = (idx + 1) % this.keys.length;
				return { key: this.keys[idx], index: idx };
			}
		}
		// All on cooldown: use the one whose cooldown expires soonest.
		let best = 0;
		for (let i = 1; i < this.keys.length; i++) {
			if (this.cooldownUntil[i] < this.cooldownUntil[best]) best = i;
		}
		this.cursor = (best + 1) % this.keys.length;
		return { key: this.keys[best], index: best };
	}

	penalize(index: number): void {
		if (index >= 0 && index < this.cooldownUntil.length) {
			this.cooldownUntil[index] = Date.now() + this.cooldownMs;
		}
	}
}

export default function activate(pi: ExtensionAPI): void {
	const cfg = loadConfig();

	if (cfg.keys.length === 0) {
		console.error(
			"[qwen-rotate] no API keys configured. Set QWEN_ROTATE_KEYS or create qwen-rotate.config.json. Provider not registered.",
		);
		return;
	}

	const pool = new KeyPool(cfg.keys, cfg.cooldownMs);

	// Register the DashScope provider. apiKey is a literal placeholder so the
	// model system treats the provider as authenticated; the real key is
	// injected per-request by the header hook below.
	pi.registerProvider(cfg.providerId, {
		name: cfg.providerName,
		baseUrl: cfg.baseUrl,
		api: "openai-completions",
		apiKey: cfg.keys[0],
		authHeader: true,
		models: cfg.models.map((m) => ({
			id: m.id,
			name: m.name ?? m.id,
			reasoning: m.reasoning ?? false,
			input: m.input ?? ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: m.contextWindow ?? 131072,
			maxTokens: m.maxTokens ?? 16384,
			compat: { ...DEFAULT_COMPAT, ...(m.compat ?? {}) },
		})),
	});

	// Tracks the key index used for the in-flight request so the response hook
	// can penalize the right key on failure.
	let lastIndex = -1;

	pi.on("before_provider_headers", (event, ctx: ExtensionContext) => {
		// Only rotate for our provider; leave every other provider untouched.
		if (ctx.model?.provider !== cfg.providerId) return;
		const picked = pool.next();
		if (!picked) return;
		lastIndex = picked.index;
		event.headers.Authorization = `Bearer ${picked.key}`;
	});

	pi.on("after_provider_response", (event, ctx: ExtensionContext) => {
		if (ctx.model?.provider !== cfg.providerId) return;
		// 401/403 = bad/expired key, 429 = rate limited: cool this key down.
		if (event.status === 401 || event.status === 403 || event.status === 429) {
			if (lastIndex >= 0) pool.penalize(lastIndex);
		}
	});

	pi.registerCommand("qwen-rotate-status", {
		description: "Show qwen-rotate key pool status",
		handler: async (_args, ctx) => {
			ctx.ui.notify(
				`[qwen-rotate] provider=${cfg.providerId} baseUrl=${cfg.baseUrl} keys=${pool.size} models=${cfg.models.length}`,
				"info",
			);
		},
	});
}
