import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import { hasTauriInternals } from "@/shared/platform/tauri";

/**
 * The building filling the screen, the window too, with the rest of Misty out of sight. It only
 * ever undoes a full screen it made itself, and leaving the building leaves it.
 */
export function useWindowFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);
  const madeFullscreen = useRef(false);
  useEffect(() => {
    if (!hasTauriInternals()) return;
    const window = getCurrentWindow();
    if (fullscreen) {
      void window
        .isFullscreen()
        .then((already) => {
          if (already) return;
          madeFullscreen.current = true;
          return window.setFullscreen(true);
        })
        .catch(() => undefined);
    } else if (madeFullscreen.current) {
      madeFullscreen.current = false;
      void window.setFullscreen(false).catch(() => undefined);
    }
  }, [fullscreen]);
  useEffect(
    () => () => {
      if (madeFullscreen.current && hasTauriInternals())
        void getCurrentWindow()
          .setFullscreen(false)
          .catch(() => undefined);
    },
    [],
  );
  return [fullscreen, setFullscreen] as const;
}
