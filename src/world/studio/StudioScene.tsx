import { OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Vector3 } from "three";
import { planGoals, type Actor, type Goal } from "./behaviour";
import { BuildLayer } from "./BuildLayer";
import { Character } from "./Character";
import { ME, type Crowd } from "./crowd";
import type { StudioEmote } from "../studioOrders";
import { DOOR, GRID, applyRoomSize, cellCenter } from "./grid";
import { deskOwners, itemCenter, itemSolids, moveItem, type StudioLayout } from "./layout";
import { teamShirts } from "./look";
import { buildNavGrid } from "./pathfinding";
import { studioPlaces } from "./places";
import { screenOf, type ScreenKind } from "./DeskScreen";
import { Piece, type Grab } from "./Piece";
import { Room } from "./Room";
import { Whiteboard } from "./Whiteboard";
import type { BoardRow } from "../studioTalk";
import type { AgentLook, DeskLook } from "../studioLooks";
import { SceneLabels } from "./SceneLabels";
import { TagProjector } from "./Tags";
import { usePageHidden, useReducedMotion } from "./useMotionPreference";
import { preloadFigures } from "./figure/CharacterModel";
import { characterFor } from "./figure/characterModels";
import { Walk } from "./Walk";
import type { WalkOptions } from "./walkOptions";
import { chairOf, seatOf, type SeatPlace } from "./building";
import { useStudioCamera } from "./cameraSettings";
import {
  EndlessOrbit,
  Follow,
  Framing,
  OverviewDepth,
  TARGET,
  roomScale,
  type OrbitControlsImpl,
} from "./SceneCamera";

export type { WalkOptions } from "./walkOptions";

/** Seconds between two looks at where the resting agents should drift to next. */
const TICK = 4000;

export interface StudioSceneProps {
  actors: Actor[];
  layout: StudioLayout;
  selected: string | null;
  onSelect(id: string | null): void;
  /** Whoever the person is talking to, who stops and listens. */
  listening?: string | null;
  building: boolean;
  pickedItem: string | null;
  onPickItem(id: string | null): void;
  onLayout(next: StudioLayout): void;
  /** Walk mode: the person walks the room as a figure, and the camera follows them. */
  walking: boolean;
  /** The name each figure goes by in the room, told apart where two share one. */
  names: Map<string, string>;
  /** What a figure is saying, while it answers something asked in the studio. */
  speech: Map<string, string>;
  /** In walk mode, the agent the person has walked up to, or `desk:<id>` for a free desk. */
  onNear?(id: string | null): void;
  /** Hire someone for a free desk. */
  onHireAt?(deskId: string): void;
  /** How each agent was dressed up, and what is on its desk. */
  looks: Record<string, AgentLook>;
  /** A task several agents share, put up on the meeting room's board. */
  board?: { task: string; rows: BoardRow[] } | null;
  /** What the person's own figure acts out, picked from the emote wheel. */
  myEmote?: { kind: StudioEmote; at: number } | null;
  /** Milestones reached, one trophy each on a trophy shelf. */
  trophies?: number;
  /** Walking up to or clicking the arcade cabinet opens its games. */
  onArcade?(): void;
  /** Name tags over the figures, and what they say; off, none shows. */
  namesShown?: boolean;
  /** The key to press for what the person walked up to, floating by it. */
  prompt?: { anchor: string; words: string } | null;
  /** Figures that just earned something, by id, and when: a "+1" rises off each. */
  pops?: Record<string, number>;
  /** Agents with a finished task's result waiting on their desk, to be collected. */
  results?: ReadonlySet<string>;
  /** Picks up an agent's waiting result: walked up to as `result:<agent id>`, or its sign. */
  onCollect?(agentId: string): void;
  /** Told whether walking looks out of the person's own eyes. */
  onFirstPerson?(first: boolean): void;
  /** Whether walking may hold the pointer to look: not while a panel needs the cursor. */
  freeLook?: boolean;
  /**
   * The person sits at their desk, the pages on a monitor over the room: the room holds still,
   * drawn only when something asks, so working costs nothing to draw.
   */
  paused?: boolean;
  /** Game mode's walking: which building, a teleport, sitting at a computer and getting up. */
  walk: WalkOptions;
  /** Where every figure and thing is, shared with what is drawn over the scene. */
  anchors?: Map<string, Vector3>;
  /** Where everyone stands, shared the same way. */
  crowd?: Crowd;
}

/**
 * The studio itself: the room, its furniture, and a figure for every agent, drawn with three.js.
 * Drag to look around, scroll to come closer, pick a figure to see what it is up to. In build mode
 * the furniture can be dragged from cell to cell instead.
 */
