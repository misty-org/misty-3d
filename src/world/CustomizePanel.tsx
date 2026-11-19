import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { AgentProfile } from "@/shared/schemas";
import {
  ColorSwatch,
  Field,
  IconButton,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  Text,
  useNotice,
} from "@/shared/ui";
import { updateAgent } from "@/features/agents/personal/saveAgent";
import { StudioSide, StudioSideHead } from "./StudioHud";
import { characterFor, characterModels, characterName } from "./studio/figure/characterModels";
import { hairs, hashOf, shirts, skins, trousers } from "./studio/look";
import { emptyLook, useStudioLooks, type FigureLook } from "./studioLooks";

/** Whose look the person's own figure is kept under, beside their agents'. */
export const PERSON_LOOK = "you";
/** Some desks come with a plant (`Desk`); its switch starts on there. */
const deskHasPlant = (deskId: string | undefined) => Boolean(deskId && hashOf(deskId) % 3 === 0);
const mugs = ["#e76f51", "#2a9d8f", "#e9c46a", "#f4f1de", "#7768ae", "#3d5a80"];

/** A labelled row of choices: the label over them. */
function ChoiceRow(props: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5" role="radiogroup" aria-label={props.label}>
      <Text bare size="caption" tone="muted">
        {props.label}
      </Text>
      {props.children}
    </div>
  );
}

/** A row of colours to pick from; the picked one is ringed. */
function Swatches(props: {
  label: string;
  colors: readonly string[];
  value: string | undefined;
  onPick(color: string): void;
}) {
  return (
    <ChoiceRow label={props.label}>
      <div className="flex flex-wrap gap-1.5">
        {props.colors.map((color) => (
          <ColorSwatch
            key={color}
            radio
            color={color}
            label={color}
            selected={props.value === color}
            onClick={() => props.onPick(color)}
          />
        ))}
      </div>
    </ChoiceRow>
  );
}

/** A part of the panel under a hairline, with its name. */
function Section(props: { label: string; children: ReactNode }) {
  return (
    <section className="grid" aria-label={props.label}>
      <Separator />
      <div className="grid gap-2.5 pt-3.5">
        <Text as="h4" size="caption" weight="semibold" tone="bright">
          {props.label}
        </Text>
        {props.children}
      </div>
    </section>
  );
}

/** The character to wear, from every one in the pack, by name. */
function CharacterChoice(props: { value: string; onPick(model: string): void }) {
  return (
    <Field label="Character">
      <Select value={props.value} onValueChange={props.onPick}>
        <SelectTrigger aria-label="Character">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {characterModels.map((model) => (
            <SelectItem key={model} value={model} label={characterName(model)} />
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/**
 * Making an agent its own: its name and role, which character it is and its colours, and what
 * is on its desk; or, with no agent, the person's own character. Every change shows in the room at
 * once and is kept on this computer: the name and role with the agent, the rest in the building's
 * own documents (`studioLooks.ts`).
 */
export function CustomizePanel(props: {
  /** The agent to dress up; without one, the person's own figure. */
  agent?: AgentProfile;
  /** The agent's desk, whose own things show until something else is chosen. */
  deskId?: string;
  /** Who the person is, which settles their character until they pick one. */
  who?: string;
  onClose(): void;
}) {
  const { agent } = props;
  const lookId = agent?.id ?? PERSON_LOOK;
  const look = useStudioLooks((state) => state.looks[lookId]) ?? emptyLook();
  const change = useStudioLooks((state) => state.change);
  const [name, setName] = useState(agent?.name ?? "");
  const [role, setRole] = useState(agent?.role ?? "");
  const [error, setError] = useState("");
  useNotice(Boolean(error), { message: error, tone: "error", onDismiss: () => setError("") });
  const figure = (next: FigureLook) =>
    change(lookId, (known) => ({ ...known, figure: { ...known.figure, ...next } }));
  const desk = (next: typeof look.desk) =>
    change(lookId, (known) => ({ ...known, desk: { ...known.desk, ...next } }));
  const keep = (next: { name?: string; role?: string }) => {
    if (!agent) return;
    if (next.name !== undefined && (!next.name.trim() || next.name.trim() === agent.name)) {
      setName(agent.name);
      return;
    }
    if (next.role !== undefined && next.role.trim() === agent.role) return;
    void updateAgent(agent, next).catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : String(reason)),
    );
  };
  return (
    <StudioSide className="w-71" aria-label={agent ? `Customize ${agent.name}` : "Your character"}>
      <StudioSideHead title={agent ? "Customize" : "Your character"}>
        <IconButton label="Done" onClick={props.onClose}>
          <X aria-hidden="true" />
        </IconButton>
      </StudioSideHead>
      <div className="-mx-1 grid min-h-0 gap-4 overflow-y-auto px-1 pb-1">
        {agent ? (
          <div className="grid gap-3">
            <Field label="Name">
              <Input
                maxLength={80}
                value={name}
                readOnly={agent.system_managed}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => keep({ name })}
                onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
              />
            </Field>
            <Field label="Role">
              <Input
                maxLength={160}
                placeholder="Reviews pull requests"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                onBlur={() => keep({ role })}
                onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
              />
            </Field>
          </div>
        ) : null}
        <Section label="Look">
          <CharacterChoice
            value={characterFor(agent?.id ?? props.who ?? PERSON_LOOK, look.figure.model)}
            onPick={(model) => figure({ model })}
          />
          <Swatches
            label="Skin"
            colors={skins}
            value={look.figure.skin}
            onPick={(skin) => figure({ skin })}
          />
          <Swatches
            label="Hair"
            colors={hairs}
            value={look.figure.hair}
            onPick={(hair) => figure({ hair })}
          />
          <Swatches
            label="Shirt"
            colors={shirts}
            value={look.figure.shirt}
            onPick={(shirt) => figure({ shirt })}
          />
          <Swatches
            label="Trousers"
            colors={trousers}
            value={look.figure.trousers}
            onPick={(next) => figure({ trousers: next })}
          />
        </Section>
        {agent ? (
          <Section label="Desk">
            {(
              [
                ["plant", "Plant"],
                ["photo", "Photo"],
                ["lamp", "Lamp"],
              ] as const
            ).map(([key, label]) => (
              <Text
                as="label"
                bare
                size="meta"
                tone="default"
                key={key}
                className="flex h-8 items-center justify-between"
              >
                <span>{label}</span>
                <Switch
                  checked={look.desk[key] ?? (key === "plant" && deskHasPlant(props.deskId))}
                  onCheckedChange={(on) => desk({ [key]: on })}
                />
              </Text>
            ))}
            <Swatches
              label="Mug"
              colors={mugs}
              value={look.desk.mug}
              onPick={(mug) => desk({ mug })}
            />
          </Section>
        ) : null}
      </div>
    </StudioSide>
  );
}
