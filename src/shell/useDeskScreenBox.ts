import { useLayoutEffect, useState, type RefObject } from "react";
import { deskScreenRect, type DeskScreenRect } from "./deskScreen";
import { useGameMode } from "./gameMode";

/**
 * Where the glass of the computer the person sits at shows in the room, in CSS pixels inside
 * `area` (the element the room is drawn over): the box the camera puts the glass on, worked out
 * from the same size, so the pages laid over it sit on the screen. Null while nobody is sat, or
 * before the area is measured.
 */
export function useDeskScreenBox(area: RefObject<HTMLElement | null>): DeskScreenRect | null {
  const place = useGameMode((state) => (state.mode === "game" ? state.seat?.place : undefined));
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const element = area.current;
    if (!place || !element) {
      setSize(null);
      return;
    }
    // The room fills the area inside its edges, as the canvas measures it.
    const measure = () =>
      setSize((known) => {
        const width = element.clientWidth;
        const height = element.clientHeight;
        return known?.width === width && known.height === height ? known : { width, height };
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [area, place]);
  return place && size ? deskScreenRect(place, size.width, size.height) : null;
}
