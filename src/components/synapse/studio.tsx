import { useState } from "react";
import { Eraser, Redo2, Sparkles, Undo2 } from "lucide-react";
import { draftWithAi, saveExperience } from "@/lib/synapse/api";
import { useStudio } from "@/lib/synapse/draft";
import { PALETTE, SCRIPT_HELP, compileScript } from "@/lib/synapse/model";
import { Viewport } from "@/components/synapse/viewport";

const chipClass = (id: string) =>
  id === "ice"
    ? "bg-ice"
    : id === "glacier"
      ? "bg-glacier"
      : id === "frost"
        ? "bg-frost"
        : id === "sea"
          ? "bg-deep"
          : id === "navy"
            ? "bg-navy"
            : "bg-ink";

const fieldClass =
  "h-11 w-full rounded-xl border border-line bg-ink px-3 text-base text-frost outline-none placeholder:text-mist focus-visible:border-ice";

export function Studio() {
  const studio = useStudio();
  const [prompt, setPrompt] = useState("Una torre de hielo con una base oscura");
  const [busy, setBusy] = useState<"save" | "ai" | null>(null);

  function runScript() {
    const compiled = compileScript(studio.script);
    if (compiled.error) {
      studio.setNotice(compiled.error);
      return;
    }
    studio.applyBlocks(compiled.blocks);
    studio.setNotice(`${compiled.blocks.length} bloques.`);
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
    studio.setNotice("Listo. Puedes seguir con bloques o editar el código.");
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
    studio.setNotice("Juego guardado.");
  }

  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:flex-row lg:gap-0">
      <div className="h-80 overflow-hidden rounded-2xl border border-line lg:h-auto lg:min-h-0 lg:flex-1 lg:rounded-none lg:border-0 lg:border-r">
        <Viewport
          blocks={studio.blocks}
          interactive
          tool={studio.tool}
          color={studio.color}
          onPlace={studio.place}
          onErase={studio.erase}
        />
      </div>
      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-96 lg:overflow-y-auto lg:p-4">
        <div className="flex gap-2">
          {(
            [
              ["blocks", "Bloques"],
              ["code", "Código"],
              ["ai", "IA"],
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
          <span className="mb-1.5 block text-sm font-medium text-mist">Nombre del juego</span>
          <input
            className={fieldClass}
            value={studio.title}
            maxLength={40}
            onChange={(event) => studio.setTitle(event.target.value)}
          />
        </label>
        {studio.mode === "blocks" ? (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Clic para poner. Clic derecho, o la goma, para quitar. Arrastra para mirar alrededor.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PALETTE.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  className={`flex h-11 items-center gap-2 rounded-xl border px-2 text-sm ${
                    studio.color === swatch.hex && studio.tool === "place"
                      ? "border-ice"
                      : "border-line"
                  }`}
                  onClick={() => studio.setColor(swatch.hex)}
                >
                  <span className={`size-4 rounded-sm border border-line ${chipClass(swatch.id)}`} />
                  {swatch.label}
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
                Quitar
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-mist disabled:opacity-40"
                onClick={studio.undo}
                disabled={studio.past.length === 0}
              >
                <Undo2 className="size-4" />
                Deshacer
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
              Ejecutar script
            </button>
          </div>
        ) : null}
        {studio.mode === "ai" ? (
          <div className="space-y-3">
            <p className="text-pretty text-sm text-mist">
              Describe el lugar. Grok escribe el script, coloca los bloques y puedes seguir editándolo.
            </p>
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
              {busy === "ai" ? "Construyendo…" : "Construir con IA"}
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
          {busy === "save" ? "Guardando…" : "Guardar juego"}
        </button>
        <p className="text-xs text-mist">{studio.blocks.length} bloques en la escena.</p>
      </aside>
    </div>
  );
}
