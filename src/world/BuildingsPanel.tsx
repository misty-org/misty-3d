import { Check, X } from "lucide-react";
import { IconButton, Pressable, rowShapeWrap, Surface, Text } from "@/shared/ui";
import { StudioSide, StudioSideHead } from "./StudioHud";

/** A Space, as a building the person can walk into. */
export interface Building {
  id: string;
  name: string;
  /** The building the person is in now. */
  current: boolean;
}

/**
 * The front door's panel: every Space the person is in, each a building. Walking into another
 * switches the window to that Space, and the building comes up around them by its door.
 */
export function BuildingsPanel(props: {
  buildings: readonly Building[];
  onEnter(id: string): void;
  onClose(): void;
}) {
  return (
    <StudioSide aria-label="Buildings" className="w-68">
      <StudioSideHead title="Buildings">
        <IconButton label="Close" size="sm" shortcut="Esc" onClick={props.onClose}>
          <X aria-hidden="true" />
        </IconButton>
      </StudioSideHead>
      <div className="grid min-h-0 gap-0.5 overflow-y-auto" role="list">
        {props.buildings.map((building) => (
          <Surface
            key={building.id}
            as={Pressable}
            role="listitem"
            tone={building.current ? "well" : "none"}
            wash="control"
            aria-current={building.current || undefined}
            className={`${rowShapeWrap} w-full text-meta`}
            onClick={() => (building.current ? props.onClose() : props.onEnter(building.id))}
          >
            {/* A Space's name always shows whole, as the Space switcher shows it. */}
            <Text
              wrap
              tone={building.current ? "bright" : undefined}
              className="min-w-0 flex-1 text-left"
            >
              {building.name}
            </Text>
            {building.current ? <Check aria-hidden="true" /> : null}
          </Surface>
        ))}
      </div>
    </StudioSide>
  );
}
