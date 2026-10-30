export type Look = {
  skin: string;
  hair: string;
  hairStyle: "short" | "spiky" | "long";
  shirt: string;
  pants: string;
  shoes: string;
};

export const DEFAULT_LOOK: Look = {
  skin: "#f1c7a4",
  hair: "#3a2a1a",
  hairStyle: "short",
  shirt: "#2f6fed",
  pants: "#243044",
  shoes: "#1c1c1c",
};

const KEY = "synapse-look";

export function readLook(): Look {
  if (typeof window === "undefined") return DEFAULT_LOOK;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LOOK;
    const parsed = JSON.parse(raw) as Partial<Look>;
    return { ...DEFAULT_LOOK, ...parsed };
  } catch {
    return DEFAULT_LOOK;
  }
}

export function writeLook(look: Look) {
  window.localStorage.setItem(KEY, JSON.stringify(look));
}
