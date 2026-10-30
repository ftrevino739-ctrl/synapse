import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";
import { completeProfile } from "@/lib/synapse/api";
import { stageClaim } from "@/lib/synapse/claim";
import { MONTHS, PALETTE, STARTER_BLOCKS, cleanUsername, parseBirthDate, usernameToEmail } from "@/lib/synapse/model";
import { Viewport } from "@/components/synapse/viewport";

const fieldClass =
  "h-11 w-full rounded-xl border border-line bg-ink px-3 text-base text-frost outline-none placeholder:text-mist focus-visible:border-ice";
const labelClass = "mb-1.5 block text-sm font-medium text-mist";
const primaryClass =
  "inline-flex h-11 w-full items-center justify-center rounded-xl bg-ice px-4 text-base font-semibold text-ink transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60";

function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="3" y="3" width="12" height="12" rx="3" fill="currentColor" />
      <rect x="17" y="17" width="12" height="12" rx="3" fill="currentColor" />
      <path
        d="M15 8h6a3 3 0 0 1 3 3v3M17 24h-6a3 3 0 0 1-3-3v-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-frost">
      <Mark className="size-8 text-ice" />
      <span className={`text-lg font-semibold tracking-tight ${compact ? "hidden sm:inline" : ""}`}>
        Synapse
      </span>
    </span>
  );
}

function authMessage(error: { message?: string; code?: string } | null | undefined): string {
  const code = (error?.code ?? "").toUpperCase();
  const message = (error?.message ?? "").toLowerCase();
  if (code.includes("USER_ALREADY") || message.includes("exist")) return "That username is taken.";
  if (
    code.includes("INVALID_EMAIL_OR_PASSWORD") ||
    message.includes("invalid email or password") ||
    message.includes("invalid credentials")
  ) {
    return "Wrong username or password.";
  }
  if (code.includes("PASSWORD_TOO_SHORT") || message.includes("too short") || message.includes("at least")) {
    return "Use at least 8 characters.";
  }
  if (code.includes("INVALID_EMAIL") || (message.includes("invalid email") && !message.includes("password"))) {
    return "That username is not valid.";
  }
  return "Could not finish. Check the fields and try again.";
}

