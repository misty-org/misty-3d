import { useEffect, useRef, useState } from "react";
import type { Actor } from "./studio/behaviour";
import { typingIn } from "./studio/keys";

/** Things the person walks up to that aren't people, by the prefix of their id. */
type Thing = "desk" | "arcade" | "result" | "seat" | "exit";
const things = new Set<string>(["desk", "arcade", "result", "seat", "exit"]);

const thingOf = (near: string | null): { thing: Thing; id: string } | null => {
  const [prefix, ...rest] = (near ?? "").split(":");
  return prefix && things.has(prefix) ? { thing: prefix as Thing, id: rest.join(":") } : null;
};

/**
 * What the person has walked up to, the key that does something with it floating by it, and E
 * doing it: talking to someone (their panel opens and the box takes what is typed), hiring at a
 * free desk, playing the arcade, picking up a result, sitting at a computer, or going out of the
 * front door to the other buildings.
 */
export function useNearby(input: {
  walking: boolean;
  names: Map<string, string>;
  actors: readonly Actor[];
  onTalk(id: string): void;
  onHire(deskId: string): void;
  onArcade(): void;
  onCollect(agentId: string): void;
  onSit(place: "desk" | "library"): void;
  onDoor(): void;
}) {
  const [near, setNear] = useState<string | null>(null);
  const found = thingOf(near);
  const words = !near
    ? ""
    : !found
      ? `Talk to ${input.names.get(near) ?? input.actors.find((actor) => actor.id === near)?.name ?? ""}`
      : {
          desk: "Hire here",
          arcade: "Play games",
          result: "See result",
          seat: found.id === "library" ? "Sit down to read" : "Sit down to work",
          exit: "Other buildings",
        }[found.thing];
  const latest = useRef(input);
  latest.current = input;
  useEffect(() => {
    if (!input.walking || !near) return;
    const press = (event: KeyboardEvent) => {
      if (event.code !== "KeyE" || typingIn(event.target) || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      const now = latest.current;
      const what = thingOf(near);
      if (!what) return now.onTalk(near);
      if (what.thing === "desk") return now.onHire(what.id);
      if (what.thing === "arcade") return now.onArcade();
      if (what.thing === "result") return now.onCollect(what.id);
      if (what.thing === "exit") return now.onDoor();
      if (what.id === "desk" || what.id === "library") now.onSit(what.id);
    };
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  }, [input.walking, near]);
  return {
    setNear,
    /** Who picking it would pick: an agent, or a result's agent. */
    target: found?.thing === "result" ? found.id : found ? null : near,
    prompt:
      input.walking && near && words ? { anchor: found ? near : `head:${near}`, words } : null,
  };
}
