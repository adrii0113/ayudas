import type { RuleGroup, RuleNode } from "./types";
import { isRuleGroup } from "./types";

function nodeLabel(node: RuleNode): string {
  if (!isRuleGroup(node)) return node.label;
  if (node.label) return node.label;
  const parts: string[] = [];
  if (node.all?.length) parts.push(node.all.map(nodeLabel).join(" y "));
  if (node.any?.length) parts.push(node.any.map(nodeLabel).join(" o "));
  return parts.join(" y ");
}

/**
 * Plain-language list of the top-level requirements of a rule tree, in the
 * same units the evaluator reports (leaf rules, or `any` groups as one item).
 */
export function describeRequirements(rules: RuleGroup): string[] {
  const out: string[] = [];
  for (const child of rules.all ?? []) {
    if (isRuleGroup(child) && !child.any && !child.label) out.push(...describeRequirements(child));
    else out.push(nodeLabel(child));
  }
  if (rules.any) out.push(rules.label ?? rules.any.map(nodeLabel).join(" o "));
  return out;
}
