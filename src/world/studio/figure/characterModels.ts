import { hashOf } from "../look";

/*
 * The characters people and agents walk the building as: Quaternius's Ultimate Animated Character
 * Pack (CC0, credited in NOTICE), packed as one mesh-only .glb each on one shared skeleton, with
 * every clip once in animations.glb. They load only when someone in the building wears them.
 */

const files = import.meta.glob("../../../assets/characters/*.glb", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

const urlOf = new Map(
  Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -4), url]),
);

/** Where the clips every character shares are. */
export const animationsUrl = urlOf.get("animations") ?? "";

/** Every character there is to wear, by id (its file's name). */
export const characterModels: readonly string[] = [...urlOf.keys()]
  .filter((id) => id !== "animations")
  .sort();

/**
 * The everyday characters, which an agent or a person is given until someone picks another: the
 * pack's costumes (knights, zombies, a cow) are for picking on purpose.
 */
const everyday = [
  "casual-male",
  "casual-female",
  "casual2-male",
  "casual2-female",
  "casual3-male",
  "casual3-female",
  "casual-bald",
  "worker-male",
  "worker-female",
  "suit-male",
  "suit-female",
  "doctor-male-young",
  "doctor-female-young",
  "chef-male",
  "chef-female",
  "old-classy-male",
  "old-classy-female",
  "kimono-male",
  "kimono-female",
].filter((id) => urlOf.has(id));

export const isCharacterModel = (id: unknown): id is string =>
  typeof id === "string" && urlOf.has(id) && id !== "animations";

/** The character someone wears: the one picked for them, else an everyday one their id settles. */
export function characterFor(id: string, picked?: string): string {
  if (isCharacterModel(picked)) return picked;
  return everyday[hashOf(id) % Math.max(1, everyday.length)] ?? characterModels[0] ?? "";
}

/** Where a character's file is. */
export const characterUrl = (id: string): string => urlOf.get(id) ?? "";

/** A character's name for a picker: "Doctor female young" for doctor-female-young. */
export const characterName = (id: string): string => {
  const words = id.replace(/(\d)/g, " $1").split("-").join(" ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
