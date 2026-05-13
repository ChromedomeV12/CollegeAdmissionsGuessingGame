// Rank ladder for cumulative session score.

window.RANKS = [
  { name: "Curious Observer",   min: 0,   icon: "eye" },
  { name: "Application Reader", min: 30,  icon: "book-2" },
  { name: "Junior Counselor",   min: 80,  icon: "school" },
  { name: "Senior Counselor",   min: 150, icon: "stars" },
  { name: "Dean of Admissions", min: 250, icon: "award" },
  { name: "Admissions Oracle",  min: 400, icon: "crown" }
];

window.rankFor = function rankFor(total) {
  const ladder = window.RANKS;
  let current = ladder[0];
  let next = null;
  for (let i = 0; i < ladder.length; i++) {
    if (total >= ladder[i].min) {
      current = ladder[i];
      next = ladder[i + 1] || null;
    }
  }
  const floor = current.min;
  const ceiling = next ? next.min : current.min;
  const span = ceiling - floor;
  const progress = next ? Math.max(0, Math.min(1, (total - floor) / span)) : 1;
  return { current, next, progress, floor, ceiling };
};
