import { useEffect, useState, type ReactNode } from "react";
import { cn, Kbd, Surface, Text } from "@/shared/ui";
import { GameHotbar, type HotbarSlotId } from "./GameHotbar";
import { GameMenu } from "./GameMenu";
import { MusicPanel } from "./MusicPanel";
import { EmotePicker, UnlockBanner } from "./StudioHotbar";
import { AttentionPill, GameTopBand, type StudioAttention } from "./StudioTopBar";
import type { StudioEmote } from "./studioOrders";
import type { Progress, Unlock } from "./studioProgress";

/** How long the controls stay up after the building opens, and the welcome to it. */
const HINT_MS = 9000;
const ARRIVAL_MS = 5000;

/** The chat window at the top left, under the band, as the games people know keep theirs. */
const chatClass = cn(
  "absolute top-14 left-2 z-[var(--stack-overlay)] w-80 max-w-[calc(100%-1rem)] p-1",
  "max-[1040px]:w-64 max-[792px]:group-data-[talking]/studio:hidden",
);

/**
 * Game mode's HUD over the building, where players expect each part: the menu and the chat at the
 * top left, the Classic and Game switch in the middle of the top, the building's level and who is
 * here at the top right with their panel under them, the hotbar along the bottom in the middle
 * (with the emote wheel over it), the music player at the bottom right, and the controls at the
 * bottom left for a while after the building opens. While the person builds, hires or plays a
 * game, only what that needs shows.
 */
export function GameHud(props: {
  visible: boolean;
  /** The building has loaded: the hotbar and the chat can be used. */
  ready: boolean;
  loading: boolean;
  /** The menu's items, and Build and Settings, which sit beside it in the band. */
  menu: Parameters<typeof GameMenu>[0] & { onBuild(): void; onSettings(): void };
  chat: ReactNode;
  chatOpen: boolean;
  onChat(): void;
  /** The panel down the right side, if any. */
  side: ReactNode;
  panel: "people" | "level" | "buildings" | null;
  onPanel(panel: "people" | "level"): void;
  peopleCount: number | null;
  progress: Progress;
  /** An agent following the person, and a way to send it back. */
  following: {
    attention: StudioAttention;
    onSendBack(): void;
    onRelease(): void;
  } | null;
  emoteOpen: boolean;
  onEmoteOpen(open: boolean): void;
  onEmote(kind: StudioEmote): void;
  musicShown: boolean;
  namesShown: boolean;
  onSlot(id: HotbarSlotId): void;
  unlocked: Unlock | null;
  onUnlockBuild(): void;
  onUnlockClose(): void;
  firstPerson: boolean;
  walking: boolean;
  /** The building the person just walked into, said for a moment as they arrive. */
  building?: string;
  /**
   * Sat at their desk, the pages on its monitor: only the band stays (and the chat, when opened
   * from it), so the person still hears from the room; the walking aids go.
   */
  seated?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setHint(false), HINT_MS);
    return () => window.clearTimeout(timer);
  }, []);
  const [arrived, setArrived] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setArrived(false), ARRIVAL_MS);
    return () => window.clearTimeout(timer);
  }, []);
  const lit = new Set<HotbarSlotId>([
    ...(props.emoteOpen ? (["emote"] as const) : []),
    ...(props.musicShown ? (["music"] as const) : []),
    ...(props.namesShown ? (["names"] as const) : []),
  ]);
  return (
    <>
      {props.side}
      {props.unlocked && props.visible && !props.seated ? (
        <UnlockBanner
          unlock={props.unlocked}
          onBuild={props.onUnlockBuild}
          onClose={props.onUnlockClose}
        />
      ) : null}
      {props.visible ? (
        <>
          <GameTopBand
            menu={<GameMenu {...props.menu} />}
            // The room can't be rebuilt from the chair.
            onBuild={props.seated ? undefined : props.menu.onBuild}
            onSettings={props.menu.onSettings}
            chatOpen={props.chatOpen}
            onChat={props.onChat}
            peopleCount={props.peopleCount}
            peopleOpen={props.panel === "people"}
            onPeople={() => props.onPanel("people")}
            level={props.progress.reached.length + 1}
            trophies={props.progress.reached.length}
            levelOpen={props.panel === "level"}
            onLevel={() => props.onPanel("level")}
          />
          {arrived && props.building && props.ready && !props.following && !props.seated ? (
            <Arrival building={props.building} />
          ) : null}
          {props.following && !props.seated ? (
            <AttentionPill
              attention={props.following.attention}
              onSendBack={props.following.onSendBack}
              onRelease={props.following.onRelease}
            />
          ) : null}
          {props.chatOpen && props.ready ? (
            <Surface tone="scene-panel" radius="xl" className={chatClass} data-tour="studio-ask">
              {props.chat}
            </Surface>
          ) : null}
          {props.ready && !props.seated ? (
            <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[var(--stack-overlay)] flex justify-center">
              <div className="pointer-events-auto relative max-w-full">
                <GameHotbar
                  lit={lit}
                  onSlot={props.onSlot}
                  compact={!hovered}
                  onHover={setHovered}
                />
                {props.emoteOpen ? (
                  <EmotePicker
                    who="You"
                    onEmote={props.onEmote}
                    onClose={() => props.onEmoteOpen(false)}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
          {props.musicShown ? (
            <div className="absolute right-2 bottom-2 z-[var(--stack-overlay)] max-[1180px]:bottom-16">
              <MusicPanel />
            </div>
          ) : null}
          {hint && props.walking && !props.loading && !props.seated ? (
            <Controls first={props.firstPerson} />
          ) : null}
        </>
      ) : null}
    </>
  );
}

/** The controls, at the bottom left for a while after the building opens. */
function Controls({ first }: { first: boolean }) {
  return (
    <Surface
      tone="scene-panel"
      radius="lg"
      aria-hidden="true"
      className={cn(
        "absolute bottom-2 left-2 z-[var(--stack-overlay)] flex items-center gap-2 py-1.5 pr-3 pl-1.5",
        "animate-[misty-fade-in_0.3s_ease-out] motion-reduce:animate-none max-[1180px]:hidden",
      )}
    >
      <Text bare as="div" size="meta" tone="bright" className="flex items-center gap-2">
        <Kbd strong>WASD</Kbd>
        <span>Move</span>
        <Kbd strong>E</Kbd>
        <span>Use</span>
        <Kbd strong>/</Kbd>
        <span>Commands</span>
        <Kbd strong>1–9</Kbd>
        <span>Hotbar</span>
        <Text bare tone="muted">
          Click to look, Esc to stop, scroll to step {first ? "back" : "in"}
        </Text>
      </Text>
    </Surface>
  );
}

/**
 * The welcome as the person walks into a building, under the middle of the band for a few
 * seconds: where they are, and the quickest way to work.
 */
function Arrival({ building }: { building: string }) {
  return (
    <Surface
      tone="scene-panel"
      radius="xl"
      role="status"
      className={cn(
        "absolute inset-x-0 top-14 z-[var(--stack-overlay)] mx-auto flex w-fit max-w-[calc(100%-1rem)]",
        "items-center gap-2 py-2 pr-3 pl-3 animate-[misty-fade-in_0.3s_ease-out] motion-reduce:animate-none",
      )}
    >
      <Text bare size="meta" weight="semibold" tone="bright">
        {building}
      </Text>
      <Text bare size="meta" tone="muted" className="flex items-center gap-1.5">
        <Kbd strong>2</Kbd>
        <span>to sit at your desk,</span>
        <Kbd strong>/</Kbd>
        <span>to go anywhere</span>
      </Text>
    </Surface>
  );
}
