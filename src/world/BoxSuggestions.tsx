import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";
import { cn, SuggestionItem, SuggestionList } from "@/shared/ui";

/** One thing the chat box offers to fill in: an agent to `@`, or a `/` command or its place. */
export interface BoxSuggestion {
  key: string;
  label: string;
  detail?: string;
  /** Its glyph, or an agent's or a person's picture. */
  icon: LucideIcon | ReactElement;
  selected: boolean;
  pick(): void;
}

/**
 * What the building's chat box offers while something is typed, by the box: above it when the box
 * sits along the bottom, below it when the box sits at the top. At least wide enough for an
 * agent's name and engine, never cut by the box's edge.
 */
export function BoxSuggestions(props: {
  items: readonly BoxSuggestion[];
  label: string;
  below?: boolean;
}) {
  if (!props.items.length) return null;
  return (
    <SuggestionList
      className={cn(
        "absolute -left-1 z-[var(--stack-overlay-raised)] max-h-60 w-[calc(100%+0.5rem)] min-w-65",
        "overflow-y-auto",
        props.below ? "top-[calc(100%+0.875rem)]" : "bottom-[calc(100%+0.875rem)]",
      )}
      aria-label={props.label}
    >
      {props.items.map((item) => (
        <SuggestionItem
          key={item.key}
          selected={item.selected}
          icon={item.icon}
          label={item.label}
          detail={item.detail}
          // Before the box loses focus to the press, so the pick lands in it.
          onPointerDown={item.pick}
        />
      ))}
    </SuggestionList>
  );
}
