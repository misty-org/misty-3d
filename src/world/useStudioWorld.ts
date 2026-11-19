import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMistyStore } from "@/features/agents/conversations/state/useMistyStore";
import { currentSpaceKey } from "@/features/agents/engines/enginesApi";
import { listenForActionQuestions, useActionQuestions } from "@/features/agents/island/actionQuestions";
import { useAgentAccountId } from "@/features/agents/personal/agentAccount";
import type { Actor } from "./studio/behaviour";
import type { RoomId } from "./studio/building";
import { useStudioLayout } from "./studio/layoutStore";
import { useSteadyStates } from "./steady";
import { studioNames } from "./studioNames";
import { boardOf, huddledAgents, useStudioSpeech, useStudioTalk } from "./studioTalk";
import { finishedRuns, useStudioResults, waitingResults } from "./studioResults";
import { claimedByOthers, fileName, useTeammateAgents, type TeammateAgent } from "@/features/agents/now/teammates";
import { useStudioPeople } from "./useStudioPeople";
import { useStudioAgents, type StudioAgent } from "@/features/agents/now/useStudioAgents";
import {
  EMOTE_MS,
  SAY_MS,
  followStudioOrders,
  placeHolds,
  useStudioOrders,
  type StudioEmote,
  type StudioPlace,
} from "./studioOrders";
import { markUnlocksSeen, seenUnlocks, type Unlock } from "./studioProgress";
import { useStudioProgress } from "./useStudioProgress";

/** How long a finished or failed run stays marked when the person hasn't looked at its agent. */
const OUTCOME_MS = 30 * 60_000;
/** How often orders are looked at again, to see which have run out. */
const ORDER_CHECK_MS = 4000;
/** How long a "+1" rises off an agent that finished a task. */
const POP_MS = 1900;

/** The warning an agent's tag and panel show when a teammate's agent is changing its file too. */
function clashLine(files: string[], teammates: readonly TeammateAgent[]) {
  const clash = claimedByOthers(files, teammates)[0];
  return clash ? `${clash.by.owner}'s ${clash.by.name} is on ${fileName(clash.file)}` : "";
}

/**
 * Everything the building shows, worked out from the person's agents and their runs, the Space's
 * other members and their agents, the orders given in it and its progress: who is where doing
 * what, what each says, what waits on desks to be collected, and what the building has earned.
 * It only shows what the runs report.
 */
