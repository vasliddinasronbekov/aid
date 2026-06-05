"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BarChart3, Bot, ClipboardList, LogOut, ShieldAlert } from "lucide-react";

import { useAuthGate } from "@/hooks/useAuth";

const adminNav = [
  { href: "/admin/records", label: "Records", icon: ClipboardList },
  { href: "/admin/ai-safety", label: "AI safety", icon: ShieldAlert },
  { href: "/admin/ranks", label: "Doctor ranks", icon: BarChart3 },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuthGate({
    allowedRoles: ["SYSTEM_ADMIN", "HOSPITAL_ADMIN", "HEAD_PHYSICIAN", "COMPLIANCE_OFFICER", "AUDITOR"],
  });

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-clinical-wash px-4 text-clinical-ink">
        <div className="rounded-md border border-clinical-line bg-white px-5 py-4 text-sm text-clinical-slate shadow-sm">
          Admin workspace loading
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-clinical-wash text-clinical-ink">
      <aside className="border-b border-clinical-line bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-clinical-line px-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-clinical-ink text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-clinical-ink">AID Admin</h1>
              <p className="text-xs text-clinical-slate">Head doctor workspace</p>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto px-3 py-3 lg:flex-col lg:overflow-visible">
            {adminNav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex min-w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold lg:min-w-0 ${
                    active
                      ? "border-clinical-blue bg-blue-50 text-clinical-blue"
                      : "border-transparent text-clinical-slate hover:border-clinical-line hover:bg-slate-50 hover:text-clinical-ink"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto hidden border-t border-clinical-line p-3 lg:block">
            <div className="rounded-md border border-clinical-line px-3 py-2">
              <p className="text-sm font-semibold text-clinical-ink">{user?.display_name || user?.username || "Admin"}</p>
              <p className="mt-1 text-xs text-clinical-slate">{user?.staff_profile?.role || "Workspace access"}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-clinical-line px-3 py-2 text-sm font-semibold text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <section className="lg:pl-64">
        <header className="hidden border-b border-clinical-line bg-white px-6 py-4 lg:block">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-clinical-ink">{user?.staff_profile?.organization_name || "Admin panel"}</p>
              <p className="text-xs text-clinical-slate">{user?.staff_profile?.primary_hospital_name || "Clinical governance"}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-2 rounded-md border border-clinical-line px-3 py-2 text-sm font-semibold text-clinical-slate hover:border-clinical-blue hover:text-clinical-blue"
            >
              <LogOut className="h-4 w-4" />
              {user?.display_name || user?.username || "Account"}
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">{children}</div>
      </section>
    </main>
  );
}
