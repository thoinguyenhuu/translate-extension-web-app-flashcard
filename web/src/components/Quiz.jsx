export default function Quiz({ question, selectedAnswer, onSelectAnswer, onDelete }) {
  const isAnswered = Boolean(selectedAnswer);

  return (
    <section className="quiz-shell">
      <button
        type="button"
        className="delete-button"
        onClick={() => onDelete(question.word)}
        aria-label={`Delete ${question.word}`}
        title="Delete word"
      >
        <svg viewBox="0 0 24 24" className="delete-icon" aria-hidden="true">
          <path
            d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h2v8H7V9Zm4 0h2v8h-2V9Zm4 0h2v8h-2V9ZM6 21l-1-14h14l-1 14H6Z"
            fill="currentColor"
          />
        </svg>
      </button>

      <section className="quiz-card">
        <div className="quiz-header">
          <p className="card-kicker">Quiz</p>
          <span className="quiz-count">Choose 1 answer</span>
        </div>

        <div className="quiz-body">
          <h2 className="card-word">{question.word}</h2>
          <p className="card-pos">{question.pos}</p>
        </div>

        <div className="quiz-options">
          {question.options.map((option) => {
            const isSelected = selectedAnswer === option;
            const isCorrectOption = option === question.correctAnswer;

            let optionClassName = "quiz-option";

            if (isAnswered && isCorrectOption) {
              optionClassName += " is-correct";
            } else if (isAnswered && isSelected && !isCorrectOption) {
              optionClassName += " is-wrong";
            }

            return (
              <button
                key={`${question.word}-${option}`}
                type="button"
                className={optionClassName}
                onClick={() => onSelectAnswer(option)}
                disabled={isAnswered}
              >
                {option}
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}
