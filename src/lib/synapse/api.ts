import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { cleanUsername, parseBirthDate, sanitizeBlocks, type Block } from "@/lib/synapse/model";

type ProfileRow = {
  username: string;
  birth_date: string;
  avatar_url?: string | null;
  look?: unknown;
};
type PlayerRow = { user_id: string; username: string };
type RequestRow = { id: number; user_id: string; username: string; created_at: unknown };
type ExperienceRow = {
  id: number;
  title: string;
  updated_at: unknown;
  block_count: number;
};
type ExperienceFullRow = {
  id: number;
  title: string;
  blocks: unknown;
  script: string;
  updated_at: unknown;
};
type MessageRow = { id: number; from_user_id: string; body: string; created_at: unknown };
type PairRow = { id: number; from_user_id: string; to_user_id: string; status: string };

export type PublicPlayer = {
  userId: string;
  username: string;
  birthDate: string;
  relation: "none" | "friends" | "outgoing" | "incoming";
};

export type FriendCard = { userId: string; username: string; birthDate: string; avatarUrl: string | null };

export type RequestCard = { id: number; userId: string; username: string; createdAt: string };

export type ExperienceCard = { id: number; title: string; blockCount: number; updatedAt: string };

export type ChatLine = { id: number; fromMe: boolean; body: string; createdAt: string };

export type HomePayload = {
  username: string;
  birthDate: string;
  avatarUrl: string | null;
  experiences: ExperienceCard[];
  friends: FriendCard[];
  incoming: RequestCard[];
  outgoing: RequestCard[];
};

const SCRIPT_SPEC = `Eres el constructor de Synapse. Traduce el pedido a un script y responde SOLO con el script, sin markdown ni explicación.
Comandos, un por línea:
color hielo|glaciar|escarcha|profundo|marino|tinta
block x y z
floor x z ancho fondo
box x y z ancho alto fondo
tower x z alto
room x z ancho fondo alto
line x y z dx dy dz cantidad
clear
Coordenadas enteras. x y z entre -12 y 12. y entre 0 y 16. Empieza con clear. Máximo 80 líneas.
Ejemplo de cabaña:
clear
color hielo
floor -4 -4 9 9
color escarcha
room -2 -2 5 5 3
color glaciar
tower -4 -4 5
tower 4 -4 5`;

async function db() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return "";
}

function duplicate(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate|unique/i.test(message);
}

