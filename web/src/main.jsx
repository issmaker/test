import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { AnimatePresence, motion } from "motion/react";
import { gsap } from "gsap";
import {
  Activity,
  Columns2,
  Cpu,
  FolderOpen,
  Focus,
  House,
  Images,
  Maximize2,
  Minus,
  Palette,
  Plus,
  ScanLine,
  X,
} from "lucide-react";
import * as THREE from "three";
import "./style.css";
import "./v47.css";
import "./v48.css";
import "./v49.css";
import "./v51.css";
import "./v52.css";

const EMPTY = {
  sourceUrl: "",
  resultUrl: "",
  referenceUrl: "",
  workingPreviewUrl: "",
  status: "Выберите PNG",
  report: "",
  outputPath: "",
  progress: 0,
  sourceFileMb: 0,
  outputFileMb: 0,
  sourceWidth: 0,
  sourceHeight: 0,
  busy: false,
  previewBusy: false,
  progressHistory: [],
  activityHistory: [],
  batchItems: [],
  batchBusy: false,
  batchProgress: 0,
  batchStatus: "Добавьте PNG-файлы",
  batchImportBusy: false,
  batchImportProgress: 0,
  batchImportStatus: "PNG не выбраны",
  batchWorkers: 1,
  batchProgressHistory: [],
  batchActivityHistory: [],
  cpuLoad: 0,
  memoryMb: 0,
  processingRate: 0,
  performanceMode: "balanced",
  hardwareThreads: 1,
};
const HEADLESS_TEST = new URLSearchParams(location.search).has("headless-test");
const TEST_TEXTURE = "qrc:/icons/liquid.svg";
const ROUTES = [
  ["home", "Главная", House],
  ["npm", "НПМ · 3 MB", ScanLine],
  ["batch", "Текстуры", Images],
  ["compare", "Сравнение", Columns2],
];
const PRESETS = [
  ["rose", "Rose signal", "#ff3f93"],
  ["cyan", "Arctic cyan", "#37e7ff"],
  ["violet", "Ultraviolet", "#9a72ff"],
  ["amber", "Amber pulse", "#ffad42"],
];
const THEME_COLORS = {
  rose: ["#ff3f93", "#8c54ff"],
  cyan: ["#37e7ff", "#3879ff"],
  violet: ["#a67cff", "#f05dff"],
  amber: ["#ffad42", "#ff4f73"],
};
const QUALITY_LEVELS = ["eco", "balanced", "max"];
const MAX_ZOOM = 16;

function readPreference(key, allowed, fallback) {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The UI remains usable when Chromium storage is disabled or unavailable.
  }
}

let textureDecodeWorker = null;
let textureDecodeSequence = 0;
const textureDecodeRequests = new Map();

function getTextureDecodeWorker() {
  if (textureDecodeWorker || typeof Worker === "undefined") return textureDecodeWorker;
  const source = `
    let queue = Promise.resolve();
    self.onmessage = ({ data }) => {
      queue = queue.then(async () => {
        const { id, url } = data;
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const blob = await response.blob();
          const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'default' });
          self.postMessage({ id, bitmap, width: bitmap.width, height: bitmap.height }, [bitmap]);
        } catch (error) {
          self.postMessage({ id, error: String(error && error.message || error) });
        }
      });
    };
  `;
  textureDecodeWorker = new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
  textureDecodeWorker.onmessage = ({ data }) => {
    const request = textureDecodeRequests.get(data.id);
    if (!request) { data.bitmap?.close?.(); return; }
    textureDecodeRequests.delete(data.id);
    if (data.error) request.reject(new Error(data.error));
    else request.resolve({ drawable: data.bitmap, width: data.width, height: data.height });
  };
  return textureDecodeWorker;
}

function decodeTextureOffMainThread(src) {
  const fallback = () => new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve({ drawable: img, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
  if (HEADLESS_TEST) return fallback();
  const worker = getTextureDecodeWorker();
  if (worker) {
    const id = ++textureDecodeSequence;
    return new Promise((resolve, reject) => {
      textureDecodeRequests.set(id, { resolve, reject });
      worker.postMessage({ id, url: src });
    });
  }
  return fallback();
}

function useBackend() {
  const [backend, setBackend] = useState(null),
    [state, setState] = useState(EMPTY);
  useEffect(() => {
    if (!window.qt?.webChannelTransport || !window.QWebChannel) return;
    new window.QWebChannel(window.qt.webChannelTransport, (channel) => {
      const api = channel.objects.optimizer;
      setBackend(api);
      let frame = 0;
      const refresh = () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          api.snapshot((v) => setState({ ...EMPTY, ...v }));
        });
      };
      [
        "sourceUrlChanged",
        "resultUrlChanged",
        "referenceUrlChanged",
        "previewChanged",
        "statusChanged",
        "reportChanged",
        "outputPathChanged",
        "outputSizeChanged",
        "sourceInfoChanged",
        "previewBusyChanged",
        "progressChanged",
        "busyChanged",
        "telemetryChanged",
        "batchItemsChanged",
        "batchBusyChanged",
        "batchProgressChanged",
        "batchStatusChanged",
        "batchImportBusyChanged",
        "batchImportProgressChanged",
        "batchImportStatusChanged",
        "batchWorkersChanged",
        "batchTelemetryChanged",
        "systemTelemetryChanged",
        "performanceModeChanged",
      ].forEach((n) => api[n]?.connect(refresh));
      refresh();
    });
  }, []);
  return { backend, state };
}

function Hint({ text, children }) {
  if (!text) return children;
  const child = React.Children.only(children);
  const publish = (e, open = true) =>
    dispatchEvent(
      new CustomEvent("agr-hint", {
        detail: { open, text, x: e?.clientX || 0, y: e?.clientY || 0 },
      }),
    );
  return React.cloneElement(child, {
    onPointerEnter: (e) => {
      child.props.onPointerEnter?.(e);
      publish(e);
    },
    onPointerMove: (e) => {
      child.props.onPointerMove?.(e);
      if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) publish(e);
    },
    onPointerLeave: (e) => {
      child.props.onPointerLeave?.(e);
      publish(e, false);
    },
    onFocus: (e) => {
      child.props.onFocus?.(e);
      const rect = e.currentTarget.getBoundingClientRect();
      publish({ clientX: rect.left + rect.width / 2, clientY: rect.bottom });
    },
    onBlur: (e) => {
      child.props.onBlur?.(e);
      publish(e, false);
    },
  });
}

function TooltipLayer() {
  const [hint, setHint] = useState({ open: false, text: "", x: 0, y: 0 });
  useEffect(() => {
    const update = (e) => setHint(e.detail);
    addEventListener("agr-hint", update);
    return () => removeEventListener("agr-hint", update);
  }, []);
  const x = Math.max(12, Math.min(innerWidth - 392, hint.x + 18));
  const y = Math.max(76, Math.min(innerHeight - 64, hint.y - 68));
  return (
    <AnimatePresence>
      {hint.open && (
        <motion.div
          className="floating-hint"
          style={{ left: x, top: y }}
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
        >
          {hint.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DecodeText({ children, trigger = 0, direction = 1 }) {
  const original = String(children),
    [value, setValue] = useState(original),
    frame = useRef(0),
    glyphs = "01<>/\\{}[]#%*+—";
  const decode = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const start = performance.now();
    const run = (now) => {
      const p = Math.min(1, (now - start) / 500),
        fixed = Math.floor(original.length * p);
      setValue(
        original
          .split("")
          .map((c, i) =>
            c === " "
              ? c
              : (direction < 0 ? i >= original.length - fixed : i < fixed)
                ? c
                : glyphs[Math.floor(Math.random() * glyphs.length)],
          )
          .join(""),
      );
      if (p < 1) frame.current = requestAnimationFrame(run);
    };
    frame.current = requestAnimationFrame(run);
  }, [direction, original]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => {
    if (trigger) decode();
  }, [decode, trigger]);
  return (
    <span
      className="decode-text"
      style={{ "--decode-chars": original.length }}
      onPointerEnter={decode}
    >
      {value}
    </span>
  );
}

function MagneticCursorField({ active, fieldRef }) {
  const dots = useRef([]),
    root = useRef(null),
    hive = useRef(null),
    target = useRef({ x: innerWidth * .67, y: innerHeight * .49 }),
    points = useRef(Array.from({ length: 18 }, () => ({ ...target.current })));
  useEffect(() => {
    if (!active) return undefined;
    const move = (e) => {
      target.current = { x: e.clientX, y: e.clientY };
    };
    let raf;
    const tick = () => {
      const influence = fieldRef?.current?.influence || 0;
      let lead = target.current;
      points.current.forEach((p, i) => {
        const ease = Math.max(.08, .34 - i * .014);
        p.x += (lead.x - p.x) * ease;
        p.y += (lead.y - p.y) * ease;
        dots.current[i]?.style.setProperty(
          "transform",
          `translate3d(${p.x}px,${p.y}px,0) translate(-50%,-50%) rotate(${i * 11}deg) scale(${Math.max(.28, 1 - i / 22)})`,
        );
        dots.current[i]?.style.setProperty("opacity", influence * Math.max(.08, .72 - i * .032));
        lead = p;
      });
      if (hive.current) {
        root.current?.style.setProperty("--field-energy", influence);
        hive.current.style.setProperty("--hive-energy", influence);
        hive.current.style.setProperty(
          "transform",
          `translate3d(${target.current.x}px,${target.current.y}px,0) translate(-50%,-50%) scale(${.72 + influence * .3}) rotate(${(fieldRef?.current?.x || 0) * 4}deg)`,
        );
      }
      raf = requestAnimationFrame(tick);
    };
    addEventListener("pointermove", move);
    tick();
    return () => {
      removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, [active]);
  if (!active) return null;
  return (
    <div className="magnetic-cursor-field" ref={root} aria-hidden="true">
      {points.current.map((_, i) => (
        <i key={i} ref={(el) => (dots.current[i] = el)} style={{ "--trail-index": i }} />
      ))}
      <div className="magnetic-hive" ref={hive}>
        {Array.from({ length: 7 }, (_, i) => <b key={i} style={{ "--cell": i }} />)}
      </div>
    </div>
  );
}

function AmbientBackdrop({ theme, secret, active }) {
  const [p, setP] = useState({ x: 0.5, y: 0.5 }),
    raf = useRef(0),
    root = useRef(null),
    energy = useRef({ value: 0 });
  useEffect(() => {
    if (!active) {
      setP({ x: 0.5, y: 0.5 });
      return undefined;
    }
    const move = (e) => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() =>
        setP({ x: e.clientX / innerWidth, y: e.clientY / innerHeight }),
      );
    };
    addEventListener("pointermove", move);
    return () => removeEventListener("pointermove", move);
  }, [active]);
  useEffect(() => {
    const react = (e) => {
      const node = root.current;
      if (!node) return;
      const detail = e.detail || {};
      node.style.setProperty("--motion-x", Number(detail.x || 0));
      node.style.setProperty("--motion-y", Number(detail.y || 0));
      energy.current.value = Math.max(0, Math.min(1, Number(detail.energy || 0)));
      node.style.setProperty("--energy", energy.current.value);
      gsap.killTweensOf(energy.current);
      gsap.to(energy.current, {
        value: 0,
        duration: 0.72,
        ease: "power3.out",
        overwrite: true,
        onUpdate: () =>
          root.current?.style.setProperty("--energy", energy.current.value),
      });
    };
    addEventListener("agr-motion", react);
    return () => {
      removeEventListener("agr-motion", react);
      gsap.killTweensOf(energy.current);
    };
  }, []);
  const px = p.x * 1600,
    py = p.y * 900;
  return (
    <div
      ref={root}
      className={`ambient-backdrop ${secret ? "secret-energy" : ""}`}
      data-theme={theme}
      style={{
        "--mx": `${p.x * 100}%`,
        "--my": `${p.y * 100}%`,
        "--px": p.x - 0.5,
        "--py": p.y - 0.5,
        "--energy": 0,
      }}
    >
      <div className="ambient-glow" />
      <svg viewBox="0 0 1600 900" preserveAspectRatio="none">
        <g className="field-lines">
          {Array.from({ length: 17 }, (_, i) => {
            const y = 22 + i * 55,
              d = Math.max(0, 1 - Math.abs(y - py) / 500),
              bend = (px - 800) * 0.06 * d;
            return (
              <path
                key={i}
                d={`M-80 ${y} C ${310 + bend} ${y - 95 * d},${px - 190} ${py + (y - py) * 0.4},${px} ${py + (y - py) * 0.2} S ${1290 - bend} ${y + 78 * d},1680 ${y}`}
              />
            );
          })}
        </g>
      </svg>
      <i className="cursor-aura" />
    </div>
  );
}

function VectorSculpture() {
  return (
    <div className="vector-sculpture" aria-hidden="true">
      <svg viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="vector-flow" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="var(--accent2)" />
            <stop offset=".48" stopColor="var(--accent)" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
          <filter id="vector-glow">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className="vector-core" fill="none" strokeLinecap="round">
          {Array.from({ length: 7 }, (_, i) => (
            <rect
              key={i}
              x={430 + i * 13}
              y={185 + i * 10}
              width={380 - i * 26}
              height={378 - i * 20}
              rx={118 - i * 8}
              transform={`rotate(${i * 12 - 36} 620 374)`}
              stroke={i === 3 ? "url(#vector-flow)" : i % 2 ? "var(--accent2)" : "var(--accent)"}
              strokeWidth={i === 3 ? 2.8 : 0.8 + i * 0.12}
              opacity={i === 3 ? 0.72 : 0.11 + i * 0.025}
              filter={i === 3 ? "url(#vector-glow)" : undefined}
            />
          ))}
          <circle cx="620" cy="374" r="54" stroke="var(--accent)" opacity=".3" />
          <circle cx="620" cy="374" r="20" stroke="white" opacity=".45" />
        </g>
      </svg>
      <div className="side-form side-form-left">
        <i />
        <i />
        <i />
      </div>
      <div className="side-form side-form-right">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

function SignalLattice({ progress, colors }) {
  const group = useRef();
  useFrame(({ clock, pointer }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      pointer.x * 0.14 + t * 0.035,
      0.018,
    );
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      -0.1 + pointer.y * 0.1 + progress * 0.18,
      0.018,
    );
    group.current.rotation.z = THREE.MathUtils.lerp(
      group.current.rotation.z,
      pointer.x * 0.06 - progress * 0.12,
      0.018,
    );
    const scale = 1 + progress * 0.07;
    group.current.scale.setScalar(
      THREE.MathUtils.lerp(group.current.scale.x, scale, 0.035),
    );
  });
  return (
    <group ref={group} position={[0.72, 0.08, -0.8]}>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh
          key={i}
          rotation={[(i - 2) * 0.31, (i - 2) * 0.42, (i - 2) * 0.19]}
          scale={1 + i * 0.16}
        >
          <torusGeometry args={[1.05, 0.018 + i * 0.006, 8, 96]} />
          <meshPhysicalMaterial
            color={colors[i % 2]}
            emissive={colors[i % 2]}
            emissiveIntensity={0.22}
            metalness={0.86}
            roughness={0.28}
            clearcoat={1}
          />
        </mesh>
      ))}
      <mesh scale={0.68}>
        <icosahedronGeometry args={[1, 1]} />
        <meshPhysicalMaterial color="#09070c" metalness={0.82} roughness={0.31} wireframe />
      </mesh>
      <mesh scale={0.18}>
        <octahedronGeometry />
        <meshBasicMaterial color={colors[0]} />
      </mesh>
    </group>
  );
}

