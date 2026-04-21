// ─────────────────────────────────────────────────────────────────────────────
// AuthContext.tsx — Britium Express Authentication Provider
// Uses Supabase Auth + user_profiles table for role resolution
// ─────────────────────────────────────────────────────────────────────────────
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "../lib/supabaseClient";
import { ROLE_PORTALS } from "../lib/config";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BritiumUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  status: string;
  position?: string;
  branch_location?: string;
  must_change_password: boolean;
  avatar_url?: string;
  language_preference: string;
  created_at: string;
}

interface AuthState {
  user: BritiumUser | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  portalRoute: string;
}

interface LoginResult {
  success: boolean;
  user?: BritiumUser;
  error?: string;
  must_change_password?: boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Profile loader ────────────────────────────────────────────────────────────
async function loadProfile(userId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function buildUser(
  authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> },
  profile: Record<string, unknown> | null
): BritiumUser {
  const role = String(profile?.role ?? "rider").toLowerCase();
  return {
    id: authUser.id,
    email: String(authUser.email ?? profile?.email ?? ""),
    full_name: String(
      profile?.full_name ??
        (authUser.user_metadata as Record<string, unknown>)?.full_name ??
        ""
    ),
    phone: profile?.phone ? String(profile.phone) : undefined,
    role,
    status: String(profile?.status ?? "active"),
    position: profile?.position ? String(profile.position) : undefined,
    branch_location: profile?.branch_location
      ? String(profile.branch_location)
      : undefined,
    must_change_password: Boolean(
      profile?.must_change_password ?? profile?.force_password_change ?? false
    ),
    avatar_url: profile?.avatar_url ? String(profile.avatar_url) : undefined,
    language_preference: String(profile?.language_preference ?? "en"),
    created_at: String(profile?.created_at ?? new Date().toISOString()),
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  const hydrateSession = useCallback(
    async (session: { user?: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | null) => {
      if (!session?.user) {
        setState({ user: null, loading: false });
        return;
      }
      try {
        const profile = await loadProfile(session.user.id);
        const user = buildUser(session.user, profile);
        setState({ user, loading: false });
      } catch (err) {
        console.error("[AuthContext] Failed to load profile:", err);
        // Fallback – keep auth but with minimal data
        setState({
          user: buildUser(session.user, null),
          loading: false,
        });
      }
    },
    []
  );

  // Boot: restore existing session
  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (mounted) await hydrateSession(session);
    })();

    // Subscribe to auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (mounted) await hydrateSession(session);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [hydrateSession]);

  // ── login ───────────────────────────────────────────────────────────────────
  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw new Error(error.message);
        if (!data.user || !data.session) throw new Error("No session returned.");

        const profile = await loadProfile(data.user.id);
        const user = buildUser(data.user, profile);
        setState({ user, loading: false });

        return {
          success: true,
          user,
          must_change_password: user.must_change_password,
        };
      } catch (err) {
        setState((s) => ({ ...s, loading: false }));
        return {
          success: false,
          error: err instanceof Error ? err.message : "Login failed",
        };
      }
    },
    []
  );

  // ── logout ──────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ user: null, loading: false });
    window.location.href = "/login";
  }, []);

  // ── refreshUser ─────────────────────────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) await hydrateSession(session);
  }, [hydrateSession]);

  const portalRoute =
    (state.user ? ROLE_PORTALS[state.user.role] : null) ?? "/login";

  return (
    <AuthContext.Provider
      value={{ ...state, login, logout, refreshUser, portalRoute }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export default AuthContext;
