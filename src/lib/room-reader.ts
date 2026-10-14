export type FaceLandmarks = Array<{ x: number; y: number }>;
export type FaceBlendshapes = Array<{ categoryName: string; score: number }>;

export type RoomReading = {
  people: number;
  facingCamera: number;
  visibleSmiles: number;
  smileLevel: number;
  headline: string;
  detail: string;
};

function shapeScore(shapes: FaceBlendshapes | undefined, name: string) {
  return shapes?.find((shape) => shape.categoryName === name)?.score ?? 0;
}

function appearsFacingCamera(landmarks: FaceLandmarks) {
  const left = landmarks[234];
  const right = landmarks[454];
  const nose = landmarks[1];
  if (!left || !right || !nose || Math.abs(right.x - left.x) < 0.001) return false;
  const nosePosition = (nose.x - left.x) / (right.x - left.x);
  return nosePosition >= 0.38 && nosePosition <= 0.62;
}

export function summarizeRoom(
  faces: Array<{ landmarks: FaceLandmarks; blendshapes?: FaceBlendshapes }>,
): RoomReading {
  if (!faces.length) {
    return {
      people: 0,
      facingCamera: 0,
      visibleSmiles: 0,
      smileLevel: 0,
      headline: "Room is ready",
      detail: "Move into the camera view to begin reading visible cues.",
    };
  }

  const facingCamera = faces.filter((face) => appearsFacingCamera(face.landmarks)).length;
  const smileScores = faces.map(
    (face) =>
      (shapeScore(face.blendshapes, "mouthSmileLeft") +
        shapeScore(face.blendshapes, "mouthSmileRight")) /
      2,
  );
  const visibleSmiles = smileScores.filter((score) => score >= 0.35).length;
  const smileLevel = Math.round(
    (smileScores.reduce((sum, score) => sum + score, 0) / faces.length) * 100,
  );
  const facingPercent = facingCamera / faces.length;

  let headline = "A mix of visible cues";
  let detail = "Some faces are turned toward the camera; expressions vary across the group.";
  if (facingPercent >= 0.75 && smileLevel >= 35) {
    headline = "Warm expressions in view";
    detail = "Most detected faces are camera-facing, with several visible smile cues.";
  } else if (facingPercent >= 0.75) {
    headline = "Most faces are camera-facing";
    detail = "The group is mostly oriented toward the camera; expression cues look varied.";
  } else if (visibleSmiles > 0) {
    headline = "A few warm expressions";
    detail = "Visible smile cues are present, while the group is oriented in different directions.";
  } else if (facingPercent < 0.4) {
    headline = "Attention is elsewhere";
    detail = "Most detected faces are turned away from the camera right now.";
  }

  return { people: faces.length, facingCamera, visibleSmiles, smileLevel, headline, detail };
}
