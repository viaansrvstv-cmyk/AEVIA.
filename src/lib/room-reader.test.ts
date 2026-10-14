import { describe, expect, it } from "vitest";
import { summarizeRoom, type FaceLandmarks } from "@/lib/room-reader";

function face(noseX: number, smile = 0): FaceLandmarks {
  const landmarks = Array.from({ length: 455 }, () => ({ x: 0.5, y: 0.5 }));
  landmarks[234] = { x: 0.2, y: 0.5 };
  landmarks[454] = { x: 0.8, y: 0.5 };
  landmarks[1] = { x: noseX, y: 0.5 };
  return landmarks;
}

describe("Room Reader signals", () => {
  it("returns a calm empty-room state when no face is visible", () => {
    expect(summarizeRoom([])).toMatchObject({
      people: 0,
      facingCamera: 0,
      visibleSmiles: 0,
      headline: "Room is ready",
    });
  });

  it("counts camera-facing faces and visible smile cues without assigning emotions", () => {
    const reading = summarizeRoom([
      {
        landmarks: face(0.5),
        blendshapes: [
          { categoryName: "mouthSmileLeft", score: 0.6 },
          { categoryName: "mouthSmileRight", score: 0.6 },
        ],
      },
      { landmarks: face(0.78), blendshapes: [] },
    ]);

    expect(reading).toMatchObject({
      people: 2,
      facingCamera: 1,
      visibleSmiles: 1,
      smileLevel: 30,
    });
    expect(reading.detail).not.toMatch(/feel|mood|emotion/i);
  });
});
