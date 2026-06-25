import type { Env, Item } from "../types";
import { buildApnsJwt } from "./jwt";
import { deviceTechKeys } from "../db";
import { chunk } from "../util/chunk";

// iat must be passed in (Workers forbid Date.now() drift assumptions across requests; use one stamp per batch).
export async function sendPush(env: Env, deviceToken: string, apnsEnv: string, title: string, body: string, iat: number): Promise<number> {
  if (!env.APNS_KEY_P8) throw new Error("APNS_KEY_P8 not set");
  const jwt = await buildApnsJwt(env.APNS_KEY_P8, env.APNS_KEY_ID, env.APNS_TEAM_ID, iat);
  const host = apnsEnv === "development" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const res = await fetch(`https://${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      "authorization": `bearer ${jwt}`,
      "apns-topic": env.APNS_TOPIC,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json"
    },
    body: JSON.stringify({ aps: { alert: { title, body }, sound: "default" } })
  });
  return res.status; // 200 = delivered to APNs
}

export async function notifyAllDevices(env: Env, title: string, body: string): Promise<void> {
  const iat = Math.floor(Date.now() / 1000);
  const { results } = await env.DB.prepare(
    `SELECT device_id, apns_token, apns_env FROM devices WHERE apns_token IS NOT NULL`
  ).all<{ device_id: string; apns_token: string; apns_env: string }>();
  for (const d of results ?? []) {
    try {
      const status = await sendPush(env, d.apns_token, d.apns_env ?? "production", title, body, iat);
      await env.DB.prepare(`INSERT INTO push_log (device_id, item_id, sent_at, status) VALUES (?, ?, datetime('now'), ?)`)
        .bind(d.device_id, "daily", String(status)).run();
    } catch (e) { console.error("push failed for device", d.device_id, e); }
  }
}

/** Items that warrant an immediate "breaking" alert: actively exploited or CVSS>=9. */
export function breakingCandidates(items: Item[]): Item[] {
  return items.filter(i => i.kev || (i.cvss ?? 0) >= 9.0);
}

/**
 * Send a single batched "breaking" push to each device whose stack matches one or
 * more newly-added breaking items it has not already been alerted about.
 */
export async function breakingPush(env: Env, newItems: Item[]): Promise<void> {
  const breaking = breakingCandidates(newItems);
  if (breaking.length === 0) return;
  if (!env.APNS_KEY_P8) return;
  const iat = Math.floor(Date.now() / 1000);

  const { results: devices } = await env.DB.prepare(
    `SELECT device_id, apns_token, apns_env FROM devices WHERE apns_token IS NOT NULL`
  ).all<{ device_id: string; apns_token: string; apns_env: string }>();

  for (const d of devices ?? []) {
    const stack = new Set(await deviceTechKeys(env, d.device_id));
    const matched = breaking.filter(i => i.techKeys.some(k => stack.has(k)));
    if (matched.length === 0) continue;

    // Find which of these items this device was already alerted about, chunked to
    // stay under D1's bound-parameter limit.
    const seenIds = new Set<string>();
    for (const group of chunk(matched.map(i => i.id), 50)) {
      const ph = group.map(() => "?").join(",");
      const { results: seenRows } = await env.DB.prepare(
        `SELECT item_id FROM push_log WHERE device_id = ? AND item_id IN (${ph})`
      ).bind(d.device_id, ...group).all<{ item_id: string }>();
      for (const r of seenRows ?? []) seenIds.add(r.item_id);
    }
    const unseen = matched.filter(i => !seenIds.has(i.id));
    if (unseen.length === 0) continue;

    const body = unseen.length === 1
      ? unseen[0].title
      : `${unseen.length} new critical issues affecting your stack`;
    try {
      const status = await sendPush(env, d.apns_token, d.apns_env ?? "production",
        "Breaking: critical issue for your stack", body, iat);
      for (const it of unseen) {
        await env.DB.prepare(
          `INSERT INTO push_log (device_id, item_id, sent_at, status) VALUES (?, ?, datetime('now'), ?)`
        ).bind(d.device_id, it.id, String(status)).run();
      }
    } catch (e) {
      console.error("breaking push failed for device", d.device_id, e);
    }
  }
}