function EdgeFrames({ colors }) {
  const pieces = [[-5.25, 2.45, -1.5, 0.72], [5.35, -2.45, -1.6, -0.62]];
  return (
    <>
      {pieces.map((p, i) => (
        <group key={i} position={p.slice(0, 3)} rotation={[p[3], i ? -0.5 : 0.5, p[3]]}>
          {Array.from({ length: 4 }, (_, ring) => (
            <mesh key={ring} rotation={[ring * 0.36, ring * 0.22, ring * 0.41]} scale={1 + ring * 0.23}>
              <torusGeometry args={[1.05, 0.022, 8, 80]} />
              <meshPhysicalMaterial color={colors[(i + ring) % 2]} emissive={colors[(i + ring) % 2]} emissiveIntensity={0.12} metalness={0.9} roughness={0.34} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function NeuralLines({ active, motionValue, colors }) {
  const geometry = useRef(),
    rows = 17,
    cols = 29,
    base = useMemo(() => {
      const a = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols - 1; c++)
          a.push(
            [(c / (cols - 1) - 0.5) * 12, (r / (rows - 1) - 0.5) * 6.8],
            [((c + 1) / (cols - 1) - 0.5) * 12, (r / (rows - 1) - 0.5) * 6.8],
          );
      return a;
    }, []),
    positions = useMemo(() => new Float32Array(base.length * 3), [base]),
    { pointer } = useThree();
  useFrame(({ clock }) => {
    if (!geometry.current) return;
    const t = clock.elapsedTime,
      px = pointer.x * 5.8,
      py = pointer.y * 3.2;
    base.forEach((p, i) => {
      const d = Math.hypot(p[0] - px, p[1] - py),
        inf = Math.exp(-d * d * 0.36);
      positions[i * 3] = p[0];
      positions[i * 3 + 1] =
        p[1] +
        Math.sin(p[0] * 1.35 + t + p[1]) * 0.045 +
        inf * pointer.y * 0.22;
      positions[i * 3 + 2] =
        -1 +
        inf * (active ? 0.7 : 0.34) +
        (motionValue?.energy || 0) * 0.15 * Math.exp(-d * d * 0.15);
    });
    geometry.current.attributes.position.needsUpdate = true;
  });
  return (
    <lineSegments>
      <bufferGeometry ref={geometry}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        color={colors[0]}
        transparent
        opacity={active ? 0.34 : 0.14}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

function makeNestedBandGeometry(radius, width, gap, depth, quality) {
  const segments = quality === "eco" ? 52 : quality === "max" ? 112 : 80;
  const start = gap * .5;
  const end = Math.PI * 2 - gap * .5;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const angle = THREE.MathUtils.lerp(start, end, i / segments);
    points.push(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  for (let i = segments; i >= 0; i--) {
    const angle = THREE.MathUtils.lerp(start, end, i / segments);
    const inner = radius - width;
    points.push(new THREE.Vector2(Math.cos(angle) * inner, Math.sin(angle) * inner));
  }
  const shape = new THREE.Shape(points);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: segments,
    bevelEnabled: true,
    bevelSegments: quality === "eco" ? 2 : 5,
    bevelSize: Math.min(width * .16, .055),
    bevelThickness: Math.min(depth * .22, .045),
  });
  geometry.translate(0, 0, -depth * .5);
  geometry.computeVertexNormals();
  return geometry;
}

function NestedBand({ radius, width, gap, depth, index, quality, register }) {
  const geometry = useMemo(
    () => makeNestedBandGeometry(radius, width, gap, depth, quality),
    [radius, width, gap, depth, quality],
  );
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 24), [geometry]);
  useEffect(() => () => {
    geometry.dispose();
    edges.dispose();
  }, [geometry, edges]);
  return (
    <mesh ref={register} geometry={geometry} castShadow={quality !== "eco"} receiveShadow>
      <meshPhysicalMaterial
        color={index % 2 ? "#45112f" : "#5b163d"}
        emissive={index % 2 ? "#9f174f" : "#c21d69"}
        emissiveIntensity={index === 0 ? .26 : .15}
        metalness={.12}
        roughness={.34}
        clearcoat={1}
        clearcoatRoughness={.13}
        sheen={.7}
        sheenColor="#ff4d9b"
        sheenRoughness={.28}
      />
      <lineSegments geometry={edges} renderOrder={2}>
        <lineBasicMaterial
          color={index < 2 ? "#ff4b9e" : "#e72f83"}
          transparent
          opacity={index < 2 ? .58 : .42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </mesh>
  );
}

function BandSparks({ fieldRef, quality, screen }) {
  const points = useRef(), material = useRef();
  const count = quality === "eco" ? 18 : quality === "max" ? 54 : 34;
  const seeds = useMemo(() => {
    const data = [];
    for (let i = 0; i < count; i++) {
      const seed = (i * 12.9898) % 1;
      data.push({
        angle: seed * Math.PI * 2,
        radius: .025 + ((i * 7) % 13) * .007,
        lift: .22 + ((i * 11) % 17) * .025,
        speed: .65 + ((i * 5) % 9) * .09,
      });
    }
    return data;
  }, [count]);
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  useFrame(({ clock }) => {
    if (!points.current || !material.current) return;
    const field = fieldRef?.current || { x: 0, y: 0, influence: 0 };
    const energy = screen === "home" ? Math.max(0, field.influence || 0) : 0;
    material.current.opacity = THREE.MathUtils.lerp(material.current.opacity, energy * .92, .18);
    material.current.size = .035 + energy * .045;
    const ox = (field.x - .34) * 2.65;
    const oy = (field.y - .03) * 1.72;
    const t = clock.elapsedTime;
    seeds.forEach((seed, index) => {
      const life = (t * seed.speed + index / count) % 1;
      const spread = seed.radius + life * .22;
      positions[index * 3] = ox + Math.cos(seed.angle + t * .8) * spread;
      positions[index * 3 + 1] = oy + Math.sin(seed.angle + t * .65) * spread + life * seed.lift;
      positions[index * 3 + 2] = .3 + Math.sin(seed.angle * 1.7 + t) * .13 + life * .16;
    });
    points.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={points} renderOrder={7} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        color="#ffd8ea"
        size={.04}
        transparent
        opacity={0}
        depthWrite={false}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

const SHELL_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;
  varying float vDent;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uProgress;
  uniform vec2 uPointer;
  void main() {
    vec3 p = position;
    float breath = sin(uTime * 1.12 + position.y * 3.4 + position.x * 1.7) * (.012 + uEnergy * .018);
    float cursorDistance = length(position.xy - uPointer);
    vDent = exp(-cursorDistance * cursorDistance * 7.5) * uEnergy;
    p += normal * (breath - vDent * .12 + sin(uProgress * 3.14159) * .018);
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = cameraPosition - world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const SHELL_FRAGMENT = `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;
  varying float vDent;
  uniform float uEnergy;
  uniform float uTime;
  uniform float uProgress;
  void main() {
    float facing = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 2.35);
    float topGlow = smoothstep(-1.5, 1.7, vWorld.y) * 0.075;
    vec3 plum = vec3(0.34, 0.055, 0.22);
    vec3 rose = vec3(1.0, 0.18, 0.53);
    float wave = sin(vDent * 24.0 - uTime * 4.2) * vDent;
    vec3 rgbSplit = vec3(.12, -.03, .15) * smoothstep(.58, .92, uProgress) * fresnel;
    vec3 color = mix(plum, rose, fresnel * .78 + uEnergy * .13 + wave * .18) + rgbSplit;
    float alpha = .035 + fresnel * (.31 + uEnergy * .13) + topGlow + abs(wave) * .11;
    gl_FragColor = vec4(color, alpha);
  }
`;

function SurfaceWaves({ fieldRef, screen }) {
  const rings = useRef([]);
  useFrame(({ clock }) => {
    const field = fieldRef?.current || { x: 0, y: 0, influence: 0 };
    const energy = screen === "home" ? Math.max(0, field.influence || 0) : 0;
    rings.current.forEach((ring, index) => {
      if (!ring) return;
      const phase = (clock.elapsedTime * (.44 + index * .035) + index / 3) % 1;
      ring.position.set((field.x - .34) * 2.65, (field.y - .03) * 1.72, .55 + index * .025);
      ring.scale.setScalar(.18 + phase * 1.35);
      ring.material.opacity = energy * (1 - phase) * .68;
      ring.rotation.z = field.x * .28 + index * .18;
    });
  });
  return <group renderOrder={6}>
    {Array.from({ length: 3 }, (_, index) => <mesh key={index} ref={(node) => { rings.current[index] = node; }}>
      <ringGeometry args={[.2, .214, 72]} />
      <meshBasicMaterial color={index === 1 ? "#ff76b3" : "#fff2f8"} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </mesh>)}
  </group>;
}

function GlassFieldSphere({ screen, quality, fieldRef, progress, verified = false, loading = false }) {
  const group = useRef(), core = useRef(), shell = useRef(), glass = useRef(), light = useRef();
  const bands = useRef([]);
  const sphereSegments = quality === "eco" ? 40 : quality === "max" ? 88 : 64;
  const nested = [
    [1.50, .33, 1.02, .24],
    [1.25, .31, .92, .23],
    [1.01, .29, .82, .22],
    [.78, .26, .72, .21],
    [.57, .22, .62, .19],
  ];
  useFrame(({ clock }) => {
    if (!group.current || !core.current) return;
    const t = clock.elapsedTime, field = fieldRef?.current || { x: 0, y: 0, influence: 0 };
    const route = screen === "home"
      ? [1.48, .02, -.78, 1.08]
      : screen === "npm"
        ? [3.75, -1.2, -1.55, .66]
        : screen === "batch"
          ? [-3.65, 1.25, -1.7, .58]
          : [3.9, 1.72, -2.2, .48];
    const magnetic = screen === "home" ? field.influence || 0 : .08;
    const dive = screen === "home" ? progress : 0;
    const breath = Math.sin(t * .92) * .012 + Math.sin(t * .41) * .007;
    group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, route[0], .055);
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, route[1], .055);
    group.current.position.z = THREE.MathUtils.lerp(group.current.position.z, route[2] + dive * 3.25, .045);
    const scale = route[3] * (1 + magnetic * .045 + dive * 1.72);
    group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, scale, .05));
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, .13, .045);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, -.18, .045);
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, -.48 + Math.sin(t * .16) * .025, .035);
    core.current.rotation.x = THREE.MathUtils.lerp(core.current.rotation.x, .42 - field.y * magnetic * .19, .035);
    core.current.rotation.y = THREE.MathUtils.lerp(core.current.rotation.y, -.62 + t * .12 + field.x * magnetic * .34, .035);
    core.current.rotation.z = THREE.MathUtils.lerp(core.current.rotation.z, -.24 + Math.sin(t * .18) * .1, .035);
    bands.current.forEach((band, index) => {
      if (!band) return;
      const direction = index - 2;
      const distance = Math.hypot((field.x - .34) * .92, field.y - .03);
      const hoveredBand = Math.max(0, Math.min(nested.length - 1, Math.round((distance / .72) * nested.length - .5)));
      const selected = magnetic > .035 && index === hoveredBand ? magnetic : 0;
      const sealed = loading ? .22 : 1;
      const ritualOpen = verified ? direction * .18 : 0;
      band.position.z = THREE.MathUtils.lerp(band.position.z, direction * .09 * sealed + magnetic * direction * .075 + ritualOpen, .08);
      band.rotation.x = THREE.MathUtils.lerp(band.rotation.x, magnetic * direction * .025, .07);
      band.rotation.y = THREE.MathUtils.lerp(band.rotation.y, magnetic * direction * -.055, .07);
      band.rotation.z = THREE.MathUtils.lerp(band.rotation.z, index * -.055 + magnetic * direction * .045, .07);
      band.material.emissiveIntensity = THREE.MathUtils.lerp(
        band.material.emissiveIntensity,
        (index === 0 ? .26 : .15) + selected * 2.8,
        .16,
      );
      const edgeMaterial = band.children[0]?.material;
      if (edgeMaterial) {
        edgeMaterial.opacity = THREE.MathUtils.lerp(
          edgeMaterial.opacity,
          (index < 2 ? .58 : .42) + selected * .4,
          .16,
        );
      }
    });
    if (shell.current) {
      shell.current.material.opacity = .13 + magnetic * .055 + dive * .1;
      shell.current.scale.setScalar(1.84 * (1 + breath + magnetic * .006));
      shell.current.material.thickness = 1.62 + Math.sin(t * .7) * .12 + magnetic * .22;
      shell.current.material.ior = 1.2 + magnetic * .08 + dive * .06;
    }
    if (glass.current) {
      glass.current.uniforms.uEnergy.value = magnetic + dive * .45;
      glass.current.uniforms.uTime.value = t;
      glass.current.uniforms.uProgress.value = dive;
      glass.current.uniforms.uPointer.value.set((field.x - .34) * 1.16, (field.y - .03) * .94);
    }
    if (light.current) {
      light.current.position.x = THREE.MathUtils.lerp(light.current.position.x, field.x * 2.2, .09);
      light.current.position.y = THREE.MathUtils.lerp(light.current.position.y, field.y * 1.7, .09);
      light.current.intensity = (quality === "eco" ? 2.2 : 5.2) + magnetic * 5.5;
    }
  });
  return (
    <group ref={group} position={[1.48, .02, -.78]} rotation={[.13, -.18, -.48]}>
      <group ref={core} rotation={[.42, -.62, -.24]}>
        {nested.map(([radius, width, gap, depth], index) => (
          <NestedBand
            key={radius}
            radius={radius}
            width={width}
            gap={gap}
            depth={depth}
            index={index}
            quality={quality}
            register={(node) => { bands.current[index] = node; }}
          />
        ))}
      </group>
      <BandSparks fieldRef={fieldRef} quality={quality} screen={screen} />
      <SurfaceWaves fieldRef={fieldRef} screen={screen} />
      <mesh ref={shell} scale={1.84} renderOrder={4}>
        <sphereGeometry args={[1, sphereSegments, sphereSegments]} />
        <meshPhysicalMaterial
          color="#7c285c"
          transparent
          opacity={.13}
          transmission={.91}
          thickness={1.7}
          roughness={.12}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={.03}
          ior={1.23}
          attenuationColor="#d5277d"
          attenuationDistance={1.15}
          envMapIntensity={1.35}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.875} renderOrder={5}>
        <sphereGeometry args={[1, sphereSegments, sphereSegments]} />
        <shaderMaterial
          ref={glass}
          vertexShader={SHELL_VERTEX}
          fragmentShader={SHELL_FRAGMENT}
          uniforms={{
            uEnergy: { value: 0 },
            uTime: { value: 0 },
            uProgress: { value: 0 },
            uPointer: { value: new THREE.Vector2(0, 0) },
          }}
          transparent
          depthWrite={false}
          side={THREE.FrontSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <pointLight ref={light} color="#ff3e99" intensity={quality === "eco" ? 2.2 : 5.2} distance={6} position={[1.2, .8, 2.4]} />
      <pointLight color="#ff9bc8" intensity={quality === "eco" ? 1.1 : 2.8} distance={5} position={[-1.4, 1.5, 1.4]} />
    </group>
  );
}

function InteractionFrameBudget() {
  const setFrameloop = useThree((state) => state.setFrameloop);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const update = (event) => {
      if (event.detail) {
        setFrameloop("never");
      }
      else {
        setFrameloop("always");
        invalidate();
      }
    };
    addEventListener("agr-drag", update);
    return () => {
      removeEventListener("agr-drag", update);
      setFrameloop("always");
    };
  }, [invalidate, setFrameloop]);
  return null;
}

const NEBULA_VERTEX = `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const NEBULA_FRAGMENT = `
  varying vec2 vUv;
  varying vec3 vWorld;
  uniform float uTime;
  uniform float uEnergy;
  uniform vec2 uPointer;
  uniform vec3 uColorA;
  uniform vec3 uColorB;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.,0.)), f.x), mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float value = 0.0, amplitude = .54;
    for (int i = 0; i < 4; i++) {
      value += noise(p) * amplitude;
      p = mat2(1.58, 1.18, -1.18, 1.58) * p + .19;
      amplitude *= .47;
    }
    return value;
  }
  void main() {
    vec2 p = vWorld.xy * .14;
    float t = uTime * .035;
    float base = fbm(p + vec2(t, -t * .62));
    float folds = fbm(p * 1.9 - vec2(t * 1.7, t));
    float filament = pow(max(0.0, 1.0 - abs(base - folds) * 2.75), 5.0);
    float river = pow(max(0.0, 1.0 - abs(sin((vWorld.y + sin(vWorld.x * .18 + t * 8.0) * 2.2) * .42)) * 1.42), 7.0);
    float cursor = exp(-length((vUv - .5) - uPointer * .08) * 3.4);
    vec3 color = mix(uColorB * .12, uColorA, base * .68 + filament * .32);
    color += mix(uColorA, vec3(1.0), .55) * filament * (1.1 + uEnergy * .55);
    color += uColorB * river * .55;
    color += mix(uColorA, uColorB, .5) * cursor * .06;
    float alpha = .10 + base * .26 + filament * .42 + river * .12;
    gl_FragColor = vec4(color, alpha);
  }
