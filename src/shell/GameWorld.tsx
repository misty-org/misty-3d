import { lazy, Suspense, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { inGameWorld, useGameMode } from "./gameMode";
import { cn } from "@/shared/ui";
import { openAgentsHub } from "@/features/agents";
import type { SeatPage } from "../world/gameCommands";
import { startTour, useTours } from "@/features/onboarding";
import {
  dockLeaves,
  preferredDefaultSpace,
  setBrowserWebviewsSuspended,
  switchSpaceWindow,
  useWorkspaceStore,
  type WorkspaceView,
} from "@/features/app-windows";
import { openSettings } from "@/features/settings";
import { useSpacesStore, useWindowSpace } from "@/features/spaces";
import { DeskDock } from "./DeskDock";
import { agentChatRoute, newChatRoute, openChatRoute, openWorkspaceRoute } from "@/app/layouts/DesktopLayout/spaceNavigation";

/** The building is three.js and a room's worth of figures: fetched only once Game mode is on. */
const VirtualStudio = lazy(() =>
  import("../world/VirtualStudio").then((module) => ({
    default: module.VirtualStudio,
  })),
);

/** The Space page each page of a computer is, by its section of the Space's routes. */
const spaceSections: Partial<Record<SeatPage, string>> = {
  calendar: "calendar",
  planner: "planner",
  notes: "notes",
  slides: "slides",
  data: "data",
  drawings: "drawings",
  chat: "chat",
  lab: "lab",
  files: "media",
};

/** Where a computer opens a page: Code, a new chat, or one of the window's Space's pages. */
function pageRoute(page: SeatPage, spaceId: string | undefined): string | undefined {
  if (page === "code") return "/agents?view=code";
  if (page === "chats") return newChatRoute();
  const section = spaceSections[page];
  return section && spaceId ? `/spaces/${encodeURIComponent(spaceId)}/${section}` : undefined;
}

/**
 * Game mode's building, over the whole window while the person walks it. Sitting down at a
 * computer keeps them in it: the camera settles square on its screen, the room holds still, and
 * the real pages, sidebar and all, light up on that screen's glass (DesktopLayout lays the panes
 * over the box `deskScreenRect` gives, which the camera puts the glass on), with the band above and
 * the desk's dock and Stand up below. The room listens to no keys while they work; standing up
 * moves the camera back out to where they were. The window's own buttons stay over it, and native
 * web pages step aside while they walk. Each of the person's Spaces is a building, and the front
 * door walks into another.
 */
export function GameWorld() {
  const inGame = useGameMode((state) => state.mode === "game");
  const inWorld = useGameMode(inGameWorld);
  const seat = useGameMode((state) => state.seat);
  // A fresh building each time they get up, so the camera's move back out plays from the chair.
  const stood = useGameMode((state) => state.stood);
  const navigate = useNavigate();
  const space = useWindowSpace();
  const spaces = useSpacesStore((state) => state.spaces);
  useEffect(() => {
    setBrowserWebviewsSuspended(inWorld, "game-world");
    return () => setBrowserWebviewsSuspended(false, "game-world");
  }, [inWorld]);
  // Shortcuts, search and the command palette work as they do in Classic: a page one of them
  // opens while the person walks the building sits them down at their desk, on that page.
  useEffect(() => {
    if (!inWorld) return;
    const pageOf = (state: ReturnType<typeof useWorkspaceStore.getState>) => {
      const pane = dockLeaves(state.layout.root).find(
        (leaf) => leaf.id === state.layout.focusedPaneId,
      );
      const view = pane?.views.find((item) => item.id === pane.activeViewId);
      return view ? `${view.id}:${view.route.split("?")[0]}` : "";
    };
    let shown = pageOf(useWorkspaceStore.getState());
    return useWorkspaceStore.subscribe((state) => {
      const now = pageOf(state);
      if (now === shown) return;
      shown = now;
      useGameMode.getState().sitDown({ place: "desk" });
    });
  }, [inWorld]);
  // The first time the building opens, its tour shows around.
  const toursLoaded = useTours((state) => state.loaded);
  useEffect(() => {
    if (!inWorld || !toursLoaded || useTours.getState().seen.includes("studio")) return;
    startTour("studio");
  }, [inWorld, toursLoaded]);
  // As the tab bar opens a page: in the focused pane, at its route.
  const open = useCallback(
    (view: WorkspaceView) => {
      useWorkspaceStore.getState().focusView(view.id);
      navigate(view.route, { replace: true });
    },
    [navigate],
  );
  /** Sits down at a computer: on `route` when one was asked for, else on what it showed last. */
  const sitDown = useCallback(
    (place: "desk" | "library", route?: string) => {
      if (route) openWorkspaceRoute(route, open);
      useGameMode.getState().sitDown({ place, route });
    },
    [open],
  );
  const personal = preferredDefaultSpace(spaces);
  const buildings = useMemo(
    () =>
      (personal ? [personal, ...spaces.filter((item) => item !== personal)] : spaces).map(
        (item) => ({ id: item.id, name: item.name, current: item.id === space?.id }),
      ),
    [spaces, personal, space?.id],
  );
  if (!inGame) return null;
  return (
    // Sat at the desk it makes no layer of its own, so the monitor sits over the room and the
    // band and the dock over the monitor.
    <div
      className={cn("absolute inset-0 flex", !seat && "z-[var(--stack-overlay)]")}
      data-misty-game-world=""
    >
      <Suspense fallback={null}>
        <VirtualStudio
          // A building of its own for each Space: switching Spaces walks into another.
          key={`${space?.id ?? "personal"}:${stood}`}
          seat={seat?.place ?? null}
          onSitDown={(place, page) =>
            sitDown(
              place,
              page
                ? pageRoute(page, space?.id)
                : place === "library"
                  ? pageRoute("lab", space?.id)
                  : undefined,
            )
          }
          onOpenChat={(agentId, chat) =>
            sitDown("desk", chat ? openChatRoute(agentId, chat) : agentChatRoute(agentId))
          }
          onAgentSettings={(agentId) =>
            sitDown(
              "desk",
              `/agents?${new URLSearchParams({ agent: agentId, agentSettings: agentId })}`,
            )
          }
          onSettings={() => openSettings()}
          onTeamSettings={() => openAgentsHub("agents")}
          buildings={buildings}
          onEnterBuilding={(id) => switchSpaceWindow(id, id === personal?.id)}
        />
      </Suspense>
      {seat ? <DeskDock onOpen={open} /> : null}
    </div>
  );
}
