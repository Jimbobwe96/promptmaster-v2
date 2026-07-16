import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

/**
 * Guess scoring is provider-pluggable. Pick the engine with the SCORING_PROVIDER env var:
 *   - "openai"    (default) → uses OPENAI_API_KEY
 *   - "anthropic"           → uses ANTHROPIC_API_KEY (Claude)
 * Both call the same structured-JSON contract, so swapping is just the env var (+ key).
 * Model IDs are one-line constants below if you want to trade quality for cost/latency.
 */
const PROVIDER = (process.env.SCORING_PROVIDER ?? 'openai').toLowerCase();
const OPENAI_SCORING_MODEL = 'gpt-4o';
const ANTHROPIC_SCORING_MODEL = 'claude-opus-4-8';

// Lazily construct only the client we actually use — each SDK throws at construction if its
// API key is absent, so we must not instantiate the provider you haven't configured.
let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;
const getAnthropic = () => (anthropicClient ??= new Anthropic());
const getOpenAI = () => (openaiClient ??= new OpenAI());

// Structured-output JSON schema: an array of { index, score } pairs. additionalProperties:false
// and every property required — satisfies both Anthropic structured outputs and OpenAI strict mode.
const SCORES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          index: { type: 'integer' },
          score: { type: 'integer' }
        },
        required: ['index', 'score']
      }
    }
  },
  required: ['scores']
} as const;

export interface GuessToScore {
  index: number;
  guess: string;
}

const SYSTEM_PROMPT = `You are the judge in a party game where players try to guess the secret text prompt that was used to generate an AI image. You are given the original prompt and a set of player guesses. Score how closely each guess matches the original prompt's meaning.

Scoring guidance (0-100):
- 90-100: captures the core subject, action, and key details; a near match in meaning.
- 70-89: gets the main subject and general idea, missing some details.
- 40-69: partially related; shares some elements but misses the main idea.
- 10-39: vaguely related at best.
- 0-9: unrelated.

Judge by semantic meaning, not exact wording — synonyms and paraphrases that capture the idea should score well. Be fair and consistent across guesses.`;

const buildUserMessage = (prompt: string, guesses: GuessToScore[]): string => {
  const numbered = guesses.map((g) => `${g.index}. ${g.guess}`).join('\n');
  return `Original prompt: "${prompt}"\n\nGuesses (by index):\n${numbered}\n\nReturn a score from 0 to 100 for each guess, referencing its index.`;
};

/** Each provider returns the raw JSON text matching SCORES_SCHEMA, or null on no content. */
async function completeWithAnthropic(system: string, user: string): Promise<string | null> {
  const response = await getAnthropic().messages.create({
    model: ANTHROPIC_SCORING_MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { format: { type: 'json_schema', schema: SCORES_SCHEMA } }
  });
  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock && textBlock.type === 'text' ? textBlock.text : null;
}

async function completeWithOpenAI(system: string, user: string): Promise<string | null> {
  const completion = await getOpenAI().chat.completions.create({
    model: OPENAI_SCORING_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'guess_scores', strict: true, schema: SCORES_SCHEMA }
    }
  });
  return completion.choices[0]?.message?.content ?? null;
}

/**
 * Score each guess 0-100 against the original prompt. Returns a map from the guess's
 * `index` to its score. Missing/failed entries are simply absent (caller defaults to 0).
 */
export async function scoreGuesses(prompt: string, guesses: GuessToScore[]): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (guesses.length === 0) return result;

  const user = buildUserMessage(prompt, guesses);
  const json =
    PROVIDER === 'anthropic'
      ? await completeWithAnthropic(SYSTEM_PROMPT, user)
      : await completeWithOpenAI(SYSTEM_PROMPT, user);
  if (!json) return result;

  const parsed = JSON.parse(json) as { scores?: Array<{ index: number; score: number }> };
  for (const { index, score } of parsed.scores ?? []) {
    result.set(index, Math.max(0, Math.min(100, Math.round(score))));
  }
  return result;
}