`;

function EnergyNebula({ theme, quality, fieldRef }) {
  const material = useRef();
  const colors = THEME_COLORS[theme] || THEME_COLORS.rose;
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    uPointer: { value: new THREE.Vector2() },
    uColorA: { value: new THREE.Color(colors[0]) },
    uColorB: { value: new THREE.Color(colors[1]) },
  }), []);
  useEffect(() => {
    uniforms.uColorA.value.set(colors[0]);
    uniforms.uColorB.value.set(colors[1]);
  }, [colors, uniforms]);
  useFrame(({ clock }) => {
    if (!material.current) return;
    const field = fieldRef?.current || { x: 0, y: 0, influence: 0 };
    material.current.uniforms.uTime.value = clock.elapsedTime;
    material.current.uniforms.uEnergy.value = THREE.MathUtils.lerp(material.current.uniforms.uEnergy.value, field.influence || 0, .035);
    material.current.uniforms.uPointer.value.lerp(new THREE.Vector2(field.x, field.y), .025);
  });
  return (
    <group>
      <mesh position={[0, 0, -7.2]} scale={[1, 1, 1]}>
        <planeGeometry args={[54, 24, quality === "max" ? 24 : 12, quality === "max" ? 12 : 6]} />
        <shaderMaterial ref={material} vertexShader={NEBULA_VERTEX} fragmentShader={NEBULA_FRAGMENT} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, -2.3, -5.8]} rotation={[-.22, 0, -.08]}>
        <planeGeometry args={[52, 8]} />
        <meshBasicMaterial color={colors[0]} transparent opacity={quality === "eco" ? .025 : .055} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function CameraRig({ fieldRef, screen }) {
  const { camera } = useThree();
  useFrame(({ clock }) => {
    const field = fieldRef?.current || { x: 0, y: 0 };
    const route = screen === "home" ? [0, 0, 7.1] : screen === "npm" ? [7.4, -.7, 7.5] : screen === "batch" ? [-7.8, .8, 7.7] : [13.8, .35, 7.65];
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      route[0] + field.x * .12,
      0.018,
    );
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      route[1] + field.y * .09 + Math.sin(clock.elapsedTime * .13) * .045,
      0.018,
    );
    camera.position.z = THREE.MathUtils.lerp(
      camera.position.z,
      route[2],
      0.018,
    );
    camera.lookAt(camera.position.x * .88, camera.position.y * .55, -6.8);
  });
  return null;
}
function Scene({ theme, quality, screen, fieldRef }) {
  const colors = THEME_COLORS[theme] || THEME_COLORS.rose;
  const density = quality === "eco" ? 24 : quality === "max" ? 92 : 54;
  return (
    <Canvas
      shadows={quality !== "eco"}
      dpr={
        quality === "eco"
          ? [0.7, 0.9]
          : quality === "max"
            ? [1, 1.35]
            : [0.85, 1.15]
      }
      camera={{ position: [0, 0, 7.1], fov: 48 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = quality === "max" ? 1.34 : 1.18;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <ambientLight intensity={0.22} />
      <EnergyNebula theme={theme} quality={quality} fieldRef={fieldRef} />
      <Sparkles
        count={density}
        scale={[12, 7, 4]}
        size={1}
        speed={0.13}
        color={colors[0]}
      />
      <InteractionFrameBudget />
      <CameraRig fieldRef={fieldRef} screen={screen} />
    </Canvas>
  );
}
class SceneBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("WebGL scene isolated:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Button({ children, quiet = false, danger = false, tip, className = "", onPointerEnter, onPointerLeave, ...props }) {
  const [decodeTick, setDecodeTick] = useState(0);
  const [decodeDirection, setDecodeDirection] = useState(1);
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--bx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--by", `${e.clientY - r.top}px`);
  };
  const node = (
    <button
      className={`button ${quiet ? "quiet" : ""} ${danger ? "danger" : ""} ${className}`.trim()}
      data-no-hold
      onPointerMove={move}
      onPointerEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setDecodeDirection(e.clientX >= rect.left + rect.width / 2 ? -1 : 1);
        setDecodeTick((value) => value + 1);
        onPointerEnter?.(e);
      }}
      onPointerLeave={onPointerLeave}
      {...props}
    >
      <i />
      <span>{typeof children === "string" ? <DecodeText trigger={decodeTick} direction={decodeDirection}>{children}</DecodeText> : children}</span>
    </button>
  );
  return <Hint text={tip}>{node}</Hint>;
}
const mb = (n) => (n ? `${Number(n).toFixed(2)} MB` : "—");
function RingMetric({ label, value, progress = 0, tip }) {
  const n = Math.max(0, Math.min(1, progress));
  return (
    <Hint text={tip}>
      <div className="ring-metric">
        <svg viewBox="0 0 52 52">
          <defs>
            <linearGradient id={`ring-${label}`}>
              <stop stopColor="var(--accent)" />
              <stop offset="1" stopColor="var(--accent2)" />
            </linearGradient>
          </defs>
          <circle className="ring-track" cx="26" cy="26" r="21" />
          <circle
            className="ring-value"
            cx="26"
            cy="26"
            r="21"
            pathLength="1"
            style={{ strokeDasharray: `${n} 1` }}
          />
        </svg>
        <div>
          <small>{label}</small>
          <strong>{value}</strong>
        </div>
      </div>
    </Hint>
  );
}
function Metric({ label, value, tip }) {
  return (
    <Hint text={tip || `${label}: ${value}`}>
      <div className="metric">
        <small>{label}</small>
        <strong>{value}</strong>
        <i />
      </div>
    </Hint>
  );
}
function Sparkline({ values = [], label, color = "var(--accent)" }) {
  const id = useId().replaceAll(":", ""),
    data = values.length ? values : [0, 0.02, 0.03],
    points = data
      .map(
        (v, i) =>
          `${(i / Math.max(1, data.length - 1)) * 100},${44 - Number(v) * 38}`,
      )
      .join(" "),
    last = Number(data.at(-1) || 0);
  return (
    <Hint text={`${label}: ${Math.round(last * 100)}%`}>
      <div className="spark">
        <small>{label}</small>
        <b>{Math.round(last * 100)}%</b>
        <svg viewBox="0 0 100 48" preserveAspectRatio="none">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor={color} stopOpacity=".4" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="chart-grid" d="M0 12H100M0 24H100M0 36H100" />
          <polygon points={`0,48 ${points} 100,48`} fill={`url(#${id})`} />
          <polyline
            className="chart-line"
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="1.7"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx="100" cy={44 - last * 38} r="2" fill={color} />
        </svg>
      </div>
    </Hint>
  );
}
function ProcessSignal({ progress = 0, status = "Ожидание", compact = false, activity = 0 }) {
  const p = Math.max(0, Math.min(1, Number(progress || 0)));
  return <div className={`process-signal ${compact ? "compact" : ""}`} title={status} style={{ "--flow-rate": `${Math.max(.42, 1.8 - Math.max(0, Math.min(1, activity)) * 1.28)}s` }}>
    <div className="signal-copy"><small>{p >= 1 ? "RGB24 VERIFIED" : p > 0 ? "ADAPTIVE PIPELINE" : "READY CHANNEL"}</small><strong>{Math.round(p * 100)}%</strong></div>
    <div className="signal-rail" style={{ "--signal-progress": p }}>
      <i />
      <b />
      <span>{Array.from({ length: 9 }, (_, i) => <em key={i} style={{ "--i": i }} />)}</span>
    </div>
    <span>{String(status).split("·")[0].slice(0,72)}</span>
  </div>;
}
function FluidProgress({ value = 0, activity = 0 }) {
  return (
    <div
      className="fluid-progress"
      style={{
        "--value": Math.max(0, Math.min(1, value)),
        "--flow-rate": `${Math.max(.42, 1.7 - Math.max(0, Math.min(1, activity)) * 1.18)}s`,
      }}
    >
      <i />
      <b />
    </div>
  );
}

