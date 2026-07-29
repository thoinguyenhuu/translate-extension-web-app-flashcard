import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginPage({ onLogin }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleLogin() {
    setIsLoading(true);
    setError("");

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin
        }
      });

      if (authError) throw authError;
    } catch (err) {
      setError(err.message || "Login failed.");
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="app-frame">
        <div className="login-card">
          <div className="login-badge">Vocabulary Learning</div>
          <h1 className="login-title">Welcome</h1>
          <p className="login-subtitle">
            Sign in to access your vocabulary and study progress.
          </p>

          {error ? <p className="banner banner-error">{error}</p> : null}

          <button
            type="button"
            className="login-google-btn"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign in with Google"}
          </button>
        </div>
      </section>
    </main>
  );
}
