import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "./components/ConfirmDialog";
import Flashcard from "./components/Flashcard";
import Quiz from "./components/Quiz";
import { buildQuizQuestion, shuffle } from "./utils/quiz";

const sampleVocabulary = [
  {
    word: "pursue",
    pos: "verb",
    mainMeaning: "theo duoi",
    meanings: [
      "to follow a goal",
      "to chase",
      "to continue doing something"
    ]
  },
  {
    word: "ceremony",
    pos: "noun",
    mainMeaning: "nghi le",
    meanings: [
      "a formal public event",
      "an act performed on a special occasion",
      "a ritual with symbolic meaning"
    ]
  },
  {
    word: "steady",
    pos: "adjective",
    mainMeaning: "on dinh",
    meanings: [
      "firmly fixed or not shaking",
      "regular and controlled",
      "continuing without interruption"
    ]
  },
  {
    word: "delay",
    pos: "verb",
    mainMeaning: "tri hoan",
    meanings: [
      "to make something happen later",
      "to postpone action",
      "to cause something to be slower"
    ]
  }
];

const DIFFICULTY_WEIGHTS = {
  easy: 1,
  medium: 2,
  hard: 4
};

const COPY = {
  rememberedLabel: "Remembered",
  studyBadgeFlashcard: "Flashcard",
  studyBadgeQuiz: "Quiz",
  rotationSuffix: "words still in rotation",
  deleteSuccessPrefix: "\u0110\u00e3 x\u00f3a",
  difficultyEasy: "D\u1ec5",
  difficultyMedium: "Trung b\u00ecnh",
  difficultyHard: "Kh\u00f3",
  rememberedButton: "\u0110\u00e3 nh\u1edb",
  quizCorrect: "\u0110\u00fang r\u1ed3i. B\u1ea1n c\u00f3 th\u1ec3 \u0111\u00e1nh gi\u00e1 \u0111\u1ed9 kh\u00f3 ho\u1eb7c \u0111\u00e1nh d\u1ea5u \u0111\u00e3 nh\u1edb.",
  quizPrompt: "B\u1ea1n c\u00f3 th\u1ec3 tr\u1ea3 l\u1eddi ho\u1eb7c \u0111\u00e1nh gi\u00e1 t\u1eeb n\u00e0y b\u1ea5t k\u1ef3 l\u00fac n\u00e0o.",
  flashcardPrompt: "B\u1ea1n c\u00f3 th\u1ec3 \u0111\u00e1nh gi\u00e1 t\u1eeb n\u00e0y ngay c\u1ea3 khi ch\u01b0a l\u1eadt th\u1ebb.",
  dialogTitle: "X\u00f3a t\u1eeb v\u1ef1ng",
  dialogCancel: "H\u1ee7y",
  dialogConfirm: "X\u00f3a",
  dialogBusy: "\u0110ang x\u00f3a..."
};

function normalizeVocabularyItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const word = String(item.word || "").trim();
  const pos = String(item.pos || "unknown").trim();
  const mainMeaning = String(item.mainMeaning || item.main_meaning || item.meaning || "").trim();
  const meanings = Array.isArray(item.meanings)
    ? item.meanings.map((meaning) => String(meaning || "").trim()).filter(Boolean).slice(0, 3)
    : [];

  if (!word || !mainMeaning) {
    return null;
  }

  if (!meanings.length) {
    meanings.push(mainMeaning);
  }

  return {
    word,
    pos,
    mainMeaning,
    meanings
  };
}

async function fetchVocabulary() {
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const supabaseKey = import.meta.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return sampleVocabulary;
  }

  const url = new URL("/rest/v1/vocabulary", supabaseUrl);
  url.searchParams.set("select", "word,pos,meaning,main_meaning,meanings");
  url.searchParams.set("order", "created_at.desc");

  const response = await fetch(url.toString(), {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`Unable to load vocabulary (${response.status}).`);
  }

  const rows = await response.json();
  const normalizedRows = rows.map(normalizeVocabularyItem).filter(Boolean);

  return normalizedRows.length ? normalizedRows : [];
}

