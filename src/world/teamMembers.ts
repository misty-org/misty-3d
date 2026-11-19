import { create } from "zustand";
import type { TeamMember as SpaceMember } from "@/features/agents/now/teamMembers";
import { isRoomId, type RoomId } from "./studio/building";

/**
 * Teammates in the building. Misty keeps who else is in the Space (`useTeamMembers`, filled from
 * the Space's live presence while something watches it); the building adds the room each one is
 * in and the requests they sent this person for an agent.
 */
export { initialOf, useStudioOpen, useTeamMembers } from "@/features/agents/now/teamMembers";

/** A member as the building sees them: also in the building, in one of its rooms. */
export type TeamMember = Omit<SpaceMember, "place"> & {
  /** Where in Misty they are: the building, the Lab, or elsewhere in the Space. */
  place?: "studio" | "lab";
  /** In the building, the room they are in, as their presence names it. */
  room?: string;
};

/** Where a teammate in each room of the building is, in a few words. */
const roomWords: Record<RoomId, string> = {
  desk: "At their desk",
  office: "On the agent floor",
  meeting: "In the meeting room",
  lounge: "In the lounge",
  library: "In the library",
  arcade: "In the arcade",
  door: "At the front door",
};

/**
 * Where a teammate stands in this person's building, from the room their presence names. Each
 * person's desk is their own, so one at their desk stands on the agent floor here.
 */
export function memberRoom(member: Pick<TeamMember, "place" | "room">): RoomId | undefined {
  if (member.place !== "studio" || !isRoomId(member.room)) return undefined;
  return member.room === "desk" ? "office" : member.room;
}

/** Where a member is, in a few words for their tag and their row. */
export function placeWords(member: Pick<TeamMember, "place" | "notebook" | "room">): string {
  if (member.place === "studio")
    return isRoomId(member.room) ? roomWords[member.room] : "In the building";
  if (member.place === "lab")
    return member.notebook ? `In the Lab · ${member.notebook}` : "In the Lab";
  return "In the Space";
}

/** A request another member sent this person for one of their agents, waiting for an answer. */
export interface StudioRequest {
  id: string;
  fromUserId: string;
  fromName: string;
  text: string;
  /** The agent it names, when the sender asked for one. */
  agentId?: string;
  createdAt: string;
  /** Stops it waiting on this device, once given to an agent or dismissed. */
  done(): void;
}

/**
 * Requests waiting for this person, newest first. The host fills this in from the Space's
 * incoming handoffs while the building is open (see HOST.md).
 */
export const useStudioRequests = create<{
  requests: StudioRequest[];
  show(requests: StudioRequest[]): void;
}>((set) => ({
  requests: [],
  show: (requests) => set({ requests }),
}));
