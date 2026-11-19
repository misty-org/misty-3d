import { Fragment } from "react";
import { Package } from "lucide-react";
import { ScenePlate, ScenePrompt, SceneReward, SceneSign } from "@/shared/ui";
import type { Actor } from "./behaviour";
import type { StudioItem } from "./layout";
import { ActorTag, FREE_DESK_PRIORITY, FreeDeskMarker, SpeechBubble, labelPriority } from "./Tags";

/**
 * The labels' own stacking layer: they order among themselves (TagProjector gives them large
 * z-indexes), but the whole layer stays under every panel, menu and popup drawn over the room.
 */
const tagLayerClass =
  "pointer-events-none absolute inset-0 isolate z-[var(--stack-above)] overflow-hidden";
/**
 * A point that follows the figure, hidden until TagProjector places it; its label is centred on
 * it, below it, or above it (`data-up`) for what floats over a head.
 */
const tagAnchorClass =
  "invisible absolute top-0 left-0 flex w-0 justify-center will-change-transform data-[up]:h-0 data-[up]:items-end";

/**
 * What floats over the room, drawn on the page rather than in it: in build mode each desk's name;
 * otherwise everyone's name tag and what they say, the next free desk's marker, results waiting
 * on desks, the key to press for what the person walked up to, and the "+1"s that rise off agents.
 * TagProjector keeps each label over its anchor.
 */
export function SceneLabels(props: {
  building: boolean;
  /** Where each label goes: TagProjector moves them, by the anchors they name. */
  tags: Map<string, HTMLElement>;
  desksShown: readonly StudioItem[];
  deskNames: Map<string, string>;
  freeDesks: readonly StudioItem[];
  onHireAt?(deskId: string): void;
  /** Each waiting result's agent. */
  parcels: ReadonlyMap<string, string>;
  onCollect?(agentId: string): void;
  names: Map<string, string>;
  prompt?: { anchor: string; words: string } | null;
  pops?: Record<string, number>;
  actors: readonly Actor[];
  selected: string | null;
  speech: Map<string, string>;
  onSelect(id: string | null): void;
}) {
  const { building, tags, desksShown, deskNames, freeDesks, parcels, actors } = props;
  return (
    <>
      {building ? (
        <div className={tagLayerClass}>
          {desksShown.map((desk) => (
            <div
              key={desk.id}
              className={tagAnchorClass}
              ref={(node) => {
                if (node) tags.set(`desk:${desk.id}`, node);
                else tags.delete(`desk:${desk.id}`);
              }}
            >
              <ScenePlate empty={!deskNames.get(desk.id)}>
                {deskNames.get(desk.id) ?? "Free desk"}
              </ScenePlate>
            </div>
          ))}
        </div>
      ) : (
        <div className={tagLayerClass}>
          {/* Only the next free desk is marked, as a game marks the next plot; walking up to any
            free desk offers it too. */}
          {props.onHireAt
            ? freeDesks.slice(0, 1).map((desk) => (
                <div
                  key={desk.id}
                  className={tagAnchorClass}
                  data-up="true"
                  data-anchor={`desk:${desk.id}`}
                  data-priority={FREE_DESK_PRIORITY}
                  ref={(node) => {
                    if (node) tags.set(`free:${desk.id}`, node);
                    else tags.delete(`free:${desk.id}`);
                  }}
                >
                  <FreeDeskMarker onHire={() => props.onHireAt?.(desk.id)} />
                </div>
              ))
            : null}
          {[...parcels.keys()].map((agentId) => (
            <div
              key={`result:${agentId}`}
              className={tagAnchorClass}
              data-up="true"
              data-anchor={`result:${agentId}`}
              data-priority={2.5}
              ref={(node) => {
                if (node) tags.set(`result:${agentId}`, node);
                else tags.delete(`result:${agentId}`);
              }}
            >
              <SceneSign
                type="button"
                icon={<Package aria-hidden="true" />}
                aria-label={`Collect ${props.names.get(agentId) ?? "agent"}'s result`}
                onClick={() => props.onCollect?.(agentId)}
              >
                Result
              </SceneSign>
            </div>
          ))}
          {props.prompt ? (
            // Over everything of its figure's: it is what the person is about to do.
            <div
              className={tagAnchorClass}
              data-up="true"
              data-anchor={props.prompt.anchor}
              data-priority={3.9}
              ref={(node) => {
                if (node) tags.set("prompt", node);
                else tags.delete("prompt");
              }}
            >
              <ScenePrompt keyName="E">{props.prompt.words}</ScenePrompt>
            </div>
          ) : null}
          {Object.entries(props.pops ?? {}).map(([id, at]) => (
            <div
              key={`${id}:${at}`}
              className={tagAnchorClass}
              data-up="true"
              data-anchor={`head:${id}`}
              data-priority={3.8}
              ref={(node) => {
                if (node) tags.set(`pop:${id}`, node);
                else tags.delete(`pop:${id}`);
              }}
            >
              <SceneReward>+1</SceneReward>
            </div>
          ))}
          {actors.map((actor) => {
            const picked = props.selected === actor.id;
            const speech = props.speech.get(actor.id) ?? "";
            const priority = labelPriority(actor, picked);
            return (
              <Fragment key={actor.id}>
                <div
                  className={tagAnchorClass}
                  data-up="true"
                  data-anchor={`head:${actor.id}`}
                  data-priority={priority}
                  ref={(node) => {
                    if (node) tags.set(`name:${actor.id}`, node);
                    else tags.delete(`name:${actor.id}`);
                  }}
                >
                  <ActorTag
                    actor={actor}
                    name={props.names.get(actor.id) ?? actor.name}
                    selected={picked}
                    onPick={props.onSelect}
                  />
                </div>
                {speech ? (
                  // Placed after its name, so it stacks above it.
                  <div
                    className={tagAnchorClass}
                    data-up="true"
                    data-anchor={`head:${actor.id}`}
                    data-priority={priority + 0.5}
                    ref={(node) => {
                      if (node) tags.set(`say:${actor.id}`, node);
                      else tags.delete(`say:${actor.id}`);
                    }}
                  >
                    <SpeechBubble speech={speech} />
                  </div>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      )}
    </>
  );
}
