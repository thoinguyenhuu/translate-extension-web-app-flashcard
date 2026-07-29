import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { calculateNextReview, saveReview, updateWordSchedule, markRemembered } from "../lib/spaced-repetition";
import { buildQuizQuestion, shuffle } from "../utils/quiz";
import Flashcard from "../components/Flashcard";
import Quiz from "../components/Quiz";
import ConfirmDialog from "../components/ConfirmDialog";

const DIFFICULTY_WEIGHTS = { easy: 1, medium: 2, hard: 4 };

const COPY = {
  rememberedLabel: "Remembered",
  badgeFlashcard: "Flashcard",
  badgeQuiz: "Quiz",
  remainingSuffix: "words remaining",
  deleteDone: "Đã xóa",
  btnEasy: "Dễ",
  btnMedium: "Trung bình",
  btnHard: "Khó",
  btnRemembered: "Đã nhớ",
  msgCorrect: "Đúng rồi!",
  msgQuiz: "Chọn đáp án đúng.",
  msgFlashcard: "Lật thẻ để xem nghĩa.",
  dialogTitle: "Xóa từ",
  dialogCancel: "Hủy",
  dialogConfirm: "Xóa",
  dialogBusy: "Đang xóa..."
};

function normalizeItem(item) {
  if (!item || typeof item !== "object") return null;
  const word = String(item.word || "").trim();
  const pos = String(item.pos || "unknown").trim();
  const mainMeaning = String(item.mainMeaning || item.main_meaning || item.meaning || "").trim();
  const meanings = Array.isArray(item.meanings)
    ? item.meanings.map(m => String(m || "").trim()).filter(Boolean).slice(0, 3)
    : [];
  if (!word || !mainMeaning) return null;
  if (!meanings.length) meanings.push(mainMeaning);
  return { word, pos, mainMeaning, meanings, id: item.id, easeFactor: item.ease_factor || 2.5, reviewInterval: item.review_interval_days || 0, nextReviewDate: item.next_review_date };
}

function pickWord(words, learnedMap, difficultyMap, previousWord = "") {
  const active = words.filter(w => !learnedMap[w.word]);
  if (!active.length) return null;
  const weighted = active.map(w => ({
    item: w,
    weight: (DIFFICULTY_WEIGHTS[difficultyMap[w.word] || "medium"] || 2) * (previousWord === w.word ? 0.35 : 1)
  }));
  const total = weighted.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of weighted) { r -= e.weight; if (r <= 0) return e.item; }
  return weighted[weighted.length - 1].item;
}

function makeRound(words, learnedMap, difficultyMap, prev = "") {
  const w = pickWord(words, learnedMap, difficultyMap, prev);
  if (!w) return null;
  if (words.length >= 4 && Math.random() < 0.5) {
    const q = buildQuizQuestion(words, w.word);
    if (q) return { type: "quiz", word: w.word, question: q };
  }
  return { type: "flashcard", word: w.word };
}

