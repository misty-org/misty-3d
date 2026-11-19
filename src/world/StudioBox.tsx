import { ArrowUp, Mic, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { listen, matchVocative, useSpeechSupport, type Listening } from "@/features/voice";
import { IconButton, Text, Textarea } from "@/shared/ui";
import { BoxSuggestions } from "./BoxSuggestions";
import { visibleConversationContent } from "@/features/agents/conversations/view/conversationTurns";
import { Questions } from "./AgentTalk";
import { typingIn } from "./studio/keys";
import { AgentAvatar } from "@/features/agents/personal/AgentAvatar";
import { mentionsIn } from "./studioNames";
import { huddle, studioChatOf, talkTo, useStudioTalk } from "./studioTalk";
import { useMistyStore } from "@/features/agents/conversations/state/useMistyStore";
import { spacesGateway } from "@/features/agents/spaces-gateway/spacesGateway";
import { PersonAvatar } from "./StudioHud";
import type { TeammateAgent } from "@/features/agents/now/teammates";
import type { StudioAgent } from "@/features/agents/now/useStudioAgents";

/** The message box's own text: one line that grows with what is typed, up to five. */
// As tall as the send button beside it, so a single line sits level with it, not along its foot.
export const studioInputClass =
  "field-sizing-content max-h-30 min-h-8 flex-1 py-1.5 text-meta leading-5";

/** The most agents one message gives a task to at once. */
const MOST_AT_ONCE = 4;
/** Push to talk: held, the microphone listens; let go, what was said is sent. */
export const TALK_KEY = "KeyV";
/** How many of the latest lines of a talk show over the box. */
const LOG_LINES = 4;

/** The chat an agent is spoken to in now: its latest private chat, however long ago. */
function currentTalk(item: StudioAgent) {
  return studioChatOf(
    item.agent.id,
    item.conversationId,
    useMistyStore.getState().conversations,
    useStudioTalk.getState(),
  );
}

/** The `@name` being typed at the cursor, if any: where it starts and what is typed of it so far. */
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0 || (at > 0 && !/\s/.test(before[at - 1]!))) return null;
  const query = before.slice(at + 1);
  if (query.includes("\n") || query.length > 40) return null;
  return { start: at, query };
}

/** What can be `@`ed: one of the person's own agents, or a teammate's agent asked through them. */
type Offer = { id: string; name: string; own?: StudioAgent; visitor?: TeammateAgent };

/** The `/` commands the box runs, as a game's chat does. */
export interface ChatCommands {
  /**
   * Runs `text` if it is a command: what to tell the person ("" for nothing), or undefined when
   * it is no command, so it is sent as a message.
   */
  run(text: string): string | undefined;
  /** What to offer while a command is typed; picking one fills the box with its `text`. */
  suggest(text: string): {
    key: string;
    label: string;
    detail: string;
    icon: LucideIcon;
    text: string;
  }[];
}

/**
 * The building's chat, as a game's: one box at the top left. What is typed, or said while V is
 * held, goes to the agent that has the person's attention (E by an agent gives it); its answer
 * shows over its head and is spoken. Otherwise `@` an agent (or start with its name, aloud) to talk
 * to it, or several to give them one task together at the meeting table. `@` a teammate's agent
 * and the words go to the teammate, who decides whether to hand them on: an agent takes requests
 * only from its own person. A `/` runs a command (`/teleport`). Enter, or `/`, opens the box from
 * the room; sending goes back to the room.
 */
