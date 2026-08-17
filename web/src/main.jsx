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
import { Environment, Lightformer, Sparkles } from "@react-three/drei";
import { AnimatePresence, motion } from "motion/react";
import { gsap } from "gsap";
import {
  Activity,
  Columns2,
  Cpu,
  FolderOpen,
  Focus,
  Gamepad2,
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
import BladeGrid from "./BladeGrid.jsx";
import "./style.css";
import "./v47.css";
import "./v48.css";
import "./v49.css";
import "./v54.css";
import "./v59.css";

const EMPTY = {
  sourceUrl: "",
  sourceName: "",
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
  sourceIsLarge: false,
  busy: false,
  previewBusy: false,
  previewProgress: 0,
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
const TEST_FULL_TEXTURE = "qrc:/icons/house.svg";
const ROUTES = [
  ["home", "Главная", House],
  ["npm", "НПМ · 3 MB", ScanLine],
  ["batch", "Текстуры", Images],
  ["compare", "Сравнение", Columns2],
  ["game", "Blade Grid", Gamepad2],
];
const PRESETS = [
  ["rose", "Rose signal", "#ff3f93"],
  ["cyan", "Arctic cyan", "#37e7ff"],
  ["violet", "Ultraviolet", "#9a72ff"],
  ["amber", "Amber pulse", "#ffad42"],
  ["emerald", "Emerald matrix", "#19e69b"],
  ["cobalt", "Electric cobalt", "#2778ff"],
];
const THEME_COLORS = {
  rose: ["#ff3f93", "#8c54ff"],
  cyan: ["#37e7ff", "#3879ff"],
  violet: ["#a67cff", "#f05dff"],
  amber: ["#ffad42", "#ff4f73"],
  emerald: ["#19e69b", "#28d9f7"],
  cobalt: ["#2778ff", "#d6f6ff"],
};
const QUALITY_LEVELS = ["eco", "balanced", "max"];
const MAX_ZOOM = 8;
const DETAIL_ZOOM = 7.95;

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
function readNumberPreference(key,fallback,min,max){
  try{const value=Number(localStorage.getItem(key));return Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;}catch{return fallback;}
}

function useBackend() {
  const [backend, setBackend] = useState(null),
    [state, setState] = useState(EMPTY);
  useEffect(() => {
    if (!window.qt?.webChannelTransport || !window.QWebChannel) return;
    new window.QWebChannel(window.qt.webChannelTransport, (channel) => {
      const api = channel.objects.optimizer;
      setBackend(api);
      let frame = 0, timer = 0, lastSnapshot = 0;
      const commitSnapshot = () => {
        frame = 0;
        timer = 0;
        lastSnapshot = performance.now();
        api.snapshot((v) => setState({ ...EMPTY, ...v }));
      };
      const refresh = () => {
        if (frame || timer) return;
        // A batch progress signal can arrive dozens of times per second. A
        // complete snapshot also serialises the whole queue, so cap bridge
        // traffic without slowing native work or user input.
        const wait = Math.max(0, 55 - (performance.now() - lastSnapshot));
        if (wait > 1) timer = setTimeout(() => { timer = 0; frame = requestAnimationFrame(commitSnapshot); }, wait);
        else frame = requestAnimationFrame(commitSnapshot);
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
        "previewProgressChanged",
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
  const decode = (event) => {
    cancelAnimationFrame(frame.current);
    const start = performance.now(),box=event.currentTarget.getBoundingClientRect(),fromLeft=event.clientX<box.left+box.width/2;
    const run = (now) => {
      const p = Math.min(1, (now - start) / 500),
        fixed = Math.floor(original.length * p);
      setValue(
        original
          .split("")
          .map((c, i) =>
            c === " "
              ? c
              : (fromLeft?i:original.length-1-i) < fixed
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

function InteractionFrameBudget(){
  const setFrameloop=useThree((state)=>state.setFrameloop),invalidate=useThree((state)=>state.invalidate);
  useEffect(()=>{const update=(event)=>{setFrameloop(event.detail?"never":"always");if(!event.detail)invalidate();};addEventListener("agr-drag",update);return()=>{removeEventListener("agr-drag",update);setFrameloop("always");};},[invalidate,setFrameloop]);
  return null;
}

const bladePose=(state,u,time=0,out)=>{
  const a=u*Math.PI*2, breathe=Math.sin(time*.38+a*2)*.035;
  let x=0,y=0,z=0,width=1.8,twist=0;
  if(state==="npm"){
    x=(u-.5)*7.1;y=Math.sin(a)*1.34*(.72+Math.abs(u-.5));z=Math.cos(a)*.74;twist=a*.72;width=1.25+Math.sin(Math.PI*u)*1.05;
  }else if(state==="batch"){
    x=(u-.5)*7.2;y=Math.sin(a*1.5)*1.52;z=Math.cos(a*3)*.58;twist=Math.sin(a*1.5)*1.05;width=1.05+.7*(.5+.5*Math.cos(a*3));
  }else if(state==="compare"){
    x=Math.sin(a)*3.25;y=Math.sign(Math.cos(a))*1.05+.34*Math.cos(a*2);z=.58*Math.sin(a*2);twist=Math.PI*.5*Math.sin(a);width=1.2+.72*Math.abs(Math.cos(a));
  }else if(state==="game"){
    const lane=(Math.floor(u*8)-3.5),cell=(u*8)%1;
    x=lane*.78+.2*Math.sin(a*3);y=(cell-.5)*5.4;z=.72*Math.sin(lane*.8+a)+.18*Math.cos(time*.4+a*2);twist=(lane%2?1:-1)*.72+.28*Math.sin(a*2);width=.92+.38*(.5+.5*Math.cos(a*8));
  }else if(state==="settings"){
    x=Math.cos(a)*2.75;y=Math.sin(a)*1.72;z=.38*Math.sin(a*2);twist=a*.34;width=1.45+.22*Math.sin(a*3);
  }else if(state==="secret"){
    // Author sequence: the existing sculpture first collapses into a bright
    // core, then opens as a three-ring metal iris. It is still the same set
    // of blades, not a replacement object.
    const reveal=THREE.MathUtils.smoothstep(time,.48,2.05),pulse=Math.exp(-Math.pow(time-2.18,2)/.075);
    const flower=.16+reveal*(2.58+.54*Math.cos(a*3));
    x=Math.cos(a)*flower*1.3;y=Math.sin(a)*flower*.73;z=reveal*(1.08*Math.sin(a*3+time*.34))+pulse*Math.cos(a*7)*.62;
    twist=a*(.55+reveal*.92)+reveal*time*.16;width=.28+reveal*(1.22+.62*(.5+.5*Math.cos(a*3)));
  }else{
    // A spatial three-lobed flow: the spine travels in depth while every
    // blade rotates independently, matching the reference fan rather than
    // collapsing into a flat infinity ribbon.
    const radius=2.72+.58*Math.cos(a*3+.35);
    x=.25+Math.cos(a)*radius*1.28;
    y=Math.sin(a)*radius*.64+.34*Math.sin(a*2);
    z=1.12*Math.sin(a*2-.35)+.42*Math.cos(a*3);
    twist=a*1.18+.44*Math.sin(a*2);
    width=1.62+.72*(.5+.5*Math.cos(a*3-.5));
  }
  const pose=out||{position:new THREE.Vector3(),rotation:new THREE.Euler(0,0,0,"XYZ"),scale:new THREE.Vector3()};
  pose.position.set(x,y+breathe,z);pose.rotation.set(.34*Math.sin(a*2),twist,.5*Math.cos(a),"XYZ");pose.scale.set(width,1,1+.18*Math.sin(a*3));return pose;
};

function BladeSculpture({ state, theme, quality, brightness=1, effects=1, transitionKind="home>home", hold=0, holdPoint, processing=false }){
  const count=quality==="eco"?104:quality==="max"?188:148;
  const body=useRef(),edge=useRef(),edgeBack=useRef(),trail=useRef(),current=useRef([]),targets=useRef([]),hover=useRef(-1),holdU=useRef(.56),frameTick=useRef(0),stateClock=useRef({name:state,start:0}),lastPointer=useRef(new THREE.Vector2()),tmp=useMemo(()=>({matrix:new THREE.Matrix4(),q:new THREE.Quaternion(),p:new THREE.Vector3(),trailP:new THREE.Vector3(),s:new THREE.Vector3(),projected:new THREE.Vector3(),offset:new THREE.Vector3(),pointer:new THREE.Vector2(),color:new THREE.Color(),bodyColor:new THREE.Color(),dark:new THREE.Color("#12364a"),white:new THREE.Color("#ffffff")}),[]);
  const colors=THEME_COLORS[theme]||THEME_COLORS.cyan;
  const accent=useMemo(()=>new THREE.Color(colors[0]),[colors]);
  const accent2=useMemo(()=>new THREE.Color(colors[1]),[colors]);
  const transitionMode=useMemo(()=>[...transitionKind].reduce((sum,char)=>sum+char.charCodeAt(0),0)%4,[transitionKind]);
  useEffect(()=>{current.current=[];targets.current=[];},[count]);
  useFrame(({clock,pointer,camera})=>{
    if(processing&&hold<=0&&++frameTick.current%2)return;
    if(!body.current||!edge.current||!edgeBack.current||!trail.current)return;
    const activePointer=hold>0&&holdPoint?tmp.pointer.set(holdPoint.x/innerWidth*2-1,1-holdPoint.y/innerHeight*2):pointer;
    const t=clock.elapsedTime;if(stateClock.current.name!==state){stateClock.current={name:state,start:t};}const poseTime=state==="secret"?t-stateClock.current.start:t, speed=activePointer.distanceTo(lastPointer.current);lastPointer.current.lerp(activePointer,.18);
    const holdCenter=holdU.current;
    let nearest=-1,nearestDistance=.29;
    for(let i=0;i<count;i++){
      const u=i/count,target=bladePose(state,u,poseTime,targets.current[i]),phase=transitionMode===0?i:transitionMode===1?count-i:transitionMode===2?Math.abs(i-count/2)*2:(i%2?i:count-i);targets.current[i]=target;
      if(hold>0){const angle=u*Math.PI*2,circular=Math.min(Math.abs(u-holdCenter),1-Math.abs(u-holdCenter)),pull=Math.exp(-circular*circular*72)*hold,global=1+hold*.055;target.position.x*=global;target.position.y*=global;target.position.z+=pull*1.58+Math.sin(angle*4-t*4)*hold*.13;target.scale.x*=1+pull*.34;target.scale.z*=1+pull*.18;target.rotation.y+=pull*.72+Math.sin(angle*2-t)*hold*.08;}
      if(!current.current[i])current.current[i]={p:target.position.clone(),q:new THREE.Quaternion().setFromEuler(target.rotation),s:target.scale.clone()};
      const c=current.current[i],delay=.045+Math.min(.055,phase/count*.045);
      c.p.lerp(target.position,delay);c.q.slerp(tmp.q.setFromEuler(target.rotation),delay);c.s.lerp(target.scale,delay);
      tmp.matrix.compose(c.p,c.q,c.s);body.current.setMatrixAt(i,tmp.matrix);
      tmp.offset.set(0,.026,.363*c.s.z).applyQuaternion(c.q);tmp.p.copy(c.p).add(tmp.offset);tmp.s.set(c.s.x,1,1);tmp.matrix.compose(tmp.p,c.q,tmp.s);edge.current.setMatrixAt(i,tmp.matrix);
      tmp.offset.set(0,-.026,-.363*c.s.z).applyQuaternion(c.q);tmp.p.copy(c.p).add(tmp.offset);tmp.matrix.compose(tmp.p,c.q,tmp.s);edgeBack.current.setMatrixAt(i,tmp.matrix);
      tmp.trailP.copy(c.p).lerp(target.position,-.24);tmp.s.copy(c.s).multiplyScalar(1.015);tmp.matrix.compose(tmp.trailP,c.q,tmp.s);trail.current.setMatrixAt(i,tmp.matrix);
      tmp.projected.copy(c.p);body.current.localToWorld(tmp.projected);tmp.projected.project(camera);const distance=Math.hypot(tmp.projected.x-activePointer.x,tmp.projected.y-activePointer.y);
      if(distance<nearestDistance){nearestDistance=distance;nearest=i;}
    }
    hover.current=nearest;
    if(nearest>=0){let delta=nearest/count-holdU.current;if(delta>.5)delta-=1;if(delta<-.5)delta+=1;holdU.current=(holdU.current+delta*(hold>0?.16:.28)+1)%1;}
    for(let i=0;i<count;i++){
      const delta=nearest<0?count:Math.min(Math.abs(i-nearest),count-Math.abs(i-nearest));
      const circular=Math.min(Math.abs(i/count-holdCenter),1-Math.abs(i/count-holdCenter)),holdLight=hold*Math.exp(-circular*circular*52)*1.55;
      const wave=Math.exp(-delta*delta/38)*effects+holdLight;
      const runner=nearest<0?0:Math.exp(-Math.pow(delta-((t*18+speed*150)%20),2)/12)*.58*effects;
      tmp.color.copy(accent).lerp(accent2,.28+.25*Math.sin(i*.17+t*.35)).multiplyScalar(.34+(wave+runner)*1.38*brightness);
      if(delta<2)tmp.color.lerp(tmp.white,.42);
      edge.current.setColorAt(i,tmp.color);
      edgeBack.current.setColorAt(i,tmp.color);
      tmp.bodyColor.copy(tmp.dark).lerp(accent,.34+.16*Math.sin(i*.09+t*.22)).multiplyScalar((1.04+.2*Math.sin(i*.11+t*.18))*brightness);body.current.setColorAt(i,tmp.bodyColor);
    }
    body.current.instanceMatrix.needsUpdate=true;edge.current.instanceMatrix.needsUpdate=true;edgeBack.current.instanceMatrix.needsUpdate=true;trail.current.instanceMatrix.needsUpdate=true;if(body.current.instanceColor)body.current.instanceColor.needsUpdate=true;if(edge.current.instanceColor)edge.current.instanceColor.needsUpdate=true;if(edgeBack.current.instanceColor)edgeBack.current.instanceColor.needsUpdate=true;
    const ry=THREE.MathUtils.lerp(body.current.rotation.y,pointer.x*.13*effects,.022),rx=THREE.MathUtils.lerp(body.current.rotation.x,-pointer.y*.085*effects,.022);for(const mesh of [body.current,edge.current,edgeBack.current,trail.current]){mesh.rotation.y=ry;mesh.rotation.x=rx;}
  });
  return <group position={[.82,.02,-.18]} scale={[1.3,1.3,1.24]}>
    <instancedMesh ref={trail} args={[null,null,count]} frustumCulled={false}>
      <boxGeometry args={[1,.04,.72]} />
      <meshBasicMaterial color={colors[0]} transparent opacity={.055*effects} depthWrite={false} blending={THREE.AdditiveBlending}/>
    </instancedMesh>
    <instancedMesh ref={body} args={[null,null,count]} frustumCulled={false}>
      <boxGeometry args={[1,.045,.72]} />
      <meshPhysicalMaterial vertexColors color="#ffffff" emissive={colors[0]} emissiveIntensity={.075*effects} metalness={.82} roughness={.2} clearcoat={1} clearcoatRoughness={.08} envMapIntensity={5.4*brightness} />
    </instancedMesh>
    <instancedMesh ref={edge} args={[null,null,count]} frustumCulled={false}>
      <boxGeometry args={[1,.014,.028]} />
      <meshBasicMaterial vertexColors toneMapped={false} transparent opacity={.98} blending={THREE.AdditiveBlending} />
    </instancedMesh>
    <instancedMesh ref={edgeBack} args={[null,null,count]} frustumCulled={false}>
      <boxGeometry args={[1,.014,.028]} />
      <meshBasicMaterial vertexColors toneMapped={false} transparent opacity={.96} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  </group>;
}

function MovingReflections({colors,brightness}){
  const a=useRef(),b=useRef();
  useFrame(({clock,pointer})=>{const t=clock.elapsedTime;if(a.current)a.current.position.set(-3.8+Math.sin(t*.31)*2.2+pointer.x,2.8+Math.cos(t*.23)*1.2,3.5);if(b.current)b.current.position.set(4.2+Math.cos(t*.27)*1.8,-2.1+Math.sin(t*.35)*1.1,2.8);});
  return <><pointLight ref={a} intensity={22*brightness} distance={13} color={colors[0]}/><pointLight ref={b} intensity={18*brightness} distance={12} color={colors[1]}/></>;
}

function Scene({ theme, quality, screen, settingsOpen, secret, transitionKind, brightness, effects, hold, holdPoint, processing }) {
  const colors = THEME_COLORS[theme] || THEME_COLORS.rose;
  const density = quality === "eco" ? 10 : quality === "max" ? 42 : 24;
  const state=secret?"secret":screen;
  return (
    <Canvas
      dpr={processing?[0.62,0.78]:
        quality === "eco"
          ? [0.7, 0.9]
          : quality === "max"
            ? [0.9, 1.1]
            : [0.8, 1]
      }
      camera={{ position: [0, 0, 7.1], fov: 48 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      }}
      onCreated={({gl})=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.56;gl.outputColorSpace=THREE.SRGBColorSpace;}}
    >
      <ambientLight intensity={.74*brightness} color="#9cc7db" />
      <hemisphereLight intensity={1.35*brightness} color="#b9f9ff" groundColor="#082438"/>
      <directionalLight position={[-4,5,5]} intensity={4.1*brightness} color="#d8f9ff" />
      <pointLight position={[5,2,3]} intensity={15*brightness} distance={15} color={colors[1]} />
      <pointLight position={[-5,-2,2]} intensity={12*brightness} distance={13} color={colors[0]} />
      <MovingReflections colors={colors} brightness={brightness}/>
      <Environment resolution={quality==="eco"?64:128}>
        <Lightformer form="rect" intensity={8*brightness} color={colors[0]} scale={[7,2.5,1]} position={[-4,2,2]} rotation-y={Math.PI/2}/>
        <Lightformer form="ring" intensity={7*brightness} color={colors[1]} scale={[5,3,1]} position={[4,-1,1]} rotation-y={-Math.PI/2}/>
        <Lightformer form="circle" intensity={2.5*brightness} color="#dffcff" scale={2} position={[0,5,-2]} rotation-x={Math.PI/2}/>
      </Environment>
      <BladeSculpture state={state} theme={theme} quality={processing&&quality==="max"?"balanced":quality} brightness={brightness} effects={effects} transitionKind={transitionKind} hold={hold} holdPoint={holdPoint} processing={processing}/>
      <Sparkles
        count={processing?Math.max(6,Math.floor(density/2)):density}
        scale={[12, 7, 4]}
        size={1}
        speed={0.13}
        color={colors[0]}
      />
      <InteractionFrameBudget />
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

function Button({ children, quiet = false, danger = false, tip, className = "", onPointerEnter, ...props }) {
  const source=typeof children==="string"?children:null,[decoded,setDecoded]=useState(source),decodeTimer=useRef(0);
  useEffect(()=>{setDecoded(source);return()=>clearInterval(decodeTimer.current);},[source]);
  const decode=(event)=>{
    onPointerEnter?.(event);if(!source||props.disabled)return;
    clearInterval(decodeTimer.current);const chars=Array.from(source),fromLeft=event.clientX-event.currentTarget.getBoundingClientRect().left<event.currentTarget.offsetWidth/2,alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШ";let frame=0;
    decodeTimer.current=setInterval(()=>{frame++;const resolved=Math.ceil(chars.length*Math.min(1,frame/11));setDecoded(chars.map((char,index)=>{if(char===" ")return char;const rank=fromLeft?index:chars.length-1-index;return rank<resolved?char:alphabet[Math.floor(Math.random()*alphabet.length)];}).join(""));if(frame>=11){clearInterval(decodeTimer.current);setDecoded(source);}},30);
  };
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
      onPointerEnter={decode}
      {...props}
    >
      <i />
      <span>{source?decoded:children}</span>
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
          <small>ADAPTIVE RGB24 / v59</small>
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
function CursorEffects({effects}){
  const ref=useRef();
  useEffect(()=>{const move=(event)=>{if(!ref.current)return;ref.current.style.setProperty("--cursor-x",`${event.clientX}px`);ref.current.style.setProperty("--cursor-y",`${event.clientY}px`);ref.current.style.setProperty("--cursor-speed",String(Math.min(1,Math.hypot(event.movementX,event.movementY)/42)));};addEventListener("pointermove",move,{passive:true});return()=>removeEventListener("pointermove",move);},[]);
  return <div ref={ref} className="cursor-effects" style={{"--cursor-effects":effects}} aria-hidden="true"><i/><i/><i/></div>;
}
function BackgroundFlowLines(){
  const ref=useRef();
  useEffect(()=>{const move=(event)=>{if(!ref.current)return;ref.current.style.setProperty("--flow-x",`${(event.clientX/innerWidth-.5)*-16}px`);ref.current.style.setProperty("--flow-y",`${(event.clientY/innerHeight-.5)*-12}px`);};addEventListener("pointermove",move,{passive:true});return()=>removeEventListener("pointermove",move);},[]);
  return <div ref={ref} className="background-flow" aria-hidden="true"><svg viewBox="0 0 1920 1080" preserveAspectRatio="none">
    {Array.from({length:18},(_,i)=><path key={`a${i}`} style={{"--i":i}} d={`M -120 ${160+i*22} C 280 ${20+i*11}, 510 ${390-i*7}, 820 ${245+i*8} S 1360 ${120+i*18}, 2040 ${280+i*16}`}/>)}
    {Array.from({length:14},(_,i)=><path key={`b${i}`} style={{"--i":i}} d={`M ${220+i*18} 1160 C ${260+i*8} 760, ${820-i*19} 920, ${930+i*11} 560 S ${1440+i*17} ${240+i*13}, 2040 ${70+i*9}`}/>)}
  </svg></div>;
}
function CursorParticleField({theme,effects}){
  const canvas=useRef(null),frame=useRef(0),pointer=useRef({x:-9999,y:-9999}),points=useRef([]);
  const colors=THEME_COLORS[theme]||THEME_COLORS.emerald;
  useEffect(()=>{
    const node=canvas.current;if(!node)return;
    const rebuild=()=>{const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,1.25);node.width=Math.round(w*dpr);node.height=Math.round(h*dpr);node.style.width=`${w}px`;node.style.height=`${h}px`;const count=Math.max(54,Math.min(110,Math.round(w*h/21000)));let seed=0x51f15e;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};points.current=Array.from({length:count},()=>({x:random()*w,y:random()*h,r:.45+random()*.85,phase:random()*6.28}));draw();};
    const draw=()=>{frame.current=0;const ctx=node.getContext("2d",{alpha:true,desynchronized:true});if(!ctx)return;const dpr=node.width/Math.max(1,innerWidth);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,innerWidth,innerHeight);const p=pointer.current;for(const dot of points.current){const dx=dot.x-p.x,dy=dot.y-p.y,d=Math.hypot(dx,dy),influence=Math.max(0,1-d/190),push=influence*influence*34,inv=d?1/d:0,x=dot.x+dx*inv*push,y=dot.y+dy*inv*push;ctx.globalAlpha=(.11+influence*.58)*Math.min(1,effects);ctx.fillStyle=influence>.35?colors[1]:colors[0];ctx.shadowColor=colors[0];ctx.shadowBlur=influence*9;ctx.beginPath();ctx.arc(x,y,dot.r+influence*1.25,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;};
    const queue=()=>{if(!frame.current)frame.current=requestAnimationFrame(draw);};
    const move=(event)=>{pointer.current={x:event.clientX,y:event.clientY};queue();};
    rebuild();addEventListener("resize",rebuild);addEventListener("pointermove",move,{passive:true});return()=>{cancelAnimationFrame(frame.current);removeEventListener("resize",rebuild);removeEventListener("pointermove",move);};
  },[colors,effects]);
  return <canvas ref={canvas} className="cursor-particle-field" aria-hidden="true"/>;
}
function HoldSpace({progress,point}){
  return <div className={`hold-space ${progress>.01?"active":""}`} style={{"--hold":progress,"--hold-x":`${point.x}px`,"--hold-y":`${point.y}px`}} aria-hidden="true">
    <div className="hold-cursor"><i/><i/><i/><b>{Math.round(progress*100).toString().padStart(2,"0")}</b></div>
    <div className="hold-space-waves">{Array.from({length:5},(_,i)=><i key={i} style={{"--i":i}}/>)}</div>
  </div>;
}
function SettingsPanel({
  open,
  setOpen,
  theme,
  setTheme,
  quality,
  setQuality,
  brightness,
  setBrightness,
  effects,
  setEffects,
  performanceMode,
  setPerformanceMode,
  hardwareThreads,
  backend,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          className="settings-panel"
          data-no-hold
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: .14 }}
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
                style={{ "--swatch": color, "--swatch2": THEME_COLORS[id][1] }}
              >
                <i />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <p>Свет и оптическое стекло</p>
          <label className="setting-range"><span>ЯРКОСТЬ</span><b>{Math.round(brightness*100)}%</b><input type="range" min=".55" max="1.4" step=".01" value={brightness} onChange={(e)=>setBrightness(Number(e.target.value))}/></label>
          <label className="setting-range"><span>ЭФФЕКТЫ</span><b>{Math.round(effects*100)}%</b><input type="range" min="0" max="1.35" step=".01" value={effects} onChange={(e)=>setEffects(Number(e.target.value))}/></label>
          <p>Качество 3D-сцены</p>
          <div className="quality-switch">
            {[
              ["eco", "ЛЁГКОЕ"],
              ["balanced", "БАЛАНС"],
              ["max", "ПОЛНОЕ"],
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
          <p>Нагрузка на железо</p>
          <button className={`auto-hardware ${performanceMode==="balanced"?"active":""}`} onClick={()=>{setPerformanceMode("balanced");backend?.setPerformanceMode?.("balanced");}}><Cpu/><span><b>АВТОМАТИЧЕСКАЯ НАГРУЗКА</b><small>AUTO · {hardwareThreads||"—"} ПОТОКОВ</small></span></button>
          <div className="quality-switch hardware-switch">
            <button className={performanceMode==="eco"?"active":""} onClick={()=>{setPerformanceMode("eco");backend?.setPerformanceMode?.("eco");}}>ТИХИЙ</button>
            <button className={performanceMode==="max"?"active":""} onClick={()=>{setPerformanceMode("max");backend?.setPerformanceMode?.("max");}}>МАКСИМУМ</button>
          </div>
          <small className="settings-note">Цвет управляет UI, металлом и отражениями. Сравнение показывает реальные пиксели PNG.</small>
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
          <em><DecodeText>ТЕКСТУР</DecodeText></em>
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
          <div><small>BATCH</small><strong>PARALLEL QUEUE</strong><b>03</b></div>
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
      <Hint text="Плавный масштаб от «Вписать» до 800%">
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

const SmoothCompareViewport = React.memo(function SmoothCompareViewport({ before, after, previewBefore, previewAfter, mode, onZoom, contentReady=true, externalLoading=false }) {
  const host = useRef(null), canvas = useRef(null), frame = useRef(0), drag = useRef(null);
  const [previewLoading,setPreviewLoading]=useState(false);
  const [detailState,setDetailState]=useState("preview");
  const images = useRef({ before: null, after: null, fullBefore:null, fullAfter:null });
  const interactionTimer=useRef(0),detailTimer=useRef(0),interaction=useRef(false),detailRequest=useRef(()=>{}),wakeRef=useRef(()=>{}),detailBlobs=useRef({});
  const target = useRef({ s: 1, x: 0, y: 0, split: 0.5 });
  const current = useRef({ s: 1, x: 0, y: 0, split: 0.5 });
  const alive = useRef(true), loaded = useRef(false), modeRef = useRef(mode);
  const setInteraction=useCallback((active,delay=0)=>{
    clearTimeout(interactionTimer.current);
    if(active){interaction.current=true;window.__AGR_INTERACTION_PAUSE_COUNT__=(window.__AGR_INTERACTION_PAUSE_COUNT__||0)+1;dispatchEvent(new CustomEvent("agr-drag",{detail:true}));}
    else if(delay)interactionTimer.current=setTimeout(()=>{interaction.current=false;dispatchEvent(new CustomEvent("agr-drag",{detail:false}));wakeRef.current();detailRequest.current();},delay);
    else{interaction.current=false;dispatchEvent(new CustomEvent("agr-drag",{detail:false}));wakeRef.current();detailRequest.current();}
  },[]);
  const clampView=useCallback((view)=>{
    const node=host.current,rect=node?.getBoundingClientRect();
    if(!rect?.width||!rect?.height)return {...view,x:0,y:0};
    const paneWidth=modeRef.current==="pan"&&images.current.before&&images.current.after?rect.width/2:rect.width;
    let maxX=Infinity,maxY=Infinity,found=false;
    for(const img of [images.current.before,images.current.after]){
      const iw=img?.naturalWidth||img?.width,ih=img?.naturalHeight||img?.height;
      if(!iw||!ih)continue;found=true;
      const fit=Math.min(paneWidth/iw,rect.height/ih);
      maxX=Math.min(maxX,Math.max(0,(iw*fit*view.s-paneWidth)/2));
      maxY=Math.min(maxY,Math.max(0,(ih*fit*view.s-rect.height)/2));
    }
    if(!found){maxX=0;maxY=0;}
    const x=Math.max(-maxX,Math.min(maxX,view.x)),y=Math.max(-maxY,Math.min(maxY,view.y));
    if(Math.abs(x-view.x)>.01||Math.abs(y-view.y)>.01)window.__AGR_PAN_CLAMPED__=true;
    return {...view,x,y};
  },[]);

  const render = useCallback(() => {
    frame.current = 0;
    const node = host.current, out = canvas.current;
    if (!node || !out || !loaded.current) return;
    const rect = node.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
    if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
    const ctx = out.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;
    const c = current.current, t = clampView(target.current);target.current=t;
    c.s += (t.s - c.s) * .19; c.x += (t.x - c.x) * .19; c.y += (t.y - c.y) * .19; c.split += (t.split - c.split) * .22;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,out.width,out.height);ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const detailed=!interaction.current&&c.s>=DETAIL_ZOOM;
    const beforeImage=detailed&&images.current.fullBefore?images.current.fullBefore:images.current.before;
    const afterImage=detailed&&images.current.fullAfter?images.current.fullAfter:images.current.after;
    const draw = (img, x0, width) => {
      const iw=img?.fullWidth||img?.naturalWidth||img?.width,ih=img?.fullHeight||img?.naturalHeight||img?.height;
      if (!iw || !ih || width <= 0) return;
      ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, width, rect.height); ctx.clip();
      const fitW = modeRef.current === "pan"&&images.current.before&&images.current.after ? rect.width / 2 : rect.width;
      const fit = Math.min(fitW / iw, rect.height / ih);
      const scale = fit * c.s, dw = iw * scale, dh = ih * scale;
      const cx = modeRef.current === "pan" ? x0 + width / 2 : rect.width / 2;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = c.s > 8 ? "medium" : "high";
      const dx=cx-dw/2+c.x,dy=rect.height/2-dh/2+c.y;
      if(img.bitmap)ctx.drawImage(img.bitmap,dx+img.tileX*scale,dy+img.tileY*scale,img.tileWidth*scale,img.tileHeight*scale);
      else ctx.drawImage(img,dx,dy,dw,dh);ctx.restore();
    };
    if (modeRef.current === "wipe") {
      const cut = rect.width * c.split; draw(beforeImage, 0, rect.width); draw(afterImage, 0, cut);
      ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(cut - .5, 0, 1, rect.height);
    } else if(images.current.before&&images.current.after){
      draw(beforeImage, 0, rect.width / 2); draw(afterImage, rect.width / 2, rect.width / 2);
    }else{
      draw(beforeImage||afterImage,0,rect.width);
    }
    const moving = Math.abs(t.s-c.s) > .001 || Math.abs(t.x-c.x) > .08 || Math.abs(t.y-c.y) > .08 || Math.abs(t.split-c.split) > .001;
    if (moving && alive.current) frame.current = requestAnimationFrame(render);
  }, [clampView]);
  const wake = useCallback(() => { if (!frame.current) frame.current = requestAnimationFrame(render); }, [render]);
  wakeRef.current=wake;
  const reset = useCallback((scale = 1) => {
    const safeScale=Math.max(1,Math.min(MAX_ZOOM,Number(scale)||1));
    target.current = clampView({ ...target.current, s: safeScale, x: 0, y: 0 });
    clearTimeout(detailTimer.current);
    if(safeScale>=DETAIL_ZOOM){setDetailState("loading");detailTimer.current=setTimeout(()=>detailRequest.current(),260);}
    else{setDetailState("preview");for(const key of ["fullBefore","fullAfter"]){images.current[key]?.bitmap?.close?.();images.current[key]?.close?.();images.current[key]=null;}}
    onZoom?.(safeScale);window.__AGR_ZOOM_TARGET__=safeScale;window.__AGR_ZOOM_BUTTON_SCALE__=safeScale;wake();
  }, [onZoom, wake,clampView]);
  useEffect(() => { modeRef.current = mode; target.current=clampView({...target.current,x:0,y:0});clearTimeout(detailTimer.current);if(target.current.s>=DETAIL_ZOOM){setDetailState("loading");detailTimer.current=setTimeout(()=>detailRequest.current(),260);}wake(); }, [mode, wake,clampView]);
  useEffect(() => {
    alive.current = true; loaded.current = false;
    let cancelled = false;const controller=new AbortController();
    const release=()=>{const unique=new Set(Object.values(images.current));for(const image of unique){image?.bitmap?.close?.();image?.close?.();}for(const detail of Object.values(detailBlobs.current)){if(detail?.image)detail.image.src="";}images.current={before:null,after:null,fullBefore:null,fullAfter:null};detailBlobs.current={};loaded.current=false;setDetailState("preview");if(canvas.current){canvas.current.width=1;canvas.current.height=1;}};
    release();
    if(!contentReady||externalLoading){setPreviewLoading(true);return()=>{alive.current=false;};}
    setPreviewLoading(Boolean(before||after));
    const load = async(src)=>{
      if(!src)return null;
      // Chromium's Fetch API rejects qrc:/ resources and logs that rejection as
      // a fatal console error. The native Image decoder supports qrc directly.
      if(src.startsWith("qrc:"))return await new Promise((resolve)=>{const img=new Image();img.decoding="async";img.onload=()=>resolve(img.naturalWidth?img:null);img.onerror=()=>resolve(null);img.src=src;});
      try{const response=await fetch(src,{signal:controller.signal});const blob=await response.blob();if(!blob.size)throw new Error("empty image");return await createImageBitmap(blob,{colorSpaceConversion:"default",premultiplyAlpha:"default"});}
      catch{if(cancelled)return null;return await new Promise((resolve)=>{const img=new Image();img.decoding="async";img.onload=()=>resolve(img.naturalWidth?img:null);img.onerror=()=>resolve(null);img.src=src;});}
    };
    const lowBefore=previewBefore||before||(HEADLESS_TEST?TEST_TEXTURE:"");
    const lowAfter=previewAfter||after||(HEADLESS_TEST?TEST_TEXTURE:"");
    Promise.all([load(lowBefore), load(lowAfter)]).then(([a,b]) => {
      if (cancelled){a?.close?.();b?.close?.();return;} images.current = { before: a, after: b }; loaded.current = Boolean(a || b);setPreviewLoading(false);reset();
    });
    const detailSource=async(key,src)=>{
      const cached=detailBlobs.current[key];if(cached?.src===src)return cached;
      try{
        // HTTP/blob sources can be cropped from their bytes without keeping a
        // second full bitmap alive.
        if(src.startsWith("http:")||src.startsWith("https:")||src.startsWith("blob:")){
          const response=await fetch(src,{signal:controller.signal});const blob=await response.blob();if(blob.size<24)throw new Error("invalid PNG");
          const header=await blob.slice(16,24).arrayBuffer(),view=new DataView(header),meta={src,blob,width:view.getUint32(0),height:view.getUint32(4)};detailBlobs.current[key]=meta;return meta;
        }
      }catch(error){if(cancelled||error?.name==="AbortError")throw error;}
      // Qt WebEngine displays texture:// and qrc:/ URLs in <img>, but Fetch
      // can reject those custom schemes. Decode through the native image path
      // and then create only the visible 800% crop.
      const image=await new Promise((resolve,reject)=>{const value=new Image();value.decoding="async";value.onload=()=>value.naturalWidth?resolve(value):reject(new Error("empty image"));value.onerror=()=>reject(new Error("full image decode failed"));value.src=src;});
      const meta={src,image,width:image.naturalWidth,height:image.naturalHeight};detailBlobs.current[key]=meta;return meta;
    };
    const cropFor=(meta,key)=>{
      const rect=host.current?.getBoundingClientRect();if(!rect?.width||!rect?.height)return null;
      const pan=modeRef.current==="pan"&&images.current.before&&images.current.after,paneWidth=pan?rect.width/2:rect.width,x0=pan&&key==="fullAfter"?rect.width/2:0;
      const fit=Math.min(paneWidth/meta.width,rect.height/meta.height),scale=fit*target.current.s,cx=pan?x0+paneWidth/2:rect.width/2,dx=cx-meta.width*scale/2+target.current.x,dy=rect.height/2-meta.height*scale/2+target.current.y;
      const margin=Math.max(96,Math.round(Math.max(paneWidth,rect.height)/Math.max(scale,.0001)*.12));
      const sx=Math.max(0,Math.floor((x0-dx)/scale)-margin),sy=Math.max(0,Math.floor(-dy/scale)-margin),ex=Math.min(meta.width,Math.ceil((x0+paneWidth-dx)/scale)+margin),ey=Math.min(meta.height,Math.ceil((rect.height-dy)/scale)+margin);
      return {x:sx,y:sy,width:Math.max(1,ex-sx),height:Math.max(1,ey-sy),key:`${sx}:${sy}:${ex}:${ey}:${target.current.s.toFixed(3)}`};
    };
    let detailBusy=false,detailPending=false;
    detailRequest.current=async()=>{
      if(detailBusy){detailPending=true;return;}
      if(cancelled||interaction.current||target.current.s<DETAIL_ZOOM)return;
      setDetailState("loading");
      detailBusy=true;
      const fullBeforeSource=before||(HEADLESS_TEST?TEST_FULL_TEXTURE:"");
      const fullAfterSource=after||(HEADLESS_TEST?TEST_FULL_TEXTURE:"");
      const pairs=[["fullBefore",fullBeforeSource,lowBefore],["fullAfter",fullAfterSource,lowAfter]];
      let loadedDetail=0,failedDetail=0,expectedDetail=0;
      for(const [key,src,low] of pairs){
        if(cancelled)break;
        if(!src)continue;
        expectedDetail++;
        if(src===low){loadedDetail++;continue;}
        try{
          const meta=await detailSource(key,src),crop=cropFor(meta,key);if(!crop)continue;
          if(images.current[key]?.key===crop.key){loadedDetail++;continue;}
          const bitmap=await createImageBitmap(meta.blob||meta.image,crop.x,crop.y,crop.width,crop.height,{colorSpaceConversion:"default",premultiplyAlpha:"default"});
          if(cancelled||interaction.current){bitmap.close();continue;}
          images.current[key]?.bitmap?.close?.();images.current[key]={bitmap,fullWidth:meta.width,fullHeight:meta.height,tileX:crop.x,tileY:crop.y,tileWidth:crop.width,tileHeight:crop.height,key:crop.key};wake();
          loadedDetail++;
          // Only a visible source tile reaches the GPU. Two full 8K bitmaps
          // are never resident at the same time.
          await new Promise(resolve=>setTimeout(resolve,48));
        }catch{failedDetail++;if(cancelled)break;}
      }
      detailBusy=false;
      if(!cancelled){const ready=expectedDetail>0&&loadedDetail===expectedDetail;setDetailState(ready?"ready":failedDetail?"fallback":"preview");if(ready)window.__AGR_FULL_DETAIL_READY__=(window.__AGR_FULL_DETAIL_READY__||0)+1;}
      if(detailPending&&!cancelled){detailPending=false;setTimeout(()=>detailRequest.current(),0);}
    };
    return () => { cancelled = true;controller.abort();alive.current = false; cancelAnimationFrame(frame.current); frame.current = 0;clearTimeout(interactionTimer.current);clearTimeout(detailTimer.current);interaction.current=false;dispatchEvent(new CustomEvent("agr-drag",{detail:false}));detailRequest.current=()=>{};release(); };
  }, [before, after, previewBefore, previewAfter, contentReady, externalLoading, reset, wake]);
  useEffect(() => {
    const observer = new ResizeObserver(()=>{target.current=clampView(target.current);wake();}); if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, [wake,clampView]);
  const zoom = useCallback((factor, ox = 0, oy = 0) => {
    const t = target.current, s = Math.max(1, Math.min(MAX_ZOOM, t.s * factor)), ratio = s / t.s;
    const raw={...t,s,x:ox-(ox-t.x)*ratio,y:oy-(oy-t.y)*ratio},next=clampView(raw);
    if(Math.abs(next.x-raw.x)<.001&&Math.abs(next.y-raw.y)<.001)window.__AGR_ZOOM_ANCHOR_ERROR__=Math.hypot((ox-next.x)/s-(ox-t.x)/t.s,(oy-next.y)/s-(oy-t.y)/t.s);
    target.current=next;clearTimeout(detailTimer.current);
    if(s>=DETAIL_ZOOM){setDetailState("loading");detailTimer.current=setTimeout(()=>detailRequest.current(),260);}
    else{setDetailState("preview");if(s<1.35){for(const key of ["fullBefore","fullAfter"]){images.current[key]?.bitmap?.close?.();images.current[key]?.close?.();images.current[key]=null;}detailBlobs.current={};}}
    onZoom?.(s); window.__AGR_ZOOM_TARGET__ = s; wake();
  }, [onZoom, wake,clampView]);
  useEffect(() => {
    const node = host.current; if (!node) return;
    const wheel = (e) => { e.preventDefault();setInteraction(true);setInteraction(false,140); window.__AGR_WHEEL_COUNT__ = (window.__AGR_WHEEL_COUNT__ || 0) + 1; const r=node.getBoundingClientRect(),localX=e.clientX-r.left,paneCenter=modeRef.current==="pan"?(localX<r.width/2?r.width*.25:r.width*.75):r.width*.5; zoom(Math.exp(Math.max(-.14, Math.min(.14, -e.deltaY*.0012))), localX-paneCenter, e.clientY-r.top-r.height/2); };
    node.addEventListener("wheel", wheel, { passive: false }); return () => node.removeEventListener("wheel", wheel);
  }, [setInteraction,zoom]);
  useEffect(() => {
    if (!HEADLESS_TEST) return;
    const z = e => { window.__AGR_WHEEL_COUNT__ = (window.__AGR_WHEEL_COUNT__ || 0) + 1; zoom(Number(e.detail?.factor || 1.1)); };
    const d = e => { target.current=clampView({...target.current,x:target.current.x+Number(e.detail?.x||0),y:target.current.y+Number(e.detail?.y||0)}); window.__AGR_TEST_VERTICAL_Y__=target.current.y; wake(); };
    addEventListener("agr-test-zoom", z); addEventListener("agr-test-drag", d); return () => { removeEventListener("agr-test-zoom", z); removeEventListener("agr-test-drag", d); };
  }, [wake, zoom,clampView]);
  return <div ref={host} className="smooth-compare" onPointerDown={(e) => {
    if(e.target.closest?.("button"))return;
    const r=host.current.getBoundingClientRect(), near=mode==="wipe" && Math.abs(e.clientX-r.left-r.width*target.current.split)<34;
    drag.current={ px:e.clientX, py:e.clientY, x:target.current.x, y:target.current.y, wipe:near }; e.currentTarget.setPointerCapture(e.pointerId);setInteraction(true);
  }} onPointerMove={(e) => {
    if (!drag.current) return; const r=host.current.getBoundingClientRect();
    if (drag.current.wipe) target.current.split=Math.max(.02,Math.min(.98,(e.clientX-r.left)/r.width));
    else { target.current=clampView({...target.current,x:drag.current.x+e.clientX-drag.current.px,y:drag.current.y+e.clientY-drag.current.py}); }
    wake();
  }} onPointerUp={() => { drag.current=null;setInteraction(false); }} onPointerCancel={() => { drag.current=null;setInteraction(false); }}>
    <canvas ref={canvas} />
    {previewLoading&&<div className="compare-loader"><i/><strong>{contentReady?"ЗАГРУЖАЕМ ИЗОБРАЖЕНИЕ":"ПЕРЕХОД"}</strong><span>Интерфейс продолжает работать</span></div>}
    {!previewLoading&&detailState==="loading"&&<div className="detail-loader"><i/><span>FULL 1:1 · ПОДГРУЖАЕМ ВИДИМЫЙ ФРАГМЕНТ</span></div>}
    {before&&<span className="compare-label before">ОРИГИНАЛ {detailState==="ready"&&target.current.s>=DETAIL_ZOOM?"· FULL":""}</span>}{after&&<span className="compare-label after">РЕЗУЛЬТАТ {detailState==="ready"&&target.current.s>=DETAIL_ZOOM?"· FULL":""}</span>}
    <div className="viewport-actions" onPointerDown={(e)=>e.stopPropagation()}><button type="button" onClick={(e)=>{e.stopPropagation();reset(1)}}>ВПИСАТЬ</button><button type="button" onClick={(e)=>{e.stopPropagation();reset(4)}}>400%</button><button type="button" onClick={(e)=>{e.stopPropagation();reset(8)}}>800%</button></div>
  </div>;
});

const ComparisonSurface = React.memo(function ComparisonSurface({
  before,
  after,
  previewBefore,
  previewAfter,
  focus,
  onFocus,
  allowWipe = false,
  onOpenFolder,
  contentReady = true,
  loading = false,
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
      <SmoothCompareViewport before={before} after={after} previewBefore={previewBefore} previewAfter={previewAfter} mode={mode} onZoom={updateZoomLabel} contentReady={contentReady} externalLoading={loading} />
      <div className="comparison-truth">
        <span>ОРИГИНАЛ · ПРЕВЬЮ 100–400% · FULL 1:1 НА 800%</span>
        <span>РЕЗУЛЬТАТ · ПРЕВЬЮ 100–400% · FULL 1:1 НА 800%</span>
      </div>
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

function ImportWindow({ active, progress = 0, status, batch = false, onGame }) {
  const value=Math.max(0,Math.min(1,Number(progress||0)));
  return <AnimatePresence>
    {active&&<motion.section className="image-load-window" initial={{opacity:0,scale:.97}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.985}} transition={{duration:.32,ease:[.18,.72,.2,1]}}>
      <div className="image-load-visual"><i/><i/><i/><b>{Math.round(value*100).toString().padStart(2,"0")}</b></div>
      <div className="image-load-copy"><small>{batch?"BATCH IMAGE PIPELINE":"NPM IMAGE PIPELINE"}</small><h2>ЗАГРУЖАЕМ ИЗОБРАЖЕНИЕ</h2><p>{status||"Читаем PNG и создаём безопасное превью"}</p><FluidProgress value={value}/><span>Окно не зависло — декодирование выполняется отдельно от интерфейса</span></div>
      <Button quiet onClick={onGame}><Gamepad2/> ОТКРЫТЬ BLADE GRID</Button>
    </motion.section>}
  </AnimatePresence>;
}

const BATCH_ROW_HEIGHT=194;
const VirtualBatchList=React.memo(function VirtualBatchList({items,state,backend,setScreen}){
  const node=useRef(null),scrollFrame=useRef(0),[viewport,setViewport]=useState({top:0,height:720});
  const measure=useCallback(()=>{scrollFrame.current=0;const target=node.current;if(target)setViewport({top:target.scrollTop,height:target.clientHeight||720});},[]);
  useEffect(()=>{const observer=new ResizeObserver(measure);if(node.current)observer.observe(node.current);measure();return()=>{observer.disconnect();cancelAnimationFrame(scrollFrame.current);};},[measure]);
  const onScroll=()=>{if(!scrollFrame.current)scrollFrame.current=requestAnimationFrame(measure);};
  const start=Math.max(0,Math.floor(viewport.top/BATCH_ROW_HEIGHT)-2),end=Math.min(items.length,Math.ceil((viewport.top+viewport.height)/BATCH_ROW_HEIGHT)+3);
  return <section ref={node} className="batch-list virtual-batch-list" onScroll={onScroll}>
    {!items.length&&<div className="empty"><Plus/><h2>Добавьте PNG-файлы</h2><p>Здесь появятся лёгкие превью до и после.</p></div>}
    {!!items.length&&<div className="batch-virtual-spacer" style={{height:items.length*BATCH_ROW_HEIGHT}}>
      {items.slice(start,end).map((item,offset)=>{const i=start+offset;return <article className={`batch-row virtualized ${item.importing?"is-importing":""} ${item.failed?"has-error":""}`} style={{top:i*BATCH_ROW_HEIGHT}} key={item.sourceUrl||i}>
        <Button className="remove-file" quiet danger disabled={state.batchBusy||state.batchImportBusy} tip={`Удалить ${item.name} из очереди`} aria-label={`Удалить ${item.name}`} onClick={()=>backend?.removeBatchItem(i)}><X/></Button>
        <div className="thumb">{item.importing?<div className="preview-loader"><i/><span>ПОДГОТОВКА</span></div>:<img loading="lazy" decoding="async" draggable="false" src={item.thumbnailSourceUrl||item.comparisonSourceUrl||item.sourceUrl}/>}<span>BEFORE</span></div>
        <div className="thumb">{item.resultUrl?<img loading="lazy" decoding="async" draggable="false" src={item.thumbnailResultUrl||item.comparisonResultUrl||item.resultUrl}/>:<p>AFTER<br/>ожидает</p>}<span>AFTER</span></div>
        <div className="file-data"><h3>{item.name}</h3><p>{item.width?`${item.width} × ${item.height} · `:""}{mb(item.sourceMb)} {item.done&&`→ ${mb(item.outputMb)}`}</p><FluidProgress value={item.progress||0}/><ProcessSignal compact progress={item.progress||(item.done?1:0)} status={item.status||item.report}/><div><Button disabled={!item.done} onClick={()=>setScreen(`compare:${i}`)}>СРАВНИТЕЛЬНЫЙ АНАЛИЗ</Button><Button quiet disabled={!item.done} onClick={()=>backend?.openBatchOutput(i)}>ПАПКА</Button></div></div>
      </article>;})}
    </div>}
  </section>;
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
            {batch ? "BATCH / ADAPTIVE NATIVE" : "НПМ / TARGET ≤ 3 MB"}
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
            disabled={batch ? state.batchBusy || state.batchImportBusy : state.busy || state.previewBusy}
            tip={batch ? "Выбрать несколько PNG" : "Выбрать PNG"}
            onClick={() =>
              batch ? backend?.chooseBatchFiles() : backend?.chooseNpmFile()
            }
          >
            {batch ? "ДОБАВИТЬ PNG" : "ИМПОРТ PNG"}
          </Button>
        </div>
      </div>
      {!batch&&<section className="npm-command-top">
        <ProcessSignal progress={state.progress} status={state.status || state.report} />
        <Button danger={state.busy} disabled={state.previewBusy||(!state.sourceUrl&&!state.busy)} onClick={()=>state.busy?backend?.stopCurrent():backend?.optimize(2.99)}>{state.busy?"ОСТАНОВИТЬ":"ОПТИМИЗИРОВАТЬ ДО 3 MB"}</Button>
        <Button quiet disabled={!state.outputPath} onClick={()=>backend?.openOutputFolder()}><FolderOpen/> ПАПКА</Button>
      </section>}
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
              disabled={state.batchImportBusy || (!items.some((item) => !item.done && !item.failed && !item.importing) && !state.batchBusy)}
              tip={
                state.batchBusy
                  ? "Остановить после безопасного шага"
                  : "Обработать только новые PNG"
              }
              onClick={() =>
                state.batchBusy
                  ? backend?.stopBatch()
                  : backend?.optimizeBatch()
              }
            >
              {state.batchBusy ? "ОСТАНОВИТЬ" : "ОПТИМИЗИРОВАТЬ НОВЫЕ"}
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
          <VirtualBatchList items={items} state={state} backend={backend} setScreen={setScreen}/>
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
          <ComparisonSurface
            before={before}
            after={state.resultUrl}
            previewBefore={state.workingPreviewUrl}
            previewAfter={state.resultUrl}
            focus={focus}
            onFocus={toggleFocus}
            contentReady={contentReady}
            loading={state.previewBusy}
            allowWipe
          />
        </>
      )}
      <ImportWindow
        active={batch?state.batchImportBusy:state.previewBusy}
        progress={batch?state.batchImportProgress:state.previewProgress}
        status={batch?state.batchImportStatus:state.status}
        batch={batch}
        onGame={()=>setScreen("game")}
      />
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
          <small>DEEP ANALYSIS · RGB24</small>
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
        previewBefore={item.comparisonSourceUrl}
        previewAfter={item.comparisonResultUrl}
        focus={focus}
        onFocus={toggleFocus}
        allowWipe
        onOpenFolder={openFolder}
        contentReady={contentReady}
      />
    </main>
  );
}

function JourneyTransition({ journey }) {
  const paths={
    npm:"M 720 560 C 940 520 1110 390 1320 285 C 1510 190 1690 235 1840 180",
    batch:"M 720 560 C 930 600 1090 735 1305 805 C 1510 870 1690 810 1840 900",
    cross:"M 1840 180 C 1500 260 1220 440 720 560 C 1210 690 1510 820 1840 900",
  };
  const selected=paths[journey.path]||paths.npm;
  return <AnimatePresence>
    {journey.active&&<motion.div className={`journey path-${journey.path}`} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.25}} aria-hidden="true">
      <svg viewBox="0 0 1920 1080" preserveAspectRatio="none">
        <path className="journey-branch muted" d={paths.npm}/><path className="journey-branch muted" d={paths.batch}/>
        <motion.path className="journey-branch selected" d={selected} initial={{pathLength:0,opacity:.2}} animate={{pathLength:1,opacity:1}} transition={{duration:1.3,ease:[.2,.72,.18,1]}} />
        <circle r="7" className="journey-node"><animateMotion dur="1.3s" fill="freeze" path={selected} keyPoints={journey.reverse?"1;0":"0;1"} keyTimes="0;1" calcMode="linear" /></circle>
      </svg>
      <div><small>ACTIVE ROUTE</small><strong>{journey.label}</strong><span>ПЕРЕМЕЩЕНИЕ ПО ПОТОКУ</span></div>
    </motion.div>}
  </AnimatePresence>;
}
function SecretScene({ active, onDone }) {
  const [title,setTitle]=useState("ISSMAKER");
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(onDone, 6800);
    return () => clearTimeout(t);
  }, [active, onDone]);
  useEffect(()=>{if(!active){setTitle("ISSMAKER");return;}const source="ISSMAKER",alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",start=performance.now();const timer=setInterval(()=>{const elapsed=performance.now()-start,resolved=Math.floor(Math.max(0,elapsed-420)/105);setTitle(Array.from(source).map((char,index)=>index<resolved?char:alphabet[Math.floor(Math.random()*alphabet.length)]).join(""));if(resolved>=source.length){clearInterval(timer);setTitle(source);}},42);return()=>clearInterval(timer);},[active]);
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="secret-scene"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="secret-veil"/>
          <div className="secret-waves">{Array.from({length:14},(_,i)=><i key={i} style={{"--size":`${130+i*52}px`,"--rotation":`${19+i*4}deg`,"--delay":`${i*-.16}s`}}/>)}</div>
          <div className="secret-title"><small>AUTHOR SEQUENCE</small><b>{title}</b><span>RGB24 · SIGNATURE VERIFIED</span></div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function IntroSequence({active,onSkip}){
  return <AnimatePresence>
    {active&&<motion.div className="intro-sequence" initial={{opacity:1}} exit={{opacity:0,filter:"blur(16px)",scale:1.035}} transition={{duration:.72,ease:[.18,.72,.2,1]}}>
      <div className="intro-grid"/>
      <div className="intro-blades">{Array.from({length:34},(_,i)=><i key={i} style={{"--i":i}}/>)}</div>
      <div className="intro-iris"><i/><i/><i/></div>
      <motion.div className="intro-copy" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{delay:.55,duration:.8}}><small>ADAPTIVE TEXTURE SYSTEM</small><strong>RGB24</strong><span>VISUAL CORE · v59</span></motion.div>
      <div className="intro-progress"><i/><span>INITIALIZING OPTICAL PIPELINE</span></div>
      <button onClick={onSkip}>ПРОПУСТИТЬ</button>
    </motion.div>}
  </AnimatePresence>;
}

function App() {
  const { backend, state } = useBackend(),
    appRoot = useRef(null),
    [route, setRoute] = useState("home"),
    [shapeState,setShapeState]=useState("home"),
    [transitionKind,setTransitionKind]=useState("home>home"),
    [hold,setHold]=useState(0),
    [holdPoint,setHoldPoint]=useState({x:innerWidth/2,y:innerHeight/2}),
    [diving, setDiving] = useState(false),
    [revealing,setRevealing]=useState(false),
    [intro,setIntro]=useState(()=>!HEADLESS_TEST),
    [contentReady, setContentReady] = useState(true),
    [settings, setSettings] = useState(false),
    [theme, setTheme] = useState(() =>
      readPreference("agr-theme", Object.keys(THEME_COLORS), "emerald"),
    ),
    [quality, setQuality] = useState(() =>
      readPreference("agr-quality", QUALITY_LEVELS, "balanced"),
    ),
    [brightness,setBrightness]=useState(()=>readNumberPreference("agr-brightness",1.32,.55,1.4)),
    [effects,setEffects]=useState(()=>readNumberPreference("agr-effects",1.25,0,1.35)),
    [performanceMode,setPerformanceMode]=useState(()=>readPreference("agr-performance",QUALITY_LEVELS,"balanced")),
    [secret, setSecret] = useState(false),
    holdRef=useRef({value:0}),
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
          setShapeState(next.startsWith("compare")?"compare":next);
          setContentReady(true);
          return;
        }
        const nextScreen=next.startsWith("compare")?"compare":next;
        setRevealing(false);
        setDiving(true);
        setContentReady(false);
        setSettings(false);
        dispatchEvent(new CustomEvent("agr-hint", { detail: { open: false } }));
        routeTimers.current = [
          setTimeout(() => {
            setTransitionKind(`${shapeState}>${nextScreen}`);
            setShapeState(nextScreen);
          }, 320),
          setTimeout(() => {
            setRoute(next);
          }, 880),
          setTimeout(() => {
            setDiving(false);setRevealing(true);
            setContentReady(true);
          }, 1450),
          setTimeout(()=>setRevealing(false),2150),
        ];
      },
      [route, screen,shapeState],
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
  useEffect(()=>{
    if(!intro)return undefined;
    const finish=()=>{setIntro(false);setRevealing(true);setTimeout(()=>setRevealing(false),820);};
    const timer=setTimeout(finish,3600);return()=>clearTimeout(timer);
  },[intro]);
  useEffect(() => writePreference("agr-theme", theme), [theme]);
  useEffect(() => writePreference("agr-quality", quality), [quality]);
  useEffect(() => writePreference("agr-brightness", brightness), [brightness]);
  useEffect(() => writePreference("agr-effects", effects), [effects]);
  useEffect(() => writePreference("agr-performance", performanceMode), [performanceMode]);
  useEffect(()=>{if(localStorage.getItem("agr-v56-visual-defaults"))return;setTheme("emerald");setBrightness(1.32);setEffects(1.25);localStorage.setItem("agr-v56-visual-defaults","1");},[]);
  useEffect(() => {backend?.setPerformanceMode?.(performanceMode);}, [backend,performanceMode]);
  useEffect(()=>{
    const down=(event)=>{
      if(screen!=="home"||event.button!==0||event.target.closest("button,input,[data-no-hold]"))return;
      setHoldPoint({x:event.clientX,y:event.clientY});
      gsap.killTweensOf(holdRef.current);gsap.to(holdRef.current,{value:1,duration:1.65,ease:"power2.inOut",onUpdate:()=>setHold(holdRef.current.value)});
    };
    const move=(event)=>{if(holdRef.current.value>.01)setHoldPoint({x:event.clientX,y:event.clientY});};
    const up=()=>{gsap.killTweensOf(holdRef.current);gsap.to(holdRef.current,{value:0,duration:.78,ease:"power3.out",onUpdate:()=>setHold(holdRef.current.value)});};
    addEventListener("pointerdown",down);addEventListener("pointermove",move,{passive:true});addEventListener("pointerup",up);addEventListener("pointercancel",up);
    return()=>{removeEventListener("pointerdown",down);removeEventListener("pointermove",move);removeEventListener("pointerup",up);removeEventListener("pointercancel",up);};
  },[screen]);
  const setSettingsOpen=useCallback((open)=>{setSettings(open);},[]);
  const openSecret=useCallback(()=>{
    routeTimers.current.forEach(clearTimeout);setSettings(false);setRevealing(false);setDiving(true);
    routeTimers.current=[
      setTimeout(()=>{setSecret(true);setTransitionKind(`${shapeState}>secret`);setShapeState("secret");},320),
      setTimeout(()=>{setDiving(false);setRevealing(true);},1450),
      setTimeout(()=>setRevealing(false),2150),
    ];
  },[shapeState]);
  const closeSecret=useCallback(()=>{
    routeTimers.current.forEach(clearTimeout);setRevealing(false);setDiving(true);
    routeTimers.current=[
      setTimeout(()=>{setSecret(false);setTransitionKind(`secret>${screen}`);setShapeState(screen);},320),
      setTimeout(()=>{setDiving(false);setRevealing(true);},1450),
      setTimeout(()=>setRevealing(false),2150),
    ];
  },[screen]);
  const page =
    screen === "home" ? (
      <Home setScreen={setScreen} />
    ) : screen === "npm" ? (
      <Workspace
        kind="npm"
        state={state}
        backend={backend}
        setScreen={setScreen}
        contentReady={contentReady}
      />
    ) : screen === "batch" ? (
      <Workspace
        kind="batch"
        state={state}
        backend={backend}
        setScreen={setScreen}
        contentReady={contentReady}
      />
    ) : screen === "game" ? (
      <BladeGrid
        backgroundBusy={state.previewBusy||state.batchImportBusy||state.busy||state.batchBusy}
        backgroundProgress={state.batchImportBusy?state.batchImportProgress:state.previewBusy?state.previewProgress:state.batchBusy?state.batchProgress:state.progress}
        backgroundStatus={state.batchImportBusy?state.batchImportStatus:state.batchBusy?state.batchStatus:state.status}
        onBack={()=>setScreen("home")}
      />
    ) : (
      <Compare
        index={Number(route.split(":")[1] || 0)}
        state={state}
        backend={backend}
        setScreen={setScreen}
        contentReady={contentReady}
      />
    );
  return (
    <div
      ref={appRoot}
      className={`app theme-${theme} quality-${quality} scene-${screen} ${diving ? "is-diving" : ""} ${revealing?"is-revealing":""} ${intro?"is-intro":""} ${hold>.01?"is-holding":""} ${secret?"has-secret":""} ${state.busy||state.batchBusy||state.batchImportBusy||state.previewBusy?"is-processing":""}`}
      style={{"--ui-brightness":brightness,"--effect-level":effects,"--hold":hold}}
    >
      <BackgroundFlowLines/>
      <CursorParticleField theme={theme} effects={effects}/>
      <div className="webgl">
        {HEADLESS_TEST ? (
          <div className="headless-scene" />
        ) : (
          <SceneBoundary>
            <Scene
              theme={theme}
              quality={quality}
              screen={shapeState}
              transitionKind={transitionKind}
              brightness={brightness}
              effects={effects}
              hold={hold}
              holdPoint={holdPoint}
              processing={state.busy||state.batchBusy||state.batchImportBusy||state.previewBusy}
            />
          </SceneBoundary>
        )}
      </div>
      <HoldSpace progress={hold} point={holdPoint}/>
      <CursorEffects effects={effects}/>
      <TooltipLayer />
      <Header
        screen={screen}
        backend={backend}
        onSettings={() => setSettingsOpen(!settings)}
      />
      <RightDock
        screen={screen}
        setScreen={setScreen}
        state={state}
      />
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          className="route-stage"
          key={route}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: HEADLESS_TEST ? 0 : .38, ease: [0.3, 0.72, 0.2, 1] }}
        >
          {page}
        </motion.div>
      </AnimatePresence>
      <SettingsPanel
        open={settings}
        setOpen={setSettingsOpen}
        theme={theme}
        setTheme={setTheme}
        quality={quality}
        setQuality={setQuality}
        brightness={brightness}
        setBrightness={setBrightness}
        effects={effects}
        setEffects={setEffects}
        performanceMode={performanceMode}
        setPerformanceMode={setPerformanceMode}
        hardwareThreads={state.hardwareThreads}
        backend={backend}
      />
      <button
        className="signature"
        data-no-hold
        onClick={openSecret}
      >
        by issmaker
      </button>
      <SecretScene
        active={secret}
        onDone={closeSecret}
      />
      <IntroSequence active={intro} onSkip={()=>{setIntro(false);setRevealing(true);setTimeout(()=>setRevealing(false),820);}}/>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
