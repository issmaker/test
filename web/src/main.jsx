import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Float, Sparkles } from '@react-three/drei'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { gsap } from 'gsap'
import {
  Activity, ArrowLeft, Columns2, FolderOpen, Gauge, House, Images,
  Maximize2, Play, Plus, ScanLine, Square, Trash2, X
} from 'lucide-react'
import * as THREE from 'three'
import './style.css'

const EMPTY = {
  sourceUrl: '', resultUrl: '', referenceUrl: '', workingPreviewUrl: '', status: 'Выберите PNG', report: '',
  outputPath: '', progress: 0, sourceFileMb: 0, outputFileMb: 0, sourceWidth: 0, sourceHeight: 0,
  busy: false, previewBusy: false, progressHistory: [], activityHistory: [], batchItems: [], batchBusy: false,
  batchProgress: 0, batchStatus: 'Добавьте PNG-файлы', batchProgressHistory: [], batchActivityHistory: []
}
const HEADLESS_TEST = new URLSearchParams(window.location.search).has('headless-test')

function useBackend() {
  const [backend, setBackend] = useState(null)
  const [state, setState] = useState(EMPTY)
  useEffect(() => {
    if (!window.qt?.webChannelTransport || !window.QWebChannel) return
    new window.QWebChannel(window.qt.webChannelTransport, channel => {
      const api = channel.objects.optimizer
      setBackend(api)
      const refresh = () => api.snapshot(value => setState({ ...EMPTY, ...value }))
      ;['sourceUrlChanged','resultUrlChanged','referenceUrlChanged','previewChanged','statusChanged','reportChanged',
        'outputPathChanged','outputSizeChanged','sourceInfoChanged','previewBusyChanged','progressChanged','busyChanged',
        'telemetryChanged','batchItemsChanged','batchBusyChanged','batchProgressChanged','batchStatusChanged','batchTelemetryChanged']
        .forEach(name => api[name]?.connect(refresh))
      refresh()
    })
  }, [])
  return { backend, state }
}

function DecodeText({ children, className = '', onEnter, onLeave }) {
  const original = String(children)
  const [value, setValue] = useState(original)
  const frame = useRef(0)
  const glyphs = '01<>/\\{}[]#%*+—'
  const decode = () => {
    cancelAnimationFrame(frame.current)
    const start = performance.now()
    const run = now => {
      const p = Math.min(1, (now - start) / 520)
      const fixed = Math.floor(original.length * p)
      setValue(original.split('').map((c, i) => c === ' ' ? ' ' : (i < fixed ? c : glyphs[Math.floor(Math.random()*glyphs.length)])).join(''))
      if (p < 1) frame.current = requestAnimationFrame(run)
    }
    frame.current = requestAnimationFrame(run)
  }
  return <span className={`decode-text ${className}`} onPointerEnter={e => { decode(); onEnter?.(e) }} onPointerLeave={onLeave}>{value}</span>
}

function PointerPixels({ active }) {
  const [pixels, setPixels] = useState([])
  const last = useRef(0)
  useEffect(() => {
    if (!active) { setPixels([]); return }
    const move = e => {
      const now = performance.now(); if (now-last.current < 28) return; last.current=now
      const born = Date.now()+Math.random()
      setPixels(current => [...current.slice(-34), ...Array.from({length:3},(_,i)=>({
        id:born+i,x:e.clientX+(Math.random()-.5)*38,y:e.clientY+(Math.random()-.5)*22,s:4+Math.random()*7
      }))])
      setTimeout(()=>setPixels(current=>current.filter(p=>p.id<born-2||p.id>born+2)),650)
    }
    window.addEventListener('pointermove',move); return()=>window.removeEventListener('pointermove',move)
  },[active])
  return <div className="pointer-pixels">{pixels.map(p=><i key={p.id} style={{left:p.x,top:p.y,width:p.s,height:p.s}} />)}</div>
}