async function deleteVocabularyWord(word) {
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const supabaseKey = import.meta.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase is not configured for delete.");
  }

  const url = new URL("/rest/v1/vocabulary", supabaseUrl);
  url.searchParams.set("word", `eq.${word}`);

  const response = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`Unable to delete "${word}" (${response.status}).`);
  }
}

function pickWeightedWord(words, learnedMap, difficultyMap, previousWord = "") {
  const activeWords = words.filter((item) => !learnedMap[item.word]);

  if (!activeWords.length) {
    return null;
  }

  const weightedWords = activeWords.map((item) => {
    const difficulty = difficultyMap[item.word] || "medium";
    let weight = DIFFICULTY_WEIGHTS[difficulty] || DIFFICULTY_WEIGHTS.medium;

    if (activeWords.length > 1 && item.word === previousWord) {
      weight *= 0.35;
    }

    return { item, weight };
  });

  const totalWeight = weightedWords.reduce((sum, entry) => sum + entry.weight, 0);
  let randomValue = Math.random() * totalWeight;

  for (const entry of weightedWords) {
    randomValue -= entry.weight;

    if (randomValue <= 0) {
      return entry.item;
    }
  }

  return weightedWords[weightedWords.length - 1].item;
}

function createStudyRound(words, learnedMap, difficultyMap, previousWord = "") {
  const nextWord = pickWeightedWord(words, learnedMap, difficultyMap, previousWord);

  if (!nextWord) {
    return null;
  }

  const promptType = words.length >= 4 && Math.random() < 0.5 ? "quiz" : "flashcard";

  if (promptType === "quiz") {
    const question = buildQuizQuestion(words, nextWord.word);

    if (question) {
      return {
        type: "quiz",
        word: nextWord.word,
        question
      };
    }
  }

  return {
    type: "flashcard",
    word: nextWord.word
  };
}

