import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as Controls } from "three-stdlib";
import { countryAt, polygons, type Country, type Location } from "@/lib/world-explorer";
import { Button } from "@/components/ui/button";
import { Minus, Plus, RotateCcw } from "lucide-react";

function position(lat: number, lon: number, radius = 2): THREE.Vector3 {
  const a = THREE.MathUtils.degToRad(lat),
    b = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    radius * Math.cos(a) * Math.cos(b),
    radius * Math.sin(a),
    -radius * Math.cos(a) * Math.sin(b),
  );
}
function boundaryGeometry(countries: Country[], radius: number) {
  const vertices: number[] = [];
  for (const country of countries)
    for (const polygon of polygons(country))
      for (const ring of polygon) {
        for (let i = 1; i < ring.length; i++) {
          const a = ring[i - 1],
            b = ring[i];
          if (!a || !b) continue;
          const start = position(a[1] ?? 0, a[0] ?? 0, 1),
            end = position(b[1] ?? 0, b[0] ?? 0, 1);
          const steps = Math.max(1, Math.ceil(start.angleTo(end) / 0.035));
          let prev = start.clone().multiplyScalar(radius);
          for (let j = 1; j <= steps; j++) {
            const next = start
              .clone()
              .lerp(end, j / steps)
              .normalize()
              .multiplyScalar(radius);
            vertices.push(prev.x, prev.y, prev.z, next.x, next.y, next.z);
            prev = next;
          }
        }
      }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return geo;
}
type Palette = { primary: string; violet: string; atmosphere: string };
function Earth({
  countries,
  selected,
  palette,
  cloudsOn,
}: {
  countries: Country[];
  selected?: Country | undefined;
  palette: Palette;
  cloudsOn: boolean;
}) {
  const map = useTexture("/earth-daymap.jpg", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = 4;
  });
  const normalMap = useTexture("/earth-normal.webp", (texture) => {
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = 4;
  });
  const border = useMemo(() => boundaryGeometry(countries, 2.006), [countries]);
  const highlight = useMemo(() => boundaryGeometry(selected ? [selected] : [], 2.018), [selected]);
  const borderMat = useRef<THREE.LineBasicMaterial>(null);
  const selectedMat = useRef<THREE.LineBasicMaterial>(null);
  const elapsed = useRef(0);
  const target = useMemo(() => new THREE.Color(palette.primary), [palette.primary]);
  useEffect(() => () => border.dispose(), [border]);
  useEffect(() => () => highlight.dispose(), [highlight]);
  useEffect(() => {
    selectedMat.current?.color.set(palette.violet);
  }, [selected, palette.violet]);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    elapsed.current += dt;
    if (borderMat.current)
      borderMat.current.opacity = 0.26 + 0.08 * Math.sin(elapsed.current * 0.75);
    if (selectedMat.current) {
      selectedMat.current.opacity = THREE.MathUtils.damp(
        selectedMat.current.opacity,
        selected ? 1 : 0,
        5,
        dt,
      );
      selectedMat.current.color.lerp(target, 1 - Math.exp(-3 * dt));
    }
  });
  return (
    <>
      <mesh>
        <sphereGeometry args={[2, 96, 64]} />
        <meshPhysicalMaterial
          map={map}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(0.14, 0.14)}
          roughness={0.84}
          metalness={0.015}
          clearcoat={0.12}
          clearcoatRoughness={0.55}
        />
      </mesh>
      {cloudsOn && (
        <Suspense fallback={null}>
          <CloudLayer />
        </Suspense>
      )}
      <lineSegments geometry={border}>
        <lineBasicMaterial
          ref={borderMat}
          color={palette.violet}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </lineSegments>
      <lineSegments geometry={highlight}>
        <lineBasicMaterial
          ref={selectedMat}
          color={palette.primary}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </lineSegments>
      <mesh scale={1.035}>
        <sphereGeometry args={[2, 64, 48]} />
        <meshBasicMaterial
          color={palette.atmosphere}
          transparent
          opacity={0.1}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
function CloudLayer() {
  const cloudMap = useTexture("/earth-clouds.jpg", (texture) => {
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = 4;
  });
  const cloudMesh = useRef<THREE.Mesh>(null);
  useFrame((_, raw) => {
    if (cloudMesh.current) cloudMesh.current.rotation.y += Math.min(raw, 0.05) * 0.004;
  });
  return (
    <mesh ref={cloudMesh} scale={1.01} renderOrder={2}>
      <sphereGeometry args={[2, 72, 48]} />
      <meshStandardMaterial
        color="#f8f9ff"
        alphaMap={cloudMap}
        alphaTest={0.035}
        transparent
        opacity={0.26}
        roughness={1}
        depthWrite={false}
      />
    </mesh>
  );
}

function GlobeLoadingSphere() {
  return (
    <mesh>
      <sphereGeometry args={[2, 48, 32]} />
      <meshStandardMaterial color="#17344f" roughness={0.9} />
    </mesh>
  );
}