function RibbonSculpture({ progress, light, compare }) {
  const group = useRef()
  useFrame((s,dt) => {
    if (!group.current) return
    group.current.rotation.y += dt * .09
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, progress*.48 + s.pointer.x*.07, .045)
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -.12+s.pointer.y*.07, .045)
    const target = progress < .78 ? 1+progress*3.8 : 3.96-(progress-.78)*14.8
    group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, Math.max(.72,target), .055))
    group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, -progress*1.1+s.pointer.x*.18, .04)
  })
  return <group ref={group} position={[compare?0:1.15,0,0]}>
    {Array.from({length:7},(_,i)=><mesh key={i} rotation={[Math.PI/2,(i-3)*.13,(i-3)*.15]} position={[0,0,(i-3)*.22]}>
      <torusGeometry args={[1.8+i*.045,.16+i*.012,24,160,Math.PI*1.62]} />
      <meshPhysicalMaterial color={i%2?'#a51e70':'#5f164d'} emissive={i===4?'#ff278f':'#31051f'} emissiveIntensity={i===4?1.3:.18}
        metalness={.45} roughness={.28} clearcoat={1} clearcoatRoughness={.14} />
    </mesh>)}
    <mesh rotation={[0,.18,0]}>
      <sphereGeometry args={[2.65,64,64]} />
      <meshPhysicalMaterial color="#d855a1" transparent opacity={compare?.11:.055} transmission={.82} thickness={.6}
        roughness={.2} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  </group>
}

function DecodeGrid({ active }) {
  const mesh = useRef(); const dummy = useMemo(()=>new THREE.Object3D(),[]); const color=useMemo(()=>new THREE.Color(),[])
  const { pointer } = useThree()
  const cells = useMemo(()=>Array.from({length:126},(_,i)=>({x:(i%14-6.5)*.48,y:(Math.floor(i/14)-4)*.48,seed:Math.random()*10})),[])
  useFrame(({clock})=>{
    if(!mesh.current)return
    const px=pointer.x*4.2,py=pointer.y*2.6,t=clock.elapsedTime
    cells.forEach((p,i)=>{
      const d=Math.hypot(p.x-px,p.y-py),wave=Math.max(0,1-d*.72),idle=.035+.025*Math.sin(t+p.seed)
      const energy=active?Math.max(idle,wave*(.65+.35*Math.sin(t*12-d*8))):idle
      dummy.position.set(p.x,p.y,1.3+energy*.8);dummy.scale.setScalar(.09+energy*.16);dummy.updateMatrix();mesh.current.setMatrixAt(i,dummy.matrix)
      color.setRGB(1,.08+energy*.38,.42+energy*.36);mesh.current.setColorAt(i,color)
    });mesh.current.instanceMatrix.needsUpdate=true;if(mesh.current.instanceColor)mesh.current.instanceColor.needsUpdate=true
  })
  return <instancedMesh ref={mesh} args={[null,null,cells.length]}>
    <boxGeometry args={[1,1,.16]} /><meshBasicMaterial toneMapped={false} transparent opacity={active?.92:.28} vertexColors />
  </instancedMesh>
}

function CameraRig({ progress, screen }) {
  const { camera, pointer } = useThree()
  useFrame(()=>{
    const dark=screen==='home'||screen==='compare'
    camera.position.x=THREE.MathUtils.lerp(camera.position.x,pointer.x*.18-progress*.8,.035)
    camera.position.y=THREE.MathUtils.lerp(camera.position.y,pointer.y*.12,.035)
    camera.position.z=THREE.MathUtils.lerp(camera.position.z,progress<.78?7-progress*4.8:3.25+(progress-.78)*17,dark?.045:.025)
    camera.lookAt(0,0,0)
  }); return null
}

function Scene({ progress, screen, decode }) {
  const light=screen==='npm'||screen==='batch'
  return <Canvas dpr={[1,1.75]} camera={{position:[0,0,7],fov:48}} gl={{antialias:true,powerPreference:'high-performance'}}>
    <color attach="background" args={[light?'#e9eff7':'#050105']} />
    <ambientLight intensity={light?1.6:.42}/><pointLight position={[4,3,5]} color="#ff58ae" intensity={45}/>
    <pointLight position={[-4,-2,2]} color={light?'#6c8ed9':'#7c1ee0'} intensity={25}/>
    <Float speed={1.2} rotationIntensity={.12} floatIntensity={.18}><RibbonSculpture progress={progress} light={light} compare={screen==='compare'}/></Float>
    {!light&&<DecodeGrid active={decode}/>} {!light&&<Sparkles count={110} scale={[12,7,4]} size={1.3} speed={.18} color="#ff8bc7"/>}
    <CameraRig progress={progress} screen={screen}/>
    <EffectComposer multisampling={0}>
      <Bloom intensity={decode?2.25:1.1} luminanceThreshold={.22} luminanceSmoothing={.5} mipmapBlur />
      <Noise opacity={light?.018:.035} blendFunction={BlendFunction.SOFT_LIGHT}/><Vignette darkness={light?.12:.65} offset={.2}/>
    </EffectComposer>
  </Canvas>
}

