import { create } from "zustand";
import {
  GRID_MAX,
  GRID_MAX_Y,
  GRID_MIN,
  MAX_BLOCKS,
  PALETTE,
  STARTER_BLOCKS,
  STARTER_SCRIPT,
  sameCell,
  type Block,
} from "@/lib/synapse/model";

export type StudioMode = "blocks" | "code" | "ai";

type StudioState = {
  experienceId: number | null;
  title: string;
  blocks: Block[];
  script: string;
  past: Block[][];
  color: string;
  tool: "place" | "erase";
  mode: StudioMode;
  notice: string | null;
  setMode: (mode: StudioMode) => void;
  setColor: (color: string) => void;
  setTool: (tool: "place" | "erase") => void;
  setTitle: (title: string) => void;
  setScript: (script: string) => void;
  setNotice: (notice: string | null) => void;
  setExperienceId: (id: number | null) => void;
  place: (block: Block) => void;
  erase: (x: number, y: number, z: number) => void;
  applyBlocks: (blocks: Block[], script?: string) => void;
  undo: () => void;
  load: (experience: { id: number; title: string; blocks: Block[]; script: string }) => void;
  blank: () => void;
};

function clone(blocks: Block[]): Block[] {
  return blocks.map((block) => ({ ...block }));
}

function allowed(block: Block): boolean {
  return (
    Number.isInteger(block.x) &&
    Number.isInteger(block.y) &&
    Number.isInteger(block.z) &&
    block.x >= GRID_MIN &&
    block.x <= GRID_MAX &&
    block.z >= GRID_MIN &&
    block.z <= GRID_MAX &&
    block.y >= 0 &&
    block.y <= GRID_MAX_Y
  );
}

export const useStudio = create<StudioState>((set, get) => ({
  experienceId: null,
  title: "Cabaña de hielo",
  blocks: clone(STARTER_BLOCKS),
  script: STARTER_SCRIPT,
  past: [],
  color: PALETTE[0].hex,
  tool: "place",
  mode: "blocks",
  notice: null,
  setMode: (mode) => set({ mode }),
  setColor: (color) => set({ color, tool: "place" }),
  setTool: (tool) => set({ tool }),
  setTitle: (title) => set({ title }),
  setScript: (script) => set({ script }),
  setNotice: (notice) => set({ notice }),
  setExperienceId: (experienceId) => set({ experienceId }),
  place: (block) => {
    if (!allowed(block)) return;
    const current = get().blocks;
    if (current.some((item) => sameCell(item, block.x, block.y, block.z))) return;
    if (current.length >= MAX_BLOCKS) {
      set({ notice: "Llegaste al límite de bloques." });
      return;
    }
    set({
      past: [...get().past, clone(current)].slice(-30),
      blocks: [...current, { ...block }],
      notice: null,
    });
  },
  erase: (x, y, z) => {
    const current = get().blocks;
    const next = current.filter((item) => !sameCell(item, x, y, z));
    if (next.length === current.length) return;
    set({
      past: [...get().past, clone(current)].slice(-30),
      blocks: next,
      notice: null,
    });
  },
  applyBlocks: (blocks, script) => {
    set({
      past: [...get().past, clone(get().blocks)].slice(-30),
      blocks: clone(blocks),
      script: script ?? get().script,
      notice: null,
    });
  },
  undo: () => {
    const past = get().past;
    const previous = past[past.length - 1];
    if (!previous) return;
    set({ blocks: previous, past: past.slice(0, -1), notice: null });
  },
  load: (experience) =>
    set({
      experienceId: experience.id,
      title: experience.title,
      blocks: clone(experience.blocks),
      script: experience.script,
      past: [],
      notice: "Juego cargado.",
      mode: "blocks",
    }),
  blank: () =>
    set({
      experienceId: null,
      title: "Nuevo juego",
      blocks: [],
      script: "clear\ncolor hielo\n",
      past: [],
      notice: null,
      mode: "blocks",
      tool: "place",
    }),
}));
