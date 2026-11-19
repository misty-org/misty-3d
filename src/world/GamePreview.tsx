import { lazy, Suspense, useState } from "react";
import { cn, Surface } from "@/shared/ui";
import { useReducedMotion } from "./studio/useMotionPreference";

const PreviewScene = lazy(() => import("./studio/PreviewScene"));

/** The page a computer opens, drawn small: a sidebar of chats beside a conversation. */
function PagePreview() {
  return (
    <Surface tone="page" className="flex size-full gap-[4%] p-[5%]">
      <div className="flex w-[26%] flex-col gap-[6%]">
        <Surface tone="active" className="h-[10%] rounded-sm" />
        <Surface tone="well" className="h-[10%] rounded-sm" />
        <Surface tone="well" className="h-[10%] rounded-sm" />
      </div>
      <Surface
        tone="card"
        edge="hairline"
        className="flex flex-1 flex-col gap-[7%] rounded-sm p-[7%]"
      >
        <Surface tone="well" className="h-[9%] w-2/3 self-end rounded-sm" />
        <Surface tone="well" className="h-[9%] w-3/4 rounded-sm" />
        <Surface tone="well" className="h-[9%] w-1/2 rounded-sm" />
      </Surface>
    </Surface>
  );
}

/**
 * Game mode in a few seconds, looping, for setup's choice between Classic and Game: someone
 * walks to their desk, sits down and types, and the camera moves into the screen until the real
 * page is all there is. With reduced motion it is one still moment of it.
 */
export function GamePreview() {
  const still = useReducedMotion();
  const [page, setPage] = useState(false);
  return (
    <Surface
      tone="stage"
      edge="hairline"
      radius="md"
      className="relative aspect-[16/10] w-full overflow-hidden"
      aria-hidden="true"
    >
      <Suspense fallback={null}>
        <PreviewScene still={still} onPage={setPage} />
      </Suspense>
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none",
          page ? "opacity-100" : "opacity-0",
        )}
      >
        <PagePreview />
      </div>
    </Surface>
  );
}
