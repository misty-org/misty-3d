# misty-3d

Misty's Game mode as a module that plugs into Misty (see HOST.md). Misty's own AGENTS.md rules apply
here too; these are the ones only the building has.

- The building is in full color. Its panels float over the room as translucent panels; everywhere
  else in Misty panes are flat.
- The building's HUD is the one colored interface: it is a game, so it wears the app's pastels (`--color-avatar-*`)
  through the scene parts' tints (`SceneTint` in Misty's `src/shared/ui/display/SceneLabel.tsx`: `SceneSlot`, `SceneGlyph`,
  `SceneBadge`, `SceneMeter`). Each thing keeps one tint everywhere it shows (a level is yellow, Break is orange),
  glyphs stay bare, and selection is still the neutral wash, with only a bar of the tint under what is lit. The
  studio's own code never picks a color; a new tint goes into the scene parts.
- The studio's music player (`native/studio_music.rs`) is the one web page a person signs in to and
  plays themselves: a music service's own site, locked to that service, with no Misty commands and
  website data of its own, never shared with an agent's pages.
