import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Boxes, Home, Inbox, MessageCircle, Plus, Search, Send } from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import {
  deleteExperience,
  getHome,
  loadExperience,
  loadMessages,
  respondRequest,
  searchPlayers,
  sendFriendRequest,
  sendMessage,
  type ChatLine,
  type HomePayload,
  type PublicPlayer,
} from "@/lib/synapse/api";
import { useStudio } from "@/lib/synapse/draft";
import { Wordmark } from "@/components/synapse/auth-screen";
import { Studio } from "@/components/synapse/studio";

export type PageId = "home" | "inbox" | "chat" | "studio";

const subscribe = () => () => {};
const noGate = () => false;

const nav = [
  { id: "home" as const, label: "Inicio", icon: Home },
  { id: "inbox" as const, label: "Buzón", icon: Inbox },
  { id: "chat" as const, label: "Chat", icon: MessageCircle },
  { id: "studio" as const, label: "Crear", icon: Boxes },
];

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function AppShell({ page }: { page: PageId }) {
  const navigate = useNavigate();
  const [home, setHome] = useState<HomePayload | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [friendId, setFriendId] = useState<string | null>(null);
  const gateSession = useSyncExternalStore(subscribe, hasGateSessionMarker, noGate);
  const [signingOut, setSigningOut] = useState(false);
  const loadDraft = useStudio((state) => state.load);
  const blank = useStudio((state) => state.blank);

  async function reload() {
    try {
      const next = await getHome();
      setHome(next);
      setProblem(null);
    } catch {
      setProblem("No se pudo cargar tu lugar.");
    }
  }

  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => void reload(), 8000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancel = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchPlayers({ data: { query: q } })
        .then((found) => {
          if (!cancel) setResults(found);
        })
        .catch(() => {
          if (!cancel) setResults([]);
        })
        .finally(() => {
          if (!cancel) setSearching(false);
        });
    }, 250);
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  async function addFriend(userId: string) {
    const result = await sendFriendRequest({ data: { userId } });
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    setResults((current) =>
      current.map((player) => (player.userId === userId ? { ...player, relation: result.state } : player)),
    );
    void reload();
  }

  function go(next: PageId) {
    void navigate({ to: "/", search: { p: next } });
  }

  const pending = home?.incoming.length ?? 0;

  return (
    <div className="flex h-dvh flex-col bg-ink text-frost">
      <header className="z-20 flex h-16 shrink-0 items-center gap-3 border-b border-line px-3 sm:px-4">
        <Link to="/" search={{ p: "home" }} className="shrink-0" aria-label="Synapse, inicio">
          <Wordmark compact />
        </Link>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-mist" />
          <input
            className="h-11 w-full rounded-xl border border-line bg-navy pr-3 pl-10 text-sm text-frost outline-none placeholder:text-mist focus-visible:border-ice"
            placeholder="Buscar amigos por usuario"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar amigos por usuario"
          />
          {query.trim().length >= 2 ? (
            <div className="absolute top-12 right-0 left-0 overflow-hidden rounded-xl border border-line bg-navy shadow-lg">
              {searching && results.length === 0 ? (
                <p className="px-3 py-3 text-sm text-mist">Buscando…</p>
              ) : null}
              {!searching && results.length === 0 ? (
                <p className="px-3 py-3 text-sm text-mist">Nadie con ese usuario.</p>
              ) : null}
              {results.map((player) => (
                <div key={player.userId} className="flex items-center gap-3 px-3 py-2">
                  <Avatar name={player.username} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{player.username}</span>
                  <RelationButton player={player} onAdd={() => void addFriend(player.userId)} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="max-w-32 truncate text-sm font-medium">{home?.username}</span>
          {gateSession ? null : (
            <button
              type="button"
              className="h-11 rounded-xl px-3 text-sm text-mist hover:text-frost disabled:opacity-60"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut().catch(() => setSigningOut(false));
              }}
            >
              {signingOut ? "Saliendo…" : "Salir"}
            </button>
          )}
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-52 shrink-0 flex-col gap-1 border-r border-line p-3 md:flex">
          {nav.map((item) => (
            <NavButton
              key={item.id}
              active={page === item.id}
              label={item.label}
              icon={item.icon}
              badge={item.id === "inbox" ? pending : 0}
              onClick={() => go(item.id)}
            />
          ))}
        </nav>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-20 md:pb-0">
          {problem ? <p className="px-4 pt-4 text-sm text-mist">{problem}</p> : null}
          {!home ? (
            <p className="px-4 py-8 text-sm text-mist">Cargando tu lugar…</p>
          ) : page === "home" ? (
            <HomePanel
              home={home}
              onCreate={() => {
                blank();
                go("studio");
              }}
              onOpen={async (id) => {
                const result = await loadExperience({ data: { id } });
                if (!result.ok) {
                  setProblem(result.error);
                  return;
                }
                loadDraft(result.experience);
                go("studio");
              }}
              onDelete={async (id) => {
                if (!window.confirm("¿Borrar este juego?")) return;
                await deleteExperience({ data: { id } });
                void reload();
              }}
              onChat={(id) => {
                setFriendId(id);
                go("chat");
              }}
            />
          ) : page === "inbox" ? (
            <InboxPanel
              home={home}
              onRespond={async (id, accept) => {
                const result = await respondRequest({ data: { id, accept } });
                if (!result.ok) setProblem(result.error);
                void reload();
              }}
            />
          ) : page === "chat" ? (
            <ChatPanel
              friends={home.friends}
              friendId={friendId}
              onSelect={setFriendId}
            />
          ) : (
            <div className="h-full min-h-[70dvh] p-3 lg:p-0">
              <Studio />
            </div>
          )}
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-navy md:hidden">
        {nav.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`relative flex h-16 flex-col items-center justify-center gap-1 text-xs ${
              page === item.id ? "text-ice" : "text-mist"
            }`}
            onClick={() => go(item.id)}
          >
            <item.icon className="size-5" />
            {item.label}
            {item.id === "inbox" && pending > 0 ? (
              <span className="absolute top-2 right-6 grid size-5 place-items-center rounded-full bg-ice text-xs font-semibold text-ink">
                {pending}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sea text-sm font-semibold text-ice">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function RelationButton({ player, onAdd }: { player: PublicPlayer; onAdd: () => void }) {
  if (player.relation === "friends") {
    return <span className="text-xs text-mist">Amigos</span>;
  }
  if (player.relation === "outgoing") {
    return <span className="text-xs text-mist">Enviada</span>;
  }
  return (
    <button
      type="button"
      className="h-9 rounded-lg bg-ice px-3 text-xs font-semibold text-ink"
      onClick={onAdd}
    >
      {player.relation === "incoming" ? "Aceptar" : "Agregar"}
    </button>
  );
}

function NavButton({
  active,
  label,
  icon: Icon,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: typeof Home;
  badge: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${
        active ? "bg-navy text-frost" : "text-mist hover:text-frost"
      }`}
    >
      <Icon className="size-4" />
      <span className="flex-1 text-left">{label}</span>
      {badge > 0 ? (
        <span className="grid min-w-5 place-items-center rounded-full bg-ice px-1.5 text-xs font-semibold text-ink">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function HomePanel({
  home,
  onCreate,
  onOpen,
  onDelete,
  onChat,
}: {
  home: HomePayload;
  onCreate: () => void;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
  onChat: (id: string) => void;
}) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-mist">Hola</p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight">{home.username}</h1>
        </div>
        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-ice px-4 text-sm font-semibold text-ink"
          onClick={onCreate}
        >
          <Plus className="size-4" />
          Crear juego
        </button>
      </div>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-mist">Tus juegos</h2>
        {home.experiences.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-sm text-mist">
            Todavía no guardas ninguno. En Crear puedes poner bloques, escribir código o pedírselo a la IA.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {home.experiences.map((game) => (
              <article key={game.id} className="rounded-2xl border border-line bg-navy p-4">
                <h3 className="truncate text-lg font-semibold">{game.title}</h3>
                <p className="mt-1 text-sm text-mist">{game.blockCount} bloques</p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="h-11 flex-1 rounded-xl bg-ice text-sm font-semibold text-ink"
                    onClick={() => onOpen(game.id)}
                  >
                    Abrir
                  </button>
                  <button
                    type="button"
                    className="h-11 rounded-xl border border-line px-4 text-sm text-mist"
                    onClick={() => onDelete(game.id)}
                  >
                    Borrar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-mist">Amigos</h2>
        {home.friends.length === 0 ? (
          <p className="text-sm text-mist">Busca un usuario arriba y mándale solicitud.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {home.friends.map((friend) => (
              <li key={friend.userId} className="flex items-center gap-3 px-3 py-2">
                <Avatar name={friend.username} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{friend.username}</span>
                <button
                  type="button"
                  className="h-10 rounded-xl border border-line px-3 text-sm text-frost"
                  onClick={() => onChat(friend.userId)}
                >
                  Chat
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function InboxPanel({
  home,
  onRespond,
}: {
  home: HomePayload;
  onRespond: (id: number, accept: boolean) => void;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6">
      <h1 className="text-3xl font-semibold tracking-tight">Buzón</h1>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-mist">Solicitudes</h2>
        {home.incoming.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-sm text-mist">
            Cuando alguien te agregue, la solicitud llega aquí.
          </p>
        ) : (
          <ul className="space-y-2">
            {home.incoming.map((request) => (
              <li key={request.id} className="flex items-center gap-3 rounded-2xl border border-line bg-navy p-3">
                <Avatar name={request.username} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{request.username}</p>
                  <p className="text-xs text-mist">Quiere ser tu amigo</p>
                </div>
                <button
                  type="button"
                  className="h-11 rounded-xl bg-ice px-3 text-sm font-semibold text-ink"
                  onClick={() => onRespond(request.id, true)}
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  className="h-11 rounded-xl border border-line px-3 text-sm text-mist"
                  onClick={() => onRespond(request.id, false)}
                >
                  Rechazar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-mist">Enviadas</h2>
        {home.outgoing.length === 0 ? (
          <p className="text-sm text-mist">No tienes solicitudes pendientes.</p>
        ) : (
          <ul className="space-y-2">
            {home.outgoing.map((request) => (
              <li key={request.id} className="flex items-center gap-3 rounded-2xl border border-line px-3 py-3">
                <Avatar name={request.username} />
                <span className="text-sm font-medium">{request.username}</span>
                <span className="ml-auto text-xs text-mist">Esperando</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ChatPanel({
  friends,
  friendId,
  onSelect,
}: {
  friends: HomePayload["friends"];
  friendId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const active = friends.find((friend) => friend.userId === friendId) ?? null;
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      setLines([]);
      return;
    }
    let cancel = false;
    const pull = () => {
      void loadMessages({ data: { userId: active.userId } }).then((result) => {
        if (cancel) return;
        if (!result.ok) {
          setError(result.error);
          setLines([]);
          return;
        }
        setError(null);
        setLines(result.lines);
      });
    };
    pull();
    const timer = window.setInterval(pull, 4000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [active?.userId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!active) return;
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    const result = await sendMessage({ data: { userId: active.userId, body } });
    if (!result.ok) {
      setError(result.error);
      setDraft(body);
      return;
    }
    const next = await loadMessages({ data: { userId: active.userId } });
    if (next.ok) setLines(next.lines);
  }

  return (
    <div className="flex h-full min-h-[70dvh] flex-col md:flex-row">
      <aside className={`w-full border-line md:block md:w-72 md:border-r ${active ? "hidden" : "block"}`}>
        <h1 className="px-4 pt-5 text-xl font-semibold">Chat</h1>
        {friends.length === 0 ? (
          <p className="px-4 py-6 text-sm text-mist">Agrega un amigo para poder escribirle.</p>
        ) : (
          <ul className="p-2">
            {friends.map((friend) => (
              <li key={friend.userId}>
                <button
                  type="button"
                  className={`flex h-12 w-full items-center gap-3 rounded-xl px-2 text-left text-sm ${
                    friend.userId === active?.userId ? "bg-navy" : ""
                  }`}
                  onClick={() => onSelect(friend.userId)}
                >
                  <Avatar name={friend.username} />
                  {friend.username}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <section className={`min-h-0 min-w-0 flex-1 flex-col ${active ? "flex" : "hidden md:flex"}`}>
        {active ? (
          <>
            <div className="flex h-14 items-center gap-2 border-b border-line px-3">
              <button type="button" className="h-11 px-2 text-sm text-mist md:hidden" onClick={() => onSelect(null)}>
                Volver
              </button>
              <Avatar name={active.username} />
              <span className="font-medium">{active.username}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
              {lines.length === 0 ? <p className="text-sm text-mist">Aún no hay mensajes.</p> : null}
              {lines.map((line) => (
                <div key={line.id} className={`flex ${line.fromMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      line.fromMe ? "bg-ice text-ink" : "bg-navy text-frost"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{line.body}</p>
                    <p className={`mt-1 text-xs ${line.fromMe ? "text-ink/70" : "text-mist"}`}>
                      {formatTime(line.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {error ? <p className="px-4 text-sm text-mist">{error}</p> : null}
            <form className="flex gap-2 border-t border-line p-3" onSubmit={(event) => void submit(event)}>
              <input
                className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-ink px-3 text-sm outline-none focus-visible:border-ice"
                value={draft}
                maxLength={500}
                placeholder={`Mensaje para ${active.username}`}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button
                type="submit"
                className="grid size-11 place-items-center rounded-xl bg-ice text-ink"
                aria-label="Enviar"
              >
                <Send className="size-4" />
              </button>
            </form>
          </>
        ) : (
          <p className="m-auto hidden text-sm text-mist md:block">Elige un amigo para chatear.</p>
        )}
      </section>
    </div>
  );
}
