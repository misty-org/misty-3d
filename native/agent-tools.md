# Studio agent tools and music player: removed Rust wiring

The Misty desktop app (`misty/src-tauri`) dropped Game mode. These are the exact snippets that
defined and wired the studio's agent tools (`studio.go`, `studio.emote`, `studio.say`,
`studio.release`, offered to models as `studio_go` and so on) and the studio music player, as they
stood before removal, each under its original path. `studio_music.rs`, `studio_music_media.rs` and
`permissions/*.toml` beside this file are the removed music player module and its generated
permission files.

Golden prompt fixtures (`features/agents/runs/local_prompt/fixtures/*.json`) also lost the four
tool rows from `expected.tools` and the "Studio:" paragraph from `expected.system`; wiring the tools
back means adding those again (the `bless_fixtures` test regenerates them).

## `src-tauri/features/agents/runs/local_prompt/catalog.json`

The four tool entries, which sat between `agent.wait` and `video.read` (lines 4677-4801):

```json
 {
  "_meta": {
   "misty/layer": "public",
   "misty/locality": "device",
   "misty/risk": "read"
  },
  "annotations": {
   "readOnlyHint": true
  },
  "description": "Move your own figure in Misty's studio, the virtual office your person watches you work in. Call it whenever your person tells you to go somewhere or take a break (\"go to your desk and work on...\", \"take a coffee break\", \"come here\", \"everyone to the meeting table\"), then carry on with any work they asked for. desk = your own desk, where you work; lounge = the sofas, for a rest; meeting = the meeting table; door = the front door, to head out or greet someone; cooler = the water cooler, for a coffee break or a chat; bookshelf = the bookshelf, to read up on something; arcade = the arcade cabinet, to play the Space's games; person = over to your person (\"come here\", \"come to me\"). The place holds for the rest of this task and a few minutes after it; studio_release lets you move on your own again.",
  "inputSchema": {
   "additionalProperties": false,
   "properties": {
    "place": {
     "description": "Where to go.",
     "enum": [
      "desk",
      "lounge",
      "meeting",
      "door",
      "cooler",
      "bookshelf",
      "arcade",
      "person"
     ],
     "type": "string"
    }
   },
   "required": [
    "place"
   ],
   "type": "object"
  },
  "name": "studio.go",
  "outputSchema": {
   "type": "object"
  }
 },
 {
  "_meta": {
   "misty/layer": "public",
   "misty/locality": "device",
   "misty/risk": "read"
  },
  "annotations": {
   "readOnlyHint": true
  },
  "description": "Act something out with your own figure in Misty's studio, where it stands: wave, cheer, dance, clap, think or point. Use it when your person asks (\"wave hello\", \"do a little dance\") or to mark a moment, such as a cheer when a long task is done. It lasts a few seconds and changes nothing else.",
  "inputSchema": {
   "additionalProperties": false,
   "properties": {
    "emote": {
     "description": "What to act out.",
     "enum": [
      "wave",
      "cheer",
      "dance",
      "clap",
      "think",
      "point"
     ],
     "type": "string"
    }
   },
   "required": [
    "emote"
   ],
   "type": "object"
  },
  "name": "studio.emote",
  "outputSchema": {
   "type": "object"
  }
 },
 {
  "_meta": {
   "misty/layer": "public",
   "misty/locality": "device",
   "misty/risk": "read"
  },
  "annotations": {
   "readOnlyHint": true
  },
  "description": "Show a short speech bubble over your own figure in Misty's studio for a few seconds. Keep it brief and in character (\"On it!\", \"Back in five.\") and use it only when it adds something, such as answering a greeting or saying where you are off to. Your answer still goes in your reply.",
  "inputSchema": {
   "additionalProperties": false,
   "properties": {
    "text": {
     "description": "What the bubble says.",
     "maxLength": 140,
     "minLength": 1,
     "type": "string"
    }
   },
   "required": [
    "text"
   ],
   "type": "object"
  },
  "name": "studio.say",
  "outputSchema": {
   "type": "object"
  }
 },
 {
  "_meta": {
   "misty/layer": "public",
   "misty/locality": "device",
   "misty/risk": "read"
  },
  "annotations": {
   "readOnlyHint": true
  },
  "description": "Let your figure in Misty's studio move on its own again after studio_go: to its desk while you work, and wherever it likes while you rest. Call it when your person says you can go back to normal (\"back to work as usual\", \"you can leave the lounge\").",
  "inputSchema": {
   "additionalProperties": false,
   "properties": {},
   "required": [],
   "type": "object"
  },
  "name": "studio.release",
  "outputSchema": {
   "type": "object"
  }
 },
```