export default function StudyPage() {
  const [vocab, setVocab] = useState([]);
  const [round, setRound] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [learned, setLearned] = useState({});
  const [difficulty, setDifficulty] = useState({});
  const [confirming, setConfirming] = useState("");
  const [deleting, setDeleting] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const { data, error: fetchErr } = await supabase
          .from("vocabulary")
          .select("id, word, pos, meaning, main_meaning, meanings, ease_factor, review_interval_days, next_review_date")
          .order("next_review_date", { ascending: true, nullsFirst: false });

        if (fetchErr) throw fetchErr;
        const items = shuffle((data || []).map(normalizeItem).filter(Boolean));
        if (!mounted) return;
        setVocab(items);
        setRound(makeRound(items, {}, {}));
      } catch (e) {
        if (!mounted) return;
        setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const card = useMemo(() => vocab.find(v => v.word === round?.word) || null, [round, vocab]);
  const remembered = vocab.reduce((c, v) => learned[v.word] ? c + 1 : c, 0);
  const pct = vocab.length ? Math.round((remembered / vocab.length) * 100) : 0;
  const curDiff = difficulty[card?.word] || "medium";
  const correct = round?.type === "quiz" && selected && selected === round?.question?.correctAnswer;

  const next = useCallback((l, d) => {
    setRound(makeRound(vocab, l || learned, d || difficulty, round?.word || ""));
    setFlipped(false);
    setSelected("");
  }, [vocab, round, learned, difficulty]);

  async function rateWord(level) {
    if (!card) return;
    try {
      const sched = calculateNextReview(level, card.easeFactor, card.reviewInterval);
      await saveReview(supabase, card.id, "review", level);
      await updateWordSchedule(supabase, card.id, sched.easeFactor, sched.reviewInterval, sched.nextReviewDate);

      const nextDiff = { ...difficulty, [card.word]: level };
      setDifficulty(nextDiff);
      setFeedback(`"${card.word}" → ${level}`);
      next(learned, nextDiff);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleRemembered() {
    if (!card) return;
    try {
      await saveReview(supabase, card.id, "remembered", null);
      await markRemembered(supabase, card.id);
      const nextLearned = { ...learned, [card.word]: true };
      setLearned(nextLearned);
      setFeedback(`"${card.word}" marked remembered`);
      next(nextLearned, difficulty);
    } catch (e) {
      setError(e.message);
    }
  }

  function handleFlip() {
    if (!card || round?.type !== "flashcard") return;
    setFlipped(v => !v);
  }

  function handleSelect(a) {
    if (!round?.question || selected) return;
    setSelected(a);
  }

  async function handleDelete() {
    if (!confirming || deleting) return;
    const word = confirming;
    try {
      setDeleting(word);
      await supabase.from("vocabulary").delete().eq("word", word);
      setVocab(prev => {
        const next = prev.filter(v => v.word !== word);
        const nl = { ...learned }; delete nl[word];
        const nd = { ...difficulty }; delete nd[word];
        setLearned(nl); setDifficulty(nd);
        setRound(makeRound(next, nl, nd, word));
        setFlipped(false); setSelected("");
        return next;
      });
      setFeedback(`${COPY.deleteDone} "${word}"`);
      setConfirming("");
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting("");
    }
  }

  if (loading) return <p className="banner">Loading vocabulary...</p>;
  if (error) return <p className="banner banner-error">{error}</p>;

  if (!card) {
    return (
      <section className="empty-state">
        <p className="empty-kicker">Session complete</p>
        <h2 className="empty-title">All words are remembered</h2>
        <p className="empty-copy">Add more vocabulary from the extension to start another study round.</p>
      </section>
    );
  }

  return (
    <>
      <section className="progress-panel">
        <div className="progress-copy">
          <span className="progress-label">{COPY.rememberedLabel}</span>
          <span className="progress-value">{remembered} / {vocab.length}</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="study-meta">
          <span className="study-badge">{round?.type === "quiz" ? COPY.badgeQuiz : COPY.badgeFlashcard}</span>
          <span className="study-meta-copy">{vocab.length - remembered} {COPY.remainingSuffix}</span>
        </div>
      </section>

      {round?.type === "flashcard" ? (
        <Flashcard item={card} isLearned={!!learned[card.word]} isFlipped={flipped} onFlip={handleFlip} onDelete={setConfirming} />
      ) : (
        <Quiz question={round.question} selectedAnswer={selected} onSelectAnswer={handleSelect} onDelete={setConfirming} />
      )}

      <section className="review-actions-panel">
        <p className={`quiz-inline-feedback ${correct ? "is-correct" : selected ? "is-wrong" : ""}`}>
          {round?.type === "quiz"
            ? selected
              ? correct ? COPY.msgCorrect : `Đáp án: ${round.question.correctAnswer}`
              : COPY.msgQuiz
            : COPY.msgFlashcard}
        </p>
        <div className="review-actions">
          {["easy", "medium", "hard"].map(l => (
            <button key={l} type="button"
              className={`review-button review-button-ghost ${curDiff === l ? "is-active" : ""}`}
              onClick={() => rateWord(l)}>
              <span className={`review-button-icon review-button-icon-${l}`} aria-hidden="true">
                {l === "easy" ? "☺" : l === "medium" ? "☻" : "✖"}
              </span>
              <span className="review-button-text">{l === "easy" ? COPY.btnEasy : l === "medium" ? COPY.btnMedium : COPY.btnHard}</span>
            </button>
          ))}
          <button type="button" className="review-button review-button-primary" onClick={handleRemembered}>
            <span className="review-button-icon review-button-icon-remembered" aria-hidden="true">≫</span>
            <span className="review-button-text">{COPY.btnRemembered}</span>
          </button>
        </div>
      </section>

      {feedback ? <p className="banner banner-success">{feedback}</p> : null}

      <ConfirmDialog
        isOpen={!!confirming}
        title={COPY.dialogTitle}
        description={confirming ? `Xóa "${confirming}" khỏi danh sách?` : ""}
        cancelLabel={deleting ? COPY.dialogBusy : COPY.dialogCancel}
        confirmLabel={COPY.dialogConfirm}
        onCancel={() => setConfirming("")}
        onConfirm={handleDelete}
        isBusy={!!deleting}
      />
    </>
  );
}