export function StudioBox(props: {
  agents: StudioAgent[];
  names: Map<string, string>;
  /** Teammates' agents visiting the room. */
  visitors?: TeammateAgent[];
  /** The person's own agent that has their attention, if any. */
  attention?: StudioAgent | null;
  onTalking(agentId: string): void;
  /** The `/` commands it runs, as `/teleport` in Game mode. */
  commands?: ChatCommands;
  /** It sits at the top of the screen, so what it offers opens below it. */
  below?: boolean;
  /** Shows the latest of the talk over the box; off while the agent's own panel shows it. */
  log?: boolean;
}) {
  const attention = props.attention ?? null;
  const heardName = attention ? (props.names.get(attention.agent.id) ?? attention.agent.name) : "";
  const conversations = useMistyStore((state) => state.conversations);
  const talkChats = useStudioTalk((state) => state.chats);
  const talk = useMemo(
    () => (attention ? currentTalk(attention) : undefined),
    // The talk changes as messages come in and as the studio picks one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attention, conversations, talkChats],
  );
  const log = props.log === false ? [] : (talk?.messages ?? []).slice(-LOG_LINES);
  const [draft, setDraft] = useState("");
  const [caret, setCaret] = useState(0);
  const [pick, setPick] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const visitors = props.visitors;
  const offers = useMemo<Offer[]>(() => {
    const own = props.agents.map((item) => ({
      id: item.agent.id,
      name: props.names.get(item.agent.id) ?? item.agent.name,
      own: item,
    }));
    const taken = new Set(own.map((offer) => offer.name.toLowerCase()));
    const theirs = (visitors ?? []).map((mate) => ({
      id: `guest:${mate.key}`,
      // A teammate's agent named like one of yours says whose it is.
      name: taken.has(mate.name.toLowerCase()) ? `${mate.name} (${mate.owner})` : mate.name,
      visitor: mate,
    }));
    return [...own, ...theirs];
  }, [props.agents, props.names, visitors]);
  const allNames = useMemo(() => new Map(offers.map((offer) => [offer.id, offer.name])), [offers]);
  const typing = mentionAt(draft, caret);
  const query = typing?.query.toLowerCase() ?? "";
  const offered = typing
    ? offers.filter((offer) => offer.name.toLowerCase().startsWith(query))
    : [];
  const chosen = offered[Math.min(pick, offered.length - 1)];
  // A `/` command being typed: what it could go on to be.
  const commandOffers = useMemo(
    () => (props.commands && draft.startsWith("/") ? props.commands.suggest(draft) : []),
    [props.commands, draft],
  );
  const chosenCommand = commandOffers[Math.min(pick, commandOffers.length - 1)];
  const fill = (text: string) => {
    setDraft(text);
    setCaret(text.length);
    setPick(0);
    requestAnimationFrame(() => input.current?.setSelectionRange(text.length, text.length));
  };

  const choose = (offer: Offer) => {
    if (!typing) return;
    const name = offer.name;
    const next = `${draft.slice(0, typing.start)}@${name} ${draft.slice(caret)}`;
    const at = typing.start + name.length + 2;
    setDraft(next);
    setCaret(at);
    setPick(0);
    requestAnimationFrame(() => input.current?.setSelectionRange(at, at));
  };

  /** Back to the room: the box lets go of the keys, so walking and V work again. */
  const done = () => {
    setDraft("");
    setCaret(0);
    input.current?.blur();
  };
  const send = async (text = draft, spoken = false) => {
    if (sending || !text.trim()) return;
    const said = text.trim().startsWith("/") ? props.commands?.run(text.trim()) : undefined;
    if (said !== undefined) {
      if (said) setError(said);
      else done();
      return;
    }
    // To whoever has the person's attention, unless they name someone with @.
    if (attention && !text.trim().startsWith("@")) {
      setSending(true);
      setError("");
      try {
        await talkTo(attention.agent, text, currentTalk(attention)?.id, spoken);
        done();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        setSending(false);
      }
      return;
    }
    // Said aloud to nobody in particular: "Codex, …" goes to Codex.
    if (spoken && !text.includes("@")) {
      const called = matchVocative(
        text,
        props.agents.map((item) => ({
          id: item.agent.id,
          name: props.names.get(item.agent.id) ?? item.agent.name,
        })),
      );
      const item = called && props.agents.find((one) => one.agent.id === called.agent.id);
      if (!item || !called) {
        setDraft(text);
        return setError("Press E by an agent first, or start with its name.");
      }
      setSending(true);
      setError("");
      try {
        await talkTo(item.agent, called.message, currentTalk(item)?.id, true);
        props.onTalking(item.agent.id);
        done();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        setSending(false);
      }
      return;
    }
    const { ids, message } = mentionsIn(allNames, text);
    const asked = ids.map((id) => offers.find((offer) => offer.id === id)?.visitor).find(Boolean);
    if (asked) {
      if (ids.length > 1) return setError(`Ask ${asked.owner}'s ${asked.name} on its own.`);
      if (!message) return setError("Say what you'd like after the name.");
      const space = spacesGateway.maybe()?.windowSpace();
      if (!space) return;
      setSending(true);
      setError("");
      try {
        await spacesGateway
          .get()
          .askMembersAgent(
            space.id,
            asked.userId,
            { id: asked.agentId, name: asked.name },
            message,
          );
        done();
        setError(`Sent to ${asked.owner}`);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        setSending(false);
      }
      return;
    }
    const targets = ids
      .map((id) => props.agents.find((item) => item.agent.id === id))
      .filter((item): item is StudioAgent => Boolean(item));
    if (!targets.length) return setError("Start with @ and the name of an agent.");
    if (!message) return setError("Say what you'd like after the name.");
    if (targets.length > MOST_AT_ONCE)
      return setError(`Up to ${MOST_AT_ONCE} agents can take on one task together.`);
    setSending(true);
    setError("");
    try {
      if (targets.length === 1) {
        const [item] = targets as [StudioAgent];
        await talkTo(item.agent, message, currentTalk(item)?.id, spoken);
      } else {
        await huddle(
          targets.map(({ agent }) => ({ agent, name: props.names.get(agent.id) ?? agent.name })),
          message,
        );
      }
      props.onTalking(targets[0]!.agent.id);
      done();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSending(false);
    }
  };

  // Push to talk: V held listens, and what was heard shows in the box as it's said; let go and
  // it's sent. Recognized on this computer, with no key.
  const speech = useSpeechSupport();
  const canHear = Boolean(speech?.recognition);
  const [hearing, setHearing] = useState(false);
  const heard = useRef<Promise<Listening> | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;
  const startHearing = () => {
    if (heard.current || !canHear) return;
    setError("");
    setHearing(true);
    const opening = listen((now) => {
      if (now.error) setError(now.error);
      else setDraft(now.text);
    });
    heard.current = opening;
    opening.catch((reason: unknown) => {
      heard.current = null;
      setHearing(false);
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  };
  const stopHearing = async () => {
    const opening = heard.current;
    if (!opening) return;
    heard.current = null;
    setHearing(false);
    const said = await opening.then((listening) => listening.stop()).catch(() => "");
    if (said.trim()) void sendRef.current(said, true);
    else setDraft("");
  };
  const hearingRef = useRef({ startHearing, stopHearing });
  hearingRef.current = { startHearing, stopHearing };
  const commandsRef = useRef(props.commands);
  commandsRef.current = props.commands;
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.code === "Enter" && !typingIn(event.target)) {
        // As in a game, Enter opens the chat.
        event.preventDefault();
        input.current?.focus();
        return;
      }
      if (event.key === "/" && !typingIn(event.target) && commandsRef.current) {
        // And / opens it on a command.
        event.preventDefault();
        setDraft("/");
        setCaret(1);
        input.current?.focus();
        return;
      }
      if (event.code !== TALK_KEY || event.repeat || typingIn(event.target)) return;
      event.preventDefault();
      hearingRef.current.startHearing();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === TALK_KEY) void hearingRef.current.stopHearing();
    };
    const leave = () => void hearingRef.current.stopHearing();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", leave);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", leave);
      void heard.current?.then((listening) => listening.stop()).catch(() => undefined);
      heard.current = null;
    };
  }, []);

  return (
    <form
      className="relative grid gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <BoxSuggestions
        below={props.below}
        label={commandOffers.length ? "Commands" : "Agents"}
        items={
          commandOffers.length
            ? commandOffers.map((offer) => ({
                key: offer.key,
                label: offer.label,
                detail: offer.detail,
                icon: offer.icon,
                selected: offer === chosenCommand,
                pick: () => fill(offer.text),
              }))
            : offered.map((offer) => ({
                key: offer.id,
                label: offer.name,
                icon: offer.own ? (
                  <AgentAvatar agent={offer.own.agent} compact />
                ) : (
                  <PersonAvatar
                    name={offer.visitor?.owner ?? ""}
                    picture={offer.visitor?.ownerPicture}
                  />
                ),
                detail: offer.own
                  ? offer.own.agent.role || undefined
                  : `Goes to ${offer.visitor?.owner}`,
                selected: offer === chosen,
                pick: () => choose(offer),
              }))
        }
      />
      {attention && props.log !== false ? (
        <Questions agentId={attention.agent.id} name={heardName} />
      ) : null}
      {attention && log.length ? (
        <div
          className="grid gap-1 px-2 pt-1"
          aria-live="polite"
          aria-label={`Talk with ${heardName}`}
        >
          {log.map((message) => {
            const text = visibleConversationContent(message.content, message.role);
            const coming = message.state === "pending" || message.state === "streaming";
            if (!text && !coming) return null;
            return (
              <Text key={message.id} as="p" size="caption" tone="default" lines={2}>
                <Text bare weight="semibold" tone="bright">
                  {message.role === "user" ? "You" : heardName}
                </Text>{" "}
                {text || "…"}
              </Text>
            );
          })}
        </div>
      ) : null}
      {error ? (
        <Text wrap size="caption" tone="muted" className="px-2 pt-1" role="alert">
          {error}
        </Text>
      ) : null}
      <div className="flex items-end gap-1.5 py-1 pr-1 pl-3">
        <Textarea
          ref={input}
          variant="composer"
          rows={1}
          className={studioInputClass}
          value={draft}
          maxLength={8000}
          placeholder={
            hearing
              ? "Speak now, then let go of V"
              : attention
                ? canHear
                  ? `Hold V or type to ${heardName}`
                  : `Say something to ${heardName}`
                : props.commands
                  ? "Message an agent with @, or type /"
                  : "Message an agent with @"
          }
          aria-label={attention ? `Talk to ${heardName}` : "Talk to the studio"}
          role="combobox"
          aria-expanded={offered.length > 0 || commandOffers.length > 0}
          onChange={(event) => {
            setDraft(event.target.value);
            setCaret(event.target.selectionStart);
            setPick(0);
            setError("");
          }}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          onKeyDown={(event) => {
            const listed = commandOffers.length || offered.length;
            if (listed && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setPick((known) => (known + step + listed) % listed);
              return;
            }
            // Tab completes a command; Enter does too while only its name is typed, else runs it.
            const partial = chosenCommand && chosenCommand.text.trim() !== draft.trim();
            const complete =
              event.key === "Tab" || (event.key === "Enter" && partial && !draft.includes(" "));
            if (chosenCommand && complete) {
              event.preventDefault();
              fill(chosenCommand.text);
              return;
            }
            if (event.key === "Escape" && draft.startsWith("/")) {
              event.preventDefault();
              done();
              return;
            }
            if ((event.key === "Enter" || event.key === "Tab") && offered.length && chosen) {
              event.preventDefault();
              choose(chosen);
              return;
            }
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            void send();
          }}
        />
        {canHear ? (
          // Held, as V is: press to talk, let go to send.
          <IconButton
            label="Hold to talk"
            shortcut="V"
            aria-pressed={hearing}
            disabled={sending}
            onPointerDown={startHearing}
            onPointerUp={() => void stopHearing()}
            onPointerLeave={() => void stopHearing()}
          >
            <Mic aria-hidden="true" />
          </IconButton>
        ) : null}
        <IconButton label="Send" type="submit" disabled={sending || hearing || !draft.trim()}>
          <ArrowUp aria-hidden="true" />
        </IconButton>
      </div>
    </form>
  );
}
