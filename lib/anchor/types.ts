export type Pillar = "nourish" | "regulate" | "begin" | "connect" | "move" | "understand";

export type Capacity = "very-low" | "some" | "steady";

export type Barrier =
  | "decision-load"
  | "sensory-load"
  | "activation"
  | "shame"
  | "time-blindness"
  | "words";

export type SupportMode = "do" | "read" | "connect";

export type Outcome = "yes" | "a-little" | "not-today";

export interface Moment {
  id: string;
  pillar: Pillar;
  title: string;
  description: string;
  defaultBarriers: Barrier[];
  supportIds: string[];
  tags: string[];
}

export interface Support {
  id: string;
  pillar: Pillar;
  title: string;
  intro: string;
  steps: string[];
  capacity: Capacity[];
  barriers: Barrier[];
  modes: SupportMode[];
  boundary: string;
  reviewStatus: "prototype" | "clinically-reviewed";
}

export interface RecommendationInput {
  momentId: string;
  capacity: Capacity;
  barrier: Barrier;
  mode: SupportMode;
}

export interface RecommendationResult {
  support: Support;
  explanation: string;
  score: number;
}

export interface PatternEntry extends RecommendationInput {
  id: string;
  supportId: string;
  outcome: Outcome;
  createdAt: string;
  taxonomyVersion: string;
}

export interface ConsentRecord {
  version: string;
  purpose: "device-storage" | "closed-beta-research";
  granted: boolean;
  recordedAt: string;
}

export interface AnchorState {
  schemaVersion: 1;
  consent: ConsentRecord[];
  patterns: PatternEntry[];
}
