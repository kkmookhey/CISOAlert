import type { Env, Item } from "../types";
import type { Synthesis } from "./synthesizer";
import { templateSynthesize } from "./template";

export async function claudeSynthesize(env: Env, item: Item): Promise<Synthesis> {
  const prompt = `You are briefing a CISO. For the vulnerability below, return STRICT JSON with keys "summary", "impact", "action". No markdown, no prose outside the JSON. Keep it tight and consistent:
- "summary": 2-3 sentences, max ~45 words. Plain factual description of the flaw.
- "impact": ~2 sentences, max ~35 words. Why it matters to a security leader running the affected technology.
- "action": 3-4 short imperative remediation steps. Put each step on its own line, prefixed with "• ". No numbering, no extra commentary.

CVE: ${item.id}
Title: ${item.title}
Severity: ${item.severity}${item.cvss ? ` (CVSS ${item.cvss})` : ""}${item.kev ? " — on CISA KEV (exploited in the wild)" : ""}
Affected technologies: ${item.techKeys.join(", ")}
Description: ${item.summary}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: env.CLAUDE_MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = await res.json<any>();
  const text = data.content?.[0]?.text ?? "{}";
  const parsed = JSON.parse(text.trim().replace(/^```json\s*|\s*```$/g, ""));
  // If Claude returns valid JSON but omits a field, fall back to the template for that
  // field rather than rendering a blank section.
  const fallback = templateSynthesize(item);
  return {
    summary: parsed.summary || item.summary,
    impact: parsed.impact || fallback.impact,
    action: parsed.action || fallback.action
  };
}
