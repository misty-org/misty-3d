import { SceneBadge, Tooltip } from "@/shared/ui";
import { skillWords } from "./doingIcons";
import type { AgentRecord } from "./studioProgress";

/**
 * An agent's record in the studio, as a game shows a player's level beside their name: one `Lv`
 * badge, the same one the People list wears. Its tooltip carries the rest of the record: the tasks
 * it finished, its best run of them without a failure, the days it got something done, what it is
 * good at, and how far it is from the next level. Nothing shows before it has finished anything.
 */
export function AgentLevelBadge({ record }: { record?: AgentRecord }) {
  if (!record?.done) return null;
  const skills = record.skills.map(({ code }) => skillWords[code]).filter(Boolean);
  const details = [
    `${record.done} done`,
    record.bestStreak > 1 ? `best streak ${record.bestStreak}` : "",
    record.days > 1 ? `${record.days} days` : "",
    skills.join(", "),
    record.toNext
      ? `${record.toNext.need - record.toNext.have} more to level ${record.level + 1}`
      : "top level",
  ].filter(Boolean);
  return (
    <Tooltip content={details.join(" · ")}>
      <span className="inline-flex flex-none" aria-label={`Level ${record.level}`}>
        <SceneBadge tint="yellow">Lv {record.level}</SceneBadge>
      </span>
    </Tooltip>
  );
}
