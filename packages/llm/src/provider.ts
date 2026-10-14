import type { z } from "zod";

export type StructuredRequest<T extends z.ZodType> = {
  /** Stable instructions (cached). */
  system: string;
  /** Long, stable document (cached, placed before the task). */
  document?: { title: string; text: string };
  /** Task message; may include validation feedback on retries. */
  prompt: string;
  schema: T;
};

export type StructuredResponse<T> = {
  output: T | null;
  /** Why there is no output: refusal, max_tokens, unparseable JSON… */
  failure?: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
};

/**
 * Provider-agnostic interface for structured extraction, so the pipeline can
 * switch LLM providers (or use a fake in tests) without changes.
 */
export interface LlmProvider {
  readonly name: string;
  extract<T extends z.ZodType>(req: StructuredRequest<T>): Promise<StructuredResponse<z.infer<T>>>;
}
