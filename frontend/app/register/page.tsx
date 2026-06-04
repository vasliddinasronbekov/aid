"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ClipboardCheck, LockKeyhole, UserPlus, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";

import { registerUser } from "@/lib/api";
import type { RegisterPayload } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<RegisterPayload>({
    username: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    organization_name: "",
    hospital_name: "",
    region_code: "andijan-central",
    role: "HEAD_PHYSICIAN",
    phone_number: "",
    license_number: "",
  });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);
    try {
      await registerUser(draft);
      router.replace(draft.role === "HEAD_PHYSICIAN" || draft.role === "HOSPITAL_ADMIN" ? "/admin" : "/doctor");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-clinical-wash px-4 py-8 text-clinical-ink">
      <section className="mx-auto w-full max-w-5xl rounded-md border border-clinical-line bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-clinical-line p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-20 overflow-hidden rounded-md bg-clinical-ink">
              <Image src="/logo.png" alt="AID logo" fill sizes="80px" className="object-contain p-1.5" priority />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Register clinic workspace</h1>
              <p className="text-sm text-clinical-slate">Creates your organization, hospital, staff account, and backend role.</p>
            </div>
          </div>
          <Link href="/login" className="inline-flex h-10 items-center justify-center rounded-md border border-clinical-line px-3 text-sm font-semibold text-clinical-slate">
            Login
          </Link>
        </div>

        <form onSubmit={submit} className="grid gap-5 p-5 lg:grid-cols-2">
          {message ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 lg:col-span-2">
              {message}
            </div>
          ) : null}

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-clinical-blue" />
              <h2 className="font-semibold">Clinic</h2>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm text-clinical-slate">Organization name</span>
              <input
                value={draft.organization_name}
                onChange={(event) => setDraft((current) => ({ ...current, organization_name: event.target.value }))}
                className="h-11 w-full rounded-md border border-clinical-line px-3 text-sm focus:border-clinical-blue"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-clinical-slate">Hospital or clinic name</span>
              <input
                value={draft.hospital_name}
                onChange={(event) => setDraft((current) => ({ ...current, hospital_name: event.target.value }))}
                className="h-11 w-full rounded-md border border-clinical-line px-3 text-sm focus:border-clinical-blue"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-clinical-slate">Region code</span>
              <input
                value={draft.region_code}
                onChange={(event) => setDraft((current) => ({ ...current, region_code: event.target.value }))}
                className="h-11 w-full rounded-md border border-clinical-line px-3 text-sm focus:border-clinical-blue"
                required
              />
            </label>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-clinical-blue" />
              <h2 className="font-semibold">Staff account</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm text-clinical-slate">First name</span>
                <input
                  value={draft.first_name}
                  onChange={(event) => setDraft((current) => ({ ...current, first_name: event.target.value }))}
                  className="h-11 w-full rounded-md border border-clinical-line px-3 text-sm focus:border-clinical-blue"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-clinical-slate">Last name</span>
                <input
                  value={draft.last_name}
                  onChange={(event) => setDraft((current) => ({ ...current, last_name: event.target.value }))}
                  className="h-11 w-full rounded-md border border-clinical-line px-3 text-sm focus:border-clinical-blue"
                  required
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm text-clinical-slate">Username</span>
                <input
                  value={draft.username}
                  onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))}
                  className="h-11 w-full rounded-md border border-clinical-line px-3 text-sm focus:border-clinical-blue"
                  autoComplete="username"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-clinical-slate">Password</span>
                <span className="relative block">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={draft.password}
                    onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))}
                    type="password"
                    className="h-11 w-full rounded-md border border-clinical-line pl-9 pr-3 text-sm focus:border-clinical-blue"
                    autoComplete="new-password"
                    required
                  />
                </span>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm text-clinical-slate">Role</span>
                <select
                  value={draft.role}
                  onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as RegisterPayload["role"] }))}
                  className="h-11 w-full rounded-md border border-clinical-line bg-white px-3 text-sm focus:border-clinical-blue"
                >
                  <option value="HEAD_PHYSICIAN">Head physician</option>
                  <option value="HOSPITAL_ADMIN">Hospital admin</option>
                  <option value="PHYSICIAN">Physician</option>
                  <option value="NURSE">Nurse</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-clinical-slate">Email</span>
                <input
                  value={draft.email}
                  onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                  type="email"
                  className="h-11 w-full rounded-md border border-clinical-line px-3 text-sm focus:border-clinical-blue"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm text-clinical-slate">Phone</span>
                <input
                  value={draft.phone_number}
                  onChange={(event) => setDraft((current) => ({ ...current, phone_number: event.target.value }))}
                  className="h-11 w-full rounded-md border border-clinical-line px-3 text-sm focus:border-clinical-blue"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-clinical-slate">License number</span>
                <input
                  value={draft.license_number}
                  onChange={(event) => setDraft((current) => ({ ...current, license_number: event.target.value }))}
                  className="h-11 w-full rounded-md border border-clinical-line px-3 text-sm focus:border-clinical-blue"
                />
              </label>
            </div>
          </section>

          <div className="flex flex-col gap-3 border-t border-clinical-line pt-5 sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
            <span className="inline-flex items-center gap-2 text-sm text-clinical-slate">
              <ClipboardCheck className="h-4 w-4 text-clinical-green" />
              Backend tenant and staff role will be created immediately.
            </span>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-clinical-blue px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <UserPlus className="h-4 w-4" />
              {submitting ? "Creating..." : "Create account"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

