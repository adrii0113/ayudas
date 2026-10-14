import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import type { LlmProvider, StructuredRequest, StructuredResponse } from "./provider";

export const DEFAULT_MODEL = "claude-opus-5-5";

export type AnthropicProviderOptions = {
  client?: Anthropic;
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
};

/**
 * Claude via the official SDK, with structured outputs validated by Zod.
 * Stable content (instructions + document) goes first and is cached, so a retry
 * with validation feedback only pays for the new message.
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly effort: NonNullable<AnthropicProviderOptions["effort"]>;
  private readonly maxTokens: number;

  constructor(options: AnthropicProviderOptions = {}) {
    this.client = options.client ?? new Anthropic();
    this.model = options.model ?? DEFAULT_MODEL;
    this.effort = options.effort ?? "high";
    this.maxTokens = options.maxTokens ?? 16000;
  }

  async extract<T extends z.ZodType>(
    req: StructuredRequest<T>,
  ): Promise<StructuredResponse<z.infer<T>>> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (req.document) {
      content.push({
        type: "document",
        source: { type: "text", media_type: "text/plain", data: req.document.text },
        title: req.document.title,
        cache_control: { type: "ephemeral" },
      });
    }
    content.push({ type: "text", text: req.prompt });

    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: this.maxTokens,
      // On a safety-classifier decline, the API retries on a fallback model
      // chosen by refusal category, inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: this.effort, format: betaZodOutputFormat(req.schema) },
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
    });

    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    };
    if (response.stop_reason === "refusal") {
      return { output: null, failure: "refusal", model: response.model, usage };
    }
    if (response.stop_reason === "max_tokens") {
      return { output: null, failure: "max_tokens", model: response.model, usage };
    }
    if (response.parsed_output == null) {
      return { output: null, failure: "unparseable_output", model: response.model, usage };
    }
    return { output: response.parsed_output as z.infer<T>, model: response.model, usage };
  }
}
