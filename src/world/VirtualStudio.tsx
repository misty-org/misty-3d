import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Vector3 } from "three";
import {
  cn,
  ErrorState,
  SceneCrosshair,
  Skeleton,
  Surface,
  lazyTool,
  ToolSuspense,
} from "@/shared/ui";
import { ArcadePanel } from "./ArcadePanel";
import { BuildPanel } from "./BuildPanel";
import type { Building } from "./BuildingsPanel";
import { PERSON_LOOK } from "./CustomizePanel";
import { GameSide, type SidePanel } from "./GameSide";
import { seatForPage, type SeatPage } from "./gameCommands";
import type { HotbarSlotId } from "./GameHotbar";
import { GameHud } from "./GameHud";
import { StudioBox } from "./StudioBox";
import { useStudioNames, type StudioMode } from "./StudioHud";
import { useStudioLooks } from "./studioLooks";
import { useStudioMusic } from "./studioMusic";
import { useStudioOrders, type StudioEmote } from "./studioOrders";
import { useSpokenReplies } from "./studioVoices";
import { useAgentAccountId } from "@/features/agents/personal/agentAccount";
import { ME, type Crowd } from "./studio/crowd";
import { canDrawRoom, SceneBoundary } from "./studio/SceneBoundary";
import {
  computerView,
  roomAt,
  roomCenters,
  seatOf,
  type RoomId,
  type SeatPlace,
} from "./studio/building";
import type { WalkOptions } from "./studio/StudioScene";
import { useGameCommands } from "./useGameCommands";
import { useGameTravel } from "./useGameTravel";
import { useStudioKeys } from "./useStudioKeys";
import { useStudioWorld } from "./useStudioWorld";
import { useWindowFullscreen } from "./useWindowFullscreen";
import { useNearby } from "./useNearby";

/** three.js is big, so the room's code is fetched while the agents and the layout load. */
const loadScene = () => import("./studio/StudioScene");
const StudioScene = lazyTool(loadScene);

/** How often the room the person is in is looked at again, for their teammates to see. */
const ROOM_EVERY_MS = 1000;

/** The shape of the building while it loads: the room, the row of agents and the build button. */
function StudioSkeleton() {
  return (
    <div
      className="absolute inset-0 grid place-items-center px-[10%] pt-18 pb-12"
      aria-hidden="true"
    >
      <Skeleton className="aspect-[20/11] w-full max-w-220 rounded-[1.75rem]" />
    </div>
  );
}

/**
 * The computer the person last sat at, per building: getting up, they come back to it, the camera
 * moving out of its screen. Kept while the window is open.
 */
let lastSeat: { space: string; place: SeatPlace } | null = null;

export interface VirtualStudioProps {
  /**
   * The computer the person sits at, its pages on the monitor over the room; null while they
   * walk. The room stays behind the monitor, still, with the band over it.
   */
  seat: SeatPlace | null;
  /** Sits down at one of the person's computers, on a page when one was asked for. */
  onSitDown(place: SeatPlace, page?: SeatPage): void;
  onOpenChat(agentId: string, conversationId: string): void;
  /** Opens an agent's settings: its engine, model and instructions. */
  onAgentSettings(agentId: string): void;
  onSettings(): void;
  onTeamSettings(): void;
  /** The Spaces the person can walk into, each a building. */
  buildings: readonly Building[];
  onEnterBuilding(id: string): void;
}

/**
 * Game mode's building: the Space as rooms to walk around in, where the person's agents work at
 * their desks and the Space's other members walk about. Each agent types at its desk while it
 * works, raises a hand there when it needs its person, puzzles over a run that failed, and drifts
 * around the lounge when it has nothing to do; a finished task leaves its result on its desk until
 * the person picks it up. Walking up to someone and pressing E gets their attention; the chat box
 * at the top left takes a message for any agent, a task for several together, or a `/` command:
 * `/teleport` goes anywhere at once. Sitting at the person's own desk, or at the library's reading
 * desk, moves the camera to its chair and lights the real pages up on a monitor over the room,
 * which stays behind it. It only shows what the runs report.
 */
