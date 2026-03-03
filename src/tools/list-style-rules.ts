import { z } from "zod";
import { STYLE_CATEGORIES, type StyleStore } from "../types.js";

export const listStyleRulesSchema = z.object({
  category: z
    .enum(STYLE_CATEGORIES as [string, ...string[]])
    .optional()
    .describe(
      "Filter by category: naming | formatting | architecture | testing | documentation | git | general. Omit to list all.",
    ),
});

export async function listStyleRulesTool(
  args: z.infer<typeof listStyleRulesSchema>,
  store: StyleStore,
) {
  const rules = await store.listRules(args.category as any);

  if (rules.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: args.category
            ? `No style rules found in category "${args.category}".`
            : "No style rules have been defined yet.",
        },
      ],
    };
  }

  const grouped = new Map<string, typeof rules>();
  for (const rule of rules) {
    const list = grouped.get(rule.category) ?? [];
    list.push(rule);
    grouped.set(rule.category, list);
  }

  const lines: string[] = [];
  for (const [cat, catRules] of grouped) {
    lines.push(`### ${cat.toUpperCase()}`);
    for (const r of catRules) {
      const tagStr = r.tags.length ? ` (${r.tags.join(", ")})` : "";
      lines.push(
        `  [${r.id}] ${r.topic}${tagStr} - v${r.version}, by ${r.createdBy}, updated ${r.updatedAt}`,
      );
    }
    lines.push("");
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `${rules.length} style rule(s):\n\n${lines.join("\n")}`,
      },
    ],
  };
}
