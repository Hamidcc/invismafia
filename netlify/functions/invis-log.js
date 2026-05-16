/**
 * invis-log  —  receives mod events and posts them as Discord embeds
 *
 * Required env vars:
 *   DISCORD_BOT_TOKEN   – bot token (Bot xxxx...)
 *   DISCORD_CHANNEL_ID  – target channel snowflake
 *   INVIS_SECRET        – shared secret, must match ApiClient.java
 */

const DISCORD_API = "https://discord.com/api/v10";

const EVENT_COLOURS = {
  JOIN:               0x9B59B6,
  SNAPSHOT:           0x8E44AD,
  PLAYER_ENTER_RANGE: 0x2ECC71,
  PLAYER_EXIT_RANGE:  0xE74C3C,
  DEATH:              0x992D22,
  KILL:               0xF39C12,
};

export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  if (body.secret !== process.env.INVIS_SECRET)
    return new Response("Forbidden", { status: 403 });

  const embed = buildEmbed(body);
  if (!embed) return new Response("Unknown event", { status: 422 });

  const res = await fetch(`${DISCORD_API}/channels/${process.env.DISCORD_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Discord error:", err);
    return new Response("Discord error", { status: 502 });
  }

  return new Response("OK", { status: 200 });
};

// ── Embed builder ──────────────────────────────────────────────────────────────

function buildEmbed(d) {
  const colour = EVENT_COLOURS[d.event] ?? 0x7289DA;
  const ts     = d.timestamp ? new Date(d.timestamp).toISOString() : new Date().toISOString();
  const coord  = d.x != null ? `\`(${d.x}, ${d.y}, ${d.z})\` — ${shortDim(d.dimension)}` : null;

  switch (d.event) {

    case "JOIN": return {
      title:       "🟣 Player Joined",
      color:       colour,
      description: `**${d.username}** connected to the server.`,
      fields: [
        { name: "UUID",       value: d.uuid,                    inline: true  },
        { name: "Position",   value: coord ?? "Unknown",        inline: true  },
        { name: "Health",     value: `❤️ ${d.health}/${d.maxHealth}`, inline: true },
        { name: "Hunger",     value: `🍗 ${d.hunger}/20`,       inline: true  },
        ...(d.effects?.length ? [{ name: "Active Effects", value: formatEffects(d.effects), inline: false }] : []),
        ...(d.inventory?.length ? [{ name: "Inventory",    value: formatInventory(d.inventory), inline: false }] : []),
      ],
      footer:    { text: "Invis Mafia • Join" },
      timestamp: ts,
    };

    case "SNAPSHOT": return {
      title:       "📦 Inventory Snapshot",
      color:       colour,
      description: `**${d.username}**'s 3-minute check-in.`,
      fields: [
        { name: "Position",      value: coord ?? "Unknown",          inline: true },
        { name: "Health",        value: `❤️ ${d.health}`,            inline: true },
        { name: "Hunger",        value: `🍗 ${d.hunger}/20`,         inline: true },
        ...(d.nearbyPlayers?.length ? [{ name: "Nearby Players", value: d.nearbyPlayers.join(", "), inline: false }] : []),
        ...(d.effects?.length ? [{ name: "Active Effects", value: formatEffects(d.effects), inline: false }] : []),
        { name: "Inventory", value: d.inventory?.length ? formatInventory(d.inventory) : "_Empty_", inline: false },
      ],
      footer:    { text: "Invis Mafia • Snapshot" },
      timestamp: ts,
    };

    case "PLAYER_ENTER_RANGE": return {
      title:       "🟢 Player Entered Range",
      color:       colour,
      description: `**${d.username}** is now near **${d.nearPlayer}**.`,
      fields: [
        { name: "Their Position", value: coord ?? "Unknown", inline: true },
        { name: "Nearby Player", value: d.nearPlayer,       inline: true },
        { name: "Has Mod",       value: d.hasMod ? "✅ Yes" : "❌ No", inline: true },
      ],
      footer:    { text: "Invis Mafia • Proximity" },
      timestamp: ts,
    };

    case "PLAYER_EXIT_RANGE": return {
      title:       "🔴 Player Left Range",
      color:       colour,
      description: `**${d.nearPlayer}** is no longer near **${d.username}**.`,
      fields: [
        { name: "Last Position", value: coord ?? "Unknown", inline: true },
      ],
      footer:    { text: "Invis Mafia • Proximity" },
      timestamp: ts,
    };

    case "DEATH": return {
      title:       "💀 Player Died",
      color:       colour,
      description: `**${d.username}** died.`,
      fields: [
        { name: "Position",  value: coord ?? "Unknown",        inline: true },
        ...(d.nearbyAtDeath?.length ? [{ name: "Nearby at Death", value: d.nearbyAtDeath.join(", "), inline: false }] : []),
      ],
      footer:    { text: "Invis Mafia • Combat" },
      timestamp: ts,
    };

    case "KILL": return {
      title:       "⚔️ Kill Confirmed",
      color:       colour,
      description: `**${d.username}** eliminated **${d.victim}**.`,
      fields: [
        { name: "Position", value: coord ?? "Unknown", inline: true },
      ],
      footer:    { text: "Invis Mafia • Combat" },
      timestamp: ts,
    };

    default: return null;
  }
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function formatInventory(items) {
  if (!items?.length) return "_Empty_";
  return items
    .map(i => {
      const name = i.item.replace("minecraft:", "").replace(/_/g, " ");
      const slot = i.slot === "armor" ? " (armor)" : "";
      return `• ${i.count}× **${name}**${slot}`;
    })
    .join("\n")
    .slice(0, 1024);
}

function formatEffects(effects) {
  if (!effects?.length) return "_None_";
  return effects
    .map(e => {
      const name = e.effect.replace("minecraft:", "").replace(/_/g, " ");
      const lvl  = e.amplifier > 0 ? ` ${toRoman(e.amplifier + 1)}` : "";
      const dur  = formatDuration(e.duration);
      return `• **${name}${lvl}** (${dur})`;
    })
    .join("\n");
}

function formatDuration(ticks) {
  const s = Math.floor(ticks / 20);
  return s >= 60 ? `${Math.floor(s/60)}m ${s%60}s` : `${s}s`;
}

function toRoman(n) {
  const r = ["","I","II","III","IV","V","VI","VII","VIII","IX","X"];
  return r[n] ?? String(n);
}

function shortDim(dim) {
  if (!dim) return "Unknown";
  return dim.replace("minecraft:", "").replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}