function HardwareTelemetry({ state, batch = false }) {
  const activity = batch ? state.batchActivityHistory : state.activityHistory;
  const progress = batch ? state.batchProgressHistory : state.progressHistory;
  return (
    <section className="hardware-strip" aria-label="Аппаратная телеметрия">
      <div><small>CPU</small><strong>{Math.round((state.cpuLoad || 0) * 100)}%</strong><Sparkline label="CPU LOAD" values={activity} /></div>
      <div><small>MEMORY</small><strong>{state.memoryMb ? `${Math.round(state.memoryMb)} MB` : "—"}</strong><i className="memory-cell" /></div>
      <div><small>THREADS</small><strong>{batch && state.batchBusy ? state.batchWorkers || 1 : state.hardwareThreads || 1}</strong><i className="thread-cell" style={{ "--threads": batch && state.batchBusy ? state.batchWorkers || 1 : state.hardwareThreads || 1 }} /></div>
      <div><small>SPEED</small><strong>{Number(state.processingRate || 0).toFixed(1)} %/s</strong><Sparkline label="PIPELINE" values={progress} color="var(--accent2)" /></div>
    </section>
  );
}

function KineticArchitecture({ activity = 0 }) {
  const level = Math.max(0.08, Math.min(1, Number(activity || 0)));
  return (
    <div className="kinetic-architecture" style={{ "--activity": level }} aria-hidden="true">
      <div className="architecture-planes">
        {Array.from({ length: 7 }, (_, i) => <i key={i} style={{ "--i": i }} />)}
      </div>
      <div className="kinetic-equalizer">
        {Array.from({ length: 18 }, (_, i) => <i key={i} style={{ "--i": i }} />)}
      </div>
    </div>
  );
}

function DataCathedral({ items = [], activity = 0, quality = "balanced" }) {
  const visible = items.length ? items.slice(0, quality === "eco" ? 18 : quality === "max" ? 54 : 32) : Array.from({ length: 12 }, (_, i) => ({ name: `SLOT ${String(i + 1).padStart(2,"0")}` }));
  return (
    <div className="data-cathedral" style={{ "--activity": Math.max(.08, Number(activity || 0)) }} aria-hidden="true">
      <div className="cathedral-vault"><i /><i /><i /><i /></div>
      <div className="cathedral-floor" />
      <div className="cathedral-links">{Array.from({ length: Math.max(6, Math.min(18, visible.length)) }, (_, i) => <i key={i} style={{ "--i": i, "--count": Math.max(6, visible.length) }} />)}</div>
      <div className="cathedral-modules">
        <AnimatePresence initial={false}>
          {visible.map((item, i) => {
            const processing = !item.done && !item.importing && Number(item.progress || 0) > 0;
            return <motion.div
              layout
              key={item.sourceUrl || item.name}
              className="cathedral-slot"
              style={{
                "--orbit-x": `${Math.cos((i / Math.max(1, visible.length)) * Math.PI * 2) * (250 + (i % 3) * 42)}px`,
                "--orbit-y": `${Math.sin((i / Math.max(1, visible.length)) * Math.PI * 2) * (112 + (i % 2) * 24)}px`,
                "--orbit-z": `${(i % 5) * 28 - 56}px`,
              }}
              initial={{ opacity: 0, scale: .35, "--burst": 0 }}
              animate={{ opacity: 1, scale: 1, "--burst": 0 }}
              exit={{ opacity: 0, scale: .18, rotate: 28, filter: "blur(12px)", "--burst": 1 }}
              transition={{ duration: .62, ease: [0.2, 0.75, 0.2, 1] }}
            >
              <div className={`cathedral-module ${item.done ? "done" : item.importing ? "loading" : processing ? "processing" : "queued"}`} style={{ "--i": i, "--count": visible.length }}>
                <i /><em /><b>{String(i + 1).padStart(2,"0")}</b><span>{item.name}</span>
                <div className="module-particles">{Array.from({ length: 9 }, (_, p) => <i key={p} style={{ "--p": p }} />)}</div>
              </div>
            </motion.div>;
          })}
        </AnimatePresence>
      </div>
      <div className="cathedral-core"><span>{items.length}</span><small>TEXTURE NODES</small></div>
    </div>
  );
}

function MorphingMonolith({ screen, quality }) {
  const nodes = quality === "eco" ? 6 : quality === "max" ? 28 : 16;
  return <div className="morphing-monolith" data-space={screen} aria-hidden="true">
    <div className="monolith-aura" />
    <div className="monolith-orb"><i /><i /><i /></div>
    <div className="monolith-ribbons">{Array.from({length:5},(_,i)=><i key={i} style={{"--i":i}} />)}</div>
    <div className="monolith-nodes">{Array.from({length:nodes},(_,i)=><i key={i} style={{"--i":i,"--x":`${(i*47)%101}%`,"--y":`${(i*71)%97}%`}} />)}</div>
    <div className="monolith-grain" />
  </div>;
}