function BirthFields({
  year,
  month,
  day,
  onYear,
  onMonth,
  onDay,
}: {
  year: number;
  month: number;
  day: number;
  onYear: (value: number) => void;
  onMonth: (value: number) => void;
  onDay: (value: number) => void;
}) {
  const thisYear = new Date().getFullYear();
  const years: number[] = [];
  for (let value = thisYear; value >= 1920; value -= 1) years.push(value);
  return (
    <div>
      <span className={labelClass}>Birth date</span>
      <div className="grid grid-cols-3 gap-2">
        <select
          aria-label="Day"
          className={fieldClass}
          value={day}
          onChange={(event) => onDay(Number(event.target.value))}
        >
          {Array.from({ length: 31 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          aria-label="Mes"
          className={fieldClass}
          value={month}
          onChange={(event) => onMonth(Number(event.target.value))}
        >
          {MONTHS.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Year"
          className={fieldClass}
          value={year}
          onChange={(event) => onYear(Number(event.target.value))}
        >
          {years.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        className={`${fieldClass} pr-12`}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Password"
        required
        minLength={8}
      />
      <button
        type="button"
        className="absolute top-0 right-0 grid h-11 w-11 place-items-center text-mist"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function BootScreen() {
  return (
    <main className="grid min-h-dvh place-items-center bg-ink">
      <Wordmark />
    </main>
  );
}

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [year, setYear] = useState(2012);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const cleaned = cleanUsername(username);
    if (!cleaned) {
      setError("Usernames are 3 to 20 letters, numbers, or _.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setPending(true);
    const email = usernameToEmail(cleaned);
    if (mode === "signup") {
      const birthDate = parseBirthDate(year, month, day);
      if (!birthDate) {
        setPending(false);
        setError("That birth date is not valid.");
        return;
      }
      stageClaim({ username: cleaned, birthDate });
      const created = await authClient.signUp.email({
        email,
        password,
        name: cleaned,
      });
      if (created.error) {
        stageClaim(null);
        setPending(false);
        setError(authMessage(created.error));
        return;
      }
      const saved = await completeProfile({ data: { username: cleaned, birthDate } });
      if (!saved.ok) {
        setPending(false);
        setError(saved.error);
        return;
      }
      stageClaim(null);
      setPending(false);
      return;
    }
    const signed = await authClient.signIn.email({ email, password });
    setPending(false);
    if (signed.error) setError(authMessage(signed.error));
  }

  return (
    <main className="grid min-h-dvh bg-ink lg:grid-cols-2">
      <section className="relative hidden min-h-dvh flex-col justify-between border-r border-line p-8 lg:flex">
        <Wordmark />
        <div className="absolute inset-x-8 top-24 bottom-36 overflow-hidden rounded-2xl border border-line">
          <Viewport
            blocks={STARTER_BLOCKS}
            interactive={false}
            tool="place"
            color={PALETTE[0].hex}
            onPlace={() => {}}
            onErase={() => {}}
          />
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-frost">Synapse</h1>
          <p className="mt-3 text-pretty text-base text-mist">Sign in. Build a place. Play it.</p>
        </div>
      </section>
      <section className="flex flex-col justify-center px-5 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Wordmark />
          </div>
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-navy p-1">
            {([
              ["login", "Log in"],
              ["signup", "Sign up"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`h-11 rounded-lg text-sm font-semibold ${
                  mode === id ? "bg-ice text-ink" : "text-mist"
                }`}
                onClick={() => {
                  setMode(id);
                  setError(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className={labelClass}>Username</span>
              <input
                className={fieldClass}
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="tu_usuario"
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Password</span>
              <PasswordField
                value={password}
                onChange={setPassword}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>
            {mode === "signup" ? (
              <BirthFields
                year={year}
                month={month}
                day={day}
                onYear={setYear}
                onMonth={setMonth}
                onDay={setDay}
              />
            ) : null}
            {error ? <p className="text-sm text-frost">{error}</p> : null}
            <button className={primaryClass} type="submit" disabled={pending}>
              {pending ? "One moment…" : mode === "login" ? "Log in" : "Sign up"}
            </button>
          </form>
          <div className="my-6 flex items-center gap-3 text-sm text-mist">
            <span className="h-px flex-1 bg-line" />
            or continue with
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="grid gap-2">
            {GROK_PROVIDERS.map((provider) => (
              <button
                key={provider.providerId}
                type="button"
                className="h-11 rounded-xl border border-line bg-navy text-sm font-semibold text-frost hover:border-ice"
                onClick={() => {
                  setError(null);
                  const back = `${window.location.pathname}${window.location.search}` || "/";
                  void signIn(provider.providerId, { callbackURL: back }).catch((err: unknown) => {
                    const message = err instanceof Error ? err.message : "";
                    if (/pop-?up|bloque/i.test(message)) {
                      setError("Your browser blocked the window. Allow pop-ups and try again.");
                      return;
                    }
                    setError("Could not open " + provider.label + ". Try again.");
                  });
                }}
              >
                Continue with {provider.label}
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export function ClaimScreen({ onDone }: { onDone: (username: string) => void }) {
  const [username, setUsername] = useState("");
  const [year, setYear] = useState(2012);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const cleaned = cleanUsername(username);
    const birthDate = parseBirthDate(year, month, day);
    if (!cleaned) {
      setError("Usernames are 3 to 20 letters, numbers, or _.");
      return;
    }
    if (!birthDate) {
      setError("That birth date is not valid.");
      return;
    }
    setPending(true);
    const saved = await completeProfile({ data: { username: cleaned, birthDate } });
    setPending(false);
    if (!saved.ok) {
      setError(saved.error);
      return;
    }
    onDone(saved.username);
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-5">
      <form className="w-full max-w-md space-y-4" onSubmit={onSubmit}>
        <Wordmark />
        <h1 className="text-balance text-3xl font-semibold tracking-tight">Pick a username</h1>
        <p className="text-pretty text-sm text-mist">People will find you by this name. Your birth date shows on your profile.</p>
        <label className="block">
          <span className={labelClass}>Username</span>
          <input
            className={fieldClass}
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="tu_usuario"
            required
          />
        </label>
        <BirthFields year={year} month={month} day={day} onYear={setYear} onMonth={setMonth} onDay={setDay} />
        {error ? <p className="text-sm text-frost">{error}</p> : null}
        <button className={primaryClass} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Enter Synapse"}
        </button>
      </form>
    </main>
  );
}
