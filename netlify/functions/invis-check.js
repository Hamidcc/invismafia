/**
 * invis-check  —  GET ?uuid=<uuid>
 * Returns { hasMod: true/false, username?, lastSeen? }
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

export default async (req) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });

  const secret = req.headers.get("X-Invis-Secret");
  if (secret !== process.env.INVIS_SECRET)
    return new Response("Forbidden", { status: 403 });

  const url  = new URL(req.url);
  const uuid = url.searchParams.get("uuid");
  if (!uuid) return new Response("Missing uuid", { status: 400 });

  const db   = getRedis();
  const raw  = await db.get(`invis:mod:${uuid}`);

  if (!raw) {
    return new Response(JSON.stringify({ hasMod: false }), {
      status:  200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  return new Response(JSON.stringify({ hasMod: true, username: data.username, lastSeen: data.ts }), {
    status:  200,
    headers: { "Content-Type": "application/json" },
  });
};
