import type { Item } from "../types";
import type { Synthesis } from "./synthesizer";

export function templateSynthesize(item: Item): Synthesis {
  const sev = item.kev ? "actively exploited (CISA KEV)" : `${item.severity}-severity`;
  const tech = item.techKeys.join(", ") || "your environment";
  const summary = item.summary.length > 280 ? item.summary.slice(0, 277).trimEnd() + "…" : item.summary;
  const action = item.kev
    ? "• Patch the affected component now — it is exploited in the wild.\n• Apply the vendor's fix and verify the version.\n• Check logs for signs of exploitation.\n• Restrict exposure of the affected service until patched."
    : "• Apply the vendor's patch on your normal cycle.\n• Raise priority if the component is internet-facing.\n• Inventory where the affected technology runs.\n• Track the fixed version in your asset register.";
  return {
    summary,
    impact: `This is a ${sev} issue affecting ${tech}. Assess your exposure and confirm whether affected versions are in use before prioritising remediation.`,
    action
  };
}
