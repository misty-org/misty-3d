import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Vector3, type Group } from "three";
import type { Actor, Goal } from "./behaviour";
import type { Spot } from "./places";
import type { FigureLook } from "../studioLooks";
import { ME, type Crowd } from "./crowd";
import { EMOTE_MS } from "../studioOrders";
import { characterLook, hashOf } from "./look";
import { createWalker, finishWalk, turnToward, type Walker } from "./motion";
import { FLOOR_MARK } from "./parts";
import { routeTo, type NavGrid } from "./pathfinding";
import { characterFor } from "./figure/characterModels";
import { CharacterModel, FIGURE_SCALE, type FigureHandle } from "./figure/CharacterModel";
import { FigureMarks } from "./figure/FigureMarks";
import { figurePose, type Doing } from "./figure/figurePose";
import { RETRY_AFTER, freshHold, walkAmong, type Hold } from "./figure/figureWalk";

/** Scene units a figure walks in a second, and jogs when work has started or its person waits. */
const SPEED = 1.9;
const JOG = 3.4;
/** Seconds a cheer lasts once a run finishes. */
const CHEER_TIME = 1.8;
/** Seconds to step into a seat and lower into it, and to get up and step back out. */
const SIT_TIME = 1.3;
const RISE_TIME = 1.0;
/** The share of sitting down spent stepping from the floor beside the seat onto it, turning to
 * face the way it sits; the rest is lowering into it. */
const STEP_SHARE = 0.4;
/** How near the floor beside its seat a figure must be to sit down: from further away it would
 * slide through whatever is between. */
const SEAT_REACH = 0.45;
/** How thick a thigh is: a seated figure rests this far over the seat. */
const THIGH = 0.05;
/** Just over the top of a standing figure's head, where what it says is shown. */
const HEAD_TOP = 1.62;
/** How near the person must be for a figure to look at them, and how far its head turns and tips
 * before the rest of it would have to. */
const LOOK_NEAR = 4.5;
const LOOK_YAW = 1.15;
const LOOK_PITCH = 0.45;
/** How high the person's eyes are, and the figure's own. */
const PERSON_EYES = 1.12;
const OWN_EYES = 1.1;
/** Following the person: how far behind them it stays, how far they may get before it sets off
 * after them (or gets up out of its seat), and when it jogs to catch up. */
const FOLLOW_GAP = 1.15;
/** How near the person must be for a figure with their attention to stop and listen. */
const LISTEN_NEAR = 6;
const FOLLOW_FAR = 1.7;
const FOLLOW_JOG = 3.5;
/** Seconds between two looks at where the person has got to, and how far they must have moved
 * for the route after them to be worked out again. */
const FOLLOW_EVERY = 0.4;
const FOLLOW_MOVED = 0.5;

/** An angle brought into the half turn either side of nothing. */
const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
/** Slow at both ends, so a figure settles into a seat instead of snapping onto it. */
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const clampTo = (value: number, most: number) => Math.max(-most, Math.min(most, value));
/** Part of the way from one angle to another, the short way round. */
const mixAngle = (from: number, to: number, t: number) => from + wrapAngle(to - from) * t;

/**
 * One agent, or a teammate, as a character in the building. It walks the route to wherever its
 * goal is, sits down when that is a seat, and then does what the goal says: types, talks, raises
 * a hand for its person, puzzles over a failed run, waves or just rests. Everything it does is read
 * from the goal; the figure decides nothing itself.
 */
