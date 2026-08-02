import { moments, supports } from "./taxonomy.ts";
import type { RecommendationInput, RecommendationResult, Support } from "./types.ts";

function scoreSupport(support: Support, input: RecommendationInput): number {
  const moment = moments.find((item) => item.id === input.momentId);
  if (!moment) return -1;

  let score = support.pillar === moment.pillar ? 8 : 0;
  if (moment.supportIds.includes(support.id)) score += 6;
  if (support.capacity.includes(input.capacity)) score += 4;
  if (support.barriers.includes(input.barrier)) score += 5;
  if (support.modes.includes(input.mode)) score += 3;
  if (moment.defaultBarriers.some((barrier) => support.barriers.includes(barrier))) score += 2;
  if (input.capacity === "very-low") score -= Math.max(0, support.steps.length - 3);
  return score;
}

export function recommendSupport(input: RecommendationInput): RecommendationResult {
  const moment = moments.find((item) => item.id === input.momentId);
  if (!moment) throw new Error(`Unknown Anchor moment: ${input.momentId}`);

  const eligible = supports.filter(
    (support) => moment.supportIds.includes(support.id) && support.capacity.includes(input.capacity) && support.modes.includes(input.mode),
  );
  if (!eligible.length) {
    throw new Error(`No reviewed Anchor support is available for capacity ${input.capacity} and mode ${input.mode}`);
  }

  const ranked = eligible
    .map((support) => ({ support, score: scoreSupport(support, input) }))
    .sort((a, b) => b.score - a.score || a.support.id.localeCompare(b.support.id));

  const best = ranked[0];
  const capacityText =
    input.capacity === "very-low" ? "very little capacity" : input.capacity === "some" ? "some capacity" : "a steadier amount of capacity";

  return {
    ...best,
    explanation: `Anchor matched this to “${moment.title}”, ${capacityText}, and the barrier you named. It is an approved prototype tool—not an AI diagnosis or clinical recommendation.`,
  };
}
