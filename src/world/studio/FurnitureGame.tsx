import { deskGlass } from "../../shell/deskScreen";
import { DESK_SCREEN, LAPTOP, MONITOR } from "./building";
import { Chair } from "./FurnitureWork";
import { Box, Cyl } from "./parts";

const WOOD = "#c99a6b";
const WOOD_DARK = "#8f6340";
const METAL = "#4a4f5a";
const SCREEN_OFF = "#2b2f38";
/** The person's screens are lit: their computer is always on, waiting for them. */
const SCREEN_ON = "#9fd3ff";

/** How bright a screen glows, and how bright once the person is close enough to sit at it. */
const SCREEN_GLOW = 0.55;
const SCREEN_READY = 1.3;

/** The bezel round a monitor's glass, on each side. */
const BEZEL = 0.03;

/**
 * A lit screen on its stand, facing the chair. `glass` is the lit part's width and height; the
 * person's own big screen gives its own, which the pages are laid over once they sit down.
 */
function Monitor(props: {
  x: number;
  turn?: number;
  glass?: { w: number; h: number };
  ready?: boolean;
}) {
  const glass = props.glass ?? { w: 0.44, h: 0.4 };
  return (
    <group position={[props.x, 0, MONITOR.z]} rotation={[0, props.turn ?? 0, 0]}>
      <Cyl r={0.13} h={0.02} at={[0, 0.65, 0]} color={METAL} shadow={false} />
      <Box size={[0.05, 0.2, 0.04]} at={[0, 0.75, -0.02]} color={METAL} shadow={false} />
      <Box
        size={[glass.w + BEZEL * 2, glass.h + BEZEL * 2, 0.045]}
        at={[0, MONITOR.y, 0]}
        color={SCREEN_OFF}
        round={0.02}
      />
      <Box
        size={[glass.w, glass.h, 0.006]}
        at={[0, MONITOR.y, DESK_SCREEN.glass]}
        color={SCREEN_ON}
        glow={SCREEN_ON}
        glowPower={props.ready ? SCREEN_READY : SCREEN_GLOW}
        shadow={false}
      />
    </group>
  );
}

/**
 * The person's own desk: wider wood, two lit screens and a plate with a star on its front. Their
 * computer is the one that opens their chats, Code and Calendar when they sit at it. `ready`
 * brightens its screens while the person is close enough to sit down: E takes them in.
 */
export function Workstation({ ready }: { ready?: boolean }) {
  return (
    <group>
      <Box size={[1.9, 0.08, 0.86]} at={[0, 0.605, -0.5]} color={WOOD} round={0.03} />
      <Box size={[0.08, 0.58, 0.74]} at={[-0.86, 0.29, -0.5]} color={WOOD_DARK} round={0.02} />
      <Box size={[0.08, 0.58, 0.74]} at={[0.86, 0.29, -0.5]} color={WOOD_DARK} round={0.02} />
      {/* The big screen straight in front of the chair, where the pages show once sat, and a
          small one turned in beside it. */}
      <Monitor x={DESK_SCREEN.x} glass={deskGlass.desk} ready={ready} />
      <Monitor x={0.66} turn={-0.35} ready={ready} />
      {/* The keyboard and mouse, and a mug. */}
      <Box size={[0.5, 0.022, 0.16]} at={[-0.2, 0.655, -0.3]} color="#3a3e47" round={0.008} />
      <Box size={[0.07, 0.025, 0.1]} at={[0.18, 0.655, -0.3]} color="#f1ede4" round={0.01} />
      <Cyl r={0.045} h={0.09} at={[-0.7, 0.69, -0.42]} color="#ffd166" shadow={false} />
      {/* The name plate on the front edge, gold, so this desk reads as the person's own. */}
      <Box
        size={[0.34, 0.09, 0.02]}
        at={[0, 0.56, -0.07]}
        color="#ffd166"
        glow="#ffd166"
        glowPower={0.35}
        shadow={false}
      />
      <Chair />
    </group>
  );
}

/** A reading desk in the library: a laptop open on it, a stack of books and a green lamp. Its
 * screen brightens, as the person's desk's do, while they are close enough to sit. */
export function ReadingDesk({ ready }: { ready?: boolean }) {
  return (
    <group>
      <Box size={[1.84, 0.07, 0.84]} at={[0, 0.605, -0.5]} color={WOOD_DARK} round={0.03} />
      <Box size={[0.07, 0.58, 0.72]} at={[-0.84, 0.29, -0.5]} color={WOOD_DARK} />
      <Box size={[0.07, 0.58, 0.72]} at={[0.84, 0.29, -0.5]} color={WOOD_DARK} />
      {/* The laptop: its lid up toward the chair, lit. */}
      <Box size={[0.5, 0.02, 0.34]} at={[0, 0.65, -0.38]} color="#b8bec8" round={0.008} />
      <group position={[0, LAPTOP.y, LAPTOP.z]} rotation={[LAPTOP.lean, 0, 0]}>
        <Box size={[0.5, 0.34, 0.02]} at={[0, LAPTOP.glassY, 0]} color="#b8bec8" round={0.008} />
        <Box
          size={[deskGlass.library.w, deskGlass.library.h, 0.004]}
          at={[0, LAPTOP.glassY, LAPTOP.glassZ]}
          color={SCREEN_ON}
          glow={SCREEN_ON}
          glowPower={ready ? SCREEN_READY : 0.5}
          shadow={false}
        />
      </group>
      {/* Books, stacked and leaning. */}
      {[
        ["#c0392b", 0.68],
        ["#2a9d8f", 0.71],
        ["#e9c46a", 0.74],
      ].map(([color, y], index) => (
        <Box
          key={color}
          size={[0.3, 0.03, 0.22]}
          at={[-0.62, y as number, -0.55]}
          turn={[0, index * 0.18, 0]}
          color={color as string}
          round={0.006}
          shadow={false}
        />
      ))}
      {/* A banker's lamp. */}
      <group position={[0.62, 0.64, -0.68]}>
        <Cyl r={0.06} h={0.02} at={[0, 0, 0]} color="#c9a227" shadow={false} />
        <Box size={[0.02, 0.24, 0.02]} at={[0, 0.12, 0]} color="#c9a227" shadow={false} />
        <Box
          size={[0.26, 0.06, 0.1]}
          at={[0, 0.26, 0.04]}
          color="#2f7d4a"
          glow="#fff2c4"
          glowPower={0.25}
          round={0.02}
          shadow={false}
        />
      </group>
      <Chair />
    </group>
  );
}
