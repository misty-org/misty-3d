# misty-3d

Misty's Game mode, set aside as its own module.

[Misty](https://github.com/misty-org/misty) is a desktop app where your AI agents work in Spaces.
Game mode was another way to use it: the Space is a 3D building, every agent has a desk where you
can watch it type, raise a hand when it needs you, or scratch its head when a run fails, and your
teammates walk the same rooms. You sit at your own desk to open Misty's real pages on its monitor.

Misty itself no longer ships Game mode. Everything it needed lives here, ready to plug back in when
there are people to play it.

## What's inside

| Folder | What it is |
| --- | --- |
| `src/world/` | The building: the three.js scene (`studio/`), characters and poses (`studio/figure/`), the HUD, hotbar, `/` commands, chat box, talking to agents and teammates, hiring, building and furnishing, quests and levels, the arcade and music |
| `src/shell/` | The mode itself (`gameMode.ts`), the Classic/Game switch, its shortcuts, and `GameWorld`, which lays the building over the window and puts Misty's pages on the desk's screen (`deskScreen.ts`) |
| `src/onboarding/` | The "How do you want to work?" setup step and the building's tour |
| `src/tools/` | The tools agents call to move their own figure (`studio_go`, `studio_emote`, `studio_say`, `studio_release`) |
| `src/assets/characters/` | Quaternius's Ultimate Animated Character Pack as .glb files (CC0) |
| `native/` | The Rust side: the studio music player, its Tauri permissions, and the agent tool wiring |
| `integration/` | The changes in Misty that mounted this module, as a patch |

`src/index.ts` is the one entry point.

## Using it

misty-3d isn't an app on its own. It runs inside Misty and reaches into it through Misty's `@/…`
imports: the shared UI, the agent and chat stores, Spaces presence, settings and the Tauri bridge.
[HOST.md](HOST.md) lists everything it needs from Misty and every place Misty mounts it, with steps
to plug it back in.

To type-check it, clone it next to a Misty checkout (`../misty`) and run `npx tsc -p .` from here.

## License

AGPL-3.0-or-later, like Misty. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
