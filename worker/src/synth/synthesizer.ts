import type { Env, Item } from "../types";
import { claudeSynthesize } from "./claude";
import { templateSynthesize } from "./template";

export interface Synthesis { summary: string; impact: string; action: string; }

/** Uses Claude when ANTHROPIC_API_KEY is present, else a deterministic template. */
export async function synthesize(env: Env, item: Item): Promise<Synthesis> {
  if (env.ANTHROPIC_API_KEY) {
    try { return await claudeSynthesize(env, item); }
    catch (e) { console.error("Claude synthesis failed:", e); return templateSynthesize(item); }
  }
  return templateSynthesize(item);
}
