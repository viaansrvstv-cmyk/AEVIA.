import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Camera,
  Loader2,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  VideoOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageIntro } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { summarizeRoom, type RoomReading } from "@/lib/room-reader";

export const Route = createFileRoute("/room-reader")({
  head: () => ({
    meta: [
      { title: "Room Reader — AEVIA" },
      {
        name: "description",
        content:
          "A private, on-device snapshot of visible group cues. Camera frames stay in your browser.",
      },
      { property: "og:title", content: "Room Reader — AEVIA" },
      {
        property: "og:description",
        content:
          "A private, on-device snapshot of visible group cues. Camera frames stay in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomReader,
});

const EMPTY_READING: RoomReading = summarizeRoom([]);

function friendlyCameraError(error: unknown) {
  if (!(error instanceof Error))
    return "Couldn’t start Room Reader. Check your camera and connection, then retry.";
  if (error.message === "insecure-context")
    return "Camera access needs HTTPS. Open this page over a secure connection, then retry.";
  if (error.message === "camera-unavailable")
    return "Camera access isn’t available in this browser. Try Chrome on a supported device.";
  if (["NotAllowedError", "PermissionDeniedError"].includes(error.name)) {
    return "Camera permission was denied. Allow camera access in your browser’s site settings, then retry.";
  }
  if (error.name === "NotFoundError")
    return "No camera was found. Connect or enable a camera, then retry.";
  if (error.name === "NotReadableError")
    return "The camera is busy. Close other apps using it, then retry.";
  return "Couldn’t load the vision model. Check your connection and camera permission, then retry.";
}

function RoomReader() {
  const video = useRef<HTMLVideoElement>(null);
  const stopSession = useRef<() => void>(() => {});
  const session = useRef(0);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Preparing camera…");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(EMPTY_READING);
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => () => stopSession.current(), []);

  async function start() {
    setError("");
    setLoadingMessage("Requesting camera access…");
    setLoading(true);
    const id = ++session.current;
    let stream: MediaStream | undefined;
    let landmarker:
      | {
          close: () => void;
          detectForVideo: (
            video: HTMLVideoElement,
            timestamp: number,
          ) => {
            faceLandmarks: Array<Array<{ x: number; y: number }>>;
            faceBlendshapes?: Array<{ categories: Array<{ categoryName: string; score: number }> }>;
          };
        }
      | undefined;
    let raf = 0;
    let lastVideoTime = -1;
    let lastUiUpdate = 0;
    let lastSignature = "";

    const release = () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
      stream = undefined;
      landmarker?.close();
      landmarker = undefined;
      if (video.current) {
        video.current.pause();
        video.current.srcObject = null;
      }
    };
    stopSession.current = () => {
      session.current++;
      release();
    };
    const ensureCurrent = () => {
      if (session.current !== id) throw new DOMException("Session stopped", "AbortError");
    };

    try {
      if (!window.isSecureContext) throw new Error("insecure-context");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera-unavailable");
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 480 },
          height: { ideal: 360 },
          frameRate: { ideal: 24, max: 30 },
        },
      });
      ensureCurrent();
      const currentVideo = video.current;
      if (!currentVideo) throw new Error("camera-unavailable");
      currentVideo.srcObject = stream;
      await currentVideo.play();
      ensureCurrent();

      setLoadingMessage("Downloading the on-device vision model…");
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
      );
      ensureCurrent();
      setLoadingMessage("Preparing the room reader…");
      const makeLandmarker = async (delegate: "GPU" | "CPU") =>
        FaceLandmarker.createFromOptions(files, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate,
          },
          runningMode: "VIDEO",
          numFaces: 4,
          outputFaceBlendshapes: true,
        });
      try {
        landmarker = await makeLandmarker("GPU");
      } catch {
        landmarker = await makeLandmarker("CPU");
      }
      ensureCurrent();
      setActive(true);

      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (!currentVideo.videoWidth || currentVideo.currentTime === lastVideoTime || !landmarker)
          return;
        lastVideoTime = currentVideo.currentTime;
        const now = performance.now();
        const result = landmarker.detectForVideo(currentVideo, now);
        const faces = result.faceLandmarks.map((landmarks, index) => ({
          landmarks,
          blendshapes: result.faceBlendshapes?.[index]?.categories,
        }));
        const next = summarizeRoom(faces);
        const signature = `${next.people}:${next.facingCamera}:${next.visibleSmiles}:${next.headline}`;
        if (now - lastUiUpdate >= 240 && signature !== lastSignature) {
          lastUiUpdate = now;
          lastSignature = signature;
          setReading(next);
          setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        }
      };
      loop();
    } catch (caught) {
      release();
      if (session.current === id) {
        stopSession.current = () => {};
        setError(friendlyCameraError(caught));
      }
    } finally {
      if (session.current === id) {
        setLoading(false);
        setLoadingMessage("Preparing camera…");
      }
    }
  }

  function stop() {
    stopSession.current();
    stopSession.current = () => {};
    setActive(false);
    setLoading(false);
    setReading(EMPTY_READING);
    setUpdatedAt("");
  }

  return (
    <>
      <PageIntro module="Module 06 · Spatial" title="Room Reader">
        A quiet snapshot of visible group cues—processed on this device. It describes what the
        camera can see, not what anyone feels or thinks.
      </PageIntro>

      <main className="mx-auto grid max-w-7xl gap-6 px-5 pb-6 lg:grid-cols-[1.45fr_1fr]">
        <section
          className="relative min-h-[340px] overflow-hidden rounded-3xl border border-border bg-foreground shadow-soft sm:aspect-video sm:min-h-0"
          aria-label="Room camera preview"
        >
          <video
            ref={video}
            muted
            playsInline
            className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
          />
          {!active && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-foreground/90 p-6 text-center text-background">
              <div className="max-w-md">
                <div className="mx-auto grid size-14 place-items-center rounded-full border border-background/20 bg-background/10">
                  {loading ? (
                    <Loader2 className="size-6 animate-spin text-primary" />
                  ) : (
                    <ScanFace className="size-6 text-primary" />
                  )}
                </div>
                <p className="eyebrow mt-4 text-primary">AEVIA · LOCAL SESSION</p>
                <h2 className="mt-2 font-display text-4xl">A read on the room.</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-background/70">
                  Start when you’re ready. Camera frames and face cues stay in this browser and are
                  never recorded or uploaded.
                </p>
                <Button
                  onClick={start}
                  disabled={loading}
                  className="mt-5 rounded-full bg-gradient-accent px-6 py-3 text-sm font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> {loadingMessage}
                    </>
                  ) : (
                    <>
                      <Camera className="size-4" />{" "}
                      {error ? "Retry Room Reader" : "Start Room Reader"}
                    </>
                  )}
                </Button>
                {error && (
                  <p role="alert" className="mx-auto mt-4 max-w-sm text-sm text-primary">
                    {error}
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="absolute inset-x-3 top-3 z-20 flex flex-wrap items-center justify-between gap-2 sm:inset-x-4 sm:top-4">
            <span className="flex items-center gap-2 rounded-full border border-background/20 bg-foreground/80 px-3 py-2 text-xs text-background backdrop-blur">
              <span
                className={`size-2 rounded-full ${active ? "animate-pulse bg-primary" : "bg-background/40"}`}
              />
              {active ? "Reading visible cues" : "Camera off"}
            </span>
            {active && (
              <Button onClick={stop} variant="secondary" size="sm" className="rounded-full">
                <VideoOff className="size-4" /> Stop
              </Button>
            )}
          </div>
          {active && (
            <div className="absolute inset-x-3 bottom-3 z-20 flex items-center gap-2 rounded-2xl border border-background/20 bg-foreground/80 px-3 py-2 text-xs text-background backdrop-blur sm:inset-x-4 sm:bottom-4">
              <ShieldCheck className="size-4 shrink-0 text-primary" />
              <span>Local processing · nothing uploaded</span>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-3xl border border-primary/40 bg-card p-6" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Room at a glance</p>
                <h2 className="mt-2 font-display text-4xl leading-tight">{reading.headline}</h2>
              </div>
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Activity className="size-5" />
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{reading.detail}</p>
            {updatedAt && (
              <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                Updated {updatedAt}
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-border bg-card p-6">
            <p className="eyebrow">Visible signals</p>
            <div className="mt-4 divide-y divide-border">
              <Signal
                label="People in view"
                value={String(reading.people)}
                detail="Up to four faces"
              />
              <Signal
                label="Facing camera"
                value={`${reading.facingCamera} / ${reading.people}`}
                detail="Estimated from face orientation"
              />
              <Signal
                label="Visible smile cues"
                value={String(reading.visibleSmiles)}
                detail={`${reading.smileLevel}% average smile signal`}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">A cue, not a conclusion</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Face direction and expression signals are approximate. They do not reveal a
                  person’s feelings, attention, consent, or intent. Use this as a playful visual
                  aid—not a way to judge anyone.
                </p>
              </div>
            </div>
          </section>
          {error && (
            <div
              className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
              role="alert"
            >
              <p>{error}</p>
              <Button
                onClick={start}
                disabled={loading}
                variant="outline"
                size="sm"
                className="mt-3 rounded-full"
              >
                <RotateCcw className="size-4" /> Retry camera
              </Button>
            </div>
          )}
        </aside>
      </main>
    </>
  );
}

function Signal({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
      <p className="shrink-0 font-display text-3xl">{value}</p>
    </div>
  );
}
