import { Hammer, MessageSquare, Settings, Shirt, Trophy, Undo2, Users, X } from "lucide-react";
import type { ReactNode } from "react";
import type { AgentProfile } from "@/shared/schemas";
import {
  ActionBar,
  cn,
  IconButton,
  iconBarItem,
  OverflowFadeText,
  Pressable,
  SceneBadge,
  SceneGlyph,
  Surface,
  Text,
  windowToolbarClass,
} from "@/shared/ui";
import { AgentAvatar } from "@/features/agents/personal/AgentAvatar";
import type { StudioState } from "@/features/agents/now/useStudioAgents";

/** A top band panel that is a button: 40px tall, as the panels beside it are. */
const panelButtonClass = "pointer-events-auto flex h-10 min-w-0 items-center gap-2 px-3 text-meta";

const stateWords = { working: "Working", "needs-you": "Needs you", resting: "Free" } as const;
const stateDot = { working: "green", "needs-you": "amber", resting: undefined } as const;

/** Who has the person's attention: the one agent what they say or type goes to. */
export interface StudioAttention {
  id: string;
  name: string;
  state: StudioState;
  agent?: AgentProfile;
  /** It was told to come to the person and keeps after them. */
  following: boolean;
}

/**
 * Game mode's band along the top, laid out as the games people know lay theirs out: at the top
 * left, past the window's own buttons, the menu (which holds the way back to Classic), the chat,
 * Build and Settings; and at the top right the building's level and who is here. Each of those
 * opens its panel under the band.
 */
export function GameTopBand(props: {
  menu: ReactNode;
  chatOpen: boolean;
  onChat(): void;
  /** Rebuilds the room; none while the person sits at their desk. */
  onBuild?(): void;
  onSettings(): void;
  peopleCount: number | null;
  peopleOpen: boolean;
  onPeople(): void;
  level: number;
  trophies: number;
  levelOpen: boolean;
  onLevel(): void;
}) {
  return (
    // A window toolbar: the shell gives it the room the window's own buttons take at its ends.
    <div
      className={cn(
        "pointer-events-none absolute inset-x-2 top-2 z-[var(--stack-overlay)] flex items-start",
        "justify-between gap-2",
        windowToolbarClass,
      )}
      data-window-toolbar=""
      data-tour="studio-top-bar"
    >
      <Surface
        tone="scene-panel"
        radius="xl"
        className="pointer-events-auto flex flex-none items-center gap-0.5 p-1"
      >
        {props.menu}
        <IconButton
          label={props.chatOpen ? "Hide chat" : "Chat"}
          shortcut="/"
          aria-pressed={props.chatOpen}
          onClick={props.onChat}
        >
          <MessageSquare aria-hidden="true" />
        </IconButton>
        {props.onBuild ? (
          <IconButton label="Build" shortcut="B" onClick={props.onBuild}>
            <Hammer aria-hidden="true" />
          </IconButton>
        ) : null}
        <IconButton label="Settings" onClick={props.onSettings}>
          <Settings aria-hidden="true" />
        </IconButton>
      </Surface>
      <div className="flex flex-none items-start gap-2 max-[792px]:hidden">
        <Surface
          as={Pressable}
          tone="scene-panel"
          radius="xl"
          wash="panel"
          data-selected={props.levelOpen || undefined}
          aria-expanded={props.levelOpen}
          aria-label={`Building level ${props.level}, ${props.trophies} unlocked`}
          className={panelButtonClass}
          onClick={props.onLevel}
        >
          <SceneBadge tint="yellow">Lv {props.level}</SceneBadge>
          <Text bare size="caption" tone="muted" className="flex items-center gap-1 tabular-nums">
            <SceneGlyph tint="yellow">
              <Trophy aria-hidden="true" />
            </SceneGlyph>
            {props.trophies}
          </Text>
        </Surface>
        <Surface
          as={Pressable}
          tone="scene-panel"
          radius="xl"
          wash="panel"
          data-selected={props.peopleOpen || undefined}
          aria-expanded={props.peopleOpen}
          className={panelButtonClass}
          onClick={props.onPeople}
        >
          <Users aria-hidden="true" />
          <Text bare weight="semibold" tone="bright">
            People
          </Text>
          {props.peopleCount === null ? null : (
            <Text bare size="caption" tone="muted" className="tabular-nums">
              {props.peopleCount}
            </Text>
          )}
        </Surface>
      </div>
    </div>
  );
}

/**
 * Who has the person's attention, under the middle of the band: their name and state, and what
 * can be done with them (send them back to work, dress them up, open their settings).
 */
export function AttentionPill(props: {
  attention: StudioAttention;
  onCustomize?(): void;
  onSettings?(): void;
  /** Sends a following agent back to its work. */
  onSendBack?(): void;
  /** Lets go of its attention. */
  onRelease(): void;
}) {
  const heard = props.attention;
  return (
    <Surface
      tone="scene-panel"
      radius="xl"
      className={cn(
        "absolute inset-x-0 top-14 z-[var(--stack-overlay)] mx-auto flex w-fit max-w-[calc(100%-1rem)]",
        "min-w-0 items-center gap-2 py-1 pr-1 pl-2.5 max-[792px]:hidden",
      )}
      aria-label={`Talking to ${heard.name}`}
    >
      <AgentAvatar agent={heard.agent} compact />
      <Text bare size="meta" weight="semibold" tone="bright" className="min-w-0">
        <OverflowFadeText>{heard.name}</OverflowFadeText>
      </Text>
      <Text bare size="caption" tone="muted" className="inline-flex flex-none items-center gap-1.5">
        <Surface
          as="span"
          tone="active"
          art={stateDot[heard.state]}
          radius="full"
          className="size-2"
          aria-hidden="true"
        />
        {heard.following ? "Following you" : stateWords[heard.state]}
      </Text>
      <ActionBar
        label={`${heard.name} actions`}
        size="sm"
        width="content"
        items={[
          ...(heard.following && props.onSendBack
            ? [
                iconBarItem({
                  id: "send-back",
                  icon: Undo2,
                  label: "Send back to work",
                  size: "sm",
                  priority: 1,
                  onSelect: props.onSendBack,
                }),
              ]
            : []),
          ...(props.onCustomize
            ? [
                iconBarItem({
                  id: "customize",
                  icon: Shirt,
                  label: "Customize",
                  size: "sm",
                  priority: 1,
                  onSelect: props.onCustomize,
                }),
              ]
            : []),
          ...(props.onSettings
            ? [
                iconBarItem({
                  id: "settings",
                  icon: Settings,
                  label: `${heard.name} settings`,
                  size: "sm",
                  priority: 1,
                  onSelect: props.onSettings,
                }),
              ]
            : []),
        ]}
        end={
          <IconButton label="Stop talking" onClick={props.onRelease}>
            <X aria-hidden="true" />
          </IconButton>
        }
      />
    </Surface>
  );
}
