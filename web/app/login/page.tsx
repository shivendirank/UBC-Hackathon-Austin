"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { API_URL } from "@/lib/api";
import { clearSession, saveSession } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("demo@thinice.local");
  const [name, setName] = useState("Demo");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const r = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof data.detail === "string" ? data.detail : "Could not sign in");
        return;
      }
      saveSession(data.token, data.user);
      router.push("/");
      router.refresh();
    } catch {
      setError("Can't reach the Thin Ice API. Start uvicorn in backend/.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center px-6 py-12">
      <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-white">Thin Ice</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
        {mode === "login" ? "Sign in" : "Create an account"}
      </h1>
      <p className="mt-2 text-sm text-[#9aa3ad]">
        Accounts are stored in <code className="text-[#c5ced6]">backend/data/users.csv</code>. Market grades are written to{" "}
        <code className="text-[#c5ced6]">markets.csv</code>.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-[24px] border border-white/10 bg-[#12141a] p-6">
        {mode === "register" && (
          <label className="block text-sm">
            <span className="text-[#8b95a1]">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-[#1a1d24] px-3 text-white outline-none"
              autoComplete="name"
            />
          </label>
        )}
        <label className="block text-sm">
          <span className="text-[#8b95a1]">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-[#1a1d24] px-3 text-white outline-none"
            autoComplete="email"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[#8b95a1]">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-[#1a1d24] px-3 text-white outline-none"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>
        {error && <p className="text-sm text-[#ff8b98]">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="h-11 w-full rounded-full bg-white text-sm font-semibold text-[#101216] disabled:opacity-60"
        >
          {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-sm text-[#9aa3ad]">
        {mode === "login" ? (
          <>
            No account?{" "}
            <button type="button" className="text-[#9aebff] hover:underline" onClick={() => { setMode("register"); setError(""); }}>
              Register
            </button>
          </>
        ) : (
          <>
            Already have one?{" "}
            <button type="button" className="text-[#9aebff] hover:underline" onClick={() => { setMode("login"); setError(""); }}>
              Sign in
            </button>
          </>
        )}
      </p>
      <p className="mt-6 text-xs text-[#6f7882]">
        Demo login: demo@thinice.local / demo1234.{" "}
        <button
          type="button"
          className="text-[#9aa3ad] underline"
          onClick={() => {
            clearSession();
            setError("Signed out on this device.");
          }}
        >
          Clear local session
        </button>
        {" · "}
        <Link href="/" className="text-[#9aa3ad] underline">
          Skip to markets
        </Link>
      </p>
    </main>
  );
}
