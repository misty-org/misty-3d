# Plugging misty-3d into Misty

misty-3d was cut out of Misty on 2026-11-19. This file is the contract between the two: what the
module takes from Misty, and where Misty mounts it.

## 1. What misty-3d needs from Misty

Every import that starts with `@/` is Misty's `src/`. misty-3d expects these to exist with the
shapes they had when it was cut out:

- **Shared UI and libraries:** `@/shared/ui` (Surface tones `scene-panel` and `stage`, the HUD's
  scene parts in `SceneLabel.tsx`, buttons, fields and the rest), `@/shared/schemas`, `@/shared/lib/deviceSetting`,
  `@/shared/lib/uiScale`, `@/shared/hooks/useHoverOpen`, `@/shared/platform/tauri`,
  `@/shared/shortcuts/factory`.
- **Agents:** `@/features/agents` (`openAgentsHub`) and, inside it, `AgentsRuntime`,
  `conversations/state/*` (activity, background replies, local chats, the Misty store),
  `conversations/view/*` (sending and turns), `conversations/ask/draftRequest`,
  `engines/enginesApi`, `island/actionQuestions`, `personal/*` (avatars, accounts, device grants,
  the agents store, `AgentSpaceField`, `saveAgent`), `runs/markdown/MistyMarkdown`,
  `spaces-gateway/spacesGateway`, and the local tool host (`tools/host`, `tools/runContexts`,
  `tools/space/*`).
- **What agents are doing now:** `@/features/agents/now/*`: `useStudioAgents`, `doing`,
  `teammates`, and `teamMembers` (`useTeamMembers`, `useStudioOpen`, `initialOf`). These stayed in
  Misty because Classic shows them too (Home's "agents now", Space member lists, the Lab).
- **Elsewhere:** `@/features/app-windows`, `@/features/spaces`, `@/features/settings` (and
  `SettingsControls`), `@/features/shortcuts`, `@/features/voice`, `@/features/onboarding`
  (`startTour`, `useTours`, `setup/PreviewChoice`), `@/features/engine-config/EngineMark`,
  `@/app/layouts/DesktopLayout/spaceNavigation` and `.../search/searchStore`.
- **Packages:** `three`, `@react-three/fiber`, `@react-three/drei` (Misty dropped the last two),
  `react`, `react-router-dom`, `zustand`, `lucide-react`.
- **Data kept on purpose:** Misty still knows the `"studio"` agent chat kind (each Space's room
  and the agents' looks, `src-tauri/features/agents/chats.rs`), conversations with
  `place: "studio"` (kept out of the chat list), and the `"studio"` presence place. misty-server
  still accepts a presence room name (`presenceRooms` in `realtime_presence.go`).

## 2. Where Misty mounted it

`integration/misty.patch` is the exact change that took Game mode out of Misty, reversed, with
imports pointed at `@misty/3d`. Applying it puts every mount point back:

| Misty file | What it does there |
| --- | --- |
| `app/layouts/DesktopLayout/index.tsx` | Mounts `GameWorld` over the pages, runs `useGameModeShortcuts`, frames the workspace on the desk's screen (`useDeskScreenBox`, Surface tone `monitor`), floats the window buttons in Game mode |
| `app/layouts/DesktopLayout/WorkspaceCanvas.tsx` | `inert` while the building covers the window |
| `app/layouts/DesktopLayout/SidebarDrawer.tsx` | Hides the sidebar while walking; window buttons always show in Game mode |
| `app/layouts/DesktopLayout/WorkspaceSidebar.tsx`, `app/shell/sidebarWidth.ts` | The Classic/Game switch in the sidebar head, and the wider minimum it needs |
| `app/SettingsSections.tsx`, `features/settings/settingsRegistry.tsx`, `settingsTypes.ts`, `device-preferences/definitions.json` | The Game settings page (`StudioSettings`) and its camera settings |
| `features/agents/tools/index.ts` | `studioTools` and `followStudioOrders` |
| `features/agents/personal/AgentEditor.tsx` | The agent's voice in the building (`world/AgentVoiceField`) |
| `features/agents/page/useAgentsPageState.ts` | An old `?view=studio` link switches to Game mode |
| `features/onboarding/setup-page/SetupPage.tsx` | The `ModeStep` setup step |
| `features/onboarding/tours/tours.ts`, `TourHost.tsx` | The `studio` tour (`studioTour`) |
| `features/spaces/list/SpaceStudioPeople.tsx` | Teammates' rooms, and their requests into `useStudioRequests` |
| `shared/shortcuts/registry.ts` | `gameModeCommands` (⇧⌘G, ⇧⌘U) |
| `shared/ui/display/Surface.tsx` | The `monitor` tone |
| `NOTICE` | The Quaternius credit |
| `src-tauri/…` | See `native/agent-tools.md` for the agent tools, and `native/*.rs` for the music player |

## 3. Plugging it back in

1. Clone misty-3d next to Misty (`misty-org/misty` and `misty-org/misty-3d` side by side).
2. In Misty, point `@misty/3d` at it: a `resolve.alias` in `.config/vite.config.ts`
   (`"@misty/3d": path.resolve(__dirname, "../../misty-3d/src")`), the same path under
   `compilerOptions.paths` in `tsconfig.json`, and `../misty-3d` in Vite's `server.fs.allow`.
3. `npm install @react-three/fiber @react-three/drei` in Misty.
4. `git apply ../misty-3d/integration/misty.patch` from Misty's root. It was written against
   Misty as of 2026-11-19; where Misty has moved on, apply the hunks by hand using the table above.
   It leaves out three things to redo by hand: the golden prompt fixtures in
   `src-tauri/features/agents/runs/local_prompt/fixtures/` (regenerate them, since the catalog gets
   the four `studio_*` tools back), and the Game cases in Misty's `SetupPage.test.tsx` and
   `AgentsPage.workspace.test.tsx`.
5. Put the Rust back: copy `native/studio_music*.rs` into `src-tauri/features/browser/` and
   `native/permissions/*.toml` into `src-tauri/permissions/autogenerated/`, then follow
   `native/agent-tools.md`.
