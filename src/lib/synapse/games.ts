import { buildTemplate, type TemplateId } from "@/lib/synapse/templates";
import type { Block } from "@/lib/synapse/model";

export type OfficialGame = {
  id: string;
  title: string;
  creators: string;
  published: string;
  players: string;
  summary: string;
  mode: "soccer" | "disaster" | "walk";
  template: TemplateId;
  hue: string;
};

export const OFFICIAL_GAMES: OfficialGame[] = [
  {
    id: "touch-soccer",
    title: "Touch Soccer",
    creators: "Synapse Sports",
    published: "Oct 12, 2026",
    players: "1",
    summary: "A small pitch. Move with WASD and click to kick.",
    mode: "soccer",
    template: "soccer",
    hue: "#1f7a3a",
  },
  {
    id: "storm-run",
    title: "Storm Run",
    creators: "Synapse Arcade",
    published: "Oct 18, 2026",
    players: "1",
    summary: "Stay on the pad and step out of the falling debris.",
    mode: "disaster",
    template: "shelter",
    hue: "#8d4b2a",
  },
  {
    id: "night-court",
    title: "Night Court",
    creators: "Synapse Sports",
    published: "Oct 4, 2026",
    players: "1",
    summary: "A hardwood court you can walk.",
    mode: "walk",
    template: "basketball",
    hue: "#c47a3a",
  },
  {
    id: "lane-tennis",
    title: "Lane Tennis",
    creators: "Synapse Sports",
    published: "Sep 28, 2026",
    players: "1",
    summary: "A lined court with room to move.",
    mode: "walk",
    template: "tennis",
    hue: "#3d8f6e",
  },
  {
    id: "open-plaza",
    title: "Open Plaza",
    creators: "Synapse",
    published: "Oct 1, 2026",
    players: "1",
    summary: "An empty lot. Walk it, then build your own.",
    mode: "walk",
    template: "blank",
    hue: "#2458c7",
  },
];

export function blocksFor(game: OfficialGame): Block[] {
  return buildTemplate(game.template);
}
