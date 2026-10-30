export type Pattern =
  | "grain"
  | "brick"
  | "stone"
  | "grass"
  | "metal"
  | "water"
  | "tile"
  | "stripe"
  | "fabric"
  | "ice";

export type Material = {
  id: string;
  name: string;
  category: string;
  hex: string;
  pattern: Pattern;
  seed: number;
};

const FAMILIES: Array<{
  category: string;
  pattern: Pattern;
  count: number;
  names: string[];
  hues: number[];
  sat: number;
  light: number;
}> = [
  { category: "Wood", pattern: "grain", count: 28, names: ["Oak", "Pine", "Walnut", "Cedar", "Maple", "Birch", "Mahogany", "Ash"], hues: [28, 32, 22, 18, 36, 40, 14, 26], sat: 42, light: 38 },
  { category: "Brick", pattern: "brick", count: 28, names: ["Clay", "Terracotta", "Sandstone brick", "Slate brick", "Adobe", "Fire brick", "Limestone brick", "Basalt brick"], hues: [8, 14, 32, 220, 24, 4, 42, 230], sat: 38, light: 42 },
  { category: "Stone", pattern: "stone", count: 28, names: ["Granite", "Marble", "Basalt", "Limestone", "Slate", "Sandstone", "Cobble", "Pumice"], hues: [220, 210, 230, 40, 215, 34, 20, 200], sat: 12, light: 48 },
  { category: "Ground", pattern: "grass", count: 24, names: ["Turf", "Fairway", "Rough", "Dirt", "Mud", "Moss", "Dry grass", "Pitch"], hues: [110, 128, 96, 28, 24, 100, 48, 140], sat: 40, light: 36 },
  { category: "Metal", pattern: "metal", count: 24, names: ["Steel", "Iron", "Copper", "Brass", "Aluminum", "Chrome", "Rust", "Gold"], hues: [210, 220, 18, 42, 200, 200, 16, 46], sat: 18, light: 52 },
  { category: "Glass", pattern: "ice", count: 16, names: ["Clear", "Frosted", "Blue glass", "Green glass", "Amber", "Smoke", "Ice", "Crystal"], hues: [200, 190, 205, 150, 38, 220, 195, 210], sat: 30, light: 70 },
  { category: "Water", pattern: "water", count: 16, names: ["Pool", "Ocean", "River", "Shallow", "Foam", "Deep", "Lagoon", "Ice water"], hues: [198, 210, 190, 186, 190, 220, 175, 195], sat: 55, light: 46 },
  { category: "Tile", pattern: "tile", count: 28, names: ["Court", "Subway", "Mosaic", "Porcelain", "Checker", "Arena", "Kitchen", "Roof"], hues: [210, 200, 12, 0, 220, 150, 30, 8], sat: 22, light: 58 },
  { category: "Sport", pattern: "stripe", count: 28, names: ["Pitch line", "Track", "Hardwood", "Ice rink", "Clay court", "Astroturf", "Lane", "Boundary"], hues: [120, 18, 28, 195, 16, 130, 210, 0], sat: 48, light: 44 },
  { category: "Fabric", pattern: "fabric", count: 24, names: ["Cotton", "Denim", "Jersey", "Canvas", "Wool", "Nylon", "Felt", "Mesh"], hues: [210, 220, 0, 40, 20, 200, 350, 190], sat: 28, light: 46 },
  { category: "Neon", pattern: "stripe", count: 20, names: ["Signal", "Arcade", "Hazard", "Glow", "Laser"], hues: [190, 300, 48, 150, 265], sat: 80, light: 55 },
  { category: "Concrete", pattern: "stone", count: 20, names: ["Slab", "Poured", "Exposed", "Sidewalk", "Bunker"], hues: [30, 220, 20, 200, 0], sat: 8, light: 55 },
  { category: "Sand", pattern: "grain", count: 16, names: ["Beach", "Dune", "Wet sand", "Gravel"], hues: [40, 36, 32, 30], sat: 28, light: 62 },
];

function hsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs((2 * l) / 100 - 1)) * (s / 100);
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l / 100 - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const hex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function build(): Material[] {
  const out: Material[] = [];
  for (const family of FAMILIES) {
    for (let i = 0; i < family.count; i += 1) {
      const name = family.names[i % family.names.length];
      const hue = family.hues[i % family.hues.length] + (i % 5) * 3;
      const light = Math.max(18, Math.min(78, family.light + ((i % 7) - 3) * 4));
      out.push({
        id: `${family.category.slice(0, 3).toLowerCase()}-${i + 1}`,
        name: `${name} ${i + 1}`,
        category: family.category,
        hex: hsl(hue, family.sat, light),
        pattern: family.pattern,
        seed: i * 17 + family.count,
      });
    }
  }
  return out.slice(0, 300);
}

export const MATERIALS: Material[] = build();

const BY_ID = new Map(MATERIALS.map((item) => [item.id, item]));

export function materialById(id: string | undefined): Material | undefined {
  if (!id) return undefined;
  return BY_ID.get(id);
}

export function paintMaterial(material: Material, size = 64): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = material.hex;
  ctx.fillRect(0, 0, size, size);
  const tint = (alpha: number, shift = 0) => {
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    if (shift < 0) ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  };
  const n = material.seed;
  if (material.pattern === "brick") {
    const h = 10;
    const w = 20;
    for (let y = 0; y < size; y += h) {
      const offset = (y / h) % 2 === 0 ? 0 : w / 2;
      for (let x = -w; x < size; x += w) {
        ctx.strokeStyle = "rgba(0,0,0,.35)";
        ctx.strokeRect(x + offset, y, w, h);
        ctx.fillStyle = `rgba(255,255,255,${0.04 + ((x + n) % 5) * 0.02})`;
        ctx.fillRect(x + offset + 1, y + 1, w - 2, h - 2);
      }
    }
  } else if (material.pattern === "grain" || material.pattern === "fabric") {
    for (let y = 0; y < size; y += 2) {
      ctx.fillStyle = y % 4 === 0 ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.06)";
      ctx.fillRect(0, y, size, 1);
      ctx.fillStyle = "rgba(0,0,0,.15)";
      ctx.fillRect((n + y * 3) % size, y, 8, 1);
    }
  } else if (material.pattern === "stone" || material.pattern === "grass") {
    for (let i = 0; i < 40; i += 1) {
      const x = (n * 13 + i * 29) % size;
      const y = (n * 7 + i * 17) % size;
      ctx.fillStyle = i % 2 ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.14)";
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + (i % 4), 2 + (i % 3), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (material.pattern === "metal") {
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, "rgba(255,255,255,.45)");
    grad.addColorStop(0.5, "rgba(0,0,0,.15)");
    grad.addColorStop(1, "rgba(255,255,255,.25)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  } else if (material.pattern === "water" || material.pattern === "ice") {
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 2;
    for (let y = 6; y < size; y += 10) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(size / 2, y + ((n + y) % 5) - 2, size, y);
      ctx.stroke();
    }
  } else if (material.pattern === "tile") {
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    for (let i = 0; i <= size; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.fillRect(0, size / 2 - 2, size, 4);
    ctx.fillRect(size / 2 - 2, 0, 4, size);
  }
  tint(0);
  return canvas;
}
