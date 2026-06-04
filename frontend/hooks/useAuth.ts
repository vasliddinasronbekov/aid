"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { getCurrentUser, logoutUser } from "@/lib/api";
import type { AuthUser, StaffRole } from "@/lib/api";

interface UseAuthGateOptions {
  allowedRoles?: StaffRole[];
}

export function useAuthGate(options: UseAuthGateOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const allowedRolesKey = options.allowedRoles?.join(",") ?? "";

  useEffect(() => {
    let active = true;

    setLoading(true);
    getCurrentUser()
      .then((currentUser) => {
        if (!active) {
          return;
        }
        const role = currentUser.staff_profile?.role;
        const allowedRoles = allowedRolesKey ? (allowedRolesKey.split(",") as StaffRole[]) : [];
        if (allowedRoles.length && !currentUser.is_superuser && (!role || !allowedRoles.includes(role))) {
          router.replace("/doctor");
          return;
        }
        setUser(currentUser);
        setError("");
      })
      .catch((authError) => {
        if (!active) {
          return;
        }
        setError(authError instanceof Error ? authError.message : "Authentication required.");
        router.replace(`/login?next=${encodeURIComponent(pathname || "/doctor")}`);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [allowedRolesKey, pathname, router]);

  const signOut = useCallback(async () => {
    await logoutUser();
    setUser(null);
    router.replace("/login");
  }, [router]);

  return { user, loading, error, signOut };
}
