import "../public/tiers.js";
import "../public/scoring.js";
import "../public/game-score.js";

export type GamePrediction = {
  universityTierPick: string | null;
  lacTierPick: string | null;
  noUniClaim: boolean;
  noLacClaim: boolean;
  schoolSelections: string[];
};

export type GameResult = {
  score: number;
  rawScore: number;
  accuracy: number;
  uniPts: number;
  lacPts: number;
  selectionPts: number;
  timeSeconds: number;
  timeFactor: number;
};

type ScoreGlobals = typeof globalThis & {
  GAME_SCORE?: {
    evaluate: (
      profile: Record<string, unknown>,
      prediction: GamePrediction,
      startedAt: string,
      finishedAt: string,
    ) => GameResult;
  };
};

export function evaluateGame(
  profile: Record<string, unknown>,
  prediction: GamePrediction,
  startedAt: string,
  finishedAt: string,
): GameResult {
  const evaluator = (globalThis as ScoreGlobals).GAME_SCORE;
  if (!evaluator) throw new Error("Game scoring engine is unavailable");
  return evaluator.evaluate(profile, prediction, startedAt, finishedAt);
}
