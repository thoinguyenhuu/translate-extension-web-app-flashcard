// SuperMemo2 spaced repetition algorithm
// https://www.supermemo.com/en/archives1990-2015/english/ol/sm2

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

export function calculateNextReview(difficulty, currentEase, currentInterval) {
  let ease = currentEase || DEFAULT_EASE;
  let interval = currentInterval || 0;
  let quality;

  switch (difficulty) {
    case "easy":
      quality = 5;
      ease += 0.15;
      break;
    case "medium":
      quality = 3;
      // ease unchanged
      break;
    case "hard":
      quality = 1;
      ease -= 0.2;
      break;
    default:
      quality = 3;
  }

  ease = Math.max(ease, MIN_EASE);

  // Calculate new interval
  if (quality >= 3) {
    if (interval === 0) interval = 1;
    else if (interval === 1) interval = 6;
    else interval = Math.round(interval * ease);
  } else {
    interval = 1; // Reset on hard
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);
  nextReview.setHours(0, 0, 0, 0);

  return {
    easeFactor: ease,
    reviewInterval: interval,
    nextReviewDate: nextReview.toISOString()
  };
}

export async function saveReview(supabase, wordId, action, difficulty) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("study_log").insert({
    user_id: user.id,
    word_id: wordId,
    action,
    difficulty: difficulty || null
  });

  if (error) throw error;
}

export async function updateWordSchedule(supabase, wordId, easeFactor, reviewInterval, nextReviewDate) {
  const { error } = await supabase
    .from("vocabulary")
    .update({
      ease_factor: easeFactor,
      review_interval_days: reviewInterval,
      next_review_date: nextReviewDate
    })
    .eq("id", wordId);

  if (error) throw error;
}

export async function updateUserStats(supabase) {
  // Get current stats
  const { data: stats, error: fetchError } = await supabase
    .from("user_stats")
    .select("*")
    .single();

  if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  let currentStreak = stats?.current_streak || 0;
  const lastReview = stats?.last_review_date;

  if (lastReview === today) {
    // Already reviewed today, streak stays
  } else if (lastReview === yesterday) {
    currentStreak += 1;
  } else {
    currentStreak = 1; // New streak or broken
  }

  const { error: upsertError } = await supabase.from("user_stats").upsert({
    user_id: undefined, // RLS handles this
    total_reviews: (stats?.total_reviews || 0) + 1,
    current_streak: currentStreak,
    longest_streak: Math.max(currentStreak, stats?.longest_streak || 0),
    last_review_date: today,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id" });

  if (upsertError) throw upsertError;
}

export async function markRemembered(supabase, wordId) {
  const { error } = await updateWordSchedule(
    supabase, wordId, DEFAULT_EASE, 365,
    new Date(Date.now() + 365 * 86400000).toISOString()
  );
  if (error) throw error;
}
