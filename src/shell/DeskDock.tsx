import { CodeXml, MessageSquarePlus, PersonStanding, Search, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { useGameMode } from "./gameMode";
import { dockLeaves, useWorkspaceStore, type WorkspaceView } from "@/features/app-windows";
import { useWindowSpace } from "@/features/spaces";
import {
  Button,
  IconButton,
  Kbd,
  Surface,
  ToolbarDivider,
  spaceIcons,
  spaceMadeKinds,
} from "@/shared/ui";
import { useSearchDialog } from "@/app/layouts/DesktopLayout/search/searchStore";
import { newChatRoute, openWorkspaceRoute } from "@/app/layouts/DesktopLayout/spaceNavigation";

/** The focused pane's open page, which the dock lights. */
function useFocusedRoute(): string {
  return useWorkspaceStore((state) => {
    const pane = dockLeaves(state.layout.root).find(
      (leaf) => leaf.id === state.layout.focusedPaneId,
    );
    return pane?.views.find((view) => view.id === pane.activeViewId)?.route ?? "";
  });
}

/** Whether a key press belongs to something on screen: a field, an open menu, dialog or list. */
function takenElsewhere(event: KeyboardEvent): boolean {
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target?.closest("input, textarea, select, [contenteditable='true'], .cm-editor")) return true;
  return Boolean(
    document.querySelector(
      "[role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox'], [data-radix-popper-content-wrapper]",
    ),
  );
}

interface DockPage {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Where it opens; null for search, which is a window over the page. */
  route: string | null;
  current: boolean;
}

/**
 * Under the monitor while the person sits at their desk in Game mode, as a computer's own dock:
 * every page the desk opens, each with its own icon, the one on screen lit, then Stand up. Escape
 * stands up too, unless a field, menu or dialog on the monitor is taking it.
 */
export function DeskDock({ onOpen }: { onOpen(view: WorkspaceView): void }) {
  const route = useFocusedRoute();
  const space = useWindowSpace();
  const base = space ? `/spaces/${encodeURIComponent(space.id)}` : "";
  const [path = "", query = ""] = route.split("?");
  const view = path === "/agents" ? new URLSearchParams(query).get("view") : null;
  const section = (name: string): DockPage["route"] => (base ? `${base}/${name}` : null);
  const inSection = (name: string) => Boolean(base) && path.startsWith(`${base}/${name}`);
  const pages: DockPage[] = [
    {
      id: "chat",
      label: "New chat",
      icon: MessageSquarePlus,
      route: newChatRoute(),
      current: path === "/agents" && !view,
    },
    {
      id: "code",
      label: "Code",
      icon: CodeXml,
      route: "/agents?view=code",
      current: view === "code",
    },
    {
      id: "space-chat",
      label: "Space chat",
      icon: spaceIcons.chat,
      route: section("chat"),
      current: inSection("chat"),
    },
    ...spaceMadeKinds.map((made) => ({
      id: made.place,
      label: made.page,
      icon: made.pageIcon,
      route: section(made.section),
      current: inSection(made.section),
    })),
    {
      id: "planner",
      label: "Planner",
      icon: spaceIcons.planner,
      route: section("planner"),
      current: inSection("planner"),
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: spaceIcons.calendar,
      route: section("calendar"),
      current: inSection("calendar"),
    },
    {
      id: "lab",
      label: "Lab",
      icon: spaceIcons.lab,
      route: section("lab"),
      current: inSection("lab"),
    },
    {
      id: "media",
      label: "Media",
      icon: spaceIcons.media,
      route: section("media"),
      current: inSection("media"),
    },
  ];

  useEffect(() => {
    // Taken before the page's own handlers run, so a menu that Escape closes is still open here.
    const press = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || takenElsewhere(event)) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      useGameMode.getState().standUp();
    };
    window.addEventListener("keydown", press, true);
    return () => window.removeEventListener("keydown", press, true);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-4 z-[var(--stack-overlay)] flex justify-center">
      <Surface
        as="nav"
        tone="scene-panel"
        radius="xl"
        aria-label="Your desk"
        className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto p-1"
      >
        {pages.map(({ id, label, icon: Icon, route: target, current }) =>
          target ? (
            <IconButton
              key={id}
              label={label}
              aria-pressed={current}
              onClick={() => openWorkspaceRoute(target, onOpen)}
            >
              <Icon aria-hidden="true" />
            </IconButton>
          ) : null,
        )}
        <IconButton label="Search" onClick={() => useSearchDialog.getState().setOpen(true)}>
          <Search aria-hidden="true" />
        </IconButton>
        <ToolbarDivider />
        <Button
          variant="quiet"
          icon={PersonStanding}
          onClick={() => useGameMode.getState().standUp()}
        >
          Stand up
          <Kbd>Esc</Kbd>
        </Button>
      </Surface>
    </div>
  );
}