export function VirtualStudio(props: VirtualStudioProps) {
  /** When the person last looked at each agent: a run that ended before then is no news. */
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [room, setRoom] = useState<RoomId | null>(null);
  const world = useStudioWorld({ seen, room });
  const { loading, agents, people, names, actors, studio, progress, spaceKey } = world;
  const { layout, change, reset } = studio;
  const [selected, pick] = useState<string | null>(null);
  const setSelected = useCallback((id: string | null) => {
    pick(id);
    if (id) setSeen((known) => ({ ...known, [id]: Date.now() }));
  }, []);
  const [mode, setMode] = useState<StudioMode>("studio");
  const [firstPerson, setFirstPerson] = useState(true);
  const [focus, setFocus] = useState(0);
  const [customizing, setCustomizing] = useState<string | null>(null);
  const [panel, setPanel] = useState<SidePanel>("people");
  const [chatOpen, setChatOpen] = useState(true);
  const [pickedItem, setPickedItem] = useState<string | null>(null);
  const [hireDesk, setHireDesk] = useState<string | undefined>();
  const [fullscreen, setFullscreen] = useWindowFullscreen();
  const [sceneKey, setSceneKey] = useState(0);
  const drawable = useMemo(canDrawRoom, []);
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [myEmote, setMyEmote] = useState<{ kind: StudioEmote; at: number } | null>(null);
  const [arcadeOpen, setArcadeOpen] = useState(false);
  const looks = useStudioLooks((state) => state.looks);
  const ownLook = looks[PERSON_LOOK]?.figure;
  const account = useAgentAccountId();
  useEffect(() => void useStudioLooks.getState().load(), [account]);
  useEffect(() => void loadScene().catch(() => undefined), []);
  // A player left playing while the building was away is still the building's.
  useEffect(() => void useStudioMusic.getState().sync(), []);
  useSpokenReplies();
  const musicShown = useStudioMusic((state) => state.shown);
  const namesShown = useStudioNames((state) => state.value.shown);
  const building = mode === "build";
  const walking = !building;
  // Where everyone stands and where everything is: the scene keeps them current, and the HUD
  // reads them to teleport and to say which room the person is in.
  const [anchors] = useState(() => new Map<string, Vector3>());
  const [crowd] = useState<Crowd>(() => new Map());

  const switchMode = useCallback(
    (next: StudioMode, deskId?: string) => {
      setMode(next);
      setPickedItem(null);
      setHireDesk(next === "hire" ? deskId : undefined);
      if (next !== "studio") setSelected(null);
    },
    [setSelected],
  );
  const toggleMusic = useCallback(() => {
    const music = useStudioMusic.getState();
    if (music.shown) music.hide();
    else music.show();
  }, []);
  const toggleNames = useCallback(() => {
    const tags = useStudioNames.getState();
    tags.set({ shown: !tags.value.shown });
  }, []);
  const act = useCallback((kind: StudioEmote) => {
    setEmoteOpen(false);
    setMyEmote({ kind, at: Date.now() });
  }, []);

  // Sitting down at a computer, and back from one: the camera moves to its chair, then the real
  // pages light up on its screen in the room; getting up it starts there and moves back out.
  const [sitting, setSitting] = useState<{ place: SeatPlace; page?: SeatPage } | null>(null);
  const [risingFrom] = useState(() => {
    const seat = lastSeat?.space === spaceKey ? lastSeat.place : null;
    lastSeat = null;
    return seat;
  });
  const { onSitDown } = props;
  // Sat down from elsewhere (a page opened while walking): the camera still moves to the chair.
  const seated = sitting?.place ?? props.seat;
  const seatNow = useRef(props.seat);
  seatNow.current = props.seat;
  // Once the camera is at the chair, the room holds still behind the monitor.
  const [settled, setSettled] = useState(false);
  const sat = useCallback(() => {
    setSettled(true);
    // Getting up, the camera moves back out from this chair.
    const place = sitting?.place ?? seatNow.current;
    if (place) lastSeat = { space: spaceKey, place };
    if (!sitting || seatNow.current) return;
    onSitDown(sitting.place, sitting.page);
  }, [sitting, spaceKey, onSitDown]);
  // Sitting down lets go of whoever had the person's attention and puts the chat away: the pages
  // have the room's middle now. The band's chat button brings it back.
  useEffect(() => {
    if (!props.seat) return;
    pick(null);
    setChatOpen(false);
    setEmoteOpen(false);
  }, [props.seat]);
  const travel = useGameTravel({
    layout,
    anchors,
    crowd,
    enabled: mode === "studio" && !seated,
    onSit: (place, page) => setSitting({ place, page }),
    onBuilding: props.onEnterBuilding,
  });
  const walk = useMemo<WalkOptions>(() => {
    const viewOf = (place: SeatPlace | null | undefined) => {
      const item = place && layout ? seatOf(layout.items, place) : undefined;
      return item ? computerView(item) : null;
    };
    return {
      memory: spaceKey,
      teleport: travel.teleport,
      sitting: viewOf(seated),
      onSat: sat,
      risingFrom: viewOf(risingFrom),
      who: account,
      look: ownLook,
    };
  }, [spaceKey, travel.teleport, seated, sat, risingFrom, layout, account, ownLook]);

  // Which room the person is in, for their teammates: looked at every second, said on a change.
  const centers = useMemo(() => (layout ? roomCenters(layout.items) : null), [layout]);
  useEffect(() => {
    if (!centers) return;
    const timer = window.setInterval(() => {
      const me = crowd.get(ME);
      if (me) setRoom(roomAt(me, centers));
    }, ROOM_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [centers, crowd]);

  const nearby = useNearby({
    walking: walking && !seated,
    names,
    actors,
    onTalk: (id) => {
      setSelected(id);
      setFocus((known) => known + 1);
    },
    onHire: (deskId) => switchMode("hire", deskId),
    onArcade: () => setArcadeOpen(true),
    onCollect: (agentId) => {
      world.collect(agentId);
      setSelected(agentId);
    },
    onSit: (place) => travel.sit(place),
    onDoor: () => setPanel("buildings"),
  });

  const commands = useGameCommands({
    agents,
    names,
    members: people.members,
    buildings: props.buildings,
    goTo: travel.goTo,
    sit: () => travel.sit("desk"),
    // Already at a computer, the page opens on it; walking, the person sits down at its own.
    openPage: (page) =>
      props.seat
        ? onSitDown(props.seat, page)
        : travel.goTo({ kind: "seat", place: seatForPage(page), page }),
    settings: props.onSettings,
    emote: act,
  });

  /** What a hotbar slot does, pressed or keyed. */
  const pressSlot = (id: HotbarSlotId) => {
    if (id === "emote") setEmoteOpen((open) => !open);
    else if (id === "desk") travel.sit("desk");
    else if (id === "meeting" || id === "library" || id === "lounge")
      travel.goTo({ kind: "room", room: id });
    else if (id === "games") setArcadeOpen(true);
    else if (id === "music") toggleMusic();
    else if (id === "build") switchMode("build");
    else toggleNames();
  };

  useStudioKeys({
    enabled: !seated,
    emoteOpen,
    hotbar: mode === "studio" && !loading && !arcadeOpen,
    emote: act,
    closeEmotes: () => setEmoteOpen(false),
    slot: pressSlot,
    level: () => setPanel((open) => (open === "level" ? null : "level")),
    names: toggleNames,
    fullscreen: () => setFullscreen((on) => !on),
    build: () => switchMode("build"),
    escape: () => {
      if (selected) setSelected(null);
      else if (customizing) setCustomizing(null);
      else if (mode !== "studio") switchMode("studio");
      else if (panel === "buildings") setPanel(null);
      else if (fullscreen) setFullscreen(false);
      else return false;
      return true;
    },
  });

  const picked = mode === "studio" ? actors.find((actor) => actor.id === selected) : undefined;
  const pickedAgent = agents.find((item) => item.agent.id === picked?.id);
  const pickedMember = Boolean(selected?.startsWith("member:"));
  // The chat and the hotbar are how the person gets about and sits down, agents or none.
  const ready = !loading;

  return (
    <Surface
      tone="stage"
      className={cn(
        // The room is in colour, which the owner allowed for this one surface; everything laid
        // over it floats on see-through panels.
        "group/studio relative h-full min-h-0 w-full overflow-hidden",
        "[&_canvas]:block [&_canvas]:touch-none",
        building && "[&_canvas]:cursor-default",
        // Sat at the desk, the room is only seen round the monitor: it takes no clicks.
        seated && "[&_canvas]:pointer-events-none",
      )}
      data-misty-window-drag-block="true"
      data-building={building || undefined}
      data-talking={(picked && !pickedAgent) || pickedMember ? true : undefined}
    >
      {!drawable ? (
        <ErrorState
          title="Couldn't draw the building"
          line="This computer's graphics don't support drawing the room."
        />
      ) : (
        <SceneBoundary onRetry={() => setSceneKey((known) => known + 1)}>
          <ToolSuspense tool="studio" className="absolute inset-0">
            {loading || !layout ? (
              <StudioSkeleton />
            ) : (
              <StudioScene
                key={sceneKey}
                actors={actors}
                layout={layout}
                anchors={anchors}
                crowd={crowd}
                selected={selected}
                onSelect={setSelected}
                listening={picked?.id ?? null}
                myEmote={myEmote}
                trophies={progress.reached.length}
                onArcade={() => setArcadeOpen(true)}
                namesShown={namesShown}
                pops={world.pops}
                prompt={selected === nearby.target ? null : nearby.prompt}
                results={world.resultIds}
                onCollect={(agentId) => {
                  setSelected(agentId);
                  setFocus((known) => known + 1);
                }}
                onFirstPerson={setFirstPerson}
                // Talking to someone gives the cursor back, as Escape does: the talk panel and
                // the box need it. A click into the room takes hold again once the talk ends.
                freeLook={
                  mode === "studio" &&
                  !seated &&
                  !customizing &&
                  !arcadeOpen &&
                  !picked &&
                  !pickedMember
                }
                paused={Boolean(props.seat) && settled}
                building={building}
                pickedItem={pickedItem}
                onPickItem={setPickedItem}
                onLayout={change}
                walking={walking}
                names={names}
                speech={world.speech}
                onNear={nearby.setNear}
                onHireAt={(deskId) => switchMode("hire", deskId)}
                board={world.board}
                looks={looks}
                walk={walk}
              />
            )}
          </ToolSuspense>
        </SceneBoundary>
      )}
      {building && layout ? (
        <BuildPanel
          layout={layout}
          progress={progress}
          agents={agents}
          picked={pickedItem}
          onPick={setPickedItem}
          onLayout={change}
          onClose={() => switchMode("studio")}
          onReset={() => {
            reset();
            setPickedItem(null);
          }}
        />
      ) : null}
      {walking && firstPerson && !loading && !arcadeOpen && !seated ? <SceneCrosshair /> : null}
      {arcadeOpen ? <ArcadePanel spaceId={spaceKey} onClose={() => setArcadeOpen(false)} /> : null}
      <GameHud
        // Hidden while the camera moves to the chair; back, band only, once sat.
        visible={mode === "studio" && !arcadeOpen && (!sitting || Boolean(props.seat))}
        seated={Boolean(seated)}
        ready={ready}
        loading={loading}
        menu={{
          onCharacter: () => setCustomizing(PERSON_LOOK),
          onSettings: props.onSettings,
          onTeamSettings: props.onTeamSettings,
          onBuild: () => switchMode("build"),
          onBuildings: () => setPanel("buildings"),
          onFullscreen: () => setFullscreen((on) => !on),
          fullscreen,
          seated: Boolean(seated),
        }}
        chat={
          <StudioBox
            agents={agents}
            names={names}
            visitors={world.teammates}
            attention={pickedAgent ?? null}
            onTalking={setSelected}
            commands={commands}
            below
            // The agent's own panel shows the talk; the box only takes what is typed to it.
            log={!pickedAgent}
          />
        }
        chatOpen={chatOpen}
        onChat={() => setChatOpen((open) => !open)}
        side={
          <GameSide
            world={world}
            mode={mode}
            arcadeOpen={arcadeOpen}
            hireDesk={hireDesk}
            customizing={customizing}
            selected={selected}
            focus={focus}
            panel={panel}
            buildings={props.buildings}
            onEnterBuilding={props.onEnterBuilding}
            onOpenChat={props.onOpenChat}
            onAgentSettings={props.onAgentSettings}
            onMode={switchMode}
            onCustomize={setCustomizing}
            onSelect={setSelected}
            onPanel={setPanel}
            onFocus={() => setFocus((known) => known + 1)}
          />
        }
        panel={panel}
        onPanel={(next) => setPanel((open) => (open === next ? null : next))}
        peopleCount={loading ? null : agents.length + people.members.length}
        progress={progress}
        following={
          // An agent following the person: who, and a way to send it back to its work.
          pickedAgent && picked?.order === "person"
            ? {
                attention: {
                  id: pickedAgent.agent.id,
                  name: names.get(pickedAgent.agent.id) ?? pickedAgent.agent.name,
                  state: pickedAgent.state,
                  agent: pickedAgent.agent,
                  following: true,
                },
                onSendBack: () => useStudioOrders.getState().release(pickedAgent.agent.id),
                onRelease: () => setSelected(null),
              }
            : null
        }
        emoteOpen={emoteOpen}
        onEmoteOpen={setEmoteOpen}
        onEmote={act}
        musicShown={musicShown}
        namesShown={namesShown}
        onSlot={pressSlot}
        unlocked={world.unlocked.unlocked}
        onUnlockBuild={() => {
          world.unlocked.dismiss();
          switchMode("build");
        }}
        onUnlockClose={world.unlocked.dismiss}
        firstPerson={firstPerson}
        walking={walking}
        building={props.buildings.find((building) => building.current)?.name}
      />
    </Surface>
  );
}