export function useStudioWorld(input: {
  /** When the person last looked at each agent: a run that ended before then is no news. */
  seen: Record<string, number>;
  /** The room the person is in, which the Space's other members see. */
  room: RoomId | null;
}) {
  const { agents: everyone, loading: agentsLoading, entries } = useStudioAgents();
  // Misty's own built-in agent isn't one of the team: the building is for the person's engines.
  const reported = useMemo(() => everyone.filter((item) => !item.agent.system_managed), [everyone]);
  const teammates = useTeammateAgents((state) => state.agents);
  const people = useStudioPeople(input.room);
  const questions = useActionQuestions((state) => state.items);
  const conversations = useMistyStore((state) => state.conversations);
  const chats = useStudioTalk((state) => state.chats);
  const huddles = useStudioTalk((state) => state.huddles);
  const studio = useStudioLayout(people.spaceId || currentSpaceKey());
  const loading = agentsLoading || !studio.layout;
  const orders = useStudioOrders((state) => state.orders);
  /** The clock orders are read against, moved on every few seconds. */
  const [now, setNow] = useState(() => Date.now());
  const account = useAgentAccountId();

  useEffect(() => followStudioOrders(), []);
  useEffect(() => listenForActionQuestions(), []);
  useEffect(() => {
    const store = useMistyStore.getState();
    if (store.accountId && !store.conversations.length && !store.conversationsLoading)
      void store.loadConversations();
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), ORDER_CHECK_MS);
    return () => window.clearInterval(timer);
  }, []);
  // An order coming in is acted on at once, not at the next look at the clock.
  useEffect(() => setNow(Date.now()), [orders]);

  // An agent with a question waiting needs its person, whatever its run last reported.
  const asking = useMemo(() => new Set(questions.map((question) => question.agentId)), [questions]);
  const keyed = useMemo(
    () =>
      reported.map((item) => ({
        ...(asking.has(item.agent.id) && item.state !== "needs-you"
          ? { ...item, state: "needs-you" as const, doing: "Needs you" }
          : item),
        id: item.agent.id,
      })),
    [reported, asking],
  );
  const agents: StudioAgent[] = useSteadyStates(keyed);
  const names = useMemo(
    () =>
      studioNames(
        agents.map(({ agent }) => ({ id: agent.id, name: agent.name, role: agent.role })),
      ),
    [agents],
  );
  // What each agent was told to do, and what of it still holds.
  const directed = useMemo(() => {
    const places = new Map<string, StudioPlace>();
    const acts = new Map<string, { kind: StudioEmote; at: number }>();
    const said = new Map<string, string>();
    for (const item of agents) {
      const id = item.agent.id;
      const order = orders[id];
      if (!order) continue;
      const run = { runId: item.runId, working: item.state === "working", endedAt: item.endedAt };
      if (order.place && placeHolds(order, run, now)) places.set(id, order.place);
      if (order.emote && order.emotedAt && now - order.emotedAt < EMOTE_MS + ORDER_CHECK_MS)
        acts.set(id, { kind: order.emote, at: order.emotedAt });
      if (order.say && order.saidAt && now - order.saidAt < SAY_MS) said.set(id, order.say);
    }
    return { places, acts, said };
  }, [agents, orders, now]);
  useEffect(() => {
    // The building notes which run a new place order belongs to, and lets go of those run out.
    const store = useStudioOrders.getState();
    for (const item of agents) {
      const id = item.agent.id;
      const order = orders[id];
      if (!order?.place) continue;
      if (order.runId === undefined) store.attach(id, item.runId);
      else if (!directed.places.has(id)) store.release(id);
    }
  }, [agents, orders, directed]);
  const huddled = useMemo(() => huddledAgents(huddles, conversations), [huddles, conversations]);
  const talked = useStudioSpeech(chats);
  // What an agent said with its studio tools shows over its head too, after anything it answered.
  const speech = useMemo(() => {
    if (!directed.said.size) return talked;
    const all = new Map(talked);
    for (const [id, words] of directed.said) if (!all.has(id)) all.set(id, words);
    return all;
  }, [talked, directed.said]);
  const board = useMemo(
    () => boardOf(huddles, conversations, Date.now()),
    [huddles, conversations],
  );
  const { seen } = input;
  const outcomes = useMemo(() => {
    const at = Date.now();
    const shown = new Map<string, "done" | "failed">();
    for (const item of agents) {
      const fresh = at - item.endedAt < OUTCOME_MS && item.endedAt > (seen[item.agent.id] ?? 0);
      if (item.outcome && fresh) shown.set(item.agent.id, item.outcome);
    }
    return shown;
  }, [agents, seen]);

  // Teammates stand in the room their presence names, and by the person's desk while a request
  // of theirs waits.
  const waitingFrom = useMemo(
    () => new Set(people.requests.map((request) => request.fromUserId)),
    [people.requests],
  );
  const members = useMemo(
    () =>
      people.memberActors.map((actor) => ({
        ...actor,
        waiting: waitingFrom.has(actor.ownerId ?? ""),
      })),
    [people.memberActors, waitingFrom],
  );
  const actors = useMemo<Actor[]>(
    () => [
      ...agents.map(({ agent, state, doing, doingCode, task, files }): Actor => ({
        id: agent.id,
        kind: "agent" as const,
        // The files it changes only show as a clash with a teammate's agent changing them too.
        clash: clashLine(files, teammates),
        name: agent.name,
        owner: "",
        guest: false,
        state,
        doing,
        doingCode,
        role: agent.role,
        task: state === "working" ? task : "",
        engine: agent.engine,
        huddle: state === "working" && huddled.has(agent.id),
        outcome: outcomes.get(agent.id) ?? "",
        order: directed.places.get(agent.id),
        emote: directed.acts.get(agent.id),
      })),
      ...teammates.map((mate): Actor => ({
        id: `guest:${mate.key}`,
        name: mate.name,
        owner: mate.owner,
        guest: true,
        kind: "agent" as const,
        ownerId: mate.userId,
        agentId: mate.agentId,
        state: mate.state,
        doing: mate.doing,
        doingCode: "",
      })),
      ...members,
    ],
    [agents, teammates, huddled, outcomes, members, directed],
  );
  // Finished tasks' results wait on their agents' desks until the person collects them.
  const collected = useStudioResults((state) =>
    state.account === account ? state.collected : null,
  );
  useEffect(() => {
    if (!loading && account) useStudioResults.getState().start(account, finishedRuns(agents));
  }, [loading, account, agents]);
  const results = useMemo(() => waitingResults(agents, collected), [agents, collected]);
  const resultIds = useMemo(() => new Set(results.keys()), [results]);
  const ownIds = useMemo(() => agents.map((item) => item.agent.id), [agents]);
  const spaceKey = people.spaceId || currentSpaceKey();
  const growth = useStudioProgress({ account, spaceId: spaceKey, agentIds: ownIds, entries });
  const unlocked = useNewUnlocks(spaceKey, growth, loading, ownIds);
  const levels = useMemo(
    () => new Map([...growth.records].map(([id, record]) => [id, record.level])),
    [growth.records],
  );
  const pops = usePops(agents);

  /** Picks up an agent's waiting result: it leaves the desk, and the agent cheers. */
  const collect = useCallback(
    (agentId: string) => {
      const result = results.get(agentId);
      if (!result) return;
      useStudioResults.getState().collect(result.runId);
      useStudioOrders.getState().give(agentId, { emote: "cheer", emotedAt: Date.now() });
    },
    [results],
  );

  return {
    account,
    loading,
    studio,
    agents,
    teammates,
    people,
    names,
    actors,
    speech,
    board,
    outcomes,
    results,
    resultIds,
    collect,
    ownIds,
    spaceKey,
    progress: growth.progress,
    tally: growth.tally,
    quests: growth.quests,
    records: growth.records,
    unlocked,
    levels,
    pops,
  };
}