## `src-tauri/features/agents/run_control/local_tools.rs`

In `LOCAL_TOOLS`, between `space.member.resolve` and `thread.create` (lines 112-115):

```rust
    "studio.emote",
    "studio.go",
    "studio.release",
    "studio.say",
```

At the end of `READ_ONLY`, after `thread.read` (lines 180-185):

```rust
    // The agent's figure in the studio: what it shows changes nothing kept, and showing it again
    // is harmless.
    "studio.go",
    "studio.emote",
    "studio.say",
    "studio.release",
```

## `src-tauri/features/agents/run_control/tool_policy.rs`

`allowed_by_list` with the studio exception (doc comment and the `starts_with("studio.")` line) (lines 167-182):

```rust
/// Whether a tool is allowed by the run's list. The tools a run needs to talk to the person and
/// to report are never left out, and neither is its figure in the studio (`studio.*`), which only
/// shows the person where the agent is.
fn allowed_by_list(facts: &RunFacts, name: &str) -> bool {
    const ALWAYS: &[&str] = &["conversation.ask_user", "log.work.write"];
    facts.allowed_tools.is_empty()
        || ALWAYS.contains(&name)
        || name.starts_with("studio.")
        || facts.allowed_tools.iter().any(|allowed| {
            allowed == name
                || allowed
                    .strip_suffix(".*")
                    .or_else(|| allowed.strip_suffix('*'))
                    .is_some_and(|family| name.starts_with(family))
        })
}
```

## `src-tauri/features/agents/runs/local_prompt/capabilities.rs`

At the end of the capabilities text, just before `out` (lines 127-130):

```rust
    if has("studio.go") {
        // A person who says "take a coffee break" means the figure they watch, not a refusal.
        out.push_str("\n\nStudio: your person watches you as a figure in Misty's studio, a virtual office. When they tell you to go somewhere or take a break (\"go to your desk and work on...\", \"take a coffee break\", \"come here\"), call studio_go, then carry on with the work they asked for.");
    }
```

## `src-tauri/features/engines/mcp.rs`

Re-export (line 35):

```rust
pub(crate) use tools::{names_misty_tool, names_studio_tool};
```

`SPACE_TOOLS` (it was `[&str; 15]` with `"studio."` last) (lines 41-60):

```rust
/// The families of tools that work on a Space. An outside engine brings its own tools for files
/// on disk, the shell and the web; these are what only Misty has. `integration.` is the person's
/// connected apps (`agents/connected_apps`), signed in once in Misty for every engine, and
/// `studio.` the engine's own figure in the studio, which the person watches it work as.
const SPACE_TOOLS: [&str; 15] = [
    "space.",
    "note.",
    "file.",
    "thread.",
    "message.",
    "drawing.",
    "deck.",
    "workbook.",
    "image.",
    "video.",
    "media.",
    "search.",
    "item.",
    "integration.",
    "studio.",
```

Engine instructions constant (lines 93-97):

```rust
/// The engine's figure in Misty's studio, so "take a coffee break" is something it does.
const STUDIO_INSTRUCTIONS: &str = "The person watches you as a figure in Misty's studio, a \
virtual office. When they tell you to go somewhere or take a break (\"go to your desk and work \
on...\", \"take a coffee break\", \"come here\"), call studio_go, then carry on with the work they \
asked for.";
```

