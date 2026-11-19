import { uiPx } from "@/shared/lib/uiScale";

/**
 * The glass of each computer the person sits at in Game mode, in scene units: the big screen on
 * their desk, and the laptop on the library's reading desk. The pages lie exactly over it.
 */
export const deskGlass = {
  desk: { w: 0.96, h: 0.54 },
  library: { w: 0.44, h: 0.28 },
} as const;

export type DeskGlassPlace = keyof typeof deskGlass;

/**
 * What stays clear round the glass once sat, in design pixels: the band along the top, the desk's
 * dock along the bottom, and room at the sides for the monitor's bezel to show.
 */
const CLEAR = { top: 56, bottom: 64, side: 24 };

/** A box in a view, in CSS pixels from its top left corner. */
export interface DeskScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where a computer's glass shows in a view `width` by `height` once the person sits at it: as big
 * as fits between the band and the dock, in the middle. The camera moves in until the glass is
 * here, and the real pages are laid over the same box, so they sit on the screen in the room.
 */
export function deskScreenRect(
  place: DeskGlassPlace,
  width: number,
  height: number,
): DeskScreenRect {
  const glass = deskGlass[place];
  const side = uiPx(CLEAR.side);
  const top = uiPx(CLEAR.top);
  const room = {
    w: Math.max(1, width - side * 2),
    h: Math.max(1, height - top - uiPx(CLEAR.bottom)),
  };
  const scale = Math.min(room.w / glass.w, room.h / glass.h);
  const w = glass.w * scale;
  const h = glass.h * scale;
  return { left: (width - w) / 2, top: top + (room.h - h) / 2, width: w, height: h };
}