export default function StudioScene(props: StudioSceneProps) {
  const { actors, layout, building, onLayout, onPickItem } = props;
  const { size } = layout;
  // Every measure below reads the floor's size, so it is set before any of them is worked out.
  applyRoomSize(size);
  const scale = roomScale(size);
  const still = useReducedMotion();
  const hidden = usePageHidden();
  const [tick, setTick] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: string; x: number; z: number } | null>(null);
  /** When a drag last ended: the click that ends a drag must not count as a click on the floor. */
  const dropped = useRef(0);
  const latest = useRef(layout);
  latest.current = layout;
  const controls = useRef<OrbitControlsImpl>(null);
  const studioCamera = useStudioCamera();
  const [ownAnchors] = useState(() => new Map<string, Vector3>());
  const anchors = props.anchors ?? ownAnchors;
  const [tags] = useState(() => new Map<string, HTMLElement>());
  /** Where everyone stands, so nobody walks into anybody else. */
  const [ownCrowd] = useState<Crowd>(() => new Map());
  const crowd = props.crowd ?? ownCrowd;

  useEffect(() => {
    if (still || hidden) return;
    const timer = window.setInterval(() => setTick((known) => known + 1), TICK);
    return () => window.clearInterval(timer);
  }, [still, hidden]);

  const grid = useMemo(() => buildNavGrid(layout.items, size), [layout.items, size]);
  // What the person's figure walks up against: the pieces as drawn, not the cells they take.
  // The room's size is in the deps because every piece's place is measured from its middle.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the size moves every piece's middle
  const solids = useMemo(() => layout.items.flatMap(itemSolids), [layout.items, size]);
  const places = useMemo(() => studioPlaces(layout.items, grid), [layout.items, grid]);
  const own = useMemo(() => actors.filter((actor) => !actor.guest), [actors]);
  const desks = useMemo(
    () =>
      deskOwners(
        layout.items,
        own.map((actor) => actor.id),
      ),
    [layout.items, own],
  );
  // Each plan starts from the last one, so figures keep their places (`planGoals`).
  const lastGoals = useRef(new Map<string, Goal>());
  const goals = useMemo(() => {
    // Read on each plan: sent to the person, a figure finds them wherever they walked to.
    const person = crowd.get(ME);
    const next = planGoals(actors, places, desks, tick, lastGoals.current, person);
    lastGoals.current = next;
    return next;
  }, [actors, places, desks, tick, crowd]);
  const shirts = useMemo(() => teamShirts(actors.map((actor) => actor.id)), [actors]);
  // Everyone's character starts loading as soon as they are known, the person's own too.
  const { looks } = props;
  const worn = actors
    .map((actor) => characterFor(actor.id, looks[actor.id]?.figure?.model))
    .concat(characterFor(props.walk.who, props.walk.look?.model))
    .join(",");
  useEffect(() => preloadFigures(worn.split(",")), [worn]);
  const deskNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const actor of own) {
      const desk = desks.get(actor.id);
      if (desk) names.set(desk, actor.name);
    }
    return names;
  }, [own, desks]);
  const desksShown = useMemo(
    () => layout.items.filter((item) => item.kind === "desk"),
    [layout.items],
  );
  const arcades = useMemo(
    () => layout.items.filter((item) => item.kind === "arcade"),
    [layout.items],
  );
  const { onArcade } = props;
  const openArcade = useCallback(() => onArcade?.(), [onArcade]);
  /** Each waiting result's agent, with the desk it waits on. */
  const parcels = useMemo(() => {
    const at = new Map<string, string>();
    for (const agentId of props.results ?? []) {
      const desk = desks.get(agentId);
      if (desk) at.set(agentId, desk);
    }
    return at;
  }, [props.results, desks]);
  const parcelDesks = useMemo(() => new Set(parcels.values()), [parcels]);
  /** Desks nobody has: each can be hired for, from the room itself. */
  const freeDesks = useMemo(
    () => desksShown.filter((desk) => !deskNames.has(desk.id)),
    [desksShown, deskNames],
  );
  /** The person's two computers: their desk's and the library's, sat at to open real pages. */
  const computers = useMemo(
    () =>
      (["desk", "library"] as SeatPlace[]).flatMap((place) => {
        const item = seatOf(layout.items, place);
        return item ? [{ place, item }] : [];
      }),
    [layout.items],
  );
  // Your own agents, members (to talk to them), free desks and your computers can be walked up to.
  const walkable = useMemo(
    () => [
      ...actors.filter((actor) => !actor.guest || actor.kind === "member").map((actor) => actor.id),
      ...freeDesks.map((desk) => `desk:${desk.id}`),
      ...arcades.map((arcade) => `arcade:${arcade.id}`),
      ...[...parcels.keys()].map((agentId) => `result:${agentId}`),
      ...computers.map(({ place }) => `seat:${place}`),
      "exit:door",
    ],
    [actors, freeDesks, arcades, parcels, computers],
  );
  useEffect(() => {
    // The front door, in the left wall: walked up to, it leads to the other buildings.
    const door = cellCenter({ x: 0, z: DOOR.z });
    anchors.set("exit:door", new Vector3(door.x - 0.4, 1.5, door.z));
    return () => void anchors.delete("exit:door");
  }, [anchors]);
  useEffect(() => {
    // A computer is walked up to at its chair, where "Sit down" floats.
    for (const { place, item } of computers) {
      const at = chairOf(item);
      anchors.set(`seat:${place}`, new Vector3(at.x, 1.35, at.z));
    }
    return () => {
      for (const { place } of computers) anchors.delete(`seat:${place}`);
    };
  }, [anchors, computers]);
  useEffect(() => {
    // A waiting result is walked up to at its desk, where its sign floats.
    const placed: string[] = [];
    for (const [agentId, deskId] of parcels) {
      const desk = layout.items.find((item) => item.id === deskId);
      if (!desk) continue;
      const at = itemCenter(desk);
      anchors.set(`result:${agentId}`, new Vector3(at.x, 1.5, at.z));
      placed.push(`result:${agentId}`);
    }
    return () => {
      for (const key of placed) anchors.delete(key);
    };
  }, [anchors, parcels, layout.items]);
  useEffect(() => {
    // The cabinet is walked up to like a person, to play it.
    for (const arcade of arcades) {
      const at = itemCenter(arcade);
      // Level with the top of the cabinet, where its prompt floats.
      anchors.set(`arcade:${arcade.id}`, new Vector3(at.x, 1.9, at.z));
    }
    return () => {
      for (const arcade of arcades) anchors.delete(`arcade:${arcade.id}`);
    };
  }, [anchors, arcades]);
  useEffect(() => {
    // A desk's name floats over its screen; it only shows in build mode.
    for (const desk of desksShown) {
      const at = itemCenter(desk);
      anchors.set(`desk:${desk.id}`, new Vector3(at.x, 1.5, at.z));
    }
    return () => {
      for (const desk of desksShown) anchors.delete(`desk:${desk.id}`);
    };
  }, [anchors, desksShown]);
  // A desk carries what its agent put on it, whichever desk that is.
  const deskDecor = new Map<string, DeskLook>();
  for (const [agentId, deskId] of desks) {
    const decor = props.looks[agentId]?.desk;
    if (decor) deskDecor.set(deskId, decor);
  }
  // Each desk's monitor shows what its own agent is doing, wherever in the room it is.
  const screens = new Map<string, ScreenKind>();
  for (const actor of own) {
    const desk = desks.get(actor.id);
    const kind = screenOf(actor);
    if (desk && kind) screens.set(desk, kind);
  }
  // Agents sharing a task gather at the first table (`planGoals`), so its board stands there.
  const boardTable = layout.items.find((item) => item.kind === "table");
  const lamps = layout.items.filter((item) => item.kind === "lamp").slice(0, 4);

  const grab = useCallback<Grab>(
    (item, event) => {
      event.stopPropagation();
      const { origin, direction } = event.ray;
      const reach = direction.y ? -origin.y / direction.y : 0;
      drag.current = {
        id: item.id,
        x: origin.x + direction.x * reach + GRID.w / 2 - item.x,
        z: origin.z + direction.z * reach + GRID.d / 2 - item.z,
      };
      if (controls.current) controls.current.enabled = false;
      setDragging(true);
      onPickItem(item.id);
    },
    [onPickItem],
  );
  const dragTo = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const held = drag.current;
      if (!held) return;
      const x = Math.round(event.point.x + GRID.w / 2 - held.x);
      const z = Math.round(event.point.z + GRID.d / 2 - held.z);
      const next = moveItem(latest.current, held.id, x, z);
      if (next !== latest.current) onLayout(next);
    },
    [onLayout],
  );
  useEffect(() => {
    if (!dragging) return;
    const drop = () => {
      drag.current = null;
      dropped.current = performance.now();
      setDragging(false);
    };
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", drop);
    return () => {
      window.removeEventListener("pointerup", drop);
      window.removeEventListener("pointercancel", drop);
    };
  }, [dragging]);
  useEffect(() => () => void (document.body.style.cursor = ""), []);

  return (
    <div className="absolute inset-0">
      <Canvas
        // Soft filtering: a wide PCF radius hatched the shadows into stripes seen up close.
        shadows="soft"
        dpr={[1, 2]}
        // On while the room is walked: the browser already stops animation frames for a page out
        // of sight. With "never" while document.hidden, not even the first frame was drawn, so a
        // web view that reported the page hidden as the room opened left it blank until it was
        // shown again. Sat at the desk, "demand" keeps the last frame round the monitor.
        frameloop={props.paused ? "demand" : "always"}
        camera={{ fov: 30, near: 0.5, far: 400, position: [16, 17, 19] }}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => (building ? undefined : props.onSelect(null))}
      >
        <hemisphereLight args={["#fff6e6", "#8f8172", 0.95]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[9 * scale, 17 * scale, 8 * scale]}
          intensity={2.1}
          color="#fff0d8"
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.04}
        >
          <orthographicCamera
            key={`${size.w}x${size.d}`}
            attach="shadow-camera"
            args={[-size.w * 0.75, size.w * 0.75, size.d * 0.95, -size.d * 0.95, 1, 60 * scale]}
          />
        </directionalLight>
        <Room key={`${size.w}x${size.d}`} size={size} />
        {layout.items.map((item) => (
          <Piece
            key={item.id}
            item={item}
            screen={screens.get(item.id) ?? null}
            decor={deskDecor.get(item.id)}
            parcel={!building && parcelDesks.has(item.id)}
            still={still}
            glow={lamps.includes(item)}
            ready={
              (item.kind === "workstation" && props.prompt?.anchor === "seat:desk") ||
              (item.kind === "reading-desk" && props.prompt?.anchor === "seat:library")
            }
            trophies={item.kind === "trophies" ? props.trophies : undefined}
            onGrab={building ? grab : undefined}
            onUse={item.kind === "arcade" && onArcade ? openArcade : undefined}
          />
        ))}
        {actors.map((actor) => {
          const goal = goals.get(actor.id);
          if (!goal) return null;
          return (
            <Character
              key={actor.id}
              actor={actor}
              goal={goal}
              grid={grid}
              shirt={shirts.get(actor.id) ?? "#4d9de0"}
              selected={!building && props.selected === actor.id}
              still={still}
              quiet={building}
              listening={!building && props.listening === actor.id}
              crowd={crowd}
              anchors={anchors}
              figure={props.looks[actor.id]?.figure}
              onPick={props.onSelect}
            />
          );
        })}
        {props.board && boardTable && !building ? (
          <Whiteboard
            at={itemCenter(boardTable)}
            task={props.board.task}
            rows={props.board.rows}
            names={props.names}
          />
        ) : null}
        {building ? (
          <BuildLayer
            key={`${size.w}x${size.d}`}
            items={layout.items}
            picked={props.pickedItem}
            onDrag={dragTo}
            onFloorClick={() => performance.now() - dropped.current > 300 && onPickItem(null)}
          />
        ) : null}
        {props.walking && !building ? (
          <Walk
            grid={grid}
            solids={solids}
            still={still}
            anchors={anchors}
            crowd={crowd}
            people={walkable}
            emote={props.myEmote}
            onNear={props.onNear}
            onFirstPerson={props.onFirstPerson}
            freeLook={props.freeLook}
            {...props.walk}
          />
        ) : (
          <>
            <OrbitControls
              ref={controls}
              makeDefault
              enabled={!dragging}
              enableDamping={!still}
              dampingFactor={0.12}
              target={TARGET}
              minDistance={4}
              maxDistance={56 * scale}
              minPolarAngle={0.2}
              maxPolarAngle={1.36}
              screenSpacePanning={false}
              rotateSpeed={studioCamera.sensitivity}
              panSpeed={studioCamera.sensitivity}
              zoomSpeed={0.8 * studioCamera.zoom}
              onChange={() => {
                const target = controls.current?.target;
                if (!target) return;
                target.x = Math.min(GRID.w / 2, Math.max(-GRID.w / 2, target.x));
                target.z = Math.min(GRID.d / 2, Math.max(-GRID.d / 2, target.z));
                target.y = TARGET[1];
              }}
            />
            <Framing size={size} />
            <OverviewDepth />
            <EndlessOrbit enabled={!building} invert={studioCamera.invert} />
            <Follow id={building ? null : props.selected} anchors={anchors} still={still} />
          </>
        )}
        <TagProjector anchors={anchors} tags={tags} shown={props.namesShown !== false} />
      </Canvas>
      <SceneLabels
        building={building}
        tags={tags}
        desksShown={desksShown}
        deskNames={deskNames}
        freeDesks={freeDesks}
        onHireAt={props.onHireAt}
        parcels={parcels}
        onCollect={props.onCollect}
        names={props.names}
        prompt={props.prompt}
        pops={props.pops}
        actors={actors}
        selected={props.selected}
        speech={props.speech}
        onSelect={props.onSelect}
      />
    </div>
  );
}
