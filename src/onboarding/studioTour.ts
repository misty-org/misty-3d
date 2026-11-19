import type { TourStep } from "@/shared/ui";

/**
 * The building's tour, shown the first time it opens. The host's tour list (Misty's
 * `features/onboarding/tours/tours.ts`) takes it as its `studio` entry; see HOST.md.
 */
export const studioTour: { label: string; steps: TourStep[] } = {
    label: "Game tour",
    steps: [
      {
        title: "Your building",
        body: "Each agent has a desk here. They type while they work, raise a hand when they need you, and scratch their heads when something went wrong.",
      },
      {
        target: "studio-ask",
        title: "Chat and commands",
        body: "Talk to an agent, @ a few of them to give them one task together, or type / to go anywhere: /teleport library, /teleport code.",
      },
      {
        target: "studio-team",
        title: "Who's here",
        body: "Your agents and the friends in this space, and what each is doing. Click one to go to them.",
      },
      {
        target: "studio-hotbar",
        title: "Your hotbar",
        body: "Keys 1 to 9: emote, sit at your desk, jump to the meeting room, the library or the lounge, play games, music, build and name tags.",
      },
      {
        title: "Sit at your desk",
        body: "Walk up to your desk by the door and press E: your chats, Code and calendar open on its monitor. Press Esc or Stand up under it to get back up.",
      },
      {
        target: "studio-level",
        title: "Level up",
        body: "Finished tasks, new agents, teammates and today's quests earn points that unlock furniture and a bigger building.",
      },
      {
        title: "Walk around",
        body: "WASD to walk, Space to jump, drag to look, scroll to step behind yourself. Walk up to an agent and press E to talk.",
      },
      {
        title: "Friends drop by",
        body: "Friends in this space walk the building too. Go out the front door to visit your other spaces.",
      },
    ],
};
