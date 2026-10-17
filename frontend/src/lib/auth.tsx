import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, tokenStore, type PublicUser } from "./api";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  signedIn(token: string, user: PublicUser): void;
  signOut(): void;
  setUser(user: PublicUser): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);

  // The token lives in localStorage, which doesn't exist during SSR — so the
  // session is resolved on mount by asking the server who the token belongs to.
  useEffect(() => {
    let cancelled = false;
    if (!tokenStore.get()) {
      setStatus("anonymous");
      return;
    }
    api
      .me()
      .then(({ user: me }) => {
        if (cancelled) return;
        setUser(me);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        tokenStore.clear();
        setStatus("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signedIn = useCallback((token: string, nextUser: PublicUser) => {
    tokenStore.set(token);
    setUser(nextUser);
    setStatus("authenticated");
  }, []);

  const signOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signedIn, signOut, setUser }),
    [status, user, signedIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
