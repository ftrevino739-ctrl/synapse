import { useMemo, useState } from "react";
import { Eraser, Play, Redo2, Sparkles, Undo2 } from "lucide-react";
import { draftWithAi, saveExperience } from "@/lib/synapse/api";
import { useStudio } from "@/lib/synapse/draft";
import { SCRIPT_HELP, compileScript } from "@/lib/synapse/model";
import { MATERIALS } from "@/lib/synapse/materials";
import { TEMPLATES, buildTemplate } from "@/lib/synapse/templates";
import { readLook } from "@/lib/synapse/look";
import { Viewport } from "@/components/synapse/viewport";
import { PlayWorld } from "@/components/synapse/play-world";

const fieldClass =
  "h-11 w-full rounded-xl border border-line bg-ink px-3 text-base text-frost outline-none placeholder:text-mist focus-visible:border-ice";

export function Studio() {
  const studio = useStudio();
  const [prompt, setPrompt] = useState("A turf pitch with white lines");
  const [busy, setBusy] = useState<"save" | "ai" | null>(null);
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState("All");
  const [materialId, setMaterialId] = useState(MATERIALS[0].id);
  const [playing, setPlaying] = useState(false);
  const categories = useMemo(() => ["All", ...new Set(MATERIALS.map((item) => item.category))], []);
  const shown = MATERIALS.filter((item) => {
    if (category !== "All" && item.category !== category) return false;
    if (!filter.trim()) return true;
    return item.name.toLowerCase().includes(filter.trim().toLowerCase());
  }).slice(0, 80);
  const selected = MATERIALS.find((item) => item.id === materialId) ?? MATERIALS[0];

  function runScript() {
    const compiled = compileScript(studio.script);
    if (compiled.error) {
      studio.setNotice(compiled.error);
      return;
    }
    studio.applyBlocks(compiled.blocks);
    studio.setNotice(`${compiled.blocks.length} blocks.`);
  }

  async function askAi() {
    setBusy("ai");
    studio.setNotice(null);
    const result = await draftWithAi({ data: { prompt } });
    setBusy(null);
    if (!result.ok) {
      studio.setNotice(result.error);
      return;
    }
    const compiled = compileScript(result.script);
    studio.setScript(result.script);
    if (compiled.error) {
      studio.setNotice(compiled.error);
      studio.setMode("code");
      return;
    }
    studio.applyBlocks(compiled.blocks, result.script);
    studio.setNotice("Ready. Keep editing if you want.");
  }

  async function save() {
    setBusy("save");
    const result = await saveExperience({
      data: {
        id: studio.experienceId,
        title: studio.title,
        blocks: studio.blocks,
        script: studio.script,
      },
    });
    setBusy(null);
    if (!result.ok) {
      studio.setNotice(result.error);
      return;
    }
    studio.setExperienceId(result.id);
    studio.setNotice("Saved.");
  }

  if (playing) {
    return (
      <PlayWorld
        blocks={studio.blocks}
        look={readLook()}
        mode="walk"
        onExit={() => setPlaying(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:flex-row lg:gap-0">
      <div className="h-80 overflow-hidden rounded-2xl border border-line lg:h-auto lg:min-h-0 lg:flex-1 lg:rounded-none lg:border-0 lg:border-r">
        <Viewport
          blocks={studio.blocks}
          interactive
          tool={studio.tool}
          color={selected.hex}
          materialId={selected.id}
          onPlace={studio.place}
          onErase={studio.erase}
        />
      </div>
      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-96 lg:overflow-y-auto lg:p-4">
        <div className="flex gap-2">
          {(
            [
              ["blocks", "Blocks"],
              ["code", "Code"],
              ["ai", "Generate"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`h-11 flex-1 rounded-xl text-sm font-semibold ${
                studio.mode === id ? "bg-ice text-ink" : "bg-navy text-mist"
              }`}
              onClick={() => studio.setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-mist">Place name</span>
          <input
            className={fieldClass}
            value={studio.title}
            maxLength={40}
            onChange={(event) => studio.setTitle(event.target.value)}
          />
        </label>
        {studio.mode === "blocks" ? (
          <div className="space-y-3">
            <p className="text-sm text-mist">Click to place. Right-click or the eraser to remove. Drag to look around.</p>
            <div className="flex flex-wrap gap-1">
              {TEMPLATES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="h-9 rounded-lg border border-line px-2 text-xs text-frost"
                  onClick={() => studio.applyBlocks(buildTemplate(item.id))}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <input
              className={fieldClass}
              value={filter}
              placeholder={`Search ${MATERIALS.length} materials`}
              onChange={(event) => setFilter(event.target.value)}
            />
            <div className="flex gap-1 overflow-x-auto">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`h-8 shrink-0 rounded-lg px-2 text-xs ${category === item ? "bg-ice text-ink" : "bg-navy text-mist"}`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
              {shown.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  className={`flex h-11 items-center gap-2 rounded-xl border px-2 text-left text-xs ${
                    materialId === swatch.id ? "border-ice" : "border-line"
                  }`}
                  onClick={() => {
                    setMaterialId(swatch.id);
                    studio.setColor(swatch.hex);
                  }}
                >
                  <span className="size-4 shrink-0 rounded-sm border border-line" style={{ background: swatch.hex }} />
                  <span className="truncate">{swatch.name}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold ${
                  studio.tool === "erase" ? "border-ice text-frost" : "border-line text-mist"
                }`}
                onClick={() => studio.setTool(studio.tool === "erase" ? "place" : "erase")}
              >
                <Eraser className="size-4" />
                Erase
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-mist disabled:opacity-40"
                onClick={studio.undo}
                disabled={studio.past.length === 0}
              >
                <Undo2 className="size-4" />
                Undo
              </button>
            </div>
          </div>
        ) : null}
        {studio.mode === "code" ? (
          <div className="space-y-3">
            <textarea
              className="h-56 w-full resize-y rounded-xl border border-line bg-ink p-3 font-mono text-sm text-frost outline-none focus-visible:border-ice"
              value={studio.script}
              spellCheck={false}
              onChange={(event) => studio.setScript(event.target.value)}
            />
            <pre className="overflow-x-auto text-xs leading-5 text-mist">{SCRIPT_HELP}</pre>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ice px-4 text-sm font-semibold text-ink"
              onClick={runScript}
            >
              <Redo2 className="size-4" />
              Run script
            </button>
          </div>
        ) : null}
        {studio.mode === "ai" ? (
          <div className="space-y-3">
            <p className="text-pretty text-sm text-mist">Describe the place. You can keep editing the blocks after.</p>
            <textarea
              className="h-32 w-full resize-y rounded-xl border border-line bg-ink p-3 text-sm text-frost outline-none focus-visible:border-ice"
              value={prompt}
              maxLength={500}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <button
              type="button"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ice px-4 text-sm font-semibold text-ink disabled:opacity-60"
              onClick={() => void askAi()}
              disabled={busy === "ai"}
            >
              <Sparkles className="size-4" />
              {busy === "ai" ? "Building…" : "Build from description"}
            </button>
          </div>
        ) : null}
        {studio.notice ? <p className="text-sm text-frost">{studio.notice}</p> : null}
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-line text-sm font-semibold text-frost disabled:opacity-60"
          onClick={() => void save()}
          disabled={busy === "save"}
        >
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ice text-sm font-semibold text-ink"
          onClick={() => setPlaying(true)}
        >
          <Play className="size-4" />
          Playtest
        </button>
        <p className="text-xs text-mist">{studio.blocks.length} blocks in the scene.</p>
      </aside>
    </div>
  );
}