function Header({ screen, backend, onSettings }) {
  const label = ROUTES.find((x) => x[0] === screen)?.[1] || "Сравнение";
  return (
    <header className="topbar" data-no-hold>
      <div className="brand">
        <span className="brand-mark">
          <ScanLine />
        </span>
        <div>
          <b>Оптимизатор текстур</b>
          <small>ADAPTIVE RGB24</small>
        </div>
      </div>
      <div className="route-status">
        <i />
        <small>ACTIVE SPACE</small>
        <strong>{label}</strong>
      </div>
      <div className="top-actions">
        <Button data-action="settings" tip="Цвет, эффекты и интерфейс" quiet onClick={onSettings}>
          <Palette />
        </Button>
        <Button
          tip="Переключить полный экран и окно"
          quiet
          onClick={() => backend?.toggleFullscreen()}
        >
          <Maximize2 />
        </Button>
        <Button
          tip="Перезапустить интерфейс"
          quiet
          onClick={() => location.reload()}
        >
          <Activity />
        </Button>
        <Button
          tip="Закрыть приложение"
          quiet
          onClick={() => backend?.quitApp()}
        >
          <X />
        </Button>
      </div>
    </header>
  );
}
function RightDock({ screen, setScreen, state }) {
  const firstDone = state.batchItems?.findIndex((item) => item.done) ?? -1;
  return (
    <motion.aside
      className="right-dock"
      data-no-hold
      initial={{ x: 110, y: "-50%", opacity: 0 }}
      animate={{ x: 0, y: "-50%", opacity: 1 }}
      transition={{ type: "spring", stiffness: 190, damping: 21, delay: 0.35 }}
    >
      <div className="dock-edge" />
      {ROUTES.map(([id, label, I]) => {
        const disabled = id === "compare" && firstDone < 0;
        return (
          <Hint
            text={disabled ? "Сначала оптимизируйте текстуру" : label}
            key={id}
          >
            <button
              data-route={id}
              disabled={disabled}
              className={screen === id ? "active" : ""}
              onClick={() => setScreen(id === "compare" ? `compare:${firstDone}` : id)}
            >
              <I />
              <span>{label}</span>
            </button>
          </Hint>
        );
      })}
    </motion.aside>
  );
}
function SettingsPanel({
  open,
  setOpen,
  theme,
  setTheme,
  quality,
  setQuality,
  backend,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          className="settings-panel"
          data-no-hold
          style={{ transformOrigin: "92% 4%" }}
          initial={{ opacity: 0, scale: .08, borderRadius: "50%", filter: "blur(18px) brightness(1.8)" }}
          animate={{ opacity: 1, scale: 1, borderRadius: "25px 8px 25px 8px", filter: "blur(0px) brightness(1)" }}
          exit={{ opacity: 0, scale: .12, borderRadius: "50%", filter: "blur(16px) brightness(1.7)" }}
          transition={{ duration: .72, ease: [0.16, 0.82, 0.18, 1] }}
        >
          <div className="settings-head">
            <div>
              <small>VISUAL CONTROL</small>
              <h2>Настройки</h2>
            </div>
            <Button quiet onClick={() => setOpen(false)}>
              <X />
            </Button>
          </div>
          <p>Цветовой сигнал</p>
          <div className="preset-grid">
            {PRESETS.map(([id, label, color]) => (
              <button
                key={id}
                className={theme === id ? "active" : ""}
                onClick={() => setTheme(id)}
                style={{ "--swatch": color }}
              >
                <i />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <p>Режим использования железа</p>
          <div className="quality-switch">
            {[
              ["eco", "ТИХИЙ"],
              ["balanced", "АВТО"],
              ["max", "МАКСИМУМ"],
            ].map(([id, label]) => (
              <button
                className={quality === id ? "active" : ""}
                onClick={() => { setQuality(id); backend?.setPerformanceMode?.(id); }}
                key={id}
              >
                {label}
              </button>
            ))}
          </div>
          <small className="settings-note">
            Меняется нагрузка GPU, CPU и число рабочих потоков. Качество PNG остаётся неизменным.
          </small>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Home({ setScreen }) {
  return (
    <main className="home">
      <section className="hero-copy">
        <p>REAL-TIME / RGB24 / WEBGL</p>
        <h1>
          <DecodeText>ОПТИМИЗАТОР</DecodeText>
          <br />
          <em>ТЕКСТУР</em>
        </h1>
        <div className="hero-line">
          <span>2K</span>
          <span>4K</span>
          <span>8K</span>
          <b>AGR RGB24</b>
        </div>
      </section>
      <section className="hero-panel">
        <div className="mode-console-head"><i /><span>SELECT OPERATION SPACE</span><b>LIVE</b></div>
        <div className="capability-grid">
          <div><small>RGB24</small><strong>TRUE COLOR</strong><b>01</b></div>
          <div><small>8K READY</small><strong>SAFE PREVIEW</strong><b>02</b></div>
          <div><small>BATCH</small><strong>DATA CATHEDRAL</strong><b>03</b></div>
        </div>
        <Button
          className="mode-gate npm-gate"
          tip="Один PNG, результат строго меньше 3 MB"
          onClick={() => setScreen("npm")}
        >
          <small>PRECISION CHANNEL · 01</small><b><DecodeText>НПМ · ДО 3 MB</DecodeText></b><em>ОДНА ТЕКСТУРА → ТОЧНЫЙ ЛИМИТ</em>
        </Button>
        <Button
          className="mode-gate batch-gate"
          tip="Несколько PNG без лимита итогового размера"
          quiet
          onClick={() => setScreen("batch")}
        >
          <small>DATA CATHEDRAL · 02</small><b><DecodeText>ОПТИМИЗАТОР ТЕКСТУР</DecodeText></b><em>МНОГО PNG → 8K PIPELINE</em>
        </Button>
      </section>
    </main>
  );
}

const ZoomPane = React.memo(function ZoomPane({ title, src, view, setView }) {
  const drag = useRef(null),
    pane = useRef(null),
    image = useRef(null),
    canvas = useRef(null),
    drawFrame = useRef(0),
    [imageReady, setImageReady] = useState(false),
    moveFrame = useRef(0),
    pendingMove = useRef(null),
    interactionTimer = useRef(0),
    displaySrc = src || (HEADLESS_TEST ? TEST_TEXTURE : ""),
    clamp = useCallback((next) => {
      const box = pane.current,
        img = image.current;
      if (!box || !img?.naturalWidth)
        return { ...next, x: 0, y: 0, s: Math.max(1, Math.min(MAX_ZOOM, next.s)) };
      const cw = box.clientWidth,
        ch = box.clientHeight,
        fit = Math.min(cw / img.naturalWidth, ch / img.naturalHeight),
        s = Math.max(1, Math.min(MAX_ZOOM, next.s)),
        maxX = Math.max(0, (img.naturalWidth * fit * s - cw) / 2),
        maxY = Math.max(0, (img.naturalHeight * fit * s - ch) / 2);
      return {
        s,
        x: Math.max(-maxX, Math.min(maxX, next.x || 0)),
        y: Math.max(-maxY, Math.min(maxY, next.y || 0)),
      };
    }, []);
  const draw = useCallback(() => {
    cancelAnimationFrame(drawFrame.current);
    drawFrame.current = requestAnimationFrame(() => {
      const box = pane.current,
        img = image.current,
        target = canvas.current;
      if (!box || !target || !img?.naturalWidth) return;
      const cw = box.clientWidth,
        ch = box.clientHeight,
        dpr = 1,
        width = Math.max(1, Math.round(cw * dpr)),
        height = Math.max(1, Math.round(ch * dpr));
      if (target.width !== width) target.width = width;
      if (target.height !== height) target.height = height;
      const ctx = target.getContext("2d", {
        alpha: true,
        willReadFrequently: true,
      });
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = view.s > 8 ? "medium" : "high";
      const fit = Math.min(cw / img.naturalWidth, ch / img.naturalHeight),
        scale = fit * view.s,
        dw = img.naturalWidth * scale,
        dh = img.naturalHeight * scale,
        dx = cw / 2 - dw / 2 + view.x,
        dy = ch / 2 - dh / 2 + view.y,
        sx = Math.max(0, Math.min(img.naturalWidth, -dx / scale)),
        sy = Math.max(0, Math.min(img.naturalHeight, -dy / scale)),
        ex = Math.max(0, Math.min(img.naturalWidth, (cw - dx) / scale)),
        ey = Math.max(0, Math.min(img.naturalHeight, (ch - dy) / scale)),
        sw = Math.max(0, ex - sx),
        sh = Math.max(0, ey - sy);
      if (sw > 0 && sh > 0)
        ctx.drawImage(
          img,
          sx,
          sy,
          sw,
          sh,
          Math.max(0, dx),
          Math.max(0, dy),
          sw * scale,
          sh * scale,
        );
    });
  }, [view]);
  useEffect(() => {
    setImageReady(false);
    setView({ s: 1, x: 0, y: 0 });
  }, [displaySrc, setView]);
  useEffect(() => {
    if (!imageReady) return;
    draw();
    const observer = new ResizeObserver(draw);
    if (pane.current) observer.observe(pane.current);
    return () => observer.disconnect();
  }, [draw, imageReady]);
  useEffect(() => {
    if (!HEADLESS_TEST) return;
    const testDrag = (e) =>
      setView((v) => {
        const next = clamp({
          ...v,
          x: v.x + Number(e.detail?.x || 0),
          y: v.y + Number(e.detail?.y || 0),
        });
        window.__AGR_TEST_VERTICAL_Y__ = next.y;
        return next;
      });
    const testZoom = (e) => {
      window.__AGR_WHEEL_COUNT__ = (window.__AGR_WHEEL_COUNT__ || 0) + 1;
      setView((v) => {
        const s = Math.max(1, Math.min(MAX_ZOOM, v.s * Number(e.detail?.factor || 1.1)));
        window.__AGR_ZOOM_TARGET__ = s;
        return clamp({ ...v, s });
      });
    };
    addEventListener("agr-test-drag", testDrag);
    addEventListener("agr-test-zoom", testZoom);
    return () => {
      removeEventListener("agr-test-drag", testDrag);
      removeEventListener("agr-test-zoom", testZoom);
    };
  }, [clamp, setView]);
  useEffect(
    () => () => {
      cancelAnimationFrame(moveFrame.current);
      cancelAnimationFrame(drawFrame.current);
      clearTimeout(interactionTimer.current);
    },
    [],
  );
  const wheel = useCallback((e) => {
    window.__AGR_WHEEL_COUNT__ = (window.__AGR_WHEEL_COUNT__ || 0) + 1;
    e.preventDefault();
    if (!pane.current) return;
    const rect = pane.current.getBoundingClientRect(),
      ox = e.clientX - rect.left - rect.width / 2,
      oy = e.clientY - rect.top - rect.height / 2;
    setView((v) => {
      const factor = Math.max(
          0.91,
          Math.min(1.1, Math.exp(-e.deltaY * 0.0011)),
        ),
        s = Math.max(1, Math.min(MAX_ZOOM, v.s * factor)),
        ratio = s / v.s;
      window.__AGR_ZOOM_TARGET__ = s;
      return clamp({
        s,
        x: ox - (ox - v.x) * ratio,
        y: oy - (oy - v.y) * ratio,
      });
    });
    dispatchEvent(new CustomEvent("agr-drag", { detail: true }));
    clearTimeout(interactionTimer.current);
    interactionTimer.current = setTimeout(
      () => dispatchEvent(new CustomEvent("agr-drag", { detail: false })),
      180,
    );
  }, [clamp, setView]);
  useEffect(() => {
    const node = pane.current;
    if (!node) return;
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [wheel]);
  const move = (e) => {
    if (!drag.current) return;
    e.preventDefault();
    pendingMove.current = { x: e.clientX, y: e.clientY };
    if (moveFrame.current) return;
    moveFrame.current = requestAnimationFrame(() => {
      moveFrame.current = 0;
      if (!drag.current || !pendingMove.current) return;
      const dx = pendingMove.current.x - drag.current.px,
        dy = pendingMove.current.y - drag.current.py;
      setView((v) =>
        clamp({ ...v, x: drag.current.x + dx, y: drag.current.y + dy }),
      );
    });
  };
  const stop = (e) => {
    cancelAnimationFrame(moveFrame.current);
    moveFrame.current = 0;
    pendingMove.current = null;
    drag.current = null;
    if (e?.currentTarget?.hasPointerCapture?.(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    dispatchEvent(new CustomEvent("agr-drag", { detail: false }));
  };
  return (
    <Hint text="Колесо — зум к курсору · перетаскивание — панорама">
      <div
        ref={pane}
        className="zoom-pane"
        onPointerDown={(e) => {
          if (view.s <= 1) return;
          e.preventDefault();
          drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
          e.currentTarget.setPointerCapture(e.pointerId);
          dispatchEvent(new CustomEvent("agr-drag", { detail: true }));
        }}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
      >
        <span>{title}</span>
        {displaySrc ? (
          <>
            <canvas ref={canvas} className={imageReady ? "ready" : ""} />
            <img
              className="zoom-source"
              ref={image}
              onLoad={() => {
                setImageReady(true);
                setView((v) => clamp(v));
              }}
              draggable="false"
              src={displaySrc}
            />
          </>
        ) : (
          <p>PNG не выбран</p>
        )}
      </div>
    </Hint>
  );
});
function ZoomControl({ view, setView }) {
  const set = (s) => {
    const value = Math.max(1, Math.min(MAX_ZOOM, s));
    setView((v) => ({
      ...v,
      s: value,
      x: value === 1 ? 0 : v.x,
      y: value === 1 ? 0 : v.y,
    }));
  };
  return (
    <div className="zoom-control">
      <Button tip="Уменьшить масштаб" quiet onClick={() => set(view.s - 0.25)}>
        <Minus />
      </Button>
      <div className="zoom-orbit" style={{ "--zoom": (view.s - 1) / (MAX_ZOOM - 1) }}>
        <span>{Math.round(view.s * 100)}%</span>
        <i />
      </div>
      <Hint text="Плавный масштаб от «Вписать» до 1600%">
        <input
          aria-label="Масштаб"
          type="range"
          min="1"
          max={MAX_ZOOM}
          step=".01"
          value={view.s}
          onChange={(e) => set(Number(e.target.value))}
        />
      </Hint>
      <Button tip="Увеличить масштаб" quiet onClick={() => set(view.s + 0.25)}>
        <Plus />
      </Button>
    </div>
  );
}

function WipeCompare({ before, after }) {
  const [split, setSplit] = useState(50);
  return (
    <div className="wipe-compare">
      <img src={before} draggable="false" alt="До оптимизации" />
      <img className="wipe-after-image" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} src={after} draggable="false" alt="После оптимизации" />
      <div className="wipe-divider" style={{ left: `${split}%` }}><i /></div>
      <span className="wipe-label before">ДО</span>
      <span className="wipe-label after">ПОСЛЕ</span>
      <input
        aria-label="Граница сравнения до и после"
        type="range"
        min="0"
        max="100"
        value={split}
        onChange={(e) => setSplit(Number(e.target.value))}
      />
    </div>
  );
}

const SmoothCompareViewport = React.memo(function SmoothCompareViewport({ before, after, mode, onZoom, contentReady = true }) {
  const host = useRef(null), canvas = useRef(null), frame = useRef(0), drag = useRef(null);
  const [nativeLoading, setNativeLoading] = useState(false);
  const images = useRef({ before: null, after: null });
  const target = useRef({ s: 1, x: 0, y: 0, split: 0.5, lensX: .5, lensY: .5, lensZoom: 2.4 });
  const current = useRef({ s: 1, x: 0, y: 0, split: 0.5, lensX: .5, lensY: .5, lensZoom: 2.4 });
  const alive = useRef(true), loaded = useRef(false), modeRef = useRef(mode), interactionTimer = useRef(0);

  const sourceSize = useCallback((source) => ({
    width: source?.width || source?.naturalWidth || 0,
    height: source?.height || source?.naturalHeight || 0,
  }), []);

  const setInteraction = useCallback((active, releaseDelay = 0) => {
    clearTimeout(interactionTimer.current);
    if (active) {
      window.__AGR_INTERACTION_PAUSE_COUNT__ = (window.__AGR_INTERACTION_PAUSE_COUNT__ || 0) + 1;
      dispatchEvent(new CustomEvent("agr-drag", { detail: true }));
    }
    else if (releaseDelay) {
      interactionTimer.current = setTimeout(
        () => {
          dispatchEvent(new CustomEvent("agr-drag", { detail: false }));
          dispatchEvent(new CustomEvent("agr-material-memory"));
        },
        releaseDelay,
      );
    } else dispatchEvent(new CustomEvent("agr-drag", { detail: false }));
  }, []);

  const clampView = useCallback((view) => {
    const node = host.current, img = images.current.before || images.current.after;
    const size = sourceSize(img);
    if (!node || !size.width) return { ...view, x: 0, y: 0 };
    const rect = node.getBoundingClientRect(), viewWidth = modeRef.current === "pan" ? rect.width / 2 : rect.width;
    const fit = Math.min(viewWidth / size.width, rect.height / size.height);
    const renderedWidth = size.width * fit * view.s, renderedHeight = size.height * fit * view.s;
    // Keep at least one full viewport edge covered: the image can be inspected,
    // but it can never be thrown completely into an infinite empty field.
    const maxX = Math.max(0, (renderedWidth - viewWidth) / 2);
    const maxY = Math.max(0, (renderedHeight - rect.height) / 2);
    return { ...view, x: Math.max(-maxX, Math.min(maxX, view.x)), y: Math.max(-maxY, Math.min(maxY, view.y)) };
  }, [sourceSize]);

  const render = useCallback(() => {
    frame.current = 0;
    const node = host.current, out = canvas.current;
    if (!node || !out || !loaded.current) return;
    const rect = node.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
    if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
    const ctx = out.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;
    target.current = clampView(target.current);
    const c = current.current, t = target.current;
    c.s += (t.s - c.s) * .19; c.x += (t.x - c.x) * .19; c.y += (t.y - c.y) * .19; c.split += (t.split - c.split) * .22;
    c.lensX += (t.lensX - c.lensX) * .34; c.lensY += (t.lensY - c.lensY) * .34; c.lensZoom += (t.lensZoom - c.lensZoom) * .22;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
    const draw = (img, x0, width) => {
      const size = sourceSize(img);
      if (!size.width || width <= 0) return;
      ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, width, rect.height); ctx.clip();
      const fitW = modeRef.current === "pan" ? rect.width / 2 : rect.width;
      const fit = Math.min(fitW / size.width, rect.height / size.height);
      const scale = fit * c.s, dw = size.width * scale, dh = size.height * scale;
      const cx = modeRef.current === "pan" ? x0 + width / 2 : rect.width / 2;
      const dx = cx - dw / 2 + c.x, dy = rect.height / 2 - dh / 2 + c.y;
      const sx = Math.max(0, Math.min(size.width, (x0 - dx) / scale));
      const sy = Math.max(0, Math.min(size.height, -dy / scale));
      const ex = Math.max(0, Math.min(size.width, (x0 + width - dx) / scale));
      const ey = Math.max(0, Math.min(size.height, (rect.height - dy) / scale));
      const sw = Math.max(0, ex - sx), sh = Math.max(0, ey - sy);
      ctx.imageSmoothingEnabled = scale < 1; ctx.imageSmoothingQuality = "high";
      if (sw > 0 && sh > 0) {
        ctx.drawImage(img.drawable || img, sx, sy, sw, sh, dx + sx * scale, dy + sy * scale, sw * scale, sh * scale);
      }
      ctx.restore();
    };
    if (modeRef.current === "wipe") {
      const cut = rect.width * c.split; draw(images.current.before, 0, rect.width); draw(images.current.after, 0, cut);
      ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(cut - .5, 0, 1, rect.height);
    } else if (modeRef.current === "lens") {
      draw(images.current.before, 0, rect.width);
      const img = images.current.after, size = sourceSize(img);
      const lx = c.lensX * rect.width, ly = c.lensY * rect.height;
      const radius = Math.max(72, Math.min(164, Math.min(rect.width, rect.height) * .18));
      if (size.width) {
        const fit = Math.min(rect.width / size.width, rect.height / size.height);
        const baseScale = fit * c.s, lensScale = baseScale * c.lensZoom;
        const baseDx = rect.width / 2 - size.width * baseScale / 2 + c.x;
        const baseDy = rect.height / 2 - size.height * baseScale / 2 + c.y;
        const imageX = (lx - baseDx) / baseScale, imageY = (ly - baseDy) / baseScale;
        const lensDx = lx - imageX * lensScale, lensDy = ly - imageY * lensScale;
        const sx = Math.max(0, Math.min(size.width, (lx - radius - lensDx) / lensScale));
        const sy = Math.max(0, Math.min(size.height, (ly - radius - lensDy) / lensScale));
        const ex = Math.max(0, Math.min(size.width, (lx + radius - lensDx) / lensScale));
        const ey = Math.max(0, Math.min(size.height, (ly + radius - lensDy) / lensScale));
        const sw = Math.max(0, ex - sx), sh = Math.max(0, ey - sy);
        ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, radius, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = "#030205"; ctx.fillRect(lx - radius, ly - radius, radius * 2, radius * 2);
        ctx.imageSmoothingEnabled = lensScale < 1;
        if (sw > 0 && sh > 0) ctx.drawImage(img.drawable || img, sx, sy, sw, sh, lensDx + sx * lensScale, lensDy + sy * lensScale, sw * lensScale, sh * lensScale);
        const glare = ctx.createRadialGradient(lx - radius * .34, ly - radius * .38, 0, lx, ly, radius);
        glare.addColorStop(0, "rgba(255,255,255,.15)"); glare.addColorStop(.42, "rgba(255,255,255,0)"); glare.addColorStop(1, "rgba(255,60,145,.12)");
        ctx.fillStyle = glare; ctx.fillRect(lx - radius, ly - radius, radius * 2, radius * 2); ctx.restore();
        ctx.beginPath(); ctx.arc(lx, ly, radius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,235,247,.92)"; ctx.lineWidth = 1.4; ctx.shadowBlur = 22; ctx.shadowColor = "rgba(255,55,148,.9)"; ctx.stroke(); ctx.shadowBlur = 0;
      }
    } else {
      draw(images.current.before, 0, rect.width / 2); draw(images.current.after, rect.width / 2, rect.width / 2);
    }
    const moving = Math.abs(t.s-c.s) > .001 || Math.abs(t.x-c.x) > .08 || Math.abs(t.y-c.y) > .08 || Math.abs(t.split-c.split) > .001 || Math.abs(t.lensX-c.lensX) > .0005 || Math.abs(t.lensY-c.lensY) > .0005 || Math.abs(t.lensZoom-c.lensZoom) > .002;
    if (moving && alive.current) frame.current = requestAnimationFrame(render);
  }, [clampView, sourceSize]);
  const wake = useCallback(() => { if (!frame.current) frame.current = requestAnimationFrame(render); }, [render]);
  const reset = useCallback((scale = 1) => {
    target.current = { ...target.current, s: scale, x: 0, y: 0 };
    onZoom?.(scale); wake();
  }, [onZoom, wake]);
  useEffect(() => {
    modeRef.current = mode;
    onZoom?.(mode === "lens" ? target.current.lensZoom : target.current.s);
    wake();
  }, [mode, onZoom, wake]);
  useEffect(() => {
    alive.current = true; loaded.current = false;
    let cancelled = false;
    if (!contentReady) {
      setNativeLoading(Boolean(before || after));
      return () => { alive.current = false; };
    }
    const load = (src) => src ? decodeTextureOffMainThread(src).catch(() => null) : Promise.resolve(null);
    setNativeLoading(Boolean(before || after));
    Promise.all([load(before || (HEADLESS_TEST ? TEST_TEXTURE : "")), load(after || (HEADLESS_TEST ? TEST_TEXTURE : ""))]).then(([a,b]) => {
      if (cancelled) {
        a?.drawable?.close?.(); b?.drawable?.close?.();
        return;
      }
      images.current = { before: a, after: b };
      loaded.current = Boolean(a || b);
      target.current = { ...target.current, s: 1, x: 0, y: 0 };
      current.current = { ...target.current };
      setNativeLoading(false);
      reset();
    });
    return () => {
      cancelled = true; alive.current = false; cancelAnimationFrame(frame.current); frame.current = 0;
      Object.values(images.current).forEach((source) => source?.drawable?.close?.());
      images.current = { before: null, after: null };
      setInteraction(false);
    };
  }, [before, after, contentReady, reset, setInteraction]);
  useEffect(() => {
    const observer = new ResizeObserver(wake); if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, [wake]);
  const zoom = useCallback((factor, ox = 0, oy = 0) => {
    const t = target.current, c = current.current;
    const s = Math.max(1, Math.min(MAX_ZOOM, t.s * factor));
    const imageX = (ox - c.x) / Math.max(.0001, c.s);
    const imageY = (oy - c.y) / Math.max(.0001, c.s);
    target.current = clampView({ ...t, s, x: ox - imageX * s, y: oy - imageY * s });
    window.__AGR_ZOOM_ANCHOR_ERROR__ = Math.max(
      Math.abs((ox - target.current.x) / target.current.s - imageX),
      Math.abs((oy - target.current.y) / target.current.s - imageY),
    );
    onZoom?.(s); window.__AGR_ZOOM_TARGET__ = s; wake();
  }, [clampView, onZoom, wake]);
  useEffect(() => {
    const node = host.current; if (!node) return;
    const wheel = (e) => {
      e.preventDefault();
      setInteraction(true);
      setInteraction(false, 150);
      window.__AGR_WHEEL_COUNT__ = (window.__AGR_WHEEL_COUNT__ || 0) + 1;
      const r = node.getBoundingClientRect(), px = e.clientX - r.left;
      if (modeRef.current === "lens") {
        const factor = Math.exp(Math.max(-.16, Math.min(.16, -e.deltaY * .0013)));
        target.current.lensZoom = Math.max(1, Math.min(8, target.current.lensZoom * factor));
        target.current.lensX = Math.max(0, Math.min(1, px / r.width));
        target.current.lensY = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
        onZoom?.(target.current.lensZoom); wake();
        return;
      }
      const paneWidth = modeRef.current === "pan" ? r.width / 2 : r.width;
      const paneLeft = modeRef.current === "pan" && px >= r.width / 2 ? r.width / 2 : 0;
      window.__AGR_ZOOM_LOCAL_X__ = px - paneLeft - paneWidth / 2;
      zoom(
        Math.exp(Math.max(-.14, Math.min(.14, -e.deltaY * .0012))),
        window.__AGR_ZOOM_LOCAL_X__,
        e.clientY - r.top - r.height / 2,
      );
    };
    node.addEventListener("wheel", wheel, { passive: false }); return () => node.removeEventListener("wheel", wheel);
  }, [setInteraction, zoom]);
  useEffect(() => {
    if (!HEADLESS_TEST) return;
    const z = e => { window.__AGR_WHEEL_COUNT__ = (window.__AGR_WHEEL_COUNT__ || 0) + 1; zoom(Number(e.detail?.factor || 1.1)); };
    const d = e => {
      target.current.x += Number(e.detail?.x || 0); target.current.y += Number(e.detail?.y || 0);
      window.__AGR_TEST_VERTICAL_Y__=target.current.y; setInteraction(true); setInteraction(false, 60); wake();
    };
    addEventListener("agr-test-zoom", z); addEventListener("agr-test-drag", d); return () => { removeEventListener("agr-test-zoom", z); removeEventListener("agr-test-drag", d); };
  }, [setInteraction, wake, zoom]);
  return <div ref={host} className={`smooth-compare mode-${mode}`} onPointerDown={(e) => {
    const r=host.current.getBoundingClientRect(), near=mode==="wipe" && Math.abs(e.clientX-r.left-r.width*target.current.split)<34;
    drag.current={ px:e.clientX, py:e.clientY, x:target.current.x, y:target.current.y, wipe:near }; e.currentTarget.setPointerCapture(e.pointerId); setInteraction(true);
  }} onPointerMove={(e) => {
    const r=host.current.getBoundingClientRect();
    if (mode === "lens") {
      target.current.lensX=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
      target.current.lensY=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
      setInteraction(true); setInteraction(false, 120); wake();
      return;
    }
    if (!drag.current) return;
    if (drag.current.wipe) target.current.split=Math.max(.02,Math.min(.98,(e.clientX-r.left)/r.width));
    else target.current=clampView({ ...target.current, x:drag.current.x+e.clientX-drag.current.px, y:drag.current.y+e.clientY-drag.current.py });
    wake();
  }} onPointerUp={() => { drag.current=null; setInteraction(false); dispatchEvent(new CustomEvent("agr-material-memory")); }} onPointerCancel={() => { drag.current=null; setInteraction(false); }}>
    <canvas ref={canvas} />
    {nativeLoading && <div className="compare-native-loader"><i /><strong>{contentReady ? "ДЕКОДИРОВАНИЕ NATIVE PNG" : "ЗАВЕРШАЕМ ПЕРЕЛЁТ КАМЕРЫ"}</strong><span>Интерфейс остаётся активным</span></div>}
    <span className="compare-label before">ORIGINAL FILE · NATIVE</span><span className="compare-label after">RESULT FILE · NATIVE</span>
    <div className="viewport-actions"><button onClick={(e)=>{e.stopPropagation();reset(1)}}>ВПИСАТЬ</button><button onClick={(e)=>{e.stopPropagation();reset(4)}}>400%</button><button onClick={(e)=>{e.stopPropagation();reset(8)}}>800%</button></div>
  </div>;
});

const ComparisonSurface = React.memo(function ComparisonSurface({
  before,
  after,
  focus,
  onFocus,
  allowWipe = false,
  onOpenFolder,
  contentReady = true,
}) {
  const [mode, setMode] = useState("pan");
  const [zoomLabel, setZoomLabel] = useState(100);
  const zoomFrame = useRef(0), pendingZoom = useRef(100);
  const updateZoomLabel = useCallback((s) => {
    pendingZoom.current = Math.round(s * 100);
    if (zoomFrame.current) return;
    zoomFrame.current = requestAnimationFrame(() => {
      zoomFrame.current = 0;
      setZoomLabel((value) => value === pendingZoom.current ? value : pendingZoom.current);
    });
  }, []);
  useEffect(() => () => cancelAnimationFrame(zoomFrame.current), []);
  return (
    <section className="compare-card transparent">
      {allowWipe && (after || HEADLESS_TEST) && (
        <div className="comparison-modes">
          <button className={mode === "pan" ? "active" : ""} onClick={() => setMode("pan")}>
            СИНХРОННЫЙ ZOOM
          </button>
          <button className={mode === "wipe" ? "active" : ""} onClick={() => setMode("wipe")}>
            ШТОРКА ДО / ПОСЛЕ
          </button>
          <button className={mode === "lens" ? "active" : ""} onClick={() => setMode("lens")}>
            СТЕКЛЯННАЯ ЛИНЗА
          </button>
        </div>
      )}
      <SmoothCompareViewport before={before} after={after} mode={mode} onZoom={updateZoomLabel} contentReady={contentReady} />
      <div className="comparison-truth" aria-label="Источник данных сравнения">
        <span><i />ОРИГИНАЛ ЧИТАЕТСЯ ИЗ ИСХОДНОГО PNG</span>
        <span><i />РЕЗУЛЬТАТ ЧИТАЕТСЯ ИЗ СОХРАНЁННОГО PNG</span>
      </div>
      <div className="compare-tools">
        <span className="live-zoom">{mode === "lens" ? `LENS ×${(zoomLabel / 100).toFixed(1)} · WHEEL` : `ZOOM ${zoomLabel}% · MAX ${MAX_ZOOM * 100}%`}</span>
        <Button quiet tip="Focus Comparison · клавиша F" onClick={onFocus}>
          <Focus /> {focus ? "ВЫЙТИ ИЗ FOCUS" : "FOCUS"}
        </Button>
        {onOpenFolder && <Button quiet onClick={onOpenFolder}>ОТКРЫТЬ ПАПКУ</Button>}
      </div>
    </section>
  );
});

function Workspace({ kind, state, backend, setScreen, contentReady = true }) {
  const batch = kind === "batch",
    [focus, setFocus] = useState(false),
    items = state.batchItems || [],
    before = state.sourceUrl;
  const toggleFocus = useCallback(() => setFocus((value) => !value), []);
  useEffect(() => {
    if (!batch) dispatchEvent(new CustomEvent("agr-focus", { detail: focus }));
  }, [batch, focus]);
  useEffect(() => {
    if (batch) return;
    const key = (e) => {
      if (e.key.toLowerCase() === "f") setFocus((v) => !v);
      if (e.key === "Escape") setFocus(false);
    };
    addEventListener("keydown", key);
    return () => {
      removeEventListener("keydown", key);
      dispatchEvent(new CustomEvent("agr-focus", { detail: false }));
    };
  }, [batch]);
  return (
    <main className={`workspace ${!batch && focus ? "focus-comparison" : ""}`}>
      <div className="workspace-head">
        <Button
          quiet
          tip="Вернуться на главный экран"
          onClick={() => setScreen("home")}
        >
          ← ВЫБОР РЕЖИМА
        </Button>
        <div>
          <small>
            {batch ? "BATCH / AUTO QUALITY" : "НПМ / TARGET ≤ 3 MB"}
          </small>
          <h1>Оптимизатор текстур</h1>
        </div>
        <div className="head-actions">
          {batch && (
            <Button
              quiet
              disabled={state.batchBusy || state.batchImportBusy}
              tip="Очистить очередь"
              onClick={() => backend?.clearBatch()}
            >
              ОЧИСТИТЬ
            </Button>
          )}
          <Button
            disabled={batch ? state.batchBusy || state.batchImportBusy : state.busy}
            tip={batch ? "Выбрать несколько PNG" : "Выбрать PNG"}
            onClick={() =>
              batch ? backend?.chooseBatchFiles() : backend?.chooseNpmFile()
            }
          >
            {batch ? "ДОБАВИТЬ PNG" : "ИМПОРТ PNG"}
          </Button>
        </div>
      </div>
      {batch ? (
        <>
          <section className="telemetry">
            <RingMetric
              label="FILES"
              value={items.length}
              progress={items.length ? 1 : 0}
              tip="Файлов в очереди"
            />
            <RingMetric
              label="PROGRESS"
              value={`${Math.round((state.batchProgress || 0) * 100)}%`}
              progress={state.batchProgress || 0}
              tip="Общий прогресс"
            />
            <Sparkline label="QUEUE FLOW" values={state.batchProgressHistory} />
            <Sparkline
              label="RGB24 ACTIVITY"
              values={state.batchActivityHistory}
              color="var(--accent2)"
            />
            <Button
              danger={state.batchBusy}
              disabled={state.batchImportBusy || (!items.some((item) => !item.failed && !item.importing) && !state.batchBusy)}
              tip={
                state.batchBusy
                  ? "Остановить после безопасного шага"
                  : "Запустить всю очередь"
              }
              onClick={() =>
                state.batchBusy
                  ? backend?.stopBatch()
                  : backend?.optimizeBatch()
              }
            >
              {state.batchBusy ? "ОСТАНОВИТЬ" : "ОПТИМИЗИРОВАТЬ ВСЕ"}
            </Button>
          </section>
          <HardwareTelemetry state={state} batch />
          <section className={`batch-import-panel ${state.batchImportBusy ? "active" : ""}`}>
            <div className="import-copy">
              <Cpu />
              <div>
                <small>{state.batchImportBusy ? "ФОНОВАЯ ЗАГРУЗКА PNG" : `АППАРАТНАЯ ОЧЕРЕДЬ · ${state.batchWorkers || 1} ${state.batchWorkers === 1 ? "ПОТОК" : "ПОТОКА"}`}</small>
                <strong>{state.batchImportBusy ? state.batchImportStatus : state.batchStatus}</strong>
              </div>
            </div>
            <FluidProgress value={state.batchImportBusy ? state.batchImportProgress : state.batchProgress} activity={state.cpuLoad} />
            <div className="import-names">
              {items.slice(-6).map((item) => (
                <span key={item.sourceUrl} className={item.importing ? "loading" : item.failed ? "failed" : "ready"}>
                  {item.name}
                </span>
              ))}
            </div>
          </section>
          <section className="batch-list">
            {!items.length && (
              <div className="empty">
                <Plus />
                <h2>Добавьте PNG-файлы</h2>
                <p>Здесь появятся крупные превью до и после.</p>
              </div>
            )}
            {items.map((item, i) => (
              <article className={`batch-row ${item.importing ? "is-importing" : ""} ${item.failed ? "has-error" : ""}`} key={item.sourceUrl || i}>
                <Button
                  className="remove-file"
                  quiet
                  danger
                  disabled={state.batchBusy || state.batchImportBusy}
                  tip={`Удалить ${item.name} из очереди`}
                  aria-label={`Удалить ${item.name}`}
                  onClick={() => backend?.removeBatchItem(i)}
                >
                  <X />
                </Button>
                <div className="thumb">
                  {item.importing ? <div className="preview-loader"><i /><span>ПОДГОТОВКА</span></div> : <img src={item.comparisonSourceUrl || item.sourceUrl} />}
                  <span>BEFORE</span>
                </div>
                <div className="thumb">
                  {item.resultUrl ? (
                    <img src={item.comparisonResultUrl || item.resultUrl} />
                  ) : (
                    <p>
                      AFTER
                      <br />
                      ожидает
                    </p>
                  )}
                  <span>AFTER</span>
                </div>
                <div className="file-data">
                  <h3>{item.name}</h3>
                  <p>
                    {item.width ? `${item.width} × ${item.height} · ` : ""}{mb(item.sourceMb)}{" "}
                    {item.done && `→ ${mb(item.outputMb)}`}
                  </p>
                  <FluidProgress value={item.progress || 0} />
                  <ProcessSignal compact progress={item.progress || (item.done ? 1 : 0)} status={item.status || item.report} activity={state.cpuLoad} />
                  <div>
                    <Button
                      disabled={!item.done}
                      onClick={() => setScreen(`compare:${i}`)}
                    >
                      СРАВНИТЕЛЬНЫЙ АНАЛИЗ
                    </Button>
                    <Button
                      quiet
                      disabled={!item.done}
                      onClick={() => backend?.openBatchOutput(i)}
                    >
                      ПАПКА
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </>
      ) : (
        <>
          <section className="telemetry">
            <Metric
              label="SOURCE"
              value={mb(state.sourceFileMb)}
              tip="Исходный PNG"
            />
            <RingMetric
              label="PIPELINE"
              value={`${Math.round((state.progress || 0) * 100)}%`}
              progress={state.progress || 0}
              tip="Прогресс RGB24"
            />
            <Metric
              label="OUTPUT"
              value={mb(state.outputFileMb)}
              tip="Готовый PNG"
            />
            <Sparkline label="RGB24 PIPELINE" values={state.progressHistory} />
            <Sparkline
              label="ANALYSIS LOAD"
              values={state.activityHistory}
              color="var(--accent2)"
            />
          </section>
          <HardwareTelemetry state={state} />
          <section className="npm-command-deck">
            <ProcessSignal progress={state.progress} status={state.status || state.report} activity={state.cpuLoad} />
            <Button danger={state.busy} disabled={!state.sourceUrl && !state.busy} onClick={() => state.busy ? backend?.stopCurrent() : backend?.optimize(2.99)}>
              {state.busy ? "ОСТАНОВИТЬ" : "ОПТИМИЗИРОВАТЬ ДО 3 MB"}
            </Button>
            <Button quiet disabled={!state.outputPath} onClick={() => backend?.openOutputFolder()}><FolderOpen /> ПАПКА РЕЗУЛЬТАТА</Button>
          </section>
          <div className="compare-title">
            <h2>СРАВНИТЕЛЬНЫЙ АНАЛИЗ · СИНХРОННОЕ ПЕРЕМЕЩЕНИЕ</h2>
          </div>
          <ComparisonSurface
            before={before}
            after={state.resultUrl}
            focus={focus}
            onFocus={toggleFocus}
            allowWipe
            contentReady={contentReady}
          />
        </>
      )}
    </main>
  );
}
function Compare({ index, state, backend, setScreen, contentReady = true }) {
  const item = (state.batchItems || [])[index],
    [focus, setFocus] = useState(false);
  const toggleFocus = useCallback(() => setFocus((value) => !value), []);
  const openFolder = useCallback(() => backend?.openBatchOutput(index), [backend, index]);
  useEffect(() => {
    dispatchEvent(new CustomEvent("agr-focus", { detail: focus }));
  }, [focus]);
  useEffect(() => {
    const key = (e) => {
      if (e.key.toLowerCase() === "f") setFocus((v) => !v);
      if (e.key === "Escape") setFocus(false);
    };
    addEventListener("keydown", key);
    return () => {
      removeEventListener("keydown", key);
      dispatchEvent(new CustomEvent("agr-focus", { detail: false }));
    };
  }, []);
  if (!item)
    return (
      <main className="workspace">
        <Button onClick={() => setScreen("batch")}>ВЕРНУТЬСЯ К СПИСКУ</Button>
      </main>
    );
  return (
    <main className={`workspace compare-scene ${focus ? "focus-comparison" : ""}`}>
      <div className="workspace-head">
        <Button quiet onClick={() => setScreen("batch")}>
          ← К СПИСКУ
        </Button>
        <div>
          <small>DEEP ANALYSIS</small>
          <h1>{item.name}</h1>
        </div>
      </div>
      <section className="analysis-summary">
        <div><small>ИСХОДНИК</small><strong>{mb(item.sourceMb)}</strong></div>
        <div><small>РЕЗУЛЬТАТ</small><strong>{mb(item.outputMb)}</strong></div>
        <div><small>ЭКОНОМИЯ</small><strong>{item.sourceMb ? `${Math.max(0, Math.round((1 - item.outputMb / item.sourceMb) * 100))}%` : "—"}</strong></div>
        <ProcessSignal compact progress={1} status={item.status || "Анализ завершён"} />
      </section>
      <ComparisonSurface
        before={item.sourceUrl}
        after={item.resultUrl}
        focus={focus}
        onFocus={toggleFocus}
        allowWipe
        onOpenFolder={openFolder}
        contentReady={contentReady}
      />
    </main>
  );
}

function HoldRitual({ holding, progress, point }) {
  return (
    <AnimatePresence>
      {holding && (
        <motion.div
          className="hold-ritual"
          style={{ left: point.x, top: point.y }}
          initial={{ opacity: 0, scale: 0.78 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.18 }}
          transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <i />
          <i />
          <i />
          <span style={{ "--hold": progress }} />
          <b>
            {Math.round(progress * 100)
              .toString()
              .padStart(2, "0")}
          </b>
          <small>УДЕРЖИВАЙТЕ</small>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
function ShellCrossing({ active, progress }) {
  return (
    <div
      className={`shell-crossing ${active ? "active" : ""}`}
      style={{ "--shell-progress": progress }}
      aria-hidden="true"
    >
      <i /><i /><i />
      <b />
      <span />
    </div>
  );
}
function TransitionPortal({ active }) {
  return (
    <div className={`transition-portal ${active ? "active" : ""}`} aria-hidden="true">
      <i /><i /><i /><b />
    </div>
  );
}
function LoadingShell({ active, label, progress = 0 }) {
  return <div className={`loading-shell ${active ? "active" : ""}`} style={{ "--load-progress": Math.max(0, Math.min(1, progress)) }} aria-hidden="true">
    <i /><i /><i />
    <div><small>8K NATIVE SCAN</small><strong>{label || "PNG"}</strong><span>{Math.round(progress * 100)}%</span></div>
  </div>;
}
function CompletionRitual({ active }) {
  return <div className={`completion-ritual ${active ? "active" : ""}`} aria-hidden="true">
    <div className="verified-shell"><i /><i /><i /><b>RGB24</b><strong>VERIFIED</strong></div>
    <span />
  </div>;
}
function MaterialMemory({ level = 0 }) {
  return <div className="material-memory" style={{ "--memory-level": Math.min(1, level / 8) }} aria-hidden="true">
    {Array.from({ length: 6 }, (_, i) => <i key={i} style={{ "--i": i }} />)}
  </div>;
}
function SecretScene({ active, onDone }) {
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(onDone, 5200);
    return () => clearTimeout(t);
  }, [active, onDone]);
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="secret-scene"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="secret-core">
            <i />
            <i />
            <i />
            <strong>ISS</strong>
          </div>
          <div className="secret-waves">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <p>
            DESIGNED IN THE DARK
            <br />
            <b>ISSMAKER</b>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function App() {
  const { backend, state } = useBackend(),
    appRoot = useRef(null),
    fieldRef = useRef({ x: 0, y: 0, influence: 0 }),
    [route, setRoute] = useState("home"),
    [diving, setDiving] = useState(false),
    [sceneSettled, setSceneSettled] = useState(true),
    [verified, setVerified] = useState(false),
    [memoryLevel, setMemoryLevel] = useState(0),
    [settings, setSettings] = useState(false),
    [theme, setTheme] = useState(() =>
      readPreference("agr-theme", Object.keys(THEME_COLORS), "rose"),
    ),
    [quality, setQuality] = useState(() =>
      readPreference("agr-quality", QUALITY_LEVELS, "balanced"),
    ),
    [secret, setSecret] = useState(false),
    completionRef = useRef(""),
    importRef = useRef(""),
    routeTimers = useRef([]),
    screen = route.startsWith("compare") ? "compare" : route,
    doneCount = (state.batchItems || []).filter((item) => item.done).length,
    setScreen = useCallback(
      (next) => {
        if (next === route || (next === "compare" && screen === "compare"))
          return;
        routeTimers.current.forEach(clearTimeout);
        if (HEADLESS_TEST) {
          setSettings(false);
          setRoute(next);
          setSceneSettled(true);
          return;
        }
        setDiving(true);
        setSceneSettled(false);
        setSettings(false);
        dispatchEvent(new CustomEvent("agr-hint", { detail: { open: false } }));
        routeTimers.current = [
          setTimeout(() => {
            setRoute(next);
          }, 720),
          setTimeout(() => {
            setDiving(false);
            setSceneSettled(true);
          }, 1450),
        ];
      },
      [route, screen],
    );
  useEffect(() => {
    const move = (e) => {
      const cursorX = e.clientX / Math.max(1, innerWidth);
      const cursorY = e.clientY / Math.max(1, innerHeight);
      const x = (e.clientX / Math.max(1, innerWidth)) * 2 - 1;
      const y = 1 - (e.clientY / Math.max(1, innerHeight)) * 2;
      const distance = Math.hypot((x - .34) * .92, y - .03);
      appRoot.current?.style.setProperty("--cursor-x", cursorX);
      appRoot.current?.style.setProperty("--cursor-y", cursorY);
      appRoot.current?.style.setProperty("--edge-angle", `${cursorX * 180 + cursorY * 90}deg`);
      appRoot.current?.style.setProperty("--title-x", `${(cursorX - .5) * 5}px`);
      appRoot.current?.style.setProperty("--title-y", `${(cursorY - .5) * 3}px`);
      fieldRef.current = {
        x,
        y,
        influence: Math.pow(Math.max(0, 1 - distance / .72), 1.7),
      };
    };
    addEventListener("pointermove", move, { passive: true });
    return () => removeEventListener("pointermove", move);
  }, []);
  useEffect(() => {
    const update = (e) => appRoot.current?.classList.toggle("is-dragging", Boolean(e.detail));
    addEventListener("agr-drag", update);
    return () => removeEventListener("agr-drag", update);
  }, []);
  useEffect(() => {
    const update = (e) => appRoot.current?.classList.toggle("focus-comparison-active", Boolean(e.detail));
    addEventListener("agr-focus", update);
    return () => removeEventListener("agr-focus", update);
  }, []);
  useEffect(() => () => routeTimers.current.forEach(clearTimeout), []);
  useEffect(() => writePreference("agr-theme", theme), [theme]);
  useEffect(() => writePreference("agr-quality", quality), [quality]);
  useEffect(() => { backend?.setPerformanceMode?.(quality); }, [backend, quality]);
  useEffect(() => {
    const remember = () => setMemoryLevel((value) => Math.min(8, value + 1));
    addEventListener("agr-material-memory", remember);
    return () => removeEventListener("agr-material-memory", remember);
  }, []);
  useEffect(() => {
    const token = `${state.sourceUrl || ""}|${(state.batchItems || []).length}`;
    if (token !== importRef.current && (state.sourceUrl || state.batchItems?.length)) {
      importRef.current = token;
      setMemoryLevel((value) => Math.min(8, value + 1));
    }
  }, [state.batchItems, state.sourceUrl]);
  useEffect(() => {
    const token = `${state.outputPath || ""}|${doneCount}`;
    if (token === "|0" || token === completionRef.current) return undefined;
    completionRef.current = token;
    setVerified(true); setMemoryLevel((value) => Math.min(8, value + 2));
    const timer = setTimeout(() => setVerified(false), 2100);
    return () => clearTimeout(timer);
  }, [doneCount, state.outputPath]);
  const page =
    screen === "home" ? (
      <Home setScreen={setScreen} />
    ) : screen === "npm" ? (
      <Workspace
        kind="npm"
        state={state}
        backend={backend}
        setScreen={setScreen}
        contentReady={sceneSettled}
      />
    ) : screen === "batch" ? (
      <Workspace
        kind="batch"
        state={state}
        backend={backend}
        setScreen={setScreen}
        contentReady={sceneSettled}
      />
    ) : (
      <Compare
        index={Number(route.split(":")[1] || 0)}
        state={state}
        backend={backend}
        setScreen={setScreen}
        contentReady={sceneSettled}
      />
    );
  return (
    <div
      ref={appRoot}
      className={`app theme-${theme} quality-${quality} scene-${screen} ${diving ? "is-diving" : ""} ${sceneSettled ? "scene-settled" : ""} ${verified ? "is-verified" : ""}`}
    >
      {screen === "batch" && <DataCathedral items={state.batchItems} quality={quality} activity={state.batchActivityHistory?.at?.(-1)} />}
      <div className="webgl">
        {HEADLESS_TEST ? (
          <div className="headless-scene" />
        ) : (
          <SceneBoundary>
            <Scene
              theme={theme}
              quality={quality}
              screen={screen}
              fieldRef={fieldRef}
            />
          </SceneBoundary>
        )}
      </div>
      <TooltipLayer />
      <Header
        screen={screen}
        backend={backend}
        onSettings={() => setSettings((v) => !v)}
      />
      <RightDock
        screen={screen}
        setScreen={setScreen}
        state={state}
      />
      <TransitionPortal active={diving} />
      <CompletionRitual active={verified} />
      <MaterialMemory level={memoryLevel} />
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          className="route-stage"
          key={route}
          initial={{ opacity: 0, scale: 1.018, filter: "blur(7px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.94, filter: "blur(10px)" }}
          transition={{ duration: HEADLESS_TEST ? 0 : 0.72, ease: [0.2, 0.72, 0.18, 1] }}
        >
          {page}
        </motion.div>
      </AnimatePresence>
      <SettingsPanel
        open={settings}
        setOpen={setSettings}
        theme={theme}
        setTheme={setTheme}
        quality={quality}
        setQuality={setQuality}
        backend={backend}
      />
      <button
        className="signature"
        data-no-hold
        onClick={() => setSecret(true)}
      >
        <span className="signature-wave">{[..."ISSMAKER"].map((letter,i)=><i key={i} style={{"--i":i}}>{letter}</i>)}</span>
        <small>IMAGINED IN LIGHT</small>
      </button>
      <SecretScene
        active={secret}
        onDone={useCallback(() => setSecret(false), [])}
      />
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
