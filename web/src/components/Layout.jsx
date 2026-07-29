import { NavLink } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Layout({ children }) {
  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <div className="app-layout">
      <nav className="nav-bar">
        <div className="nav-brand">
          <span className="nav-logo">V</span>
          <span className="nav-title">Vocabulary</span>
        </div>
        <div className="nav-links">
          <NavLink to="/study" className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}>
            Study
          </NavLink>
          <NavLink to="/words" className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}>
            Words
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}>
            Stats
          </NavLink>
        </div>
        <button type="button" className="nav-logout" onClick={handleLogout} title="Sign out">
          Logout
        </button>
      </nav>
      <main className="layout-content">{children}</main>
    </div>
  );
}
