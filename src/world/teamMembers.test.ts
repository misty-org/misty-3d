import { describe, expect, it } from "vitest";
import { memberRoom, placeWords } from "./teamMembers";

describe("where a teammate is", () => {
  it("says the room of the building they are in, from their presence", () => {
    expect(placeWords({ place: "studio", room: "lounge" })).toBe("In the lounge");
    expect(placeWords({ place: "studio", room: "desk" })).toBe("At their desk");
    expect(placeWords({ place: "studio" })).toBe("In the building");
    expect(placeWords({ place: "lab", notebook: "Cells" })).toBe("In the Lab · Cells");
    expect(placeWords({})).toBe("In the Space");
  });

  it("stands them in that room here, their own desk being on the agent floor", () => {
    expect(memberRoom({ place: "studio", room: "library" })).toBe("library");
    expect(memberRoom({ place: "studio", room: "desk" })).toBe("office");
    // Only the building's own rooms count, and only while they are in it.
    expect(memberRoom({ place: "studio", room: "my secret plans" })).toBeUndefined();
    expect(memberRoom({ place: "lab", room: "library" })).toBeUndefined();
  });
});
