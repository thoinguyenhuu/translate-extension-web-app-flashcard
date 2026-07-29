import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export default function WordsPage() {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterPos, setFilterPos] = useState("");
  const [deleting, setDeleting] = useState(new Set());
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const { data, error: fetchErr } = await supabase
          .from("vocabulary")
          .select("id, word, pos, main_meaning, meanings, created_at")
          .order("created_at", { ascending: false });

        if (fetchErr) throw fetchErr;
        if (mounted) setWords(data || []);
      } catch (e) {
        if (mounted) setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    return words.filter(w => {
      const matchSearch = !search || w.word.toLowerCase().includes(search.toLowerCase());
      const matchPos = !filterPos || w.pos === filterPos;
      return matchSearch && matchPos;
    });
  }, [words, search, filterPos]);

  const posList = useMemo(() => [...new Set(words.map(w => w.pos))], [words]);

  async function handleDelete(word) {
    if (deleting.has(word)) return;
    try {
      setDeleting(prev => new Set(prev).add(word));
      const { error: delErr } = await supabase.from("vocabulary").delete().eq("word", word);
      if (delErr) throw delErr;
      setWords(prev => prev.filter(w => w.word !== word));
      setFeedback(`Deleted "${word}"`);
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(prev => { const n = new Set(prev); n.delete(word); return n; });
    }
  }

  if (loading) return <p className="banner">Loading...</p>;

  return (
    <section className="words-page">
      <header className="hero" style={{ marginBottom: 20, textAlign: "left" }}>
        <p className="eyebrow">Vocabulary</p>
        <h1 className="hero-title" style={{ fontSize: 28 }}>Your word list ({words.length})</h1>
      </header>

      {error ? <p className="banner banner-error">{error}</p> : null}
      {feedback ? <p className="banner banner-success">{feedback}</p> : null}

      <div className="words-filters">
        <input className="text-input" type="text" placeholder="Search words..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
        <select className="text-input select-input" value={filterPos} onChange={e => setFilterPos(e.target.value)}
          style={{ width: 140 }}>
          <option value="">All types</option>
          {posList.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="banner" style={{ marginTop: 16 }}>No words found.</p>
      ) : (
        <div className="words-list">
          {filtered.map(w => (
            <div key={w.id} className="word-row">
              <div className="word-row-main">
                <span className="word-row-word">{w.word}</span>
                <span className="pos-badge-inline">{w.pos}</span>
                <span className="word-row-meaning">{w.main_meaning}</span>
              </div>
              <div className="word-row-meta">
                {w.meanings?.length > 1 ? <span className="word-row-count">+{w.meanings.length - 1} meanings</span> : null}
                <span className="word-row-date">{new Date(w.created_at).toLocaleDateString()}</span>
              </div>
              <button type="button" className="word-row-delete" onClick={() => handleDelete(w.word)}
                disabled={deleting.has(w.word)} title="Delete">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