In `Caller::instructions` (line 184):

```rust
        let base = format!("{space} {APPS_INSTRUCTIONS} {STUDIO_INSTRUCTIONS}");
```

## `src-tauri/features/engines/mcp_tools.rs`

`names_studio_tool` (lines 239-250):

```rust
/// Whether an engine's request is for one of the studio tools, which only move its own figure, so
/// they go ahead while a chat plans too. Only the tool's own name counts (`mcp__misty__studio_go`,
/// `misty_studio_go`), never what its input says, so no call that changes something passes for one.
pub(crate) fn names_studio_tool(tool: &str) -> bool {
    let tool = tool.trim().to_ascii_lowercase();
    tool.contains("misty")
        && space_tools()
            .iter()
            .filter_map(|offered| offered["name"].as_str())
            .filter(|name| name.starts_with("studio_"))
            .any(|name| tool.ends_with(name))
}
```

## `src-tauri/features/engines/runs_permission.rs`

In `decide`: Misty tool calls go ahead, and studio moves go ahead even while planning (lines 18-25):

```rust
    let facts = RunFacts::of_request(run_id, &body);
    // A call into Misty's own server is journaled and gated there, under this run's mode, so the
    // person isn't asked once here and once more by the tool itself. A plan still changes nothing,
    // though the agent may still move its figure in the studio.
    let misty = crate::engines::mcp::names_misty_tool(tool, input);
    if misty && (!facts.planning || crate::engines::mcp::names_studio_tool(tool)) {
        return Decision::Allow;
    }
```

## `src-tauri/features/agents/run_control/local_tools_tests.rs`

In `a_reload_asks_again_only_what_is_safe_to_repeat` (line 52):

```rust
    assert!(repeats_safely("studio.go"));
```

## `src-tauri/features/agents/run_control/tool_policy_tests.rs`

Test (later renamed and cut down to its `file.create` half) (lines 379-409):

```rust
#[test]
fn the_studio_figure_moves_in_every_mode_and_a_new_file_asks() {
    let taint = Taint::default();
    let planning = RunFacts {
        planning: true,
        ..run(true)
    };
    let listed = RunFacts {
        allowed_tools: vec!["note.read".into()],
        ..run(false)
    };
    for name in ["studio.go", "studio.emote", "studio.say", "studio.release"] {
        for facts in [&run(false), &run(true), &planning, &listed] {
            assert_eq!(
                decide(facts, &taint, name, &json!({})),
                Decision::Run,
                "{name}"
            );
        }
    }
    assert!(asks(&decide(
        &run(false),
        &taint,
        "file.create",
        &json!({})
    )));
    assert_eq!(
        decide(&run(true), &taint, "file.create", &json!({})),
        Decision::Run
    );
}
```

## `src-tauri/features/engines/mcp_tests.rs`

In `offers_space_tools_under_names_clients_accept` (lines 12-15):

```rust
    // Every engine can move its own figure in the studio, with or without the browser.
    for studio in ["studio_go", "studio_emote", "studio_say", "studio_release"] {
        assert!(names.contains(&studio), "{studio}");
    }
```

In `offers_the_browser_only_to_a_run_it_was_attached_to` (lines 39-40):

```rust
    assert!(plain.offers(&json!({ "name": "studio_go" })));
    assert!(plain.instructions().contains("studio_go"));
```

Whole test (lines 105-121):

```rust
#[test]
fn a_studio_move_is_known_by_its_name_alone() {
    for spelled in [
        "mcp__misty__studio_go",
        "misty_studio_say",
        "Misty: studio_release",
    ] {
        assert!(names_studio_tool(spelled), "{spelled}");
    }
    for other in [
        "mcp__misty__note_create",
        "studio_go",
        "mcp__misty__studio_go_and_more",
    ] {
        assert!(!names_studio_tool(other), "{other}");
    }
}
```