/**
 * Something the building just unlocked, said once and cheered by the whole team. The first look at
 * a building takes what it already has as known, with nothing to celebrate.
 */
function useNewUnlocks(
  spaceKey: string,
  growth: ReturnType<typeof useStudioProgress>,
  loading: boolean,
  ownIds: string[],
) {
  const [unlocked, setUnlocked] = useState<Unlock | null>(null);
  const reachedIds = growth.progress.reached.map((unlock) => unlock.id).join(",");
  useEffect(() => {
    if (!spaceKey || !growth.ready || loading) return;
    const ids = reachedIds ? reachedIds.split(",") : [];
    const known = seenUnlocks(spaceKey);
    if (!known) {
      markUnlocksSeen(spaceKey, ids);
      return;
    }
    const fresh = growth.progress.reached.filter((unlock) => !known.has(unlock.id));
    if (!fresh.length) return;
    markUnlocksSeen(spaceKey, ids);
    setUnlocked(fresh[fresh.length - 1]!);
    const store = useStudioOrders.getState();
    for (const id of ownIds) store.give(id, { emote: "cheer", emotedAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the reached ids stand for `growth`
  }, [reachedIds, spaceKey, growth.ready, loading]);
  return { unlocked, dismiss: useCallback(() => setUnlocked(null), []) };
}

/** A "+1" rising off each agent as a task of its finishes while the building is watched. */
function usePops(agents: StudioAgent[]): Record<string, number> {
  const [pops, setPops] = useState<Record<string, number>>({});
  const lastDone = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    const done = new Map(
      agents.filter((item) => item.outcome === "done").map((item) => [item.agent.id, item.endedAt]),
    );
    const before = lastDone.current;
    lastDone.current = done;
    if (!before) return;
    const fresh = [...done].filter(([id, ended]) => before.get(id) !== ended).map(([id]) => id);
    if (!fresh.length) return;
    const at = Date.now();
    setPops((known) => ({ ...known, ...Object.fromEntries(fresh.map((id) => [id, at])) }));
    const timer = window.setTimeout(
      () =>
        setPops((known) =>
          Object.fromEntries(Object.entries(known).filter(([, when]) => when !== at)),
        ),
      POP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [agents]);
  return pops;
}
