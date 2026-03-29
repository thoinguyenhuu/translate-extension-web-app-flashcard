export function shuffle(items) {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[randomIndex]] = [nextItems[randomIndex], nextItems[index]];
  }

  return nextItems;
}

export function buildQuizQuestion(words, targetWord) {
  if (!Array.isArray(words) || words.length < 4) {
    return null;
  }

  const normalizedWords = words.filter((item) => item && item.word && item.mainMeaning);
  const target = normalizedWords.find((item) => item.word === targetWord);

  if (!target || normalizedWords.length < 4) {
    return null;
  }

  const distractors = shuffle(
    normalizedWords
      .filter((item) => item.word !== target.word)
      .map((item) => item.mainMeaning)
      .filter((meaning, index, array) => meaning !== target.mainMeaning && array.indexOf(meaning) === index)
  ).slice(0, 3);

  if (distractors.length < 3) {
    return null;
  }

  return {
    word: target.word,
    pos: target.pos,
    correctAnswer: target.mainMeaning,
    options: shuffle([target.mainMeaning, ...distractors])
  };
}
