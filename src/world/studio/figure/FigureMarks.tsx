import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { Ball, Box, FLOOR_MARK } from "../parts";

/** How high over the floor the marks float: over the top of the head. */
const OVER_HEAD = 1.72;

/**
 * What floats over a figure, as a game marks who wants something: an amber exclamation mark
 * bobbing while it needs its person, a question mark while it puzzles over a run that failed, and
 * the green diamond (and a ring on the floor) over whichever one is picked.
 */
export function FigureMarks(props: {
  needsYou: boolean;
  puzzled: boolean;
  selected: boolean;
  still: boolean;
}) {
  const sign = useRef<Group>(null);
  const gem = useRef<Group>(null);
  const marked = props.needsYou || props.puzzled;
  useFrame(({ clock }) => {
    const time = props.still ? 0 : clock.elapsedTime;
    if (sign.current) sign.current.position.y = OVER_HEAD + Math.abs(Math.sin(time * 3.2)) * 0.1;
    if (gem.current) {
      gem.current.position.y = (marked ? 2.22 : 1.84) + Math.sin(time * 2.2) * 0.04;
      gem.current.rotation.y = time * 1.6;
    }
  });
  return (
    <>
      {marked ? (
        <group ref={sign} position={[0, OVER_HEAD, 0]}>
          <Ball r={0.17} at={[0, 0.1, 0]} color={props.needsYou ? "#ffb703" : "#8ecae6"} />
          {props.needsYou
            ? // An exclamation mark, on both faces of the ball.
              [0.13, -0.13].map((z) => (
                <group key={z}>
                  <Box
                    size={[0.06, 0.15, 0.06]}
                    at={[0, 0.14, z]}
                    color="#3a2a00"
                    round={0.02}
                    shadow={false}
                  />
                  <Box
                    size={[0.06, 0.06, 0.06]}
                    at={[0, 0.02, z]}
                    color="#3a2a00"
                    round={0.02}
                    shadow={false}
                  />
                </group>
              ))
            : // A question mark: its hook and its dot.
              [0.13, -0.13].map((z) => (
                <group key={z}>
                  <Box
                    size={[0.1, 0.05, 0.05]}
                    at={[0, 0.2, z]}
                    color="#023047"
                    round={0.02}
                    shadow={false}
                  />
                  <Box
                    size={[0.05, 0.08, 0.05]}
                    at={[0.04, 0.15, z]}
                    color="#023047"
                    round={0.02}
                    shadow={false}
                  />
                  <Box
                    size={[0.05, 0.06, 0.05]}
                    at={[0, 0.09, z]}
                    color="#023047"
                    round={0.02}
                    shadow={false}
                  />
                  <Box
                    size={[0.05, 0.05, 0.05]}
                    at={[0, 0.01, z]}
                    color="#023047"
                    round={0.02}
                    shadow={false}
                  />
                </group>
              ))}
        </group>
      ) : null}
      {props.selected ? (
        <>
          <group ref={gem} position={[0, 1.84, 0]}>
            <mesh scale={[1, 1.7, 1]}>
              <octahedronGeometry args={[0.1, 0]} />
              <meshStandardMaterial
                color="#5fe36b"
                emissive="#2fbf4a"
                emissiveIntensity={0.9}
                flatShading
              />
            </mesh>
          </group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_MARK, 0]}>
            <ringGeometry args={[0.36, 0.45, 40]} />
            <meshBasicMaterial color="#5fe36b" transparent opacity={0.9} />
          </mesh>
        </>
      ) : null}
    </>
  );
}