export function Character(props: {
  actor: Actor;
  goal: Goal;
  grid: NavGrid;
  shirt: string;
  selected: boolean;
  /** No walking or swaying: the figure is simply put where it belongs. */
  still: boolean;
  /** Build mode: figures stay out of the way of the furniture being moved. */
  quiet: boolean;
  /** The person is talking to it: it stops where it is and turns to them. */
  listening: boolean;
  /** Everyone on the floor, which it keeps out of the way of and keeps its own place in. */
  crowd: Crowd;
  /** Where each figure's name goes, kept current for the tags drawn over the scene. */
  anchors: Map<string, Vector3>;
  /** How its person dressed it up, over the look worked out from its id. */
  figure?: FigureLook;
  onPick(id: string): void;
}) {
  const { actor, goal, grid, still, figure } = props;
  const colors = useMemo(() => {
    const own = characterLook(actor.id);
    return {
      skin: figure?.skin ?? own.skin,
      hair: figure?.hair ?? own.hair,
      trousers: figure?.trousers ?? own.trousers,
      shirt: figure?.shirt ?? props.shirt,
    };
  }, [actor.id, figure, props.shirt]);
  const model = characterFor(actor.id, figure?.model);
  const walker = useRef<Walker | null>(null);
  walker.current ??= createWalker(goal.spot.via ?? goal.spot, goal.spot.yaw);
  // How far into its seat the figure is, from standing on the floor beside it to sat down, and
  // which seat that is: getting up finishes in the old seat before the walk to the next place.
  const seated = useRef(goal.spot.sit ? 1 : 0);
  const seat = useRef<Spot | null>(goal.spot.sit ? goal.spot : null);
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const handle = useRef<FigureHandle | null>(null);
  /** How much it is looking at the person, eased in and out so the head never snaps round. */
  const gaze = useRef(0);
  const head = useRef({ turn: 0, nod: 0, tip: 0 });
  /** How fast it is going, eased, so its legs don't stutter between frames, and where it was. */
  const pace = useRef(0);
  const lastAt = useRef<{ x: number; z: number } | null>(null);
  /** Whether it was last getting up, rather than sitting down, and the way it steps out. */
  const rising = useRef<{ was: number; out: number | null }>({ was: 0, out: null });
  const phase = useMemo(() => (actor.id.length * 1.7) % 6, [actor.id]);
  // A run finishing while the room is watched is cheered once; one that was done before it opened
  // isn't, since nobody saw it end.
  const outcome = actor.outcome ?? "";
  const lastOutcome = useRef(outcome);
  const cheer = useRef<{ pending: boolean; from: number }>({ pending: false, from: -1 });
  useEffect(() => {
    if (outcome === "done" && lastOutcome.current !== "done") cheer.current.pending = true;
    lastOutcome.current = outcome;
  }, [outcome]);

  const held = useRef<Hold>(freshHold());
  /** Where the person was when the route after them was last worked out, and when. */
  const chase = useRef<{ x: number; z: number; at: number } | null>(null);

  useEffect(() => {
    const self = walker.current;
    if (!self) return;
    // Following the person, it keeps after them; it goes to its new place once that ends.
    const withPerson = actor.order === "person";
    if (withPerson && props.crowd.has(ME) && !still) return;
    // A seat is walked up to, not into: the figure stops on the floor beside it and sits from there.
    const stop = goal.spot.via ?? goal.spot;
    self.path = routeTo(grid, self, stop, stop);
    self.moving = true;
    held.current = freshHold();
    if (still) {
      finishWalk(self);
      self.yaw = goal.spot.yaw;
      seated.current = goal.spot.sit ? 1 : 0;
      seat.current = goal.spot.sit ? goal.spot : null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new place re-routes; talking is read as it stands
  }, [grid, goal.spot, still]);

  const { anchors, crowd } = props;
  // Done talking, or no longer called over: back to where its work puts it, from wherever
  // following the person took it.
  const withPerson = props.listening || actor.order === "person";
  const wasWithPerson = useRef(withPerson);
  useEffect(() => {
    const self = walker.current;
    const was = wasWithPerson.current;
    wasWithPerson.current = withPerson;
    chase.current = null;
    if (!self || !was || withPerson) return;
    const stop = goal.spot.via ?? goal.spot;
    self.path = routeTo(grid, self, stop, stop);
    self.moving = true;
    held.current = freshHold();
    if (still) finishWalk(self);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the end of a talk re-routes
  }, [withPerson]);
  useEffect(() => () => void crowd.delete(actor.id), [crowd, actor.id]);
  useEffect(() => {
    anchors.set(actor.id, new Vector3(goal.spot.x, 0, goal.spot.z));
    anchors.set(`head:${actor.id}`, new Vector3(goal.spot.x, HEAD_TOP, goal.spot.z));
    return () => {
      anchors.delete(actor.id);
      anchors.delete(`head:${actor.id}`);
    };
    // The anchor only has to exist; the frame loop keeps it where the figure is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchors, actor.id]);

  const walk = (self: Walker, step: number, speed?: number) => {
    const hurry = goal.activity === "type" || goal.activity === "wave" || goal.activity === "hand";
    held.current = walkAmong(self, step, speed ?? (hurry ? JOG : SPEED), {
      id: actor.id,
      crowd,
      grid,
      held: held.current,
    });
  };

  useFrame(({ clock, camera }, delta) => {
    const self = walker.current;
    if (!self || !root.current || !body.current) return;
    const step = Math.min(delta, 0.1);
    const time = still ? 0 : clock.elapsedTime + phase;
    // Get up before setting off; once arrived beside the seat, step onto it and lower into it.
    // A figure that gave up, or stopped, short of its seat doesn't sit in it from across the room.
    const entry = goal.spot.via ?? goal.spot;
    const besideSeat = Math.hypot(entry.x - self.x, entry.z - self.z) < SEAT_REACH;
    const here =
      !self.moving &&
      goal.spot.sit &&
      held.current.gaveUp === null &&
      (besideSeat || seat.current === goal.spot)
        ? goal.spot
        : null;
    // With the person's attention it stops where it is and turns to them, while they're near; it
    // never trails after them for it.
    const near = crowd.get(ME);
    const listening =
      props.listening && (!near || Math.hypot(near.x - self.x, near.z - self.z) < LISTEN_NEAR);
    // Told to come to the person, it follows their figure, each at its own distance, so the team
    // stands round them, until it is sent back to work.
    const summoned = actor.order === "person" && !listening;
    const me = summoned && !still ? crowd.get(ME) : undefined;
    const gap = me ? Math.hypot(me.x - self.x, me.z - self.z) : 0;
    const keep = summoned ? FOLLOW_GAP + 0.35 + (hashOf(actor.id) % 5) * 0.2 : FOLLOW_GAP;
    const following = Boolean(me) && (self.moving || gap > keep + FOLLOW_FAR - FOLLOW_GAP);
    if (!still) {
      if (me && following) {
        if (seat.current) {
          // Up out of its seat first.
          seated.current = Math.max(0, seated.current - step / RISE_TIME);
          if (seated.current === 0) seat.current = null;
        } else if (gap <= keep) {
          [self.path, self.moving] = [[], false];
          held.current = freshHold();
          chase.current = null;
        } else {
          const now = clock.elapsedTime;
          const last = chase.current;
          const moved = !last || Math.hypot(me.x - last.x, me.z - last.z) > FOLLOW_MOVED;
          // Given up on getting nearer (the others are round them already), it stays where it
          // is until the person moves on.
          if (held.current.gaveUp === null || moved) {
            if (moved || (self.moving && last && now - last.at > FOLLOW_EVERY)) {
              // A step short of them, on their side of where it stands.
              const toward = { x: (self.x - me.x) / gap, z: (self.z - me.z) / gap };
              const target = { x: me.x + toward.x * keep, z: me.z + toward.z * keep };
              self.path = routeTo(grid, self, target, target);
              self.moving = self.path.length > 0;
              chase.current = { x: me.x, z: me.z, at: now };
              if (moved) held.current = freshHold();
            }
            if (self.moving) walk(self, step, gap > 4 ? FOLLOW_JOG : SPEED * 1.2);
          }
        }
      } else if (me || listening) {
        // With the person, or listening to them: it stands where it is, only finishing sitting
        // down if it was halfway there.
        if (here && seat.current === here)
          seated.current = Math.min(1, seated.current + step / SIT_TIME);
      } else if (seat.current && seat.current !== here) {
        seated.current = Math.max(0, seated.current - step / RISE_TIME);
        if (seated.current === 0) seat.current = null;
      } else if (self.moving) {
        walk(self, step);
      } else if (held.current.gaveUp !== null) {
        // Gave up short of its place: after a while it tries again.
        held.current.gaveUp += step;
        if (held.current.gaveUp >= RETRY_AFTER) {
          const stop = goal.spot.via ?? goal.spot;
          self.path = routeTo(grid, self, stop, stop);
          self.moving = true;
          held.current = freshHold();
        }
      } else if (goal.spot.sit && !here && !seat.current) {
        // Stopped short of its seat with no way nearer: it stands where it is and tries again.
        held.current = { ...freshHold(), gaveUp: 0 };
      } else if (here) {
        seat.current = here;
        seated.current = Math.min(1, seated.current + step / SIT_TIME);
      }
    }
    const tagging = following && self.moving;
    const arrived =
      ((listening || Boolean(me)) && !tagging) ||
      (!self.moving && !(seat.current && seat.current !== here));
    // The person: their own figure while they walk the room, otherwise the camera they look from.
    const person = crowd.get(ME) ?? camera.position;
    const toPerson = Math.atan2(person.x - self.x, person.z - self.z);
    const into = seat.current;
    if (arrived && !into) {
      // A figure that is waving, or that the person is talking to, turns to face them.
      const facePerson = goal.activity === "wave" || listening || Boolean(me);
      const want = facePerson ? toPerson : goal.spot.yaw;
      self.yaw = still ? want : turnToward(self.yaw, want, step * 7);
    }
    // Sitting down is two moves: a step from the floor beside the seat onto it, turning to face
    // the way it sits, then lowering into it. Getting up is the same backwards, stepping out the
    // way it came.
    const progress = into ? seated.current : 0;
    const stepIn = clamp01(progress / STEP_SHARE);
    const sit = ease(clamp01((progress - STEP_SHARE) / (1 - STEP_SHARE)));
    const settle = ease(stepIn);
    const getting = rising.current;
    if (into && progress < getting.was && getting.out === null)
      getting.out = Math.atan2(self.x - into.x, self.z - into.z);
    if (!into || progress >= 1) {
      // Out of the seat: it walks off facing the way it stepped out.
      if (!into && getting.out !== null) self.yaw = getting.out;
      getting.out = null;
    }
    getting.was = progress;
    const yaw = !into
      ? self.yaw
      : getting.out !== null
        ? mixAngle(getting.out, into.yaw, ease(clamp01(stepIn * 1.25)))
        : mixAngle(self.yaw, into.yaw, ease(clamp01(stepIn * 1.25)));
    const x = into ? self.x + (into.x - self.x) * settle : self.x;
    const z = into ? self.z + (into.z - self.z) * settle : self.z;
    const walking = self.moving && (!(listening || me) || tagging) && progress === 0;
    const stepping = Boolean(into) && stepIn > 0 && stepIn < 1 && sit === 0;
    // Sat down, its thighs rest on the seat, whatever height the character sits at.
    const thigh = handle.current?.seatedThigh ?? into?.seatY ?? 0;
    const rise = into ? sit * (into.seatY + THIGH - thigh) : 0;
    // Forward on the seat as it sits, so its hips land on the seat, not against the backrest.
    const forward = into ? sit * (handle.current?.seatedForward ?? 0) : 0;
    root.current.position.set(x + Math.sin(yaw) * forward, rise, z + Math.cos(yaw) * forward);
    root.current.rotation.y = yaw;
    anchors.get(actor.id)?.set(x, -0.1, z);
    crowd.set(actor.id, {
      x,
      z,
      moving: self.moving && (!(listening || me) || tagging),
      seated: sit > 0.5,
    });
    // Over the head, and over the mark that bobs there when it needs its person.
    const marked = actor.state === "needs-you" || goal.activity === "puzzled";
    const over = marked ? 0.55 : props.selected ? 0.4 : 0;
    anchors.get(`head:${actor.id}`)?.set(x, HEAD_TOP + rise + over, z);

    // Short of its place it just stands about, rather than typing or playing at nothing.
    const short = held.current.gaveUp !== null;
    const doing: Doing =
      listening && !tagging
        ? "listen"
        : (me || short) && !tagging
          ? "relax"
          : arrived && (!into || progress >= 1)
            ? goal.activity
            : "walk";
    const emote = actor.emote && !walking ? actor.emote : null;
    const emoteAge = emote ? (Date.now() - emote.at) / 1000 : Infinity;
    if (cheer.current.pending) cheer.current = { pending: false, from: clock.elapsedTime };
    const cheerAge = cheer.current.from < 0 ? Infinity : clock.elapsedTime - cheer.current.from;
    const pose = figurePose({
      doing,
      emote:
        !still && emote && emoteAge < EMOTE_MS / 1000 ? { kind: emote.kind, age: emoteAge } : null,
      cheer: !still && cheerAge < CHEER_TIME && !walking ? { age: cheerAge } : null,
      seated: progress > 0,
      slumped: outcome === "failed" && doing !== "walk",
      time,
    });
    body.current.position.y = pose.bounce;
    // Near the person, it looks at them: the head turns and tips to their eyes, as far as a neck
    // goes, and back to what it was doing once they walk on or get behind it. Busy, it only
    // glances.
    const blend = (rate: number) => (still ? 1 : 1 - Math.exp(-rate * step));
    const mine = crowd.get(ME);
    const away = mine ? Math.hypot(mine.x - x, mine.z - z) : Infinity;
    const toward = mine ? wrapAngle(Math.atan2(mine.x - x, mine.z - z) - yaw) : 0;
    const sees =
      !still && mine && away < LOOK_NEAR && Math.abs(toward) < LOOK_YAW + 0.6 && !pose.victory;
    const busy = doing === "type" || doing === "play";
    const want = sees ? (listening ? 1 : busy ? 0.7 : 0.9) * clamp01(LOOK_NEAR - away) : 0;
    gaze.current += (want - gaze.current) * blend(4);
    const look = { ...pose.look };
    if (gaze.current > 0.001) {
      const up = Math.atan2(PERSON_EYES - (rise + OWN_EYES), Math.max(0.3, away));
      look.turn += (clampTo(toward, LOOK_YAW) - look.turn) * gaze.current;
      look.nod += (clampTo(-up, LOOK_PITCH) - look.nod) * gaze.current;
      look.tip *= 1 - gaze.current;
    }
    const eased = blend(10);
    for (const key of ["turn", "nod", "tip"] as const)
      head.current[key] += (look[key] - head.current[key]) * eased;
    // How fast it goes, in the character's own units: what its legs keep pace with.
    const was = lastAt.current ?? { x, z };
    const moved = Math.hypot(x - was.x, z - was.z) / Math.max(step, 1e-3);
    lastAt.current = { x, z };
    pace.current += ((walking || stepping ? moved : 0) - pace.current) * blend(12);
    handle.current?.animator.update(still ? 0 : step, {
      speed: pace.current / FIGURE_SCALE,
      sit,
      airborne: false,
      victory: pose.victory,
      upper: pose.upper,
      look: head.current,
      sway: pose.sway,
    });
  });

  const pick = (event: ThreeEvent<MouseEvent>) => {
    if (props.quiet) return;
    event.stopPropagation();
    props.onPick(actor.id);
  };
  const start = walker.current;
  return (
    <group ref={root} position={[start.x, 0, start.z]} rotation={[0, start.yaw, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_MARK, 0]}>
        <circleGeometry args={[0.3, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <group ref={body}>
        <Suspense fallback={null}>
          <CharacterModel model={model} colors={colors} handle={handle} />
        </Suspense>
      </group>
      {/* A generous target, so a figure is easy to pick even from far away. */}
      <mesh
        position={[0, 0.7, 0]}
        onClick={pick}
        onPointerOver={() => !props.quiet && (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <cylinderGeometry args={[0.36, 0.36, 1.45, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <FigureMarks
        needsYou={actor.state === "needs-you"}
        puzzled={goal.activity === "puzzled"}
        selected={props.selected}
        still={still}
      />
    </group>
  );
}