const iconFor={home:House,npm:ScanLine,batch:Images,compare:Columns2}
function Nav({screen,setScreen,state,setDecode,backend}) {
  return <header className="nav" data-no-hold>
    <div className="brand"><span className="brand-mark"><Activity/></span><div><b>Adaptive Texture</b><small>VISUAL COMPUTE</small></div></div>
    <nav>{[['home','Главная'],['npm','НПМ · 3 MB'],['batch','Текстуры'],['compare','Сравнение']].map(([id,label])=>{
      const I=iconFor[id]; const disabled=id==='compare'&&!state.batchItems?.some(x=>x.done)
      return <button key={id} className={screen===id?'active':''} disabled={disabled} onClick={()=>setScreen(id)}><I/><DecodeText onEnter={()=>setDecode(true)} onLeave={()=>setDecode(false)}>{label}</DecodeText></button>
    })}</nav>
    <div className="nav-actions"><span>v36</span><button onClick={()=>window.qt?.webChannelTransport&&window.location.reload()}><Activity/></button><button onClick={()=>backend?.quitApp()}><X/></button></div>
  </header>
}

function Metric({label,value,accent=false}) { return <div className={`metric ${accent?'accent':''}`}><small>{label}</small><strong>{value}</strong></div> }
function Button({children,quiet=false,danger=false,...props}) { return <button data-no-hold className={`button ${quiet?'quiet':''} ${danger?'danger':''}`} {...props}><DecodeText>{children}</DecodeText></button> }
const mb=n=>n?`${Number(n).toFixed(2)} MB`:'—'

function Sparkline({values=[],label,color='#ff3f93'}) {
  const points=(values.length?values:[0,.02,.03]).map((v,i)=>`${i/Math.max(1,values.length-1)*100},${44-Number(v)*38}`).join(' ')
  return <div className="spark"><small>{label}</small><svg viewBox="0 0 100 48" preserveAspectRatio="none"><polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg></div>
}

function Home({setScreen,hidden,setDecode}) {
  return <main className={`home ${hidden?'cinematic-hidden':''}`}>
    <section className="hero-copy"><p>REAL-TIME / RGB24</p><h1><DecodeText onEnter={()=>setDecode(true)} onLeave={()=>setDecode(false)}>ОПТИМИЗАЦИЯ</DecodeText><br/>ТЕКСТУР,<br/><em>КОТОРАЯ РАБОТАЕТ</em><br/>ВМЕСТЕ С ВАМИ</h1></section>
    <section className="hero-panel">
      <small>TEXTURE INFRASTRUCTURE</small><h2>Два готовых конвейера для production-текстур</h2>
      <p>НПМ до 3 MB или пакетная RGB24-оптимизация 2K, 4K и 8K без ручного лимита.</p>
      <div className="chips"><b>● RGB24</b><b>● 8K READY</b><b>BATCH</b></div>
      <Button onClick={()=>setScreen('npm')}>НПМ · ОПТИМИЗИРОВАТЬ ДО 3 MB</Button>
      <Button quiet onClick={()=>setScreen('batch')}>ОТКРЫТЬ ОПТИМИЗАТОР ТЕКСТУР</Button>
    </section>
    <p className="hold-hint">НАЖМИТЕ И УДЕРЖИВАЙТЕ В ЛЮБОМ МЕСТЕ</p>
  </main>
}

