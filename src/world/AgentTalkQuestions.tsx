import { useState } from "react";
import { Button, CodeBlock, Surface, Text } from "@/shared/ui";
import {
  actionQuestionHasDetails,
  actionQuestionText,
  answerActionQuestion,
  useActionQuestions,
} from "@/features/agents/island/actionQuestions";

/** An agent's questions waiting for its person, answered right here: nothing runs until they are. */
export function Questions(props: { agentId: string; name: string }) {
  const all = useActionQuestions((state) => state.items);
  const questions = all.filter((question) => question.agentId === props.agentId);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  if (!questions.length) return null;
  const answer = (id: string, allow: boolean) => {
    setBusy(id);
    setError("");
    void answerActionQuestion(id, allow)
      .catch(() => setError("That question already closed. Nothing was done."))
      .finally(() => setBusy(""));
  };
  return (
    <div className="grid gap-2">
      {questions.map((question) => (
        <Surface
          key={question.id}
          artWash="amber"
          radius="xl"
          className="grid gap-2 p-2.5"
          role="group"
        >
          <Text wrap size="meta" tone="bright">
            {actionQuestionText(question, props.name)}
          </Text>
          {actionQuestionHasDetails(question) ? (
            <CodeBlock
              code={question.control}
              wrap
              copy={false}
              className="max-h-30 overflow-auto"
            />
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="flex-1"
              disabled={busy === question.id}
              onClick={() => answer(question.id, true)}
            >
              Allow
            </Button>
            <Button
              className="flex-1"
              disabled={busy === question.id}
              onClick={() => answer(question.id, false)}
            >
              Deny
            </Button>
          </div>
        </Surface>
      ))}
      {error ? (
        <Text wrap size="caption" tone="muted" role="alert">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
