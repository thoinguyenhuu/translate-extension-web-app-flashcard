export default function Flashcard({ item, isLearned, isFlipped, onFlip, onDelete }) {
  return (
    <section className="flashcard-shell">
      <button
        type="button"
        className="delete-button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(item.word);
        }}
        aria-label={`Delete ${item.word}`}
        title="Delete word"
      >
        <svg viewBox="0 0 24 24" className="delete-icon" aria-hidden="true">
          <path
            d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h2v8H7V9Zm4 0h2v8h-2V9Zm4 0h2v8h-2V9ZM6 21l-1-14h14l-1 14H6Z"
            fill="currentColor"
          />
        </svg>
      </button>

      <button
        type="button"
        className="flashcard"
        onClick={onFlip}
        aria-label={`Flashcard for ${item.word}`}
      >
        <div className={`flashcard-inner ${isFlipped ? "is-flipped" : ""}`}>
          <article className="flashcard-face flashcard-front">
            <div className="card-topline">
              <p className="card-kicker">Front</p>
              <span className={`card-status ${isLearned ? "is-learned" : "is-new"}`}>
                {isLearned ? "Learned" : "New"}
              </span>
            </div>
            <div className="card-body">
              <h2 className="card-word">{item.word}</h2>
              <p className="card-pos">{item.pos}</p>
            </div>
            <p className="card-hint">Tap to reveal meaning</p>
          </article>

          <article className="flashcard-face flashcard-back">
            <div className="card-topline">
              <p className="card-kicker">Back</p>
              <span className={`card-status ${isLearned ? "is-learned" : "is-new"}`}>
                {isLearned ? "Learned" : "New"}
              </span>
            </div>
            <div className="card-body">
              <p className="card-main-meaning">{item.mainMeaning}</p>
              <ul className="card-meaning-list">
                {item.meanings.map((meaning) => (
                  <li key={`${item.word}-${meaning}`}>{meaning}</li>
                ))}
              </ul>
            </div>
            <p className="card-hint">Tap to flip back</p>
          </article>
        </div>
      </button>
    </section>
  );
}
