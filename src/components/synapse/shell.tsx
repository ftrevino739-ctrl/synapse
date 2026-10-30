import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Boxes, Home, Inbox, MessageCircle, Plus, Search, Send, UserRound } from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import {
  deleteExperience,
  getHome,
  loadExperience,
  loadMessages,
  respondRequest,
  saveAvatar,
  searchPlayers,
  sendFriendRequest,
  sendMessage,
  type ChatLine,
  type HomePayload,
  type PublicPlayer,
} from "@/lib/synapse/api";
import { useStudio } from "@/lib/synapse/draft";
import { OFFICIAL_GAMES, blocksFor, type OfficialGame } from "@/lib/synapse/games";
import { DEFAULT_LOOK, readLook, writeLook, type Look } from "@/lib/synapse/look";
import { Wordmark } from "@/components/synapse/auth-screen";
import { PlayWorld } from "@/components/synapse/play-world";
import { Studio } from "@/components/synapse/studio";

export type PageId = "home" | "inbox" | "chat" | "studio" | "account";

const subscribe = () => () => {};
const noGate = () => false;

const nav = [
  { id: "home" as const, label: "Home", icon: Home },
  { id: "chat" as const, label: "Chat", icon: MessageCircle },
  { id: "inbox" as const, label: "Inbox", icon: Inbox },
  { id: "studio" as const, label: "Create", icon: Boxes },
  { id: "account" as const, label: "You", icon: UserRound },
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
  const [detail, setDetail] = useState<OfficialGame | null>(null);
  const [playing, setPlaying] = useState<OfficialGame | null>(null);

  async function reload() {
    try {
      const next = await getHome();
      setHome(next);
      setProblem(null);
    } catch {
      setProblem("Could not load your place.");
    }
  }

  useEffect(() => {
    const saved = window.localStorage.getItem("synapse-theme");
    if (saved) document.documentElement.dataset.theme = saved;
  }, []);

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
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-navy/90 px-3 backdrop-blur sm:px-4">
        <Link to="/" search={{ p: "home" }} className="shrink-0" aria-label="Synapse, inicio">
          <Wordmark compact />
        </Link>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-mist" />
          <input
            className="h-11 w-full rounded-xl border border-line bg-navy pr-3 pl-10 text-sm text-frost outline-none placeholder:text-mist focus-visible:border-ice"
            placeholder="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search people"
          />
          {query.trim().length >= 2 ? (
            <div className="absolute top-12 right-0 left-0 overflow-hidden rounded-xl border border-line bg-navy shadow-lg">
              {searching && results.length === 0 ? (
                <p className="px-3 py-3 text-sm text-mist">Searching…</p>
              ) : null}
              {!searching && results.length === 0 ? (
                <p className="px-3 py-3 text-sm text-mist">No one with that username.</p>
              ) : null}
              {results.map((player) => (
                <div key={player.userId} className="flex items-center gap-3 px-3 py-2">
                  <Avatar name={player.username} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{player.username}</p>
                    <p className="text-xs text-mist">Born {player.birthDate}</p>
                  </div>
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
              {signingOut ? "Leaving…" : "Log out"}
            </button>
          )}
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-[4.75rem] shrink-0 flex-col items-center gap-1 border-r border-line bg-navy/70 py-3 md:flex">
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
            <p className="px-4 py-8 text-sm text-mist">Loading…</p>
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
                if (!window.confirm("Delete this game?")) return;
                await deleteExperience({ data: { id } });
                void reload();
              }}
              onChat={(id) => {
                setFriendId(id);
                go("chat");
              }}
              onPlay={(game) => setDetail(game)}
            />
          ) : page === "account" ? (
            <AccountPanel home={home} onSaved={() => void reload()} />
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
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-navy md:hidden">
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
      {playing ? (
        <div className="fixed inset-0 z-40 bg-ink">
          <PlayWorld
            blocks={blocksFor(playing)}
            look={readLook()}
            mode={playing.mode}
            onExit={() => setPlaying(null)}
          />
        </div>
      ) : null}
      {detail && !playing ? (
        <div className="fixed inset-0 z-30 grid place-items-end bg-black/50 p-4 sm:place-items-center">
          <article className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-navy">
            <div className="h-40" style={{ background: detail.hue }} />
            <div className="space-y-2 p-4">
              <h2 className="text-2xl font-semibold">{detail.title}</h2>
              <p className="text-sm text-mist">{detail.summary}</p>
              <p className="text-sm">Creators: {detail.creators}</p>
              <p className="text-sm text-mist">Published {detail.published}</p>
              <p className="text-sm text-mist">Players {detail.players}</p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  className="h-11 flex-1 rounded-xl bg-ice text-sm font-semibold text-ink"
                  onClick={() => setPlaying(detail)}
                >
                  Play
                </button>
                <button
                  type="button"
                  className="h-11 rounded-xl border border-line px-4 text-sm"
                  onClick={() => setDetail(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}

function Avatar({ name, image, large = false }: { name: string; image?: string | null; large?: boolean }) {
  const size = large ? "size-16" : "size-9";
  if (image) {
    return <img src={image} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-full bg-sea text-sm font-semibold text-ice`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function RelationButton({ player, onAdd }: { player: PublicPlayer; onAdd: () => void }) {
  if (player.relation === "friends") {
    return <span className="text-xs text-mist">Friends</span>;
  }
  if (player.relation === "outgoing") {
    return <span className="text-xs text-mist">Sent</span>;
  }
  return (
    <button
      type="button"
      className="h-9 rounded-lg bg-ice px-3 text-xs font-semibold text-ink"
      onClick={onAdd}
    >
      {player.relation === "incoming" ? "Accept" : "Add"}
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
      className={`flex w-16 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium leading-tight ${
        active ? "bg-ink text-frost" : "text-mist hover:text-frost"
      }`}
    >
      <Icon className="size-5" />
      <span>{label}</span>
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
  onPlay,
}: {
  home: HomePayload;
  onCreate: () => void;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
  onChat: (id: string) => void;
  onPlay: (game: OfficialGame) => void;
}) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">For you</h1>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-ice px-3 text-sm font-semibold text-ink"
          onClick={onCreate}
        >
          <Plus className="size-4" />
          Create
        </button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-1">
        <button type="button" className="flex w-16 shrink-0 flex-col items-center gap-1 text-center" onClick={onCreate}>
          <span className="grid size-16 place-items-center rounded-full border border-line bg-navy text-ice">
            <Plus className="size-5" />
          </span>
          <span className="text-[11px] text-mist">Add friends</span>
        </button>
        {home.friends.map((friend) => (
          <button
            key={friend.userId}
            type="button"
            className="flex w-16 shrink-0 flex-col items-center gap-1 text-center"
            onClick={() => onChat(friend.userId)}
          >
            <span className="relative">
              <Avatar name={friend.username} image={friend.avatarUrl} large />
              <span className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-ink bg-emerald-400" />
            </span>
            <span className="w-full truncate text-[11px]">{friend.username}</span>
          </button>
        ))}
      </div>
      <section>
        <h2 className="mb-3 text-base font-semibold">Recommended for you</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {OFFICIAL_GAMES.map((game) => (
            <button key={game.id} type="button" className="text-left" onClick={() => onPlay(game)}>
              <span className="block aspect-[4/3] rounded-xl" style={{ background: game.hue }} />
              <span className="mt-2 block truncate text-sm font-medium">{game.title}</span>
              <span className="block truncate text-xs text-mist">{game.creators}</span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-base font-semibold">Continue</h2>
        {home.experiences.length === 0 ? (
          <p className="text-sm text-mist">Games you save show up here.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {home.experiences.map((game) => (
              <article key={game.id} className="min-w-0">
                <button type="button" className="block w-full text-left" onClick={() => onOpen(game.id)}>
                  <span className="block aspect-[4/3] rounded-xl bg-sea" />
                  <span className="mt-2 block truncate text-sm font-medium">{game.title}</span>
                  <span className="block text-xs text-mist">{game.blockCount} blocks</span>
                </button>
                <button type="button" className="mt-1 text-xs text-mist" onClick={() => onDelete(game.id)}>
                  Delete
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AccountPanel({ home, onSaved }: { home: HomePayload; onSaved: () => void }) {
  const [look, setLook] = useState<Look>(readLook());
  const [theme, setTheme] = useState<string>(() =>
    typeof document === "undefined" ? "dark" : document.documentElement.dataset.theme || "dark",
  );
  const [note, setNote] = useState<string | null>(null);

  function applyTheme(next: string) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("synapse-theme", next);
  }

  function patch(partial: Partial<Look>) {
    const next = { ...look, ...partial };
    setLook(next);
    writeLook(next);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const data = await resizeImage(file);
    const result = await saveAvatar({ data: { avatarUrl: data } });
    if (!result.ok) {
      setNote(result.error);
      return;
    }
    setNote("Photo saved.");
    onSaved();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      <h1 className="text-3xl font-semibold">Your account</h1>
      <div className="flex items-center gap-4">
        <Avatar name={home.username} image={home.avatarUrl} large />
        <div>
          <p className="text-xl font-semibold">{home.username}</p>
          <p className="text-sm text-mist">Born {home.birthDate}</p>
          <label className="mt-2 inline-block text-sm text-ice">
            Change photo
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
          </label>
        </div>
      </div>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-mist">Theme</h2>
        <div className="flex gap-2">
          {(
            [
              ["dark", "Dark"],
              ["light", "Light"],
              ["glass", "Liquid glass"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`h-10 rounded-xl px-3 text-sm ${theme === id ? "bg-ice text-ink" : "border border-line"}`}
              onClick={() => applyTheme(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mist">Character</h2>
        <p className="text-sm text-mist">This is the person who shows up when you join a game.</p>
        <LookField label="Skin" value={look.skin} onChange={(skin) => patch({ skin })} />
        <LookField label="Hair" value={look.hair} onChange={(hair) => patch({ hair })} />
        <label className="block text-sm">
          Hair style
          <select
            className="mt-1 h-11 w-full rounded-xl border border-line bg-ink px-3"
            value={look.hairStyle}
            onChange={(event) => patch({ hairStyle: event.target.value as Look["hairStyle"] })}
          >
            <option value="short">Short</option>
            <option value="spiky">Spiky</option>
            <option value="long">Long</option>
          </select>
        </label>
        <LookField label="Shirt" value={look.shirt} onChange={(shirt) => patch({ shirt })} />
        <LookField label="Pants" value={look.pants} onChange={(pants) => patch({ pants })} />
        <LookField label="Shoes" value={look.shoes} onChange={(shoes) => patch({ shoes })} />
        <button type="button" className="text-sm text-mist" onClick={() => patch(DEFAULT_LOOK)}>
          Reset look
        </button>
      </section>
      {note ? <p className="text-sm text-mist">{note}</p> : null}
    </div>
  );
}

function LookField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      {label}
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(image, 0, 0, 128, 128);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
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
      <h1 className="text-3xl font-semibold tracking-tight">Inbox</h1>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-mist">Requests</h2>
        {home.incoming.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-sm text-mist">
            When someone adds you, the request shows up here.
          </p>
        ) : (
          <ul className="space-y-2">
            {home.incoming.map((request) => (
              <li key={request.id} className="flex items-center gap-3 rounded-2xl border border-line bg-navy p-3">
                <Avatar name={request.username} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{request.username}</p>
                  <p className="text-xs text-mist">Wants to be friends</p>
                </div>
                <button
                  type="button"
                  className="h-11 rounded-xl bg-ice px-3 text-sm font-semibold text-ink"
                  onClick={() => onRespond(request.id, true)}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="h-11 rounded-xl border border-line px-3 text-sm text-mist"
                  onClick={() => onRespond(request.id, false)}
                >
                  Decline
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-mist">Sent</h2>
        {home.outgoing.length === 0 ? (
          <p className="text-sm text-mist">No pending requests.</p>
        ) : (
          <ul className="space-y-2">
            {home.outgoing.map((request) => (
              <li key={request.id} className="flex items-center gap-3 rounded-2xl border border-line px-3 py-3">
                <Avatar name={request.username} />
                <span className="text-sm font-medium">{request.username}</span>
                <span className="ml-auto text-xs text-mist">Waiting</span>
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
          <p className="px-4 py-6 text-sm text-mist">Add a friend to start chatting.</p>
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
                Back
              </button>
              <Avatar name={active.username} />
              <span className="font-medium">{active.username}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
              {lines.length === 0 ? <p className="text-sm text-mist">No messages yet.</p> : null}
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
                placeholder={`Message ${active.username}`}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button
                type="submit"
                className="grid size-11 place-items-center rounded-xl bg-ice text-ink"
                aria-label="Send"
              >
                <Send className="size-4" />
              </button>
            </form>
          </>
        ) : (
          <p className="m-auto hidden text-sm text-mist md:block">Pick a friend.</p>
        )}
      </section>
    </div>
  );
}