export default function App() {
  const [vocabulary, setVocabulary] = useState(sampleVocabulary);
  const [currentRound, setCurrentRound] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [learnedMap, setLearnedMap] = useState({});
  const [difficultyMap, setDifficultyMap] = useState({});
  const [deletingWord, setDeletingWord] = useState("");
  const [confirmingWord, setConfirmingWord] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadVocabulary() {
      try {
        setIsLoading(true);
        setError("");
        const items = shuffle(await fetchVocabulary());

        if (!isMounted) {
          return;
        }

        setVocabulary(items);
        setLearnedMap({});
        setDifficultyMap({});
        setCurrentRound(createStudyRound(items, {}, {}));
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        const fallbackItems = shuffle(sampleVocabulary);
        setVocabulary(fallbackItems);
        setLearnedMap({});
        setDifficultyMap({});
        setCurrentRound(createStudyRound(fallbackItems, {}, {}));
        setError(loadError.message || "Unable to load vocabulary.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadVocabulary();

    return () => {
      isMounted = false;
    };
  }, []);

  const currentCard = useMemo(
    () => vocabulary.find((item) => item.word === currentRound?.word) || null,
    [currentRound, vocabulary]
  );

  const totalCards = vocabulary.length;
  const rememberedCount = vocabulary.reduce(
    (count, item) => (learnedMap[item.word] ? count + 1 : count),
    0
  );
  const remainingCount = totalCards - rememberedCount;
  const progressPercent = totalCards ? Math.round((rememberedCount / totalCards) * 100) : 0;
  const currentDifficulty = currentCard ? difficultyMap[currentCard.word] || "medium" : "medium";
  const quizAnsweredCorrectly =
    currentRound?.type === "quiz" &&
    selectedAnswer &&
    selectedAnswer === currentRound.question.correctAnswer;

  function goToNextRound(nextLearnedMap = learnedMap, nextDifficultyMap = difficultyMap) {
    const nextRound = createStudyRound(
      vocabulary,
      nextLearnedMap,
      nextDifficultyMap,
      currentRound?.word || ""
    );
    setCurrentRound(nextRound);
    setIsFlipped(false);
    setSelectedAnswer("");
  }

  function handleFlip() {
    if (!currentCard || currentRound?.type !== "flashcard") {
      return;
    }

    setIsFlipped((value) => !value);
  }

  function handleAnswerSelect(answer) {
    if (!currentRound?.question || selectedAnswer) {
      return;
    }

    setSelectedAnswer(answer);
  }

  function handleDeleteRequest(word) {
    if (deletingWord) {
      return;
    }

    setConfirmingWord(word);
  }

  function handleDeleteCancel() {
    if (deletingWord) {
      return;
    }

    setConfirmingWord("");
  }

  async function handleDeleteConfirm() {
    if (!confirmingWord || deletingWord) {
      return;
    }

    const word = confirmingWord;

    try {
      setDeletingWord(word);
      setError("");
      setFeedback("");
      await deleteVocabularyWord(word);

      setVocabulary((items) => {
        const nextItems = items.filter((item) => item.word !== word);
        const nextLearnedMap = { ...learnedMap };
        const nextDifficultyMap = { ...difficultyMap };

        delete nextLearnedMap[word];
        delete nextDifficultyMap[word];

        setLearnedMap(nextLearnedMap);
        setDifficultyMap(nextDifficultyMap);
        setCurrentRound(createStudyRound(nextItems, nextLearnedMap, nextDifficultyMap, word));
        setIsFlipped(false);
        setSelectedAnswer("");

        return nextItems;
      });

      setFeedback(`${COPY.deleteSuccessPrefix} "${word}" kh\u1ecfi Supabase.`);
      setConfirmingWord("");
    } catch (deleteError) {
      setError(deleteError.message || `Unable to delete "${word}".`);
    } finally {
      setDeletingWord("");
    }
  }

  function handleSetDifficulty(level) {
    if (!currentCard) {
      return;
    }

    const nextDifficultyMap = {
      ...difficultyMap,
      [currentCard.word]: level
    };

    setDifficultyMap(nextDifficultyMap);
    setFeedback(`"${currentCard.word}" set to ${level}.`);
    goToNextRound(learnedMap, nextDifficultyMap);
  }

  function handleRemembered() {
    if (!currentCard) {
      return;
    }

    const nextLearnedMap = {
      ...learnedMap,
      [currentCard.word]: true
    };

    setLearnedMap(nextLearnedMap);
    setFeedback(`"${currentCard.word}" marked as remembered.`);
    goToNextRound(nextLearnedMap, difficultyMap);
  }

  return (
    <>
      <main className="app-shell">
        <section className="app-frame">
          <header className="hero">
            <p className="eyebrow">Vocabulary Review</p>
            <h1 className="hero-title">Mixed study flow for vocabulary recall</h1>
            <p className="hero-copy">
              Flashcards and quiz prompts appear in random order. Keep rating each word until
              you finally mark it as remembered.
            </p>
          </header>

          {error ? <p className="banner banner-error">{error}</p> : null}
          {feedback ? <p className="banner banner-success">{feedback}</p> : null}
          {isLoading ? <p className="banner">Loading vocabulary...</p> : null}

          {!isLoading && currentCard ? (
            <>
              <section className="progress-panel" aria-label="Study progress">
                <div className="progress-copy">
                  <span className="progress-label">{COPY.rememberedLabel}</span>
                  <span className="progress-value">
                    {rememberedCount} / {totalCards}
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="study-meta">
                  <span className="study-badge">
                    {currentRound?.type === "quiz" ? COPY.studyBadgeQuiz : COPY.studyBadgeFlashcard}
                  </span>
                  <span className="study-meta-copy">
                    {remainingCount} {COPY.rotationSuffix}
                  </span>
                </div>
              </section>

              {currentRound?.type === "flashcard" ? (
                <Flashcard
                  key={`${currentCard.word}-${currentRound.type}`}
                  item={currentCard}
                  isLearned={Boolean(learnedMap[currentCard.word])}
                  isFlipped={isFlipped}
                  onFlip={handleFlip}
                  onDelete={handleDeleteRequest}
                />
              ) : (
                <Quiz
                  key={`${currentCard.word}-${currentRound.type}`}
                  question={currentRound.question}
                  selectedAnswer={selectedAnswer}
                  onSelectAnswer={handleAnswerSelect}
                  onDelete={handleDeleteRequest}
                />
              )}

              <section className="review-actions-panel">
                <p
                  className={`quiz-inline-feedback ${quizAnsweredCorrectly ? "is-correct" : selectedAnswer ? "is-wrong" : ""}`}
                >
                  {currentRound?.type === "quiz"
                    ? selectedAnswer
                      ? quizAnsweredCorrectly
                        ? COPY.quizCorrect
                        : `\u0110\u00e1p \u00e1n \u0111\u00fang: ${currentRound.question.correctAnswer}`
                      : COPY.quizPrompt
                    : COPY.flashcardPrompt}
                </p>

                <div className="review-actions">
                  <button
                    type="button"
                    className={`review-button review-button-ghost ${currentDifficulty === "easy" ? "is-active" : ""}`}
                    onClick={() => handleSetDifficulty("easy")}
                  >
                    <span className="review-button-icon review-button-icon-easy" aria-hidden="true">
                      ☺
                    </span>
                    <span className="review-button-text">{COPY.difficultyEasy}</span>
                  </button>
                  <button
                    type="button"
                    className={`review-button review-button-ghost ${currentDifficulty === "medium" ? "is-active" : ""}`}
                    onClick={() => handleSetDifficulty("medium")}
                  >
                    <span className="review-button-icon review-button-icon-medium" aria-hidden="true">
                      ☻
                    </span>
                    <span className="review-button-text">{COPY.difficultyMedium}</span>
                  </button>
                  <button
                    type="button"
                    className={`review-button review-button-ghost ${currentDifficulty === "hard" ? "is-active" : ""}`}
                    onClick={() => handleSetDifficulty("hard")}
                  >
                    <span className="review-button-icon review-button-icon-hard" aria-hidden="true">
                      ✖
                    </span>
                    <span className="review-button-text">{COPY.difficultyHard}</span>
                  </button>
                  <button
                    type="button"
                    className="review-button review-button-primary"
                    onClick={handleRemembered}
                  >
                    <span className="review-button-icon review-button-icon-remembered" aria-hidden="true">
                      ≫
                    </span>
                    <span className="review-button-text">{COPY.rememberedButton}</span>
                  </button>
                </div>
              </section>
            </>
          ) : null}

          {!isLoading && !currentCard ? (
            <section className="empty-state">
              <p className="empty-kicker">Session complete</p>
              <h2 className="empty-title">All words are remembered</h2>
              <p className="empty-copy">
                Add more vocabulary from the extension to start another study round.
              </p>
            </section>
          ) : null}
        </section>
      </main>

      <ConfirmDialog
        isOpen={Boolean(confirmingWord)}
        title={COPY.dialogTitle}
        description={
          confirmingWord
            ? `B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n x\u00f3a "${confirmingWord}" kh\u1ecfi danh s\u00e1ch \u00f4n t\u1eadp kh\u00f4ng?`
            : ""
        }
        cancelLabel={COPY.dialogCancel}
        confirmLabel={deletingWord ? COPY.dialogBusy : COPY.dialogConfirm}
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isBusy={Boolean(deletingWord)}
      />
    </>
  );
}
