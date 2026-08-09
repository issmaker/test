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
import { Float, MeshTransmissionMaterial, Sparkles } from "@react-three/drei";
import {
  Bloom,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { AnimatePresence, motion } from "motion/react";
import { gsap } from "gsap";
import {
  Activity,
  Columns2,
  FolderOpen,
  House,
  Images,
  Maximize2,
  Minus,
  Palette,
  Plus,
  ScanLine,
  Settings,
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
  batchProgressHistory: [],
  batchActivityHistory: [],
};
const HEADLESS_TEST = new URLSearchParams(location.search).has("headless-test");
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

function useBackend() {
  const [backend, setBackend] = useState(null),
    [state, setState] = useState(EMPTY);
  useEffect(() => {
    if (!window.qt?.webChannelTransport || !window.QWebChannel) return;
    new window.QWebChannel(window.qt.webChannelTransport, (channel) => {
      const api = channel.objects.optimizer;
      setBackend(api);
      const refresh = () => api.snapshot((v) => setState({ ...EMPTY, ...v }));
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
  const x = Math.max(12, Math.min(innerWidth - 292, hint.x + 16));
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

function CursorTrail() {
  const dots = useRef([]),
    target = useRef({ x: innerWidth / 2, y: innerHeight / 2 }),
    points = useRef(Array.from({ length: 12 }, () => ({ ...target.current })));
  useEffect(() => {
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
  }, []);
  return (
    <div className="cursor-trail">
      {points.current.map((_, i) => (
        <i key={i} ref={(el) => (dots.current[i] = el)} />
      ))}
    </div>
  );
}

function AmbientBackdrop({ theme, motionValue, secret }) {
  const [p, setP] = useState({ x: 0.5, y: 0.5 }),
    raf = useRef(0);
  useEffect(() => {
    const move = (e) => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() =>
        setP({ x: e.clientX / innerWidth, y: e.clientY / innerHeight }),
      );
    };
    addEventListener("pointermove", move);
    return () => removeEventListener("pointermove", move);
  }, []);
  const px = p.x * 1600,
    py = p.y * 900,
    energy = motionValue?.energy || 0;
  return (
    <div
      className={`ambient-backdrop ${secret ? "secret-energy" : ""}`}
      data-theme={theme}
      style={{
        "--mx": `${p.x * 100}%`,
        "--my": `${p.y * 100}%`,
        "--px": p.x - 0.5,
        "--py": p.y - 0.5,
        "--energy": energy,
      }}
    >
      <div className="ambient-glow" />
      <svg viewBox="0 0 1600 900" preserveAspectRatio="none">
        <g className="field-lines">
          {Array.from({ length: 17 }, (_, i) => {
            const y = 22 + i * 55,
              d = Math.max(0, 1 - Math.abs(y - py) / 500),
              bend = (px - 800) * 0.06 * d + energy * 110 * d;
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
          {Array.from({ length: 8 }, (_, i) => (
            <path
              key={i}
              d={`M ${305 + i * 4} 390 C 365 ${135 + i * 9}, 620 ${150 - i * 5}, 690 372 C 760 ${595 - i * 8}, 1015 ${575 + i * 4}, 930 330 C 850 ${92 + i * 7}, 585 ${190 + i * 3}, 520 390 C 455 ${590 - i * 6}, 285 ${560 + i * 5}, ${305 + i * 4} 390 Z`}
              stroke={i === 4 ? "url(#vector-flow)" : "var(--accent)"}
              strokeWidth={i === 4 ? 3.2 : 0.8 + i * 0.18}
              opacity={i === 4 ? 0.8 : 0.08 + i * 0.035}
              filter={i === 4 ? "url(#vector-glow)" : undefined}
            />
          ))}
          <ellipse
            cx="620"
            cy="374"
            rx="104"
            ry="214"
            stroke="var(--accent2)"
            strokeWidth="1"
            opacity=".22"
          />
          <ellipse
            cx="620"
            cy="374"
            rx="238"
            ry="72"
            stroke="var(--accent)"
            strokeWidth="1"
            opacity=".18"
          />
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

function FlowSculpture({ progress, motionValue, colors }) {
  const group = useRef();
  useFrame(({ clock, pointer }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      pointer.x * 0.2 + Math.sin(t * 0.18) * 0.08,
      0.025,
    );
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      -0.16 + pointer.y * 0.14 + progress * 0.32,
      0.025,
    );
    group.current.rotation.z = THREE.MathUtils.lerp(
      group.current.rotation.z,
      pointer.x * 0.1 - progress * 0.22,
      0.025,
    );
    const scale = 1 + progress * 0.13 + (motionValue?.energy || 0) * 0.035;
    group.current.scale.setScalar(
      THREE.MathUtils.lerp(group.current.scale.x, scale, 0.035),
    );
  });
  return (
    <group ref={group} position={[0.65, 0.1, -0.75]}>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh
          key={i}
          rotation={[(i - 3) * 0.082, (i - 3) * 0.11, (i - 3) * 0.105]}
          scale={1 + i * 0.038}
        >
          <torusKnotGeometry args={[1.48, 0.025 + i * 0.006, 190, 9, 2, 3]} />
          <meshPhysicalMaterial
            color={colors[i % 2]}
            emissive={i === 4 ? colors[0] : "#12040d"}
            emissiveIntensity={i === 4 ? 1.15 : 0.15}
            metalness={0.72}
            roughness={0.2}
            clearcoat={1}
          />
        </mesh>
      ))}
    </group>
  );
}

function OrganicForms({ colors }) {
  const pieces = [
    [-5.1, 2.75, -1.7, 1.25, 0.72, 1.45],
    [5.25, -2.8, -1.5, 1, 0.68, 1.3],
    [-4.9, -2.7, -1.8, 0.76, 1.12, 0.72],
    [5.1, 2.7, -1.9, 0.65, 1.05, 0.7],
  ];
  return (
    <>
      {pieces.map((p, i) => (
        <Float
          key={i}
          speed={0.45 + i * 0.06}
          rotationIntensity={0.16}
          floatIntensity={0.18}
        >
          <mesh
            position={p.slice(0, 3)}
            scale={p.slice(3)}
            rotation={[i * 0.5, 0.6 + i, 0.2]}
          >
            <dodecahedronGeometry args={[1.25, 3]} />
            <MeshTransmissionMaterial
              color={colors[i % 2]}
              samples={3}
              resolution={192}
              transmission={1}
              thickness={0.85}
              roughness={0.16}
              chromaticAberration={0.05}
              anisotropy={0.18}
              distortion={0.18}
              temporalDistortion={0.04}
              clearcoat={1}
            />
          </mesh>
        </Float>
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
function Scene({ progress, active, motionValue, theme, quality }) {
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
      <ambientLight intensity={0.42} />
      <pointLight position={[4, 3, 5]} color={colors[0]} intensity={14} />
      <pointLight position={[-4, -2, 2]} color={colors[1]} intensity={9} />
      <OrganicForms colors={colors} />
      <FlowSculpture
        progress={progress}
        motionValue={motionValue}
        colors={colors}
      />
      <NeuralLines active={active} motionValue={motionValue} colors={colors} />
      <Sparkles
        count={density}
        scale={[12, 7, 4]}
        size={1}
        speed={0.13}
        color={colors[0]}
      />
      <CameraRig progress={progress} motionValue={motionValue} />
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={active ? 1.05 : 0.56}
          luminanceThreshold={0.36}
          luminanceSmoothing={0.55}
          mipmapBlur
        />
        <Noise opacity={0.025} blendFunction={BlendFunction.SOFT_LIGHT} />
        <Vignette darkness={0.55} offset={0.24} />
      </EffectComposer>
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
    return this.state.failed ? (
      <div className="scene-safe-mode">
        <span>VISUAL SAFE MODE</span>
      </div>
    ) : (
      this.props.children
    );
  }
}

function Button({ children, quiet = false, danger = false, tip, ...props }) {
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--bx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--by", `${e.clientY - r.top}px`);
  };
  const node = (
    <button
      className={`button ${quiet ? "quiet" : ""} ${danger ? "danger" : ""}`}
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
          <small>ADAPTIVE RGB24 / v40</small>
        </div>
      </div>
      <div className="route-status">
        <i />
        <small>ACTIVE SPACE</small>
        <strong>{label}</strong>
      </div>
      <div className="top-actions">
        <Button tip="Цвет, эффекты и интерфейс" quiet onClick={onSettings}>
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
function RightDock({ screen, setScreen, state, onSettings }) {
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
        const disabled =
          id === "compare" && !state.batchItems?.some((x) => x.done);
        return (
          <Hint
            text={disabled ? "Сначала оптимизируйте текстуру" : label}
            key={id}
          >
            <button
              disabled={disabled}
              className={screen === id ? "active" : ""}
              onClick={() => setScreen(id)}
            >
              <I />
              <span>{label}</span>
            </button>
          </Hint>
        );
      })}
      <i className="dock-separator" />
      <Hint text="Настройки">
        <button onClick={onSettings}>
          <Settings />
          <span>Настройки</span>
        </button>
      </Hint>
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
        <div className="capabilities">
          <div>
            <i>01</i>
            <strong>RGB24</strong>
            <small>TRUE COLOR</small>
          </div>
          <div>
            <i>02</i>
            <strong>8K READY</strong>
            <small>SAFE PREVIEW</small>
          </div>
          <div>
            <i>03</i>
            <strong>BATCH</strong>
            <small>MULTI FLOW</small>
          </div>
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

function ZoomPane({ title, src, view, setView }) {
  const drag = useRef(null),
    pane = useRef(null),
    image = useRef(null),
    motionTick = useRef(0),
    wheelEvents = useRef(new WeakSet()),
    clamp = useCallback((next) => {
      const box = pane.current,
        img = image.current;
      if (!box || !img?.naturalWidth)
        return { ...next, x: 0, y: 0, s: Math.max(1, Math.min(6, next.s)) };
      const cw = box.clientWidth,
        ch = box.clientHeight,
        fit = Math.min(cw / img.naturalWidth, ch / img.naturalHeight),
        s = Math.max(1, Math.min(6, next.s)),
        maxX = Math.max(0, (img.naturalWidth * fit * s - cw) / 2),
        maxY = Math.max(0, (img.naturalHeight * fit * s - ch) / 2);
      return {
        s,
        x: Math.max(-maxX, Math.min(maxX, next.x || 0)),
        y: Math.max(-maxY, Math.min(maxY, next.y || 0)),
      };
    }, []),
    pulse = (x = 0, y = 0, energy = 0.5, force = false) => {
      const now = performance.now();
      if (!force && now - motionTick.current < 55) return;
      motionTick.current = now;
      dispatchEvent(
        new CustomEvent("agr-motion", { detail: { x, y, energy } }),
      );
    };
  useEffect(() => setView({ s: 1, x: 0, y: 0 }), [src, setView]);
  const wheel = (e) => {
    const nativeEvent = e.nativeEvent || e;
    if (wheelEvents.current.has(nativeEvent)) return;
    wheelEvents.current.add(nativeEvent);
    window.__AGR_WHEEL_COUNT__ = (window.__AGR_WHEEL_COUNT__ || 0) + 1;
    if (!e.nativeEvent) e.preventDefault();
    if (!pane.current) return;
    const rect = pane.current.getBoundingClientRect(),
      ox = e.clientX - rect.left - rect.width / 2,
      oy = e.clientY - rect.top - rect.height / 2;
    setView((v) => {
      const factor = Math.max(
          0.91,
          Math.min(1.1, Math.exp(-e.deltaY * 0.0011)),
        ),
        s = Math.max(1, Math.min(6, v.s * factor)),
        ratio = s / v.s;
      window.__AGR_ZOOM_TARGET__ = s;
      return clamp({
        s,
        x: ox - (ox - v.x) * ratio,
        y: oy - (oy - v.y) * ratio,
      });
    });
    pulse(-e.deltaX * 0.004, -e.deltaY * 0.0025, 0.9);
  };
  useEffect(() => {
    const node = pane.current;
    if (!node) return;
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [wheel]);
  const move = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.px,
      dy = e.clientY - drag.current.py;
    setView((v) =>
      clamp({ ...v, x: drag.current.x + dx, y: drag.current.y + dy }),
    );
    pulse(dx * 0.011, -dy * 0.011, 0.7);
  };
  const stop = (e) => {
    drag.current = null;
    if (e?.currentTarget?.hasPointerCapture?.(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    pulse(0, 0, 0.2, true);
    dispatchEvent(new CustomEvent("agr-drag", { detail: false }));
  };
  return (
    <Hint text="Колесо — зум к курсору · перетаскивание — панорама">
      <div
        ref={pane}
        className="zoom-pane"
        onWheelCapture={wheel}
        onPointerDown={(e) => {
          if (view.s <= 1) return;
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
        {src ? (
          <img
            ref={image}
            onLoad={() => setView((v) => clamp(v))}
            draggable="false"
            src={src}
            style={{
              transform: `translate3d(${view.x}px,${view.y}px,0) scale(${view.s})`,
            }}
          />
        ) : (
          <p>PNG не выбран</p>
        )}
      </div>
    </Hint>
  );
}
function ZoomControl({ view, setView }) {
  const set = (s) => {
    const value = Math.max(1, Math.min(6, s));
    setView((v) => ({
      ...v,
      s: value,
      x: value === 1 ? 0 : v.x,
      y: value === 1 ? 0 : v.y,
    }));
    dispatchEvent(
      new CustomEvent("agr-motion", {
        detail: { x: 0, y: (value - view.s) * 1.3, energy: 0.9 },
      }),
    );
  };
  return (
    <div className="zoom-control">
      <Button tip="Уменьшить масштаб" quiet onClick={() => set(view.s - 0.25)}>
        <Minus />
      </Button>
      <div className="zoom-orbit" style={{ "--zoom": (view.s - 1) / 5 }}>
        <span>{Math.round(view.s * 100)}%</span>
        <i />
      </div>
      <Hint text="Плавный масштаб от «Вписать» до 600%">
        <input
          aria-label="Масштаб"
          type="range"
          min="1"
          max="6"
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

function Workspace({ kind, state, backend, setScreen }) {
  const batch = kind === "batch",
    [view, setView] = useState({ s: 1, x: 0, y: 0 }),
    items = state.batchItems || [],
    before = state.referenceUrl || state.workingPreviewUrl || state.sourceUrl;
  return (
    <main className="workspace">
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
              tip="Очистить очередь"
              onClick={() => backend?.clearBatch()}
            >
              ОЧИСТИТЬ
            </Button>
          )}
          <Button
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
          <section className="batch-list">
            {!items.length && (
              <div className="empty">
                <Plus />
                <h2>Добавьте PNG-файлы</h2>
                <p>Здесь появятся крупные превью до и после.</p>
              </div>
            )}
            {items.map((item, i) => (
              <article className="batch-row" key={item.sourceUrl || i}>
                <div className="thumb">
                  <img src={item.comparisonSourceUrl || item.sourceUrl} />
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
                    {item.width} × {item.height} · {mb(item.sourceMb)}{" "}
                    {item.done && `→ ${mb(item.outputMb)}`}
                  </p>
                  <FluidProgress value={item.progress || 0} />
                  <small>{item.report || item.status}</small>
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
          <section className="compare-card transparent">
            <div className="compare-title">
              <h2>СРАВНИТЕЛЬНЫЙ АНАЛИЗ</h2>
            </div>
            <div className="compare-grid">
              <ZoomPane
                title="BEFORE / ORIGINAL"
                src={before}
                view={view}
                setView={setView}
              />
              <ZoomPane
                title="AFTER / AGR RGB24"
                src={state.resultUrl}
                view={view}
                setView={setView}
              />
            </div>
            <div className="compare-tools">
              <Button quiet onClick={() => setView({ s: 1, x: 0, y: 0 })}>
                ВПИСАТЬ
              </Button>
              <Button
                quiet
                onClick={() => setView((v) => ({ ...v, x: 0, y: 0 }))}
              >
                ЦЕНТР
              </Button>
              <ZoomControl view={view} setView={setView} />
            </div>
          </section>
          <section className="bottom-process">
            <p>{state.report || state.status}</p>
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
    [view, setView] = useState({ s: 1, x: 0, y: 0 });
  if (!item)
    return (
      <main className="workspace">
        <Button onClick={() => setScreen("batch")}>ВЕРНУТЬСЯ К СПИСКУ</Button>
      </main>
    );
  return (
    <main className="workspace compare-scene">
      <div className="workspace-head">
        <Button quiet onClick={() => setScreen("batch")}>
          ← К СПИСКУ
        </Button>
        <div>
          <small>DEEP ANALYSIS</small>
          <h1>{item.name}</h1>
        </div>
      </div>
      <section className="compare-card transparent">
        <div className="compare-grid">
          <ZoomPane
            title="BEFORE"
            src={item.comparisonSourceUrl || item.sourceUrl}
            view={view}
            setView={setView}
          />
          <ZoomPane
            title="AFTER"
            src={item.comparisonResultUrl || item.resultUrl}
            view={view}
            setView={setView}
          />
        </div>
        <div className="compare-tools">
          <Button quiet onClick={() => setView({ s: 1, x: 0, y: 0 })}>
            ВПИСАТЬ
          </Button>
          <ZoomControl view={view} setView={setView} />
          <Button quiet onClick={() => backend?.openBatchOutput(index)}>
            ОТКРЫТЬ ПАПКУ
          </Button>
        </div>
      </section>
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
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.6 }}
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
    [route, setRoute] = useState("home"),
    [progress, setProgress] = useState(0),
    [holding, setHolding] = useState(false),
    [holdPoint, setHoldPoint] = useState({
      x: innerWidth / 2,
      y: innerHeight / 2,
    }),
    [motionValue, setMotionValue] = useState({ x: 0, y: 0, energy: 0 }),
    [dragging, setDragging] = useState(false),
    [diving, setDiving] = useState(false),
    [settings, setSettings] = useState(false),
    [theme, setTheme] = useState(
      () => localStorage.getItem("agr-theme") || "rose",
    ),
    [quality, setQuality] = useState(
      () => localStorage.getItem("agr-quality") || "balanced",
    ),
    [secret, setSecret] = useState(false),
    progressRef = useRef({ value: 0 }),
    motionRef = useRef({ x: 0, y: 0, energy: 0 }),
    routeTimers = useRef([]),
    screen = route.startsWith("compare") ? "compare" : route,
    setScreen = useCallback(
      (next) => {
        if (next === route || (next === "compare" && screen === "compare"))
          return;
        routeTimers.current.forEach(clearTimeout);
        setDiving(true);
        setSettings(false);
        dispatchEvent(new CustomEvent("agr-hint", { detail: { open: false } }));
        routeTimers.current = [
          setTimeout(() => {
            setRoute(next);
            setProgress(0);
            progressRef.current.value = 0;
          }, 220),
          setTimeout(() => setDiving(false), 900),
        ];
      },
      [route, screen],
    );
  useEffect(() => {
    const react = (e) => {
      Object.assign(motionRef.current, e.detail);
      setMotionValue({ ...motionRef.current });
      gsap.killTweensOf(motionRef.current);
      gsap.to(motionRef.current, {
        x: 0,
        y: 0,
        energy: 0,
        duration: 1.1,
        ease: "power3.out",
        onUpdate: () => setMotionValue({ ...motionRef.current }),
      });
    };
    addEventListener("agr-motion", react);
    return () => removeEventListener("agr-motion", react);
  }, []);
  useEffect(() => {
    const update = (e) => setDragging(Boolean(e.detail));
    addEventListener("agr-drag", update);
    return () => removeEventListener("agr-drag", update);
  }, []);
  useEffect(() => () => routeTimers.current.forEach(clearTimeout), []);
  useEffect(() => localStorage.setItem("agr-theme", theme), [theme]);
  useEffect(() => localStorage.setItem("agr-quality", quality), [quality]);
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
          duration: 1.45,
          ease: "elastic.out(1,.55)",
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
      className={`app theme-${theme} quality-${quality} scene-${screen} ${holding ? "is-holding" : ""} ${dragging ? "is-dragging" : ""} ${diving ? "is-diving" : ""}`}
    >
      <AmbientBackdrop
        theme={theme}
        motionValue={motionValue}
        secret={secret}
      />
      <VectorSculpture />
      <div className="webgl">
        {screen !== "home" ? null : HEADLESS_TEST ? (
          <div className="headless-scene" />
        ) : (
          <SceneBoundary>
            <Scene
              progress={progress}
              active={holding || (motionValue.energy || 0) > 0.12}
              motionValue={motionValue}
              theme={theme}
              quality={quality}
            />
          </SceneBoundary>
        )}
      </div>
      <CursorTrail />
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
        onSettings={() => setSettings((v) => !v)}
      />
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          className="route-stage"
          key={route}
          initial={{ opacity: 0, scale: 1.04, filter: "blur(12px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.82, filter: "blur(18px)" }}
          transition={{ duration: 0.62, ease: [0.2, 0.78, 0.18, 1] }}
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
