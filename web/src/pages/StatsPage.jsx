import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function StatsPage() {
  const [stats, setStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        // User stats
        const { data: statsData } = await supabase
          .from("user_stats")
          .select("*")
          .single();

        // Reviews per day (last 7 days)
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const { data: reviewData } = await supabase
          .from("study_log")
          .select("reviewed_at, action")
          .gte("reviewed_at", weekAgo)
          .order("reviewed_at", { ascending: true });

        // Word count
        const { count: wordCount } = await supabase
          .from("vocabulary")
          .select("*", { count: "exact", head: true });

        if (!mounted) return;

        // Build daily chart data
        const dayMap = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000);
          const key = d.toISOString().split("T")[0];
          dayMap[key] = { date: d.toLocaleDateString("en", { weekday: "short" }), reviews: 0, remembered: 0 };
        }
        for (const r of reviewData || []) {
          const key = new Date(r.reviewed_at).toISOString().split("T")[0];
          if (dayMap[key]) {
            dayMap[key].reviews++;
            if (r.action === "remembered") dayMap[key].remembered++;
          }
        }
        setReviews(Object.values(dayMap));
        setStats({
          totalWords: wordCount || 0,
          currentStreak: statsData?.current_streak || 0,
          longestStreak: statsData?.longest_streak || 0,
          totalReviews: statsData?.total_reviews || 0
        });
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  if (loading) return <p className="banner">Loading stats...</p>;

  return (
    <section className="stats-page">
      <header className="hero" style={{ marginBottom: 20, textAlign: "left" }}>
        <p className="eyebrow">Statistics</p>
        <h1 className="hero-title" style={{ fontSize: 28 }}>Your progress</h1>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{stats?.totalWords || 0}</span>
          <span className="stat-label">Words saved</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats?.currentStreak || 0}</span>
          <span className="stat-label">Day streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats?.longestStreak || 0}</span>
          <span className="stat-label">Best streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats?.totalReviews || 0}</span>
          <span className="stat-label">Total reviews</span>
        </div>
      </div>

      <div className="chart-card">
        <h3 className="chart-title">Reviews last 7 days</h3>
        {reviews.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={reviews}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="reviews" fill="#2563eb" radius={[6, 6, 0, 0]} name="Reviews" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="banner" style={{ marginTop: 12 }}>No reviews yet this week.</p>
        )}
      </div>
    </section>
  );
}
