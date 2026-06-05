"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, LogIn, MessageSquareText, ShieldCheck, UserRound } from "lucide-react";

import { loginUser } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/doctor");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(params.get("next") || "/doctor");
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);
    try {
      await loginUser({ username, password });
      router.replace(nextPath);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-clinical-wash px-4 py-8 text-clinical-ink">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-md border border-clinical-line bg-white shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-clinical-line bg-clinical-ink p-6 text-white lg:border-b-0 lg:border-r">
          <div className="relative h-16 w-28 overflow-hidden rounded-md bg-white/10">
            <Image src="/logo.png" alt="AID logo" fill sizes="112px" className="object-contain p-2" priority />
          </div>
          <h1 className="mt-8 text-2xl font-semibold">AID Healthcare Platform</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/75">
            Real clinical CRM, AI safety escalation, patient communication, and governance data in one secured workspace.
          </p>
          <div className="mt-8 space-y-3 text-sm text-white/80">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-clinical-cyan" />
              Tenant-scoped hospital data
            </div>
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-clinical-cyan" />
              Session auth with CSRF protection
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="p-6 sm:p-8">
          <div>
            <h2 className="text-xl font-semibold">Login</h2>
            <p className="mt-1 text-sm text-clinical-slate">Enter your staff account to continue.</p>
          </div>

          {message ? (
            <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              {message}
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-clinical-slate">Username</span>
              <span className="relative block">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="h-11 w-full rounded-md border border-clinical-line pl-9 pr-3 text-sm focus:border-clinical-blue"
                  autoComplete="username"
                  required
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-clinical-slate">Password</span>
              <span className="relative block">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  className="h-11 w-full rounded-md border border-clinical-line pl-9 pr-3 text-sm focus:border-clinical-blue"
                  autoComplete="current-password"
                  required
                />
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-clinical-blue text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <LogIn className="h-4 w-4" />
            {submitting ? "Signing in..." : "Sign in"}
          </button>

          <a
            href="https://www.aid-ai.uz/feedback/doctors"
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-clinical-line bg-white text-sm font-semibold text-clinical-blue transition hover:border-clinical-blue hover:bg-blue-50"
          >
            <MessageSquareText className="h-4 w-4" />
            Go to feedback page
          </a>

          <p className="mt-5 text-center text-sm text-clinical-slate">
            New clinic account?{" "}
            <Link href="/register" className="font-semibold text-clinical-blue">
              Register
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
