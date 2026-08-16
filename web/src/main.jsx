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
  const y = hint.y > innerHeight - 90 ? hint.y - 48 : hint.y + 18;
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

function DecodeText({ children }) {
  const original = String(children),
    [value, setValue] = useState(original),
    frame = useRef(0),
    glyphs = "01<>/\\{}[]#%*+—";
  const decode = () => {
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
              : i < fixed
                ? c
                : glyphs[Math.floor(Math.random() * glyphs.length)],
          )
          .join(""),
      );
      if (p < 1) frame.current = requestAnimationFrame(run);
    };
    frame.current = requestAnimationFrame(run);
  };
  return (
    <span className="decode-text" onPointerEnter={decode}>
      {value}
    </span>
  );
}

function CursorTrail({ active }) {
  const dots = useRef([]),
    target = useRef({ x: innerWidth / 2, y: innerHeight / 2 }),
    points = useRef(Array.from({ length: 12 }, () => ({ ...target.current })));
  useEffect(() => {
    if (!active) return undefined;
    const move = (e) => {
      target.current = { x: e.clientX, y: e.clientY };
    };
    let raf;
    const tick = () => {
      let lead = target.current;
      points.current.forEach((p, i) => {
        const ease = 0.28 - i * 0.012;
        p.x += (lead.x - p.x) * ease;
        p.y += (lead.y - p.y) * ease;
        dots.current[i]?.style.setProperty(
          "transform",
          `translate3d(${p.x}px,${p.y}px,0) translate(-50%,-50%) scale(${1 - i / 15})`,
        );
        lead = p;
      });
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
    <div className="cursor-trail">
      {points.current.map((_, i) => (
        <i key={i} ref={(el) => (dots.current[i] = el)} />
      ))}
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

function CameraRig({ progress, motionValue }) {
  const { camera, pointer } = useThree();
  useFrame(({ clock }) => {
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      pointer.x * 0.32 + (motionValue?.x || 0) * 0.04,
      0.03,
    );
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      pointer.y * 0.22 + (motionValue?.y || 0) * 0.04,
      0.03,
    );
    camera.position.z = THREE.MathUtils.lerp(
      camera.position.z,
      7.1 - progress * 0.22 + Math.sin(clock.elapsedTime * 0.22) * 0.035,
      0.025,
    );
    camera.lookAt(0, 0, 0);
  });
  return null;
}
function Scene({ progress, theme, quality }) {
  const colors = THEME_COLORS[theme] || THEME_COLORS.rose;
  const density = quality === "eco" ? 45 : quality === "max" ? 125 : 80;
  return (
    <Canvas
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
    >
      <ambientLight intensity={0.58} />
      <pointLight position={[4, 3, 5]} color={colors[0]} intensity={2.8} />
      <pointLight position={[-4, -2, 2]} color={colors[1]} intensity={1.8} />
      <EdgeFrames colors={colors} />
      <SignalLattice progress={progress} colors={colors} />
      <NeuralLines active={false} motionValue={{ energy: 0 }} colors={colors} />
      <Sparkles
        count={density}
        scale={[12, 7, 4]}
        size={1}
        speed={0.13}
        color={colors[0]}
      />
      <CameraRig progress={progress} motionValue={motionValue} />
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

function Button({ children, quiet = false, danger = false, tip, className = "", ...props }) {
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
      {...props}
    >
      <i />
      <span>{children}</span>
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
function ProcessSignal({ progress = 0, status = "Ожидание", compact = false }) {
  const p = Math.max(0, Math.min(1, Number(progress || 0)));
  return <div className={`process-signal ${compact ? "compact" : ""}`} title={status}>
    <div className="signal-copy"><small>{p >= 1 ? "RGB24 VERIFIED" : p > 0 ? "ADAPTIVE PIPELINE" : "READY CHANNEL"}</small><strong>{Math.round(p * 100)}%</strong></div>
    <div className="signal-bars">{Array.from({length:18},(_,i)=><i key={i} style={{"--h":`${20 + ((i * 37 + Math.round(p*100)) % 75)}%`,"--on":i/17<=p?1:.12}} />)}</div>
    <span>{String(status).split("·")[0].slice(0,72)}</span>
  </div>;
}
function FluidProgress({ value = 0 }) {
  return (
    <div
      className="fluid-progress"
      style={{ "--value": Math.max(0, Math.min(1, value)) }}
    >
      <i />
      <b />
    </div>
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
      <div className="cathedral-modules">
        {visible.map((item, i) => <div key={`${item.sourceUrl || item.name}-${i}`} className={`cathedral-module ${item.done ? "done" : item.importing ? "loading" : "queued"}`} style={{ "--i": i, "--count": visible.length }}><i /><b>{String(i + 1).padStart(2,"0")}</b><span>{item.name}</span></div>)}
      </div>
      <div className="cathedral-core"><span>{items.length}</span><small>TEXTURE NODES</small></div>
    </div>
  );
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
          <small>ADAPTIVE RGB24 / v45</small>
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
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          className="settings-panel"
          data-no-hold
          initial={{ x: 390, opacity: 0, filter: "blur(12px)" }}
          animate={{ x: 0, opacity: 1, filter: "blur(0)" }}
          exit={{ x: 390, opacity: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 25 }}
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
          <p>Интенсивность эффектов</p>
          <div className="quality-switch">
            {[
              ["eco", "ТИХО"],
              ["balanced", "БАЛАНС"],
              ["max", "МАКС"],
            ].map(([id, label]) => (
              <button
                className={quality === id ? "active" : ""}
                onClick={() => setQuality(id)}
                key={id}
              >
                {label}
              </button>
            ))}
          </div>
          <small className="settings-note">
            Настройки применяются сразу и не влияют на качество PNG.
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
        <div className="capability-grid">
          <div><small>RGB24</small><strong>TRUE COLOR</strong><b>01</b></div>
          <div><small>8K READY</small><strong>SAFE PREVIEW</strong><b>02</b></div>
          <div><small>BATCH</small><strong>DATA CATHEDRAL</strong><b>03</b></div>
        </div>
        <Button
          tip="Один PNG, результат строго меньше 3 MB"
          onClick={() => setScreen("npm")}
        >
          НПМ · ОПТИМИЗИРОВАТЬ ДО 3 MB
        </Button>
        <Button
          tip="Несколько PNG без лимита итогового размера"
          quiet
          onClick={() => setScreen("batch")}
        >
          ОТКРЫТЬ ОПТИМИЗАТОР ТЕКСТУР
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

const SmoothCompareViewport = React.memo(function SmoothCompareViewport({ before, after, mode, onZoom }) {
  const host = useRef(null), canvas = useRef(null), frame = useRef(0), drag = useRef(null);
  const images = useRef({ before: null, after: null });
  const target = useRef({ s: 1, x: 0, y: 0, split: 0.5 });
  const current = useRef({ s: 1, x: 0, y: 0, split: 0.5 });
  const alive = useRef(true), loaded = useRef(false), modeRef = useRef(mode);

  const render = useCallback(() => {
    frame.current = 0;
    const node = host.current, out = canvas.current;
    if (!node || !out || !loaded.current) return;
    const rect = node.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
    if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
    const ctx = out.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) return;
    const c = current.current, t = target.current;
    c.s += (t.s - c.s) * .19; c.x += (t.x - c.x) * .19; c.y += (t.y - c.y) * .19; c.split += (t.split - c.split) * .22;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = "#030205"; ctx.fillRect(0, 0, rect.width, rect.height);
    const draw = (img, x0, width) => {
      if (!img?.naturalWidth || width <= 0) return;
      ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, width, rect.height); ctx.clip();
      const fitW = modeRef.current === "pan" ? rect.width / 2 : rect.width;
      const fit = Math.min(fitW / img.naturalWidth, rect.height / img.naturalHeight);
      const scale = fit * c.s, dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
      const cx = modeRef.current === "pan" ? x0 + width / 2 : rect.width / 2;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = c.s > 8 ? "medium" : "high";
      ctx.drawImage(img, cx - dw / 2 + c.x, rect.height / 2 - dh / 2 + c.y, dw, dh); ctx.restore();
    };
    if (modeRef.current === "wipe") {
      const cut = rect.width * c.split; draw(images.current.before, 0, rect.width); draw(images.current.after, 0, cut);
      ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(cut - .5, 0, 1, rect.height);
    } else {
      draw(images.current.before, 0, rect.width / 2); draw(images.current.after, rect.width / 2, rect.width / 2);
    }
    const moving = Math.abs(t.s-c.s) > .001 || Math.abs(t.x-c.x) > .08 || Math.abs(t.y-c.y) > .08 || Math.abs(t.split-c.split) > .001;
    if (moving && alive.current) frame.current = requestAnimationFrame(render);
  }, []);
  const wake = useCallback(() => { if (!frame.current) frame.current = requestAnimationFrame(render); }, [render]);
  const reset = useCallback((scale = 1) => {
    target.current = { ...target.current, s: scale, x: 0, y: 0 };
    onZoom?.(scale); wake();
  }, [onZoom, wake]);
  useEffect(() => { modeRef.current = mode; wake(); }, [mode, wake]);
  useEffect(() => {
    alive.current = true; loaded.current = false;
    let cancelled = false;
    const load = (src) => new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image(); img.decoding = "async";
      const done = () => resolve(img.naturalWidth ? img : null);
      img.onload = done; img.onerror = () => resolve(null); img.src = src;
      if (img.complete) done();
    });
    Promise.all([load(before || (HEADLESS_TEST ? TEST_TEXTURE : "")), load(after || (HEADLESS_TEST ? TEST_TEXTURE : ""))]).then(([a,b]) => {
      if (cancelled) return; images.current = { before: a, after: b }; loaded.current = Boolean(a || b); reset();
    });
    return () => { cancelled = true; alive.current = false; cancelAnimationFrame(frame.current); frame.current = 0; };
  }, [before, after, reset]);
  useEffect(() => {
    const observer = new ResizeObserver(wake); if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, [wake]);
  const zoom = useCallback((factor, ox = 0, oy = 0) => {
    const t = target.current, s = Math.max(1, Math.min(MAX_ZOOM, t.s * factor)), ratio = s / t.s;
    target.current = { ...t, s, x: ox - (ox - t.x) * ratio, y: oy - (oy - t.y) * ratio };
    onZoom?.(s); window.__AGR_ZOOM_TARGET__ = s; wake();
  }, [onZoom, wake]);
  useEffect(() => {
    const node = host.current; if (!node) return;
    const wheel = (e) => { e.preventDefault(); window.__AGR_WHEEL_COUNT__ = (window.__AGR_WHEEL_COUNT__ || 0) + 1; const r=node.getBoundingClientRect(); zoom(Math.exp(Math.max(-.14, Math.min(.14, -e.deltaY*.0012))), e.clientX-r.left-r.width/2, e.clientY-r.top-r.height/2); };
    node.addEventListener("wheel", wheel, { passive: false }); return () => node.removeEventListener("wheel", wheel);
  }, [zoom]);
  useEffect(() => {
    if (!HEADLESS_TEST) return;
    const z = e => zoom(Number(e.detail?.factor || 1.1));
    const d = e => { target.current.x += Number(e.detail?.x || 0); target.current.y += Number(e.detail?.y || 0); window.__AGR_TEST_VERTICAL_Y__=target.current.y; wake(); };
    addEventListener("agr-test-zoom", z); addEventListener("agr-test-drag", d); return () => { removeEventListener("agr-test-zoom", z); removeEventListener("agr-test-drag", d); };
  }, [wake, zoom]);
  return <div ref={host} className="smooth-compare" onPointerDown={(e) => {
    const r=host.current.getBoundingClientRect(), near=mode==="wipe" && Math.abs(e.clientX-r.left-r.width*target.current.split)<34;
    drag.current={ px:e.clientX, py:e.clientY, x:target.current.x, y:target.current.y, wipe:near }; e.currentTarget.setPointerCapture(e.pointerId);
  }} onPointerMove={(e) => {
    if (!drag.current) return; const r=host.current.getBoundingClientRect();
    if (drag.current.wipe) target.current.split=Math.max(.02,Math.min(.98,(e.clientX-r.left)/r.width));
    else { target.current.x=drag.current.x+e.clientX-drag.current.px; target.current.y=drag.current.y+e.clientY-drag.current.py; }
    wake();
  }} onPointerUp={() => { drag.current=null; }} onPointerCancel={() => { drag.current=null; }}>
    <canvas ref={canvas} />
    <span className="compare-label before">BEFORE / ORIGINAL</span><span className="compare-label after">AFTER / AGR RGB24</span>
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
}) {
  const [mode, setMode] = useState("pan");
  const [zoomLabel, setZoomLabel] = useState(100);
  const updateZoomLabel = useCallback((s) => setZoomLabel(Math.round(s * 100)), []);
  return (
    <section className="compare-card transparent">
      {allowWipe && after && (
        <div className="comparison-modes">
          <button className={mode === "pan" ? "active" : ""} onClick={() => setMode("pan")}>
            СИНХРОННЫЙ ZOOM
          </button>
          <button className={mode === "wipe" ? "active" : ""} onClick={() => setMode("wipe")}>
            ШТОРКА ДО / ПОСЛЕ
          </button>
        </div>
      )}
      <SmoothCompareViewport before={before} after={after} mode={mode} onZoom={updateZoomLabel} />
      <div className="compare-tools">
        <span className="live-zoom">ZOOM {zoomLabel}% · MAX {MAX_ZOOM * 100}%</span>
        <Button quiet tip="Focus Comparison · клавиша F" onClick={onFocus}>
          <Focus /> {focus ? "ВЫЙТИ ИЗ FOCUS" : "FOCUS"}
        </Button>
        {onOpenFolder && <Button quiet onClick={onOpenFolder}>ОТКРЫТЬ ПАПКУ</Button>}
      </div>
    </section>
  );
});

function Workspace({ kind, state, backend, setScreen }) {
  const batch = kind === "batch",
    [focus, setFocus] = useState(false),
    items = state.batchItems || [],
    before = state.referenceUrl || state.workingPreviewUrl || state.sourceUrl;
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
          <section className={`batch-import-panel ${state.batchImportBusy ? "active" : ""}`}>
            <div className="import-copy">
              <Cpu />
              <div>
                <small>{state.batchImportBusy ? "ФОНОВАЯ ЗАГРУЗКА PNG" : `АППАРАТНАЯ ОЧЕРЕДЬ · ${state.batchWorkers || 1} ${state.batchWorkers === 1 ? "ПОТОК" : "ПОТОКА"}`}</small>
                <strong>{state.batchImportBusy ? state.batchImportStatus : state.batchStatus}</strong>
              </div>
            </div>
            <FluidProgress value={state.batchImportBusy ? state.batchImportProgress : state.batchProgress} />
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
                  <ProcessSignal compact progress={item.progress || (item.done ? 1 : 0)} status={item.status || item.report} />
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
          <div className="compare-title">
            <h2>СРАВНИТЕЛЬНЫЙ АНАЛИЗ · СИНХРОННОЕ ПЕРЕМЕЩЕНИЕ</h2>
          </div>
          <ComparisonSurface
            before={before}
            after={state.resultUrl}
            focus={focus}
            onFocus={toggleFocus}
          />
          <section className="bottom-process">
            <ProcessSignal progress={state.progress} status={state.status || state.report} />
            <Button
              danger={state.busy}
              disabled={!state.sourceUrl && !state.busy}
              onClick={() =>
                state.busy ? backend?.stopCurrent() : backend?.optimize(2.99)
              }
            >
              {state.busy ? "ОСТАНОВИТЬ" : "ОПТИМИЗИРОВАТЬ ДО 3 MB"}
            </Button>
            <Button
              quiet
              disabled={!state.outputPath}
              onClick={() => backend?.openOutputFolder()}
            >
              <FolderOpen /> ПАПКА РЕЗУЛЬТАТА
            </Button>
          </section>
        </>
      )}
    </main>
  );
}
function Compare({ index, state, backend, setScreen }) {
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
        before={item.comparisonSourceUrl || item.sourceUrl}
        after={item.comparisonResultUrl || item.resultUrl}
        focus={focus}
        onFocus={toggleFocus}
        allowWipe
        onOpenFolder={openFolder}
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
function TransitionPortal({ active }) {
  return (
    <div className={`transition-portal ${active ? "active" : ""}`} aria-hidden="true">
      <i /><i /><i /><b />
    </div>
  );
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
    [route, setRoute] = useState("home"),
    [progress, setProgress] = useState(0),
    [holding, setHolding] = useState(false),
    [holdPoint, setHoldPoint] = useState({
      x: innerWidth / 2,
      y: innerHeight / 2,
    }),
    [diving, setDiving] = useState(false),
    [settings, setSettings] = useState(false),
    [theme, setTheme] = useState(() =>
      readPreference("agr-theme", Object.keys(THEME_COLORS), "rose"),
    ),
    [quality, setQuality] = useState(() =>
      readPreference("agr-quality", QUALITY_LEVELS, "balanced"),
    ),
    [secret, setSecret] = useState(false),
    progressRef = useRef({ value: 0 }),
    routeTimers = useRef([]),
    screen = route.startsWith("compare") ? "compare" : route,
    setScreen = useCallback(
      (next) => {
        if (next === route || (next === "compare" && screen === "compare"))
          return;
        routeTimers.current.forEach(clearTimeout);
        if (HEADLESS_TEST) {
          setSettings(false);
          setRoute(next);
          setProgress(0);
          progressRef.current.value = 0;
          return;
        }
        setDiving(true);
        setSettings(false);
        dispatchEvent(new CustomEvent("agr-hint", { detail: { open: false } }));
        routeTimers.current = [
          setTimeout(() => {
            setRoute(next);
            setProgress(0);
            progressRef.current.value = 0;
          }, 310),
          setTimeout(() => setDiving(false), 760),
        ];
      },
      [route, screen],
    );
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
  useEffect(() => {
    const down = (e) => {
        if (
          screen !== "home" ||
          e.button !== 0 ||
          e.target.closest("[data-no-hold]")
        )
          return;
        setHoldPoint({ x: e.clientX, y: e.clientY });
        setHolding(true);
        gsap.killTweensOf(progressRef.current);
        gsap.to(progressRef.current, {
          value: 1,
          duration: 2.7,
          ease: "sine.inOut",
          onUpdate: () => setProgress(progressRef.current.value),
        });
      },
      up = () => {
        setHolding(false);
        gsap.killTweensOf(progressRef.current);
        gsap.to(progressRef.current, {
          value: 0,
          duration: 0.82,
          ease: "power3.out",
          onUpdate: () => setProgress(progressRef.current.value),
        });
      };
    addEventListener("pointerdown", down);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    return () => {
      removeEventListener("pointerdown", down);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
    };
  }, [screen]);
  const page =
    screen === "home" ? (
      <Home setScreen={setScreen} />
    ) : screen === "npm" ? (
      <Workspace
        kind="npm"
        state={state}
        backend={backend}
        setScreen={setScreen}
      />
    ) : screen === "batch" ? (
      <Workspace
        kind="batch"
        state={state}
        backend={backend}
        setScreen={setScreen}
      />
    ) : (
      <Compare
        index={Number(route.split(":")[1] || 0)}
        state={state}
        backend={backend}
        setScreen={setScreen}
      />
    );
  return (
    <div
      ref={appRoot}
      className={`app theme-${theme} quality-${quality} scene-${screen} ${holding ? "is-holding" : ""} ${diving ? "is-diving" : ""}`}
    >
      <AmbientBackdrop theme={theme} secret={secret} active={screen === "home" && !diving} />
      {screen === "batch" ? <DataCathedral items={state.batchItems} quality={quality} activity={state.batchActivityHistory?.at?.(-1)} /> : <KineticArchitecture activity={holding ? Math.max(.2, progress) : Number(state.activityHistory?.at?.(-1) || .08)} />}
      <VectorSculpture />
      <div className="webgl">
        {screen !== "home" ? null : HEADLESS_TEST ? (
          <div className="headless-scene" />
        ) : (
          <SceneBoundary>
            <Scene
              progress={progress}
              theme={theme}
              quality={quality}
            />
          </SceneBoundary>
        )}
      </div>
      <CursorTrail active={screen === "home" && quality !== "eco" && !diving} />
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
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          className="route-stage"
          key={route}
          initial={{ opacity: 0, scale: 1.018, filter: "blur(7px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.94, filter: "blur(10px)" }}
          transition={{ duration: HEADLESS_TEST ? 0 : 0.3, ease: [0.3, 0.72, 0.2, 1] }}
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
      />
      <HoldRitual holding={holding} progress={progress} point={holdPoint} />
      <button
        className="signature"
        data-no-hold
        onClick={() => setSecret(true)}
      >
        by issmaker
      </button>
      <SecretScene
        active={secret}
        onDone={useCallback(() => setSecret(false), [])}
      />
      <div
        className="cinematic-progress"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
