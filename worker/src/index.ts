import type { Env, Item, Category } from "./types";
import { upsertDevice, deviceTechKeys, deleteDevice } from "./db";
import { composeBriefing } from "./briefing";
import { loadItems, insertItems, SEED_ITEMS, editionDates, pruneOldItems, loadCriticalKevVulns } from "./seed";
import { runIngest } from "./intel/normalize";
import { notifyAllDevices, sendPush, breakingPush } from "./apns/push";
import catalog from "../shared/tech_catalog.json";

const VALID_TECH_KEYS = new Set<string>(
  (catalog as any).categories.flatMap((c: any) => c.options.map((o: any) => o.key))
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function today(): string { return new Date().toISOString().slice(0, 10); }

function requireAdmin(req: Request, env: Env): Response | null {
  if (!env.ADMIN_TOKEN) return json({ error: "admin not configured" }, 503);
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (provided !== env.ADMIN_TOKEN) return json({ error: "forbidden" }, 403);
  return null;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (req.method === "POST" && url.pathname === "/v1/register") {
        let b: any;
        try { b = await req.json(); } catch (e) { return json({ error: "invalid JSON body" }, 400); }
        if (!b.deviceId) return json({ error: "deviceId required" }, 400);
        const techKeys = (Array.isArray(b.techKeys) ? b.techKeys : []).filter(
          (k: unknown): k is string => typeof k === "string" && VALID_TECH_KEYS.has(k)
        );
        await upsertDevice(env, b.deviceId, b.apnsToken ?? null, b.tz ?? "UTC", techKeys);
        return new Response(null, { status: 204 });
      }

      if (req.method === "GET" && url.pathname === "/v1/briefing") {
        const category = ((url.searchParams.get("category") ?? "vuln")) as Category;
        if (!["vuln", "threat", "news"].includes(category)) return json({ error: "bad category" }, 400);
        const deviceId = req.headers.get("x-device-id");
        const date = url.searchParams.get("date") ?? undefined;
        const stack = deviceId
          ? await deviceTechKeys(env, deviceId)
          : (url.searchParams.get("techKeys")?.split(",").filter(Boolean) ?? []);
        const global = category !== "vuln";
        const items = await loadItems(env, { category, stack, date, global });
        const fallback = category === "vuln" ? await loadCriticalKevVulns(env, date) : [];
        return json(composeBriefing(items, { date: date ?? today(), category, stack, fallback }));
      }

      if (req.method === "GET" && url.pathname === "/v1/briefing/dates") {
        const category = ((url.searchParams.get("category") ?? "vuln")) as Category;
        if (!["vuln", "threat", "news"].includes(category)) return json({ error: "bad category" }, 400);
        const deviceId = req.headers.get("x-device-id");
        const global = category !== "vuln";
        const stack = deviceId ? await deviceTechKeys(env, deviceId) : [];
        if (!global && !deviceId) return json([], 200);
        return json(await editionDates(env, { category, stack, global }));
      }

      if (req.method === "POST" && url.pathname === "/v1/delete") {
        let b: any;
        try { b = await req.json(); } catch (e) { return json({ error: "invalid JSON body" }, 400); }
        if (!b.deviceId) return json({ error: "deviceId required" }, 400);
        await deleteDevice(env, b.deviceId);
        return new Response(null, { status: 204 });
      }

      if (req.method === "POST" && url.pathname === "/v1/admin/seed") {
        const denied = requireAdmin(req, env); if (denied) return denied;
        await insertItems(env, SEED_ITEMS);
        return json({ inserted: SEED_ITEMS.length });
      }

      if (req.method === "POST" && url.pathname === "/v1/admin/ingest") {
        const denied = requireAdmin(req, env); if (denied) return denied;
        await runIngest(env);
        return json({ ok: true });
      }

      if (req.method === "POST" && url.pathname === "/v1/admin/push-test") {
        const denied = requireAdmin(req, env); if (denied) return denied;
        let b: any;
        try { b = await req.json(); } catch (e) { return json({ error: "invalid JSON body" }, 400); }
        const status = await sendPush(env, b.token, b.env ?? "development", "CISOAlert test", "Push works 🎉", Math.floor(Date.now() / 1000));
        return json({ apnsStatus: status });
      }

      return json({ error: "not found" }, 404);
    } catch (e: any) {
      return json({ error: e?.message ?? "internal error" }, 500);
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      // Each phase is isolated: a failure (e.g. an upstream outage) in one must not
      // skip the others — notably, a truncated ingest must still let push/prune run.
      let newItems: Item[] = [];
      try { newItems = await runIngest(env); } catch (e) { console.error("ingest failed", e); }
      try { await breakingPush(env, newItems); } catch (e) { console.error("breakingPush failed", e); }
      try { await pruneOldItems(env); } catch (e) { console.error("prune failed", e); }
      try {
        if (new Date(event.scheduledTime).getUTCHours() === 6) {
          await notifyAllDevices(env, "Your CISOAlert briefing is ready", "Open today's briefing for issues matched to your stack.");
        }
      } catch (e) { console.error("daily summary failed", e); }
    })());
  }
};
