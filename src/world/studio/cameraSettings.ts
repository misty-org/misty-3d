import { useSettingsStore } from "@/features/settings";
import { booleanSetting, numberSetting } from "@/features/settings/SettingsControls";

/** The range of the studio camera's sensitivity and zoom speed, as multiples of the built-in. */
export const STUDIO_CAMERA_SCALE = { min: 0.25, max: 3 } as const;

export interface StudioCamera {
  /** How far the camera turns for the mouse's travel, against the built-in rate. */
  sensitivity: number;
  /** How far the wheel moves the camera in and out, against the built-in rate. */
  zoom: number;
  /** Mouse up looks down, as some games have it. */
  invert: boolean;
}

const scale = (value: number) =>
  Math.min(STUDIO_CAMERA_SCALE.max, Math.max(STUDIO_CAMERA_SCALE.min, value));

export function selectStudioCamera(document?: Record<string, unknown> | null): StudioCamera {
  const source = document ?? {};
  return {
    sensitivity: scale(numberSetting(source, "studio", "camera_sensitivity", 1)),
    zoom: scale(numberSetting(source, "studio", "zoom_speed", 1)),
    invert: booleanSetting(source, "studio", "invert_look", false),
  };
}

/** The person's studio camera settings, current as they change in Settings. */
export function useStudioCamera(): StudioCamera {
  const studio = useSettingsStore((state) => state.settings?.document.studio);
  return selectStudioCamera({ studio });
}
