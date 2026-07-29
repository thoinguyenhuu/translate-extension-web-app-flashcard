import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import LoginPage from "./LoginPage";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setIsLoading(false);
    });

    // Listen for auth state changes (e.g., after OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <main className="app-shell">
        <section className="app-frame">
          <p className="banner">Loading...</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return children;
}
