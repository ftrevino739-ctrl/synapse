export const PALETTE = [
  { id: "ice", label: "Hielo", hex: "#7EC8FF" },
  { id: "glacier", label: "Glaciar", hex: "#64B4FF" },
  { id: "frost", label: "Escarcha", hex: "#E8F4FF" },
  { id: "sea", label: "Profundo", hex: "#14325F" },
  { id: "navy", label: "Marino", hex: "#0B1A36" },
  { id: "ink", label: "Tinta", hex: "#071226" },
] as const;

export type PaletteId = (typeof PALETTE)[number]["id"];

const HEX_BY_NAME: Record<string, string> = Object.fromEntries(
  PALETTE.map((swatch) => [swatch.id, swatch.hex]),
);

const HEX_OK = new Set(PALETTE.map((swatch) => swatch.hex.toLowerCase()));

export type Block = {
  x: number;
  y: number;
  z: number;
  color: string;
  material?: string;
};

export const GRID_MIN = -48;
export const GRID_MAX = 48;
export const GRID_MAX_Y = 32;
export const MAX_BLOCKS = 8000;

export const SCRIPT_HELP = [
  "color hielo|glaciar|escarcha|profundo|marino|tinta",
  "block x y z",
  "floor x z ancho fondo",
  "box x y z ancho alto fondo",
  "tower x z alto",
  "room x z ancho fondo alto",
  "line x y z dx dy dz cantidad",
  "clear",
].join("\n");

const COLOR_ALIAS: Record<string, PaletteId> = {
  ice: "ice",
  hielo: "ice",
  glacier: "glacier",
  glaciar: "glacier",
  frost: "frost",
  escarcha: "frost",
  sea: "sea",
  profundo: "sea",
  navy: "navy",
  marino: "navy",
  ink: "ink",
  tinta: "ink",
};

export const STARTER_SCRIPT = `color hielo
floor -5 -5 11 11
color escarcha
room -3 -3 7 7 3
color glaciar
tower -5 -5 6
tower 5 -5 6
tower -5 5 6
tower 5 5 6
color marino
block 0 0 4
`;

type Put = (x: number, y: number, z: number) => void;

function inSpan(n: number, min: number, max: number): boolean {
  return Number.isInteger(n) && n >= min && n <= max;
}

