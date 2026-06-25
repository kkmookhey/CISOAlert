import type { Env } from "./types";

export async function upsertDevice(env: Env, deviceId: string, apnsToken: string | null, tz: string, techKeys: string[]) {
  await env.DB.prepare(
    `INSERT INTO devices (device_id, apns_token, tz, updated_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(device_id) DO UPDATE SET apns_token=excluded.apns_token, tz=excluded.tz, updated_at=datetime('now')`
  ).bind(deviceId, apnsToken, tz).run();

  await env.DB.prepare(`DELETE FROM device_stack WHERE device_id = ?`).bind(deviceId).run();
  for (const key of techKeys) {
    await env.DB.prepare(`INSERT OR IGNORE INTO device_stack (device_id, tech_key) VALUES (?, ?)`).bind(deviceId, key).run();
  }
}

export async function deviceTechKeys(env: Env, deviceId: string): Promise<string[]> {
  const { results } = await env.DB.prepare(`SELECT tech_key FROM device_stack WHERE device_id = ?`).bind(deviceId).all<{ tech_key: string }>();
  return (results ?? []).map(r => r.tech_key);
}

export async function deleteDevice(env: Env, deviceId: string) {
  await env.DB.prepare(`DELETE FROM device_stack WHERE device_id = ?`).bind(deviceId).run();
  await env.DB.prepare(`DELETE FROM devices WHERE device_id = ?`).bind(deviceId).run();
}