function GlobeControls({
  countries,
  focus,
  onSelect,
  zoomAction,
}: {
  countries: Country[];
  focus?: Country | undefined;
  onSelect: (location: Location) => void;
  zoomAction: { n: number; mode: string };
}) {
  const controls = useRef<Controls>(null);
  const { camera, gl } = useThree();
  const target = useRef<THREE.Vector3 | undefined>(undefined);
  useEffect(() => {
    if (focus) target.current = position(focus.lat, focus.lon, 5.6);
  }, [focus]);
  useEffect(() => {
    if (!zoomAction.n) return;
    if (zoomAction.mode === "reset") target.current = position(20, 60, 6.5);
    else
      target.current = camera.position
        .clone()
        .normalize()
        .multiplyScalar(
          THREE.MathUtils.clamp(
            camera.position.length() * (zoomAction.mode === "in" ? 0.8 : 1.25),
            2.5,
            10,
          ),
        );
  }, [zoomAction, camera]);
  useFrame((_, raw) => {
    if (!target.current) return;
    camera.position.lerp(target.current, 1 - Math.exp(-5 * Math.min(raw, 0.05)));
    camera.lookAt(0, 0, 0);
    if (camera.position.distanceTo(target.current) < 0.008) target.current = undefined;
  });
  useEffect(() => {
    const element = gl.domElement;
    const points = new Map<number, { x: number; y: number }>();
    let moved = false,
      multi = false;
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2(),
      hit = new THREE.Vector3();
    const sphere = new THREE.Sphere(new THREE.Vector3(), 2);
    const down = (e: PointerEvent) => {
      if (!points.size) {
        moved = false;
        multi = false;
      }
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size > 1) multi = true;
      target.current = undefined;
    };
    const move = (e: PointerEvent) => {
      const p = points.get(e.pointerId);
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) moved = true;
    };
    const up = (e: PointerEvent) => {
      const p = points.get(e.pointerId);
      points.delete(e.pointerId);
      if (!p || moved || multi || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) return;
      const rect = element.getBoundingClientRect();
      // A small screen-space tolerance helps tiny island taps without selecting across oceans.
      for (const [dx, dy] of [
        [0, 0],
        [5, 0],
        [-5, 0],
        [0, 5],
        [0, -5],
      ]) {
        pointer.set(
          ((e.clientX - rect.left + (dx ?? 0)) / rect.width) * 2 - 1,
          -((e.clientY - rect.top + (dy ?? 0)) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, camera);
        if (!raycaster.ray.intersectSphere(sphere, hit)) continue;
        const lat = THREE.MathUtils.radToDeg(Math.asin(hit.y / 2));
        const lon = THREE.MathUtils.radToDeg(Math.atan2(-hit.z, hit.x));
        const country = countryAt(countries, lat, lon);
        if (country) {
          onSelect({ country, lat, lon });
          break;
        }
      }
    };
    const cancel = (e: PointerEvent) => {
      points.delete(e.pointerId);
      moved = true;
    };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", cancel);
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", cancel);
    };
  }, [camera, gl, countries, onSelect]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      autoRotate
      autoRotateSpeed={0.32}
      rotateSpeed={0.48}
      zoomSpeed={0.65}
      minDistance={2.5}
      maxDistance={10}
      onStart={() => {
        target.current = undefined;
      }}
    />
  );
}

export default function WorldGlobe({
  countries,
  selected,
  focus,
  onSelect,
  cloudsOn,
}: {
  countries: Country[];
  selected?: Country | undefined;
  focus?: Country | undefined;
  onSelect: (location: Location) => void;
  cloudsOn: boolean;
}) {
  const [visible, setVisible] = useState(true);
  const [inView, setInView] = useState(true);
  const [palette, setPalette] = useState<Palette>();
  const [action, setAction] = useState({ n: 0, mode: "reset" });
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), {
            rootMargin: "140px",
          })
        : undefined;
    if (wrapper.current) observer?.observe(wrapper.current);
    const css = getComputedStyle(wrapper.current ?? document.documentElement);
    // Three cannot parse OKLCH; let the browser convert semantic CSS tokens to sRGB.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    const color = (token: string) => {
      const value = css.getPropertyValue(token).trim();
      if (!context) return value;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const pixel = context.getImageData(0, 0, 1, 1).data;
      return `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
    };
    setPalette({
      primary: color("--primary"),
      violet: color("--violet"),
      atmosphere: color("--world-atmosphere"),
    });
    return () => {
      document.removeEventListener("visibilitychange", update);
      observer?.disconnect();
    };
  }, []);
  return (
    <div className="world-canvas" ref={wrapper}>
      {palette && (
        <Canvas
          camera={{ position: position(20, 60, 6.5).toArray(), fov: 44 }}
          dpr={[1, 1.25]}
          gl={{ alpha: true, antialias: true }}
          frameloop={visible && inView ? "always" : "never"}
          fallback={
            <p className="world-load">
              Your browser can’t display the globe. You can still choose a country above.
            </p>
          }
        >
          <ambientLight intensity={1.05} />
          <directionalLight position={[4, 5, 7]} intensity={1.95} />
          <pointLight position={[-5, -1, -4]} intensity={0.3} color={palette.atmosphere} />
          <Stars radius={65} depth={40} count={900} factor={2} saturation={0} fade speed={0.15} />
          <Suspense fallback={<GlobeLoadingSphere />}>
            <Earth
              countries={countries}
              selected={selected}
              palette={palette}
              cloudsOn={cloudsOn}
            />
          </Suspense>
          <GlobeControls
            countries={countries}
            focus={focus}
            onSelect={onSelect}
            zoomAction={action}
          />
        </Canvas>
      )}
      <div className="world-tools">
        {[
          { mode: "in", label: "Zoom in", Icon: Plus },
          { mode: "out", label: "Zoom out", Icon: Minus },
          { mode: "reset", label: "Reset globe view", Icon: RotateCcw },
        ].map(({ mode, label, Icon }) => (
          <Button
            key={mode}
            variant="outline"
            size="icon"
            aria-label={label}
            title={label}
            onClick={() => setAction((a) => ({ n: a.n + 1, mode }))}
          >
            <Icon />
          </Button>
        ))}
      </div>
    </div>
  );
}
