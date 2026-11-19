import { AgentTalk } from "./AgentTalk";
import { BuildingsPanel, type Building } from "./BuildingsPanel";
import { CustomizePanel, PERSON_LOOK } from "./CustomizePanel";
import { HirePanel } from "./HireAgent";
import { MemberTalk } from "./MemberTalk";
import { LevelCard } from "./StudioHotbar";
import { TeamPanel, type StudioMode } from "./StudioHud";
import { assignDesk, deskOwners } from "./studio/layout";
import { placeWords } from "./teamMembers";
import type { useStudioWorld } from "./useStudioWorld";

/** What the right side of the band opens under it, when nothing more pressing shows there. */
export type SidePanel = "people" | "level" | "buildings" | null;

type StudioWorld = ReturnType<typeof useStudioWorld>;

/** A picked member, from who is in the Space now or, failing that, a request they sent. */
function memberOf(id: string, people: StudioWorld["people"]) {
  const userId = id.slice("member:".length);
  const member = people.members.find((candidate) => candidate.userId === userId);
  if (member) return { ...member, where: placeWords(member) };
  const request = people.requests.find((candidate) => candidate.fromUserId === userId);
  // Not in the Space right now: there is nowhere to say they are.
  return request ? { userId, name: request.fromName, where: "" } : undefined;
}

/**
 * What shows down the right side of the building, under the band: one panel at a time, the most
 * pressing first. Hiring for a desk, dressing an agent up, the panel of whoever has the person's
 * attention (an agent's chat and what it asks or left on its desk, or a teammate's messages), then
 * the front door's buildings, the building's level, and who is here.
 */
export function GameSide(props: {
  world: StudioWorld;
  mode: StudioMode;
  arcadeOpen: boolean;
  /** The free desk Hire was opened for, if any. */
  hireDesk?: string;
  /** The agent being dressed up, if any. */
  customizing: string | null;
  selected: string | null;
  /** Changes when the person walks up to someone, which puts the cursor in their box. */
  focus: number;
  panel: SidePanel;
  buildings: readonly Building[];
  onEnterBuilding(id: string): void;
  onOpenChat(agentId: string, conversationId: string): void;
  onAgentSettings(agentId: string): void;
  onMode(mode: StudioMode): void;
  onCustomize(agentId: string | null): void;
  onSelect(id: string | null): void;
  onPanel(panel: SidePanel): void;
  /** Puts the cursor in the panel of whoever was just picked. */
  onFocus(): void;
}) {
  const { world, selected } = props;
  const { agents, names, people } = world;
  const { layout, change } = world.studio;
  const release = () => props.onSelect(null);
  if (props.mode === "hire")
    return (
      <HirePanel
        key={props.hireDesk ?? ""}
        deskId={props.hireDesk}
        onClose={() => props.onMode("studio")}
        onHired={(agent, deskId) => {
          if (deskId && layout) change(assignDesk(layout, deskId, agent.id));
          props.onMode("studio");
          props.onSelect(agent.id);
        }}
      />
    );
  if (props.mode !== "studio" || props.arcadeOpen) return null;
  if (props.customizing === PERSON_LOOK)
    return <CustomizePanel who={world.account} onClose={() => props.onCustomize(null)} />;
  const customizing = agents.find((item) => item.agent.id === props.customizing)?.agent;
  if (customizing)
    return (
      <CustomizePanel
        key={customizing.id}
        agent={customizing}
        deskId={layout ? deskOwners(layout.items, world.ownIds).get(customizing.id) : undefined}
        onClose={() => props.onCustomize(null)}
      />
    );
  const member = selected?.startsWith("member:") ? memberOf(selected, people) : undefined;
  if (member && people.spaceId)
    return (
      <MemberTalk
        key={member.userId}
        spaceId={people.spaceId}
        member={member}
        focus={props.focus}
        onClose={release}
      />
    );
  const picked = world.actors.find((actor) => actor.id === selected);
  if (picked && picked.kind !== "member") {
    // The agent's panel: its chat, what it asks, what it left on its desk. A visiting agent is
    // asked through its person.
    const own = agents.find((item) => item.agent.id === picked.id);
    const id = own?.agent.id;
    return (
      <AgentTalk
        key={picked.id}
        actor={picked}
        name={names.get(picked.id) ?? picked.name}
        item={own}
        focus={props.focus}
        onOpenChat={props.onOpenChat}
        onCustomize={id ? () => props.onCustomize(id) : undefined}
        onSettings={id ? () => props.onAgentSettings(id) : undefined}
        onClose={release}
        record={id ? world.records.get(id) : undefined}
        result={id ? world.results.get(id) : undefined}
        onCollect={id ? () => world.collect(id) : undefined}
      />
    );
  }
  if (props.panel === "buildings")
    return (
      <BuildingsPanel
        buildings={props.buildings}
        onEnter={props.onEnterBuilding}
        onClose={() => props.onPanel(null)}
      />
    );
  if (props.panel === "level" && !world.loading)
    return (
      <LevelCard
        progress={world.progress}
        tally={world.tally}
        quests={world.quests}
        onClose={() => props.onPanel(null)}
      />
    );
  if (props.panel === "people")
    return (
      <TeamPanel
        onClose={() => props.onPanel(null)}
        levels={world.levels}
        agents={agents}
        visitors={world.teammates}
        people={people.members}
        requests={people.requests}
        onHire={() => props.onMode("hire")}
        outcomes={world.outcomes}
        names={names}
        selected={selected}
        loading={world.loading}
        onPick={(id) => {
          props.onSelect(id);
          props.onFocus();
        }}
      />
    );
  return null;
}
