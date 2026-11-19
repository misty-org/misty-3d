import { DesktopSettingsRow as Row, DesktopSettingsSection as Section } from "@/features/settings";
import { SliderControl, SwitchControl } from "@/features/settings/SettingsControls";
import type { SettingsContentProps } from "@/features/settings";
import { STUDIO_CAMERA_SCALE, selectStudioCamera } from "./cameraSettings";

const times = (value: number) => `${Number(value.toFixed(2))}×`;

/** Settings › Studio: how the camera answers the mouse, walking about and over the room. */
export function StudioSettings(props: SettingsContentProps) {
  const camera = selectStudioCamera(props.document);
  const scale = (key: string, value: number) => (
    <SliderControl
      value={value}
      min={STUDIO_CAMERA_SCALE.min}
      max={STUDIO_CAMERA_SCALE.max}
      step={0.05}
      disabled={props.working}
      format={times}
      onCommit={(next) => props.onSettingChange("studio", key, next)}
    />
  );
  return (
    <Section title="Camera">
      <Row label="Camera sensitivity">{scale("camera_sensitivity", camera.sensitivity)}</Row>
      <Row label="Zoom speed">{scale("zoom_speed", camera.zoom)}</Row>
      <Row label="Invert vertical look">
        <SwitchControl
          checked={camera.invert}
          disabled={props.working}
          onChange={(value) => props.onSettingChange("studio", "invert_look", value)}
        />
      </Row>
    </Section>
  );
}