function asBlocks(value: unknown): Block[] {
  const raw = typeof value === "string" ? safeParse(value) : value;
  return sanitizeBlocks(raw);
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<ProfileRow>`
      select username, birth_date, avatar_url, look from profiles where user_id = ${context.userId}
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      username: row.username,
      birthDate: String(row.birth_date).slice(0, 10),
      avatarUrl: row.avatar_url ?? null,
    };
  });

export const saveAvatar = createServerFn({ method: "POST" })
  .validator((input: { avatarUrl: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const avatarUrl = (data.avatarUrl ?? "").slice(0, 180000);
    if (!avatarUrl.startsWith("data:image/")) {
      return { ok: false as const, error: "Choose an image." };
    }
    const sql = await db();
    await sql`update profiles set avatar_url = ${avatarUrl} where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const completeProfile = createServerFn({ method: "POST" })
  .validator((input: { username: string; birthDate: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const username = cleanUsername(data.username ?? "");
    const birthDate = typeof data.birthDate === "string" ? data.birthDate : "";
    const birthParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
    const parsed = birthParts
      ? parseBirthDate(Number(birthParts[1]), Number(birthParts[2]), Number(birthParts[3]))
      : null;
    if (!username) {
      return { ok: false as const, error: "Usernames are 3 to 20 letters, numbers, or _." };
    }
    if (!parsed) {
      return { ok: false as const, error: "That birth date is not valid." };
    }
    const sql = await db();
    const mine = await sql<ProfileRow>`
      select username, birth_date from profiles where user_id = ${context.userId}
    `;
    if (mine[0]) return { ok: true as const, username: mine[0].username };
    try {
      await sql`
        insert into profiles (user_id, username, username_lower, birth_date)
        values (${context.userId}, ${username}, ${username.toLowerCase()}, ${parsed})
      `;
    } catch (error) {
      if (!duplicate(error)) throw error;
      const again = await sql<ProfileRow>`
        select username, birth_date from profiles where user_id = ${context.userId}
      `;
      if (again[0]) return { ok: true as const, username: again[0].username };
      return { ok: false as const, error: "That username is taken." };
    }
    return { ok: true as const, username };
  });

export const getHome = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<HomePayload | null> => {
    const sql = await db();
    const me = context.userId;
    const profiles = await sql<ProfileRow>`
      select username, birth_date, avatar_url, look from profiles where user_id = ${me}
    `;
    if (!profiles[0]) return null;
    const [experiences, friends, incoming, outgoing] = await Promise.all([
      sql<ExperienceRow>`
        select id, title, updated_at, jsonb_array_length(blocks) as block_count
        from experiences
        where owner_id = ${me}
        order by updated_at desc
        limit 24
      `,
      sql<{ user_id: string; username: string; birth_date: string; avatar_url: string | null }>`
        select p.user_id, p.username, p.birth_date::text, p.avatar_url
        from friend_requests f
        join profiles p
          on p.user_id = case when f.from_user_id = ${me} then f.to_user_id else f.from_user_id end
        where f.status = 'accepted' and (f.from_user_id = ${me} or f.to_user_id = ${me})
        order by p.username_lower
      `,
      sql<RequestRow>`
        select f.id, p.user_id, p.username, f.created_at
        from friend_requests f
        join profiles p on p.user_id = f.from_user_id
        where f.to_user_id = ${me} and f.status = 'pending'
        order by f.created_at desc
      `,
      sql<RequestRow>`
        select f.id, p.user_id, p.username, f.created_at
        from friend_requests f
        join profiles p on p.user_id = f.to_user_id
        where f.from_user_id = ${me} and f.status = 'pending'
        order by f.created_at desc
      `,
    ]);
    const card = (row: RequestRow): RequestCard => ({
      id: Number(row.id),
      userId: row.user_id,
      username: row.username,
      createdAt: asIso(row.created_at),
    });
    return {
      username: profiles[0].username,
      birthDate: String(profiles[0].birth_date).slice(0, 10),
      avatarUrl: profiles[0].avatar_url ?? null,
      experiences: experiences.map((row) => ({
        id: Number(row.id),
        title: row.title,
        blockCount: Number(row.block_count),
        updatedAt: asIso(row.updated_at),
      })),
      friends: friends.map((row) => ({
        userId: row.user_id,
        username: row.username,
        birthDate: String(row.birth_date).slice(0, 10),
        avatarUrl: row.avatar_url,
      })),
      incoming: incoming.map(card),
      outgoing: outgoing.map(card),
    };
  });

export const searchPlayers = createServerFn({ method: "POST" })
  .validator((input: { query: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<PublicPlayer[]> => {
    const query = (data.query ?? "").trim().toLowerCase().replace(/[%_]/g, "").slice(0, 20);
    if (query.length < 2) return [];
    const sql = await db();
    const me = context.userId;
    const rows = await sql<{ user_id: string; username: string; birth_date: string; relation: string | null }>`
      select p.user_id, p.username, p.birth_date::text,
        case
          when f.status = 'accepted' then 'friends'
          when f.from_user_id = ${me} and f.status = 'pending' then 'outgoing'
          when f.to_user_id = ${me} and f.status = 'pending' then 'incoming'
          else 'none'
        end as relation
      from profiles p
      left join friend_requests f
        on (f.from_user_id = ${me} and f.to_user_id = p.user_id)
        or (f.to_user_id = ${me} and f.from_user_id = p.user_id)
      where p.username_lower like ${`${query}%`} and p.user_id <> ${me}
      order by p.username_lower
      limit 8
    `;
    return rows.map((row) => ({
      userId: row.user_id,
      username: row.username,
      birthDate: String(row.birth_date).slice(0, 10),
      relation:
        row.relation === "friends" || row.relation === "outgoing" || row.relation === "incoming"
          ? row.relation
          : "none",
    }));
  });

export const sendFriendRequest = createServerFn({ method: "POST" })
  .validator((input: { userId: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const target = (data.userId ?? "").trim();
    if (!target || target === context.userId) {
      return { ok: false as const, error: "No puedes agregarte a ti." };
    }
    const sql = await db();
    const me = context.userId;
    const found = await sql<{ user_id: string }>`
      select user_id from profiles where user_id = ${target}
    `;
    if (!found[0]) return { ok: false as const, error: "Ese jugador no existe." };
    const existing = await sql<PairRow>`
      select id, from_user_id, to_user_id, status
      from friend_requests
      where (from_user_id = ${me} and to_user_id = ${target})
         or (from_user_id = ${target} and to_user_id = ${me})
    `;
    const row = existing[0];
    if (row?.status === "accepted") return { ok: true as const, state: "friends" as const };
    if (row && row.from_user_id === target && row.status === "pending") {
      await sql`
        update friend_requests set status = 'accepted'
        where id = ${row.id} and to_user_id = ${me}
      `;
      return { ok: true as const, state: "friends" as const };
    }
    if (row && row.from_user_id === me) return { ok: true as const, state: "outgoing" as const };
    try {
      await sql`
        insert into friend_requests (from_user_id, to_user_id, status)
        values (${me}, ${target}, 'pending')
      `;
    } catch (error) {
      if (!duplicate(error)) throw error;
    }
    return { ok: true as const, state: "outgoing" as const };
  });

export const respondRequest = createServerFn({ method: "POST" })
  .validator((input: { id: number; accept: boolean }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const id = Number(data.id);
    if (!Number.isInteger(id)) return { ok: false as const, error: "Solicitud no válida." };
    const sql = await db();
    if (data.accept) {
      const updated = await sql<{ id: number }>`
        update friend_requests set status = 'accepted'
        where id = ${id} and to_user_id = ${context.userId} and status = 'pending'
        returning id
      `;
      if (!updated[0]) return { ok: false as const, error: "Esa solicitud ya no está." };
    } else {
      const removed = await sql<{ id: number }>`
        delete from friend_requests
        where id = ${id} and to_user_id = ${context.userId} and status = 'pending'
        returning id
      `;
      if (!removed[0]) return { ok: false as const, error: "Esa solicitud ya no está." };
    }
    return { ok: true as const };
  });

async function areFriends(me: string, friendId: string): Promise<boolean> {
  const sql = await db();
  const rows = await sql<{ id: number }>`
    select id from friend_requests
    where status = 'accepted'
      and ((from_user_id = ${me} and to_user_id = ${friendId})
        or (from_user_id = ${friendId} and to_user_id = ${me}))
    limit 1
  `;
  return Boolean(rows[0]);
}

export const loadMessages = createServerFn({ method: "POST" })
  .validator((input: { userId: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const friendId = (data.userId ?? "").trim();
    if (!friendId) return { ok: false as const, error: "Elige un amigo.", lines: [] as ChatLine[] };
    if (!(await areFriends(context.userId, friendId))) {
      return { ok: false as const, error: "Solo puedes chatear con amigos.", lines: [] as ChatLine[] };
    }
    const sql = await db();
    const me = context.userId;
    const rows = await sql<MessageRow>`
      select id, from_user_id, body, created_at
      from messages
      where (from_user_id = ${me} and to_user_id = ${friendId})
         or (from_user_id = ${friendId} and to_user_id = ${me})
      order by id asc
      limit 200
    `;
    return {
      ok: true as const,
      lines: rows.map((row) => ({
        id: Number(row.id),
        fromMe: row.from_user_id === me,
        body: row.body,
        createdAt: asIso(row.created_at),
      })),
    };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .validator((input: { userId: string; body: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const friendId = (data.userId ?? "").trim();
    const body = (data.body ?? "").trim().slice(0, 500);
    if (!body) return { ok: false as const, error: "Escribe un mensaje." };
    if (!(await areFriends(context.userId, friendId))) {
      return { ok: false as const, error: "Solo puedes chatear con amigos." };
    }
    const sql = await db();
    await sql`
      insert into messages (from_user_id, to_user_id, body)
      values (${context.userId}, ${friendId}, ${body})
    `;
    return { ok: true as const };
  });

export const saveExperience = createServerFn({ method: "POST" })
  .validator((input: { id: number | null; title: string; blocks: Block[]; script: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const title = (data.title ?? "").trim().slice(0, 40);
    if (title.length < 2) return { ok: false as const, error: "Ponle un nombre de al menos 2 letras." };
    const blocks = sanitizeBlocks(data.blocks);
    const script = (data.script ?? "").slice(0, 8000);
    const sql = await db();
    const payload = JSON.stringify(blocks);
    const id = data.id == null ? null : Number(data.id);
    if (id != null && Number.isInteger(id)) {
      const updated = await sql<{ id: number }>`
        update experiences
        set title = ${title}, blocks = ${payload}::jsonb, script = ${script}, updated_at = now()
        where id = ${id} and owner_id = ${context.userId}
        returning id
      `;
      if (updated[0]) return { ok: true as const, id: Number(updated[0].id) };
    }
    const inserted = await sql<{ id: number }>`
      insert into experiences (owner_id, title, blocks, script)
      values (${context.userId}, ${title}, ${payload}::jsonb, ${script})
      returning id
    `;
    return { ok: true as const, id: Number(inserted[0].id) };
  });

export const deleteExperience = createServerFn({ method: "POST" })
  .validator((input: { id: number }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const id = Number(data.id);
    if (!Number.isInteger(id)) return { ok: false as const, error: "No encontré ese juego." };
    const sql = await db();
    await sql`
      delete from experiences where id = ${id} and owner_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const loadExperience = createServerFn({ method: "POST" })
  .validator((input: { id: number }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const id = Number(data.id);
    if (!Number.isInteger(id)) return { ok: false as const, error: "No encontré ese juego." };
    const sql = await db();
    const rows = await sql<ExperienceFullRow>`
      select id, title, blocks, script, updated_at
      from experiences
      where id = ${id} and owner_id = ${context.userId}
    `;
    const row = rows[0];
    if (!row) return { ok: false as const, error: "Ese juego no es tuyo." };
    return {
      ok: true as const,
      experience: {
        id: Number(row.id),
        title: row.title,
        blocks: asBlocks(row.blocks),
        script: row.script,
        updatedAt: asIso(row.updated_at),
      },
    };
  });

export const draftWithAi = createServerFn({ method: "POST" })
  .validator((input: { prompt: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ data }) => {
    const prompt = (data.prompt ?? "").trim().slice(0, 500);
    if (prompt.length < 3) return { ok: false as const, error: "Describe qué quieres construir." };
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return {
        ok: false as const,
        error: "La IA no está disponible en este momento. Puedes construir con bloques o con código.",
      };
    }
    let response: Response;
    try {
      response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.3,
          max_tokens: 700,
          messages: [
            { role: "system", content: SCRIPT_SPEC },
            { role: "user", content: prompt },
          ],
        }),
      });
    } catch {
      return { ok: false as const, error: "La IA no respondió. Inténtalo otra vez." };
    }
    if (!response.ok) {
      return { ok: false as const, error: "La IA no pudo construir eso ahora." };
    }
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    const script = text
      .replace(/```[a-z]*\n?/gi, "")
      .replace(/```/g, "")
      .trim()
      .slice(0, 8000);
    if (!script) return { ok: false as const, error: "La IA no devolvió un script." };
    return { ok: true as const, script };
  });
