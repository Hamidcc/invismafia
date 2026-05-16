/**
 * invis-register  —  heartbeat that records a UUID as a mod user
 *
 * Required env vars:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *   INVIS_SECRET
 */

import { Redis } from "@upstash/redis";

let redis;
function getRedis() {
  if (!redis) redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return redis;
}

// TTL: if we haven't heard a heartbeat in 90 seconds, they're offline / unmodded
const TTL_SECONDS = 90;

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  if (body.secret !== process.env.INVIS_SECRET)
    return new Response("Forbidden", { status: 403 });

  const { uuid, username } = body;
  if (!uuid) return new Response("Missing uuid", { status: 400 });

  const db = getRedis();
  await db.set(`invis:mod:${uuid}`, JSON.stringify({ uuid, username, ts: Date.now() }), { ex: TTL_SECONDS });

  return new Response(JSON.stringify({ ok: true }), {
    status:  200,
    headers: { "Content-Type": "application/json" },
  });
};
