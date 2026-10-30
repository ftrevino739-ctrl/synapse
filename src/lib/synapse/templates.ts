import { materialById, type Material } from "@/lib/synapse/materials";
import type { Block } from "@/lib/synapse/model";

function mat(id: string): Material {
  const found = materialById(id);
  if (!found) throw new Error(id);
  return found;
}

function put(blocks: Block[], x: number, y: number, z: number, item: Material) {
  blocks.push({ x, y, z, color: item.hex, material: item.id });
}

export type TemplateId = "blank" | "soccer" | "basketball" | "tennis" | "pool" | "shelter";

export const TEMPLATES: Array<{ id: TemplateId; name: string }> = [
  { id: "blank", name: "Empty lot" },
  { id: "soccer", name: "Soccer pitch" },
  { id: "basketball", name: "Basketball court" },
  { id: "tennis", name: "Tennis court" },
  { id: "pool", name: "Pool" },
  { id: "shelter", name: "Storm shelter" },
];

export function buildTemplate(id: TemplateId): Block[] {
  if (id === "blank") return [];
  const blocks: Block[] = [];
  if (id === "soccer") {
    const turf = mat("gro-1");
    const line = mat("spo-1");
    for (let x = -18; x <= 18; x += 1) {
      for (let z = -11; z <= 11; z += 1) put(blocks, x, 0, z, turf);
    }
    for (let x = -18; x <= 18; x += 1) {
      put(blocks, x, 0, -11, line);
      put(blocks, x, 0, 11, line);
    }
    for (let z = -11; z <= 11; z += 1) {
      put(blocks, -18, 0, z, line);
      put(blocks, 18, 0, z, line);
      put(blocks, 0, 0, z, line);
    }
    return blocks;
  }
  if (id === "basketball") {
    const wood = mat("spo-3");
    const line = mat("spo-8");
    for (let x = -12; x <= 12; x += 1) {
      for (let z = -8; z <= 8; z += 1) put(blocks, x, 0, z, wood);
    }
    for (let x = -12; x <= 12; x += 1) {
      put(blocks, x, 0, -8, line);
      put(blocks, x, 0, 8, line);
    }
    for (let z = -8; z <= 8; z += 1) {
      put(blocks, -12, 0, z, line);
      put(blocks, 12, 0, z, line);
    }
    const steel = mat("met-1");
    for (let y = 1; y <= 4; y += 1) {
      put(blocks, -12, y, 0, steel);
      put(blocks, 12, y, 0, steel);
    }
    return blocks;
  }
  if (id === "tennis") {
    const court = mat("til-1");
    const line = mat("spo-8");
    for (let x = -10; x <= 10; x += 1) {
      for (let z = -6; z <= 6; z += 1) put(blocks, x, 0, z, court);
    }
    for (let x = -10; x <= 10; x += 1) put(blocks, x, 0, 0, line);
    return blocks;
  }
  if (id === "pool") {
    const deck = mat("til-4");
    const water = mat("wat-1");
    for (let x = -10; x <= 10; x += 1) {
      for (let z = -7; z <= 7; z += 1) {
        const edge = Math.abs(x) === 10 || Math.abs(z) === 7;
        put(blocks, x, 0, z, edge ? deck : water);
      }
    }
    return blocks;
  }
  const slab = mat("con-1");
  const wall = mat("con-5");
  for (let x = -8; x <= 8; x += 1) {
    for (let z = -8; z <= 8; z += 1) put(blocks, x, 0, z, slab);
  }
  for (let i = -8; i <= 8; i += 1) {
    for (let y = 1; y <= 3; y += 1) {
      put(blocks, i, y, -8, wall);
      put(blocks, i, y, 8, wall);
      put(blocks, -8, y, i, wall);
      put(blocks, 8, y, i, wall);
    }
  }
  return blocks;
}