## `src-tauri/features/browser/mod.rs`

Module declarations (lines 2-3):

```rust
pub mod studio_music;
pub mod studio_music_media;
```

## `src-tauri/features/app/handlers/more_commands.rs`

Command registrations, after `browser_webview_set_bounds` (lines 19-34):

```rust
            #[cfg(desktop)]
            crate::browser::studio_music::studio_music_open,
            #[cfg(desktop)]
            crate::browser::studio_music::studio_music_place,
            #[cfg(desktop)]
            crate::browser::studio_music::studio_music_hide,
            #[cfg(desktop)]
            crate::browser::studio_music::studio_music_close,
            #[cfg(desktop)]
            crate::browser::studio_music::studio_music_state,
            #[cfg(desktop)]
            crate::browser::studio_music_media::studio_music_media,
            #[cfg(desktop)]
            crate::browser::studio_music_media::studio_music_act,
            #[cfg(desktop)]
            crate::browser::studio_music_media::studio_music_mute,
```

## `src-tauri/features/app/trusted_windows/navigation_guard.rs`

`hosts_websites` with the music player exception (lines 12-18):

```rust
/// Webviews that host remote websites and enforce their own `on_navigation`: browser pages, and
/// the studio's music player, which keeps to its service's sites (`browser/studio_music.rs`).
pub(crate) fn hosts_websites(label: &str) -> bool {
    label.starts_with("misty-browser-")
        || label == "render-control"
        || label == crate::browser::studio_music::LABEL
}
```

## `src-tauri/features/browser/pages/content_world.rs`

`evaluate_in_page_world`, used only by `studio_music_media.rs` (lines 18-27):

```rust
/// Runs `function_body` in the page's own world, beside the page's scripts and their globals.
/// Only for a page whose scripts are the person's own choice to trust with what is read back,
/// such as the studio's music player; what it returns is the page's word, never Misty's.
#[cfg(target_os = "macos")]
pub(crate) async fn evaluate_in_page_world(
    webview: Webview,
    function_body: String,
) -> Result<String, String> {
    evaluate_in(webview, None, function_body, None).await
}
```

## `src-tauri/tauri-permissions/app_commands.in`

After `browser_webview_set_bounds` (lines 101-108):

```rust
    "studio_music_open",
    "studio_music_place",
    "studio_music_hide",
    "studio_music_close",
    "studio_music_state",
    "studio_music_media",
    "studio_music_act",
    "studio_music_mute",
```

## `src-tauri/tauri-permissions/actions/actions.toml`

In the `action-browser` set, after `allow-browser-webview-set-bounds` (lines 161-168):

```toml
  "allow-studio-music-open",
  "allow-studio-music-place",
  "allow-studio-music-hide",
  "allow-studio-music-close",
  "allow-studio-music-state",
  "allow-studio-music-media",
  "allow-studio-music-act",
  "allow-studio-music-mute",
```

## `src-tauri/features/agents/runs/local_prompt/companion_misty_guide.md`

The sidebar line listed the Studio page (line 6):

```markdown
- It holds the Space's pages, such as "Home", "Chat", "Journal", "Library", "Planner", "Calendar", "Studio" and "Tutor", and the person's chats, with "New chat", "Search" and sections they make with "New section…".
```

## `src-tauri/features/agents/runs/local_prompt/catalog.json`

`file.create` description (the `game` flag sent games to the studio arcade) (line 2322):

```json
  "description": "Save a new text file into your home Space's Library: a single-file HTML page or game, Markdown, plain text, JSON, CSV or SVG. Pass the whole file as content (up to 1.5 MB) and a name ending in .html, .md, .txt, .json, .csv or .svg. For a game, write one self-contained .html file, with its CSS, JavaScript and images inline and nothing loaded from other sites, and set game true: it then shows in the arcade cabinet in Misty's studio, where your person can play it. Returns the new item's id and name; change its name, caption or tags later with file_update.",
```