export function compileScript(source: string): { blocks: Block[]; error: string | null } {
  const map = new Map<string, Block>();
  let color = HEX_BY_NAME.ice;
  const lines = source.replace(/\t/g, " ").split(/\r?\n/);
  if (lines.length > 220) {
    return { blocks: [], error: "El script pasa de 220 líneas." };
  }

  const put: Put = (x, y, z) => {
    if (!inSpan(x, GRID_MIN, GRID_MAX) || !inSpan(z, GRID_MIN, GRID_MAX) || !inSpan(y, 0, GRID_MAX_Y)) {
      return;
    }
    const key = `${x},${y},${z}`;
    if (!map.has(key) && map.size >= MAX_BLOCKS) return;
    map.set(key, { x, y, z, color });
  };

  const fail = (line: number, message: string) => ({
    blocks: [...map.values()],
    error: `Línea ${line}: ${message}`,
  });

  const ints = (parts: string[], count: number): number[] | null => {
    if (parts.length !== count) return null;
    const nums = parts.map((part) => Number(part));
    if (nums.some((n) => !Number.isInteger(n))) return null;
    return nums;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i].replace(/#.*$/, "").trim();
    if (!raw) continue;
    const [cmdRaw, ...rest] = raw.split(/\s+/);
    const cmd = cmdRaw.toLowerCase();
    const lineNo = i + 1;

    if (cmd === "clear") {
      map.clear();
      continue;
    }

    if (cmd === "color") {
      const name = (rest[0] ?? "").toLowerCase();
      const id = COLOR_ALIAS[name];
      if (!id || rest.length !== 1) return fail(lineNo, "usa color hielo, glaciar, escarcha, profundo, marino o tinta.");
      color = HEX_BY_NAME[id];
      continue;
    }

    if (cmd === "block") {
      const n = ints(rest, 3);
      if (!n) return fail(lineNo, "block necesita x y z.");
      put(n[0], n[1], n[2]);
      continue;
    }

    if (cmd === "floor") {
      const n = ints(rest, 4);
      if (!n) return fail(lineNo, "floor necesita x z ancho fondo.");
      const [x, z, w, d] = n;
      if (!inSpan(w, 1, 80) || !inSpan(d, 1, 80)) return fail(lineNo, "That floor is too large.");
      for (let ix = 0; ix < w; ix += 1) {
        for (let iz = 0; iz < d; iz += 1) put(x + ix, 0, z + iz);
      }
      continue;
    }

    if (cmd === "box") {
      const n = ints(rest, 6);
      if (!n) return fail(lineNo, "box necesita x y z ancho alto fondo.");
      const [x, y, z, w, h, d] = n;
      if (!inSpan(w, 1, 20) || !inSpan(h, 1, 16) || !inSpan(d, 1, 20)) {
        return fail(lineNo, "esa caja no cabe.");
      }
      for (let ix = 0; ix < w; ix += 1) {
        for (let iy = 0; iy < h; iy += 1) {
          for (let iz = 0; iz < d; iz += 1) put(x + ix, y + iy, z + iz);
        }
      }
      continue;
    }

    if (cmd === "tower") {
      const n = ints(rest, 3);
      if (!n) return fail(lineNo, "tower necesita x z alto.");
      const [x, z, h] = n;
      if (!inSpan(h, 1, 16)) return fail(lineNo, "la torre es demasiado alta.");
      for (let y = 0; y < h; y += 1) put(x, y, z);
      continue;
    }

    if (cmd === "room") {
      const n = ints(rest, 5);
      if (!n) return fail(lineNo, "room necesita x z ancho fondo alto.");
      const [x, z, w, d, h] = n;
      if (w < 3 || d < 3 || h < 2 || w > 18 || d > 18 || h > 10) {
        return fail(lineNo, "la sala tiene que medir al menos 3×3 y 2 de alto.");
      }
      const doorX = Math.floor(w / 2);
      for (let ix = 0; ix < w; ix += 1) {
        for (let iz = 0; iz < d; iz += 1) {
          put(x + ix, 0, z + iz);
          const edge = ix === 0 || iz === 0 || ix === w - 1 || iz === d - 1;
          if (!edge) continue;
          const door = iz === d - 1 && ix === doorX;
          for (let y = 1; y <= h; y += 1) {
            if (door && y <= 2) continue;
            put(x + ix, y, z + iz);
          }
        }
      }
      for (let ix = 0; ix < w; ix += 1) {
        for (let iz = 0; iz < d; iz += 1) put(x + ix, h + 1, z + iz);
      }
      continue;
    }

    if (cmd === "line") {
      const n = ints(rest, 7);
      if (!n) return fail(lineNo, "line necesita x y z dx dy dz cantidad.");
      const [x, y, z, dx, dy, dz, count] = n;
      if (!inSpan(count, 1, 32)) return fail(lineNo, "la línea es demasiado larga.");
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4 || Math.abs(dz) > 4) {
        return fail(lineNo, "el paso de la línea es demasiado grande.");
      }
      for (let step = 0; step < count; step += 1) {
        put(x + dx * step, y + dy * step, z + dz * step);
      }
      continue;
    }

    return fail(lineNo, `no conozco «${cmd}».`);
  }

  return { blocks: [...map.values()], error: null };
}

export const STARTER_BLOCKS = compileScript(STARTER_SCRIPT).blocks;

export function sanitizeBlocks(input: unknown): Block[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: Block[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<Block>;
    const { x, y, z } = candidate;
    if (!inSpan(x ?? NaN, GRID_MIN, GRID_MAX) || !inSpan(z ?? NaN, GRID_MIN, GRID_MAX)) continue;
    if (!inSpan(y ?? NaN, 0, GRID_MAX_Y)) continue;
    const rawColor = candidate.color;
    if (typeof rawColor !== "string" || !/^#[0-9a-f]{6}$/i.test(rawColor)) continue;
    const material =
      typeof candidate.material === "string" && candidate.material.length <= 40
        ? candidate.material
        : undefined;
    const key = `${x},${y},${z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      x: x as number,
      y: y as number,
      z: z as number,
      color: rawColor,
      ...(material ? { material } : {}),
    });
    if (out.length >= MAX_BLOCKS) break;
  }
  return out;
}

const USERNAME = /^[a-zA-Z0-9_]{3,20}$/;

export function cleanUsername(value: string): string | null {
  const trimmed = value.trim();
  if (!USERNAME.test(trimmed)) return null;
  return trimmed;
}

export function usernameToEmail(username: string): string {
  return `${username.toLowerCase()}@players.synapse`;
}

export function parseBirthDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const now = new Date();
  if (year < 1920 || year > now.getFullYear()) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  if (date.getTime() > Date.now()) return null;
  const monthText = String(month).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");
  return `${year}-${monthText}-${dayText}`;
}

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function sameCell(a: Block, x: number, y: number, z: number): boolean {
  return a.x === x && a.y === y && a.z === z;
}