function ZoomPane({title,src,view,setView}) {
  const drag=useRef(null)
  const move=e=>{if(!drag.current)return;setView(v=>({...v,x:drag.current.x+e.clientX-drag.current.px,y:drag.current.y+e.clientY-drag.current.py}))}
  return <div className="zoom-pane" onWheel={e=>{e.preventDefault();setView(v=>({...v,s:Math.max(.2,Math.min(8,v.s*(e.deltaY<0?1.12:.89)))}))}}
    onPointerDown={e=>{drag.current={px:e.clientX,py:e.clientY,x:view.x,y:view.y};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={move} onPointerUp={()=>drag.current=null}>
    <span>{title}</span>{src?<img draggable="false" src={src} style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.s})`}}/>:<p>PNG не выбран</p>}
  </div>
}

function Workspace({kind,state,backend,setScreen,setDecode}) {
  const batch=kind==='batch'; const [view,setView]=useState({s:1,x:0,y:0}); const items=state.batchItems||[]
  const before=state.referenceUrl||state.workingPreviewUrl||state.sourceUrl
  return <main className="workspace light-scene">
    <div className="workspace-head"><Button quiet onClick={()=>setScreen('home')}>← ВЫБОР РЕЖИМА</Button><div><small>{batch?'TEXTURE SYSTEM / 02':'PIPELINE / 01'}</small><h1>{batch?'Оптимизация текстур':'Оптимизация для НПМ-текстур'}</h1></div>
      <div className="head-actions">{batch&&<Button quiet onClick={()=>backend?.clearBatch()}>ОЧИСТИТЬ</Button>}<Button onClick={()=>batch?backend?.chooseBatchFiles():backend?.chooseNpmFile()}>{batch?'ДОБАВИТЬ PNG':'ИМПОРТ PNG'}</Button></div></div>
    {batch?<>
      <section className="telemetry"><Metric label="FILES" value={items.length}/><Metric label="PROGRESS" value={`${Math.round((state.batchProgress||0)*100)}%`} accent/><Sparkline label="QUEUE PROGRESS" values={state.batchProgressHistory}/><Sparkline label="RGB24 ACTIVITY" values={state.batchActivityHistory} color="#7447df"/>
        <Button danger={state.batchBusy} onClick={()=>state.batchBusy?backend?.stopBatch():backend?.optimizeBatch()}>{state.batchBusy?'ОСТАНОВИТЬ':'ОПТИМИЗИРОВАТЬ ВСЕ'}</Button></section>
      <section className="batch-list">{!items.length&&<div className="empty"><Plus/><h2>Добавьте PNG-файлы</h2><p>Здесь появятся крупные превью до и после.</p></div>}
        {items.map((item,i)=><article className="batch-row" key={item.sourceUrl||i}><div className="thumb"><img src={item.comparisonSourceUrl||item.sourceUrl}/><span>BEFORE</span></div><div className="thumb"><>{item.resultUrl?<img src={item.comparisonResultUrl||item.resultUrl}/>:<p>AFTER<br/>ожидает</p>}</><span>AFTER</span></div>
          <div className="file-data"><h3>{item.name}</h3><p>{item.width} × {item.height} · {mb(item.sourceMb)} {item.done&&`→ ${mb(item.outputMb)}`}</p><progress value={item.progress||0} max="1"/><small>{item.report||item.status}</small><div><Button disabled={!item.done} onClick={()=>setScreen(`compare:${i}`)}>СРАВНИТЕЛЬНЫЙ АНАЛИЗ</Button><Button quiet disabled={!item.done} onClick={()=>backend?.openBatchOutput(i)}>ПАПКА</Button></div></div></article>)}
      </section></>:<>
      <section className="telemetry"><Metric label="SOURCE" value={mb(state.sourceFileMb)}/><Metric label="НПМ TARGET" value="≤ 3.0 MB" accent/><Metric label="OUTPUT" value={mb(state.outputFileMb)}/><Sparkline label="RGB24 PIPELINE" values={state.progressHistory}/><Sparkline label="ANALYSIS LOAD" values={state.activityHistory} color="#7447df"/></section>
      <section className="compare-card"><div className="compare-title"><h2>СРАВНИТЕЛЬНЫЙ АНАЛИЗ</h2><span>{Math.round(view.s*100)}%</span></div><div className="compare-grid"><ZoomPane title="BEFORE / ORIGINAL" src={before} view={view} setView={setView}/><ZoomPane title="AFTER / AGR RGB24" src={state.resultUrl} view={view} setView={setView}/></div>
        <div className="compare-tools"><Button quiet onClick={()=>setView({s:1,x:0,y:0})}>ВПИСАТЬ</Button><Button quiet onClick={()=>setView({s:1,x:0,y:0})}>1:1</Button><input type="range" min=".2" max="8" step=".01" value={view.s} onChange={e=>setView(v=>({...v,s:Number(e.target.value)}))}/></div></section>
      <section className="bottom-process"><p>{state.report||state.status}</p><Button danger={state.busy} disabled={!state.sourceUrl&&!state.busy} onClick={()=>state.busy?backend?.stopCurrent():backend?.optimize(2.99)}>{state.busy?'ОСТАНОВИТЬ':'ОПТИМИЗИРОВАТЬ ДО 3 MB'}</Button><Button quiet disabled={!state.outputPath} onClick={()=>backend?.openOutputFolder()}>ПАПКА РЕЗУЛЬТАТА</Button></section>
    </>}
  </main>
}

function Compare({index,state,backend,setScreen}) {
  const item=(state.batchItems||[])[index]; const [view,setView]=useState({s:1,x:0,y:0})
  if(!item)return <main className="workspace"><Button onClick={()=>setScreen('batch')}>ВЕРНУТЬСЯ К СПИСКУ</Button></main>
  return <main className="workspace compare-scene"><div className="workspace-head"><Button quiet onClick={()=>setScreen('batch')}>← ВЕРНУТЬСЯ К СПИСКУ</Button><div><small>DEEP ANALYSIS / 03</small><h1>{item.name}</h1></div></div>
    <section className="compare-card dark"><div className="compare-title"><h2>СРАВНИТЕЛЬНЫЙ АНАЛИЗ / AUTO RGB24</h2><span>{Math.round(view.s*100)}%</span></div><div className="compare-grid"><ZoomPane title="BEFORE" src={item.comparisonSourceUrl||item.sourceUrl} view={view} setView={setView}/><ZoomPane title="AFTER" src={item.comparisonResultUrl||item.resultUrl} view={view} setView={setView}/></div><div className="compare-tools"><Button quiet onClick={()=>setView({s:1,x:0,y:0})}>ВПИСАТЬ</Button><Button quiet onClick={()=>backend?.openBatchOutput(index)}>ОТКРЫТЬ ПАПКУ</Button></div></section></main>
}

function App() {
  const {backend,state}=useBackend(); const [routeRaw,setScreenRaw]=useState('home'); const [progress,setProgress]=useState(0); const [holding,setHolding]=useState(false); const [decode,setDecode]=useState(false)
  const progressRef=useRef({value:0}); const screen=routeRaw.startsWith('compare')?'compare':routeRaw
  const setScreen=useCallback(next=>{setScreenRaw(next);setProgress(0);progressRef.current.value=0},[])
  useEffect(()=>{
    const down=e=>{if(screen!=='home'||e.button!==0||e.target.closest('[data-no-hold]'))return;setHolding(true);gsap.killTweensOf(progressRef.current);gsap.to(progressRef.current,{value:1,duration:3.1,ease:'power1.inOut',onUpdate:()=>setProgress(progressRef.current.value)})}
    const up=()=>{if(!holding)return;setHolding(false);gsap.killTweensOf(progressRef.current);gsap.to(progressRef.current,{value:0,duration:1.15,ease:'power3.inOut',onUpdate:()=>setProgress(progressRef.current.value)})}
    window.addEventListener('pointerdown',down);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);return()=>{window.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up)}
  },[screen,holding])
  const hidden=screen==='home'&&progress>.025
  return <div className={`app scene-${screen} ${hidden?'is-cinematic':''}`}>
    <div className="webgl">{HEADLESS_TEST?<div className="headless-scene"/>:<Scene progress={progress} screen={screen} decode={decode||holding}/>}</div>
    <PointerPixels active={decode&&screen==='home'}/>
    <div className={`chrome ${hidden?'hidden':''}`}><Nav screen={screen} setScreen={setScreen} state={state} setDecode={setDecode} backend={backend}/></div>
    {screen==='home'&&<Home setScreen={setScreen} hidden={hidden} setDecode={setDecode}/>} {screen==='npm'&&<Workspace kind="npm" state={state} backend={backend} setScreen={setScreen} setDecode={setDecode}/>} {screen==='batch'&&<Workspace kind="batch" state={state} backend={backend} setScreen={setScreen} setDecode={setDecode}/>} {screen==='compare'&&<Compare index={Number(routeRaw.split(':')[1]||0)} state={state} backend={backend} setScreen={setScreen}/>} 
    <div className="cinematic-progress" style={{transform:`scaleX(${progress})`}}/>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
