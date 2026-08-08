import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, MeshTransmissionMaterial, Sparkles } from '@react-three/drei'
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

function AmbientBackdrop({screen,motion}) {
  const [pointer,setPointer]=useState({x:.5,y:.5})
  const frame=useRef(0)
  useEffect(() => {
    const move = e => {
      cancelAnimationFrame(frame.current)
      frame.current=requestAnimationFrame(()=>setPointer({x:e.clientX/innerWidth,y:e.clientY/innerHeight}))
    }
    window.addEventListener('pointermove',move); return()=>window.removeEventListener('pointermove',move)
  },[])
  const px=pointer.x*1600,py=pointer.y*900,energy=motion?.energy||0
  return <div className="ambient-backdrop" data-scene={screen} style={{'--mx':`${pointer.x*100}%`,'--my':`${pointer.y*100}%`,'--px':pointer.x-.5,'--py':pointer.y-.5,'--energy':energy}}>
    <div className="ambient-glow"/><svg viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true"><g className="field-lines">
      {Array.from({length:15},(_,i)=>{const y=55+i*58,d=Math.max(0,1-Math.abs(y-py)/460),bend=(px-800)*.075*d+energy*90*d;return <path key={i} d={`M-80 ${y} C ${300+bend} ${y-85*d}, ${px-180} ${py+(y-py)*.42}, ${px} ${py+(y-py)*.22} S ${1280-bend} ${y+72*d}, 1680 ${y}`}/>})}
      {Array.from({length:9},(_,i)=>{const x=70+i*185,d=Math.max(0,1-Math.abs(x-px)/850);return <path className="cross-line" key={`v${i}`} d={`M${x} -80 C ${x-110*d} ${py-170}, ${px+(x-px)*.35} ${py-40}, ${px+(x-px)*.18} ${py} S ${x+90*d} ${py+260}, ${x} 980`}/>})}
    </g></svg><i className="cursor-aura"/>
  </div>
}

function FlowSculpture({ progress, screen, motion }) {
  const compare=screen==='compare',accent=screen==='npm'?'#28d9ff':screen==='batch'?'#8d5cff':'#ff278f'
  const group = useRef()
  useFrame((s,dt) => {
    if (!group.current) return
    group.current.rotation.y += dt * .09
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, progress*.34 + s.pointer.x*.18+(motion?.x||0)*.08, .04)
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -.2+s.pointer.y*.13+(motion?.y||0)*.05, .04)
    const target = progress < .78 ? 1+progress*2.35 : 2.83-(progress-.78)*9.2
    group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, Math.max(.82,target)+(motion?.energy||0)*.025, .045))
    group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, -progress*.7+s.pointer.x*.32, .035)
  })
  const origin=screen==='npm'?[-4.5,2.35,-1.1]:screen==='batch'?[4.65,2.1,-1.1]:[compare?3.8:1.4,.25,-.2]
  return <group ref={group} position={origin}>
    {Array.from({length:8},(_,i)=><mesh key={i} rotation={[(i-3.5)*.085,(i-3.5)*.11,(i-3.5)*.12]} scale={1+i*.035}>
      <torusKnotGeometry args={[1.55,.027+i*.006,220,10,2,3]} />
      <meshPhysicalMaterial color={screen==='npm'?(i%2?'#176b86':'#123b55'):screen==='batch'?(i%2?'#563296':'#291d59'):(i%2?'#a51e70':'#5f164d')} emissive={i===4?accent:'#21051b'} emissiveIntensity={i===4?1.3:.18}
        metalness={.65} roughness={.2} clearcoat={1} clearcoatRoughness={.1} />
    </mesh>)}
  </group>
}

function OrganicGlass({screen}) {
  const pieces=screen==='home'?[[-4.8,2.5,-1,1.4,.8,1.15],[4.6,-2.5,-1.2,1.25,.75,1.5],[-4.4,-2.8,-1.5,.85,1.25,.8]]
    :screen==='npm'?[[4.9,2.6,-1.2,1.1,.7,1.5],[5.5,-2.5,-1.6,.7,1.1,.7]]
    :screen==='batch'?[[-5,2.6,-1.2,1.25,.72,1.4],[5.2,-2.7,-1.4,.9,1.25,.8]]:[]
  const tint=screen==='npm'?'#7eeeff':screen==='batch'?'#ae89ff':'#ff8bc7'
  return <>{pieces.map((p,i)=><Float key={i} speed={.65+i*.13} rotationIntensity={.34} floatIntensity={.28}>
    <mesh position={p.slice(0,3)} scale={p.slice(3)} rotation={[i*.7,.6+i,.2]}>
      <icosahedronGeometry args={[1.25,4]}/><MeshTransmissionMaterial color={tint} samples={4} resolution={256} transmission={1}
        thickness={1.15} roughness={.12} chromaticAberration={.08} anisotropy={.25} distortion={.28} distortionScale={.35}
        temporalDistortion={.08} clearcoat={1} backside backsideThickness={.5}/>
    </mesh></Float>)}</>
}

function NeuralLines({ active,screen,motion }) {
  const geometry=useRef();const rows=19,cols=31
  const base=useMemo(()=>{const a=[];for(let r=0;r<rows;r++)for(let c=0;c<cols-1;c++)a.push([(c/(cols-1)-.5)*12,(r/(rows-1)-.5)*6.8],[((c+1)/(cols-1)-.5)*12,(r/(rows-1)-.5)*6.8]);return a},[])
  const positions=useMemo(()=>new Float32Array(base.length*3),[base])
  const {pointer}=useThree()
  useFrame(({clock})=>{if(!geometry.current)return;const t=clock.elapsedTime,px=pointer.x*5.8,py=pointer.y*3.2,boost=(motion?.energy||0)*.16
    base.forEach((p,i)=>{const d=Math.hypot(p[0]-px,p[1]-py),influence=Math.exp(-d*d*.38),wave=Math.sin(p[0]*1.5+t*1.4+p[1]*.7)*.055
      positions[i*3]=p[0];positions[i*3+1]=p[1]+wave+influence*(pointer.y*.2+(motion?.y||0)*.08);positions[i*3+2]=-.8+influence*(active?.72:.38)+boost*Math.exp(-d*d*.16)})
    geometry.current.attributes.position.needsUpdate=true
  })
  const color=screen==='npm'?'#3be5ff':screen==='batch'?'#9d75ff':'#ff4b9d'
  return <lineSegments><bufferGeometry ref={geometry}><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry><lineBasicMaterial color={color} transparent opacity={active?.36:.16} blending={THREE.AdditiveBlending}/></lineSegments>
}

function CameraRig({ progress, screen,motion }) {
  const { camera, pointer } = useThree()
  useFrame(()=>{
    const dark=screen==='home'||screen==='compare'
    camera.position.x=THREE.MathUtils.lerp(camera.position.x,pointer.x*.34-progress*.65+(motion?.x||0)*.05,.035)
    camera.position.y=THREE.MathUtils.lerp(camera.position.y,pointer.y*.24+(motion?.y||0)*.05,.035)
    camera.position.z=THREE.MathUtils.lerp(camera.position.z,progress<.78?7-progress*4.8:3.25+(progress-.78)*17,dark?.045:.025)
    camera.lookAt(0,0,0)
  }); return null
}

function Scene({ progress, screen, decode,motion }) {
  const accent=screen==='npm'?'#4be8ff':screen==='batch'?'#9a6cff':'#ff58ae'
  return <Canvas dpr={[1,1.4]} camera={{position:[0,0,7],fov:48}} gl={{antialias:true,alpha:true,powerPreference:'high-performance'}}>
    <ambientLight intensity={.48}/><pointLight position={[4,3,5]} color={accent} intensity={48}/>
    <pointLight position={[-4,-2,2]} color={screen==='npm'?'#176cff':'#7c1ee0'} intensity={28}/>
    <OrganicGlass screen={screen}/><Float speed={1.05} rotationIntensity={.1} floatIntensity={.15}><FlowSculpture progress={progress} screen={screen} motion={motion}/></Float>
    <NeuralLines active={decode||(motion?.energy||0)>.1} screen={screen} motion={motion}/><Sparkles count={screen==='home'?130:70} scale={[12,7,4]} size={1.1} speed={.16} color={accent}/>
    <CameraRig progress={progress} screen={screen} motion={motion}/>
    <EffectComposer multisampling={0}>
      <Bloom intensity={decode?2.25:1.1} luminanceThreshold={.22} luminanceSmoothing={.5} mipmapBlur />
      <Noise opacity={.035} blendFunction={BlendFunction.SOFT_LIGHT}/><Vignette darkness={.62} offset={.2}/>
    </EffectComposer>
  </Canvas>
}

const iconFor={home:House,npm:ScanLine,batch:Images,compare:Columns2}
function Nav({screen,setScreen,state,setDecode,backend}) {
  return <header className="nav" data-no-hold>
    <div className="brand"><span className="brand-mark"><ScanLine/></span><div><b>Оптимизатор текстур</b><small>ADAPTIVE RGB24</small></div></div>
    <nav>{[['home','Главная'],['npm','НПМ · 3 MB'],['batch','Текстуры'],['compare','Сравнение']].map(([id,label])=>{
      const I=iconFor[id]; const disabled=id==='compare'&&!state.batchItems?.some(x=>x.done)
      return <button key={id} data-tip={disabled?'Сначала оптимизируйте текстуру':`Открыть: ${label}`} className={screen===id?'active':''} disabled={disabled} onClick={()=>setScreen(id)}><I/><DecodeText onEnter={()=>setDecode(true)} onLeave={()=>setDecode(false)}>{label}</DecodeText></button>
    })}</nav>
    <div className="nav-actions"><span>v38</span><button data-tip="Перезапустить интерфейс" onClick={()=>window.qt?.webChannelTransport&&window.location.reload()}><Activity/></button><button data-tip="Закрыть приложение" onClick={()=>backend?.quitApp()}><X/></button></div>
  </header>
}

function Metric({label,value,accent=false,tip}) { return <div data-tip={tip||`${label}: ${value}`} className={`metric ${accent?'accent':''}`}><small>{label}</small><strong>{value}</strong><i/></div> }
function Button({children,quiet=false,danger=false,tip,...props}) { return <button data-no-hold data-tip={tip} className={`button ${quiet?'quiet':''} ${danger?'danger':''}`} {...props}><span className="button-content"><DecodeText>{children}</DecodeText></span></button> }
const mb=n=>n?`${Number(n).toFixed(2)} MB`:'—'

function Sparkline({values=[],label,color='#ff3f93'}) {
  const id=useId().replaceAll(':','')
  const points=(values.length?values:[0,.02,.03]).map((v,i)=>`${i/Math.max(1,values.length-1)*100},${44-Number(v)*38}`).join(' ')
  const last=Number((values.length?values[values.length-1]:0)||0)
  return <div className="spark" data-tip={`${label}: ${Math.round(last*100)}%`}><small>{label}</small><b>{Math.round(last*100)}%</b><svg viewBox="0 0 100 48" preserveAspectRatio="none"><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor={color} stopOpacity=".38"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient></defs><path className="chart-grid" d="M0 12H100M0 24H100M0 36H100"/><polygon points={`0,48 ${points} 100,48`} fill={`url(#${id})`}/><polyline className="chart-line" points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke"/><circle cx="100" cy={44-last*38} r="2.2" fill={color}/></svg></div>
}

function Home({setScreen,hidden,setDecode}) {
  return <main className={`home ${hidden?'cinematic-hidden':''}`}>
    <section className="hero-copy"><p>REAL-TIME / RGB24 / WEBGL</p><h1><DecodeText onEnter={()=>setDecode(true)} onLeave={()=>setDecode(false)}>ОПТИМИЗАТОР</DecodeText><br/><em>ТЕКСТУР</em></h1><div className="hero-line"><span>2K</span><span>4K</span><span>8K</span><b>AGR RGB24</b></div></section>
    <section className="hero-panel">
      <small>TEXTURE INFRASTRUCTURE</small><h2>Два готовых конвейера для production-текстур</h2>
      <p>НПМ до 3 MB или пакетная RGB24-оптимизация 2K, 4K и 8K без ручного лимита.</p>
      <div className="capabilities"><div data-tip="Строгий 24-битный PNG без альфа-канала"><i>01</i><strong>RGB24</strong><small>TRUE COLOR</small></div><div data-tip="Корректная работа с исходниками до 8K"><i>02</i><strong>8K READY</strong><small>SAFE PREVIEW</small></div><div data-tip="Пакетная обработка нескольких текстур"><i>03</i><strong>BATCH</strong><small>MULTI FLOW</small></div></div>
      <Button onClick={()=>setScreen('npm')}>НПМ · ОПТИМИЗИРОВАТЬ ДО 3 MB</Button>
      <Button quiet onClick={()=>setScreen('batch')}>ОТКРЫТЬ ОПТИМИЗАТОР ТЕКСТУР</Button>
    </section>
    <p className="hold-hint">НАЖМИТЕ И УДЕРЖИВАЙТЕ В ЛЮБОМ МЕСТЕ</p>
  </main>
}

function ZoomPane({title,src,view,setView}) {
  const drag=useRef(null),pane=useRef(null),image=useRef(null)
  const clamp=useCallback(next=>{const box=pane.current,img=image.current;if(!box||!img?.naturalWidth)return {...next,x:0,y:0,s:Math.max(1,Math.min(6,next.s))}
    const cw=box.clientWidth,ch=box.clientHeight,fit=Math.min(cw/img.naturalWidth,ch/img.naturalHeight),s=Math.max(1,Math.min(6,next.s))
    const maxX=Math.max(0,(img.naturalWidth*fit*s-cw)/2),maxY=Math.max(0,(img.naturalHeight*fit*s-ch)/2)
    return {s,x:Math.max(-maxX,Math.min(maxX,next.x||0)),y:Math.max(-maxY,Math.min(maxY,next.y||0))}
  },[])
  const pulse=(x=0,y=0,energy=.5)=>window.dispatchEvent(new CustomEvent('agr-motion',{detail:{x,y,energy}}))
  useEffect(()=>setView({s:1,x:0,y:0}),[src,setView])
  const wheel=e=>{e.preventDefault();const rect=pane.current.getBoundingClientRect(),ox=e.clientX-rect.left-rect.width/2,oy=e.clientY-rect.top-rect.height/2
    setView(v=>{const factor=Math.max(.88,Math.min(1.14,Math.exp(-e.deltaY*.0014))),s=Math.max(1,Math.min(6,v.s*factor)),ratio=s/v.s;return clamp({s,x:ox-(ox-v.x)*ratio,y:oy-(oy-v.y)*ratio})})
    pulse(-e.deltaX*.004,-e.deltaY*.0028,.8)
  }
  const move=e=>{if(!drag.current)return;const dx=e.clientX-drag.current.px,dy=e.clientY-drag.current.py;setView(v=>clamp({...v,x:drag.current.x+dx,y:drag.current.y+dy}));pulse(dx*.012,-dy*.012,.65)}
  const stop=e=>{drag.current=null;e?.currentTarget?.releasePointerCapture?.(e.pointerId);pulse(0,0,.18)}
  return <div ref={pane} className={`zoom-pane ${drag.current?'dragging':''}`} data-tip="Колесо — плавный зум · перетаскивание — панорама" onWheel={wheel}
    onPointerDown={e=>{if(view.s<=1)return;drag.current={px:e.clientX,py:e.clientY,x:view.x,y:view.y};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}>
    <span>{title}</span>{src?<img ref={image} onLoad={()=>setView(v=>clamp(v))} draggable="false" src={src} style={{transform:`translate3d(${view.x}px,${view.y}px,0) scale(${view.s})`}}/>:<p>PNG не выбран</p>}
  </div>
}

function Workspace({kind,state,backend,setScreen,setDecode}) {
  const batch=kind==='batch'; const [view,setView]=useState({s:1,x:0,y:0}); const items=state.batchItems||[]
  const before=state.referenceUrl||state.workingPreviewUrl||state.sourceUrl
  return <main className="workspace light-scene">
    <div className="workspace-head"><Button tip="Вернуться на главный экран" quiet onClick={()=>setScreen('home')}>← ВЫБОР РЕЖИМА</Button><div><small>{batch?'BATCH / AUTO QUALITY':'НПМ / TARGET ≤ 3 MB'}</small><h1>Оптимизатор текстур</h1></div>
      <div className="head-actions">{batch&&<Button tip="Удалить все файлы из списка" quiet onClick={()=>backend?.clearBatch()}>ОЧИСТИТЬ</Button>}<Button tip={batch?'Выбрать несколько PNG':'Выбрать PNG-текстуру'} onClick={()=>batch?backend?.chooseBatchFiles():backend?.chooseNpmFile()}>{batch?'ДОБАВИТЬ PNG':'ИМПОРТ PNG'}</Button></div></div>
    {batch?<>
      <section className="telemetry"><Metric label="FILES" value={items.length} tip="Количество файлов в очереди"/><Metric label="PROGRESS" value={`${Math.round((state.batchProgress||0)*100)}%`} tip="Общий прогресс очереди" accent/><Sparkline label="QUEUE PROGRESS" values={state.batchProgressHistory}/><Sparkline label="RGB24 ACTIVITY" values={state.batchActivityHistory} color="#8d66ff"/>
        <Button tip={state.batchBusy?'Безопасно остановить после текущего шага':'Запустить обработку всей очереди'} danger={state.batchBusy} onClick={()=>state.batchBusy?backend?.stopBatch():backend?.optimizeBatch()}>{state.batchBusy?'ОСТАНОВИТЬ':'ОПТИМИЗИРОВАТЬ ВСЕ'}</Button></section>
      <section className="batch-list">{!items.length&&<div className="empty"><Plus/><h2>Добавьте PNG-файлы</h2><p>Здесь появятся крупные превью до и после.</p></div>}
        {items.map((item,i)=><article className="batch-row" key={item.sourceUrl||i}><div className="thumb"><img src={item.comparisonSourceUrl||item.sourceUrl}/><span>BEFORE</span></div><div className="thumb"><>{item.resultUrl?<img src={item.comparisonResultUrl||item.resultUrl}/>:<p>AFTER<br/>ожидает</p>}</><span>AFTER</span></div>
          <div className="file-data"><h3>{item.name}</h3><p>{item.width} × {item.height} · {mb(item.sourceMb)} {item.done&&`→ ${mb(item.outputMb)}`}</p><progress value={item.progress||0} max="1"/><small>{item.report||item.status}</small><div><Button disabled={!item.done} onClick={()=>setScreen(`compare:${i}`)}>СРАВНИТЕЛЬНЫЙ АНАЛИЗ</Button><Button quiet disabled={!item.done} onClick={()=>backend?.openBatchOutput(i)}>ПАПКА</Button></div></div></article>)}
      </section></>:<>
      <section className="telemetry"><Metric label="SOURCE" value={mb(state.sourceFileMb)} tip="Размер исходного PNG"/><Metric label="НПМ TARGET" value="≤ 3.0 MB" tip="Автоматический предел для НПМ" accent/><Metric label="OUTPUT" value={mb(state.outputFileMb)} tip="Размер готового RGB24 PNG"/><Sparkline label="RGB24 PIPELINE" values={state.progressHistory}/><Sparkline label="ANALYSIS LOAD" values={state.activityHistory} color="#8d66ff"/></section>
      <section className="compare-card"><div className="compare-title"><h2>СРАВНИТЕЛЬНЫЙ АНАЛИЗ</h2><span>{Math.round(view.s*100)}%</span></div><div className="compare-grid"><ZoomPane title="BEFORE / ORIGINAL" src={before} view={view} setView={setView}/><ZoomPane title="AFTER / AGR RGB24" src={state.resultUrl} view={view} setView={setView}/></div>
        <div className="compare-tools"><Button tip="Показать изображение целиком" quiet onClick={()=>setView({s:1,x:0,y:0})}>ВПИСАТЬ</Button><Button tip="Вернуть изображение в центр" quiet onClick={()=>setView(v=>({...v,x:0,y:0}))}>ЦЕНТР</Button><input aria-label="Масштаб" data-tip="Плавный масштаб сравнения" type="range" min="1" max="6" step=".01" value={view.s} onChange={e=>setView(v=>({...v,s:Number(e.target.value),x:0,y:0}))}/></div></section>
      <section className="bottom-process"><p>{state.report||state.status}</p><Button danger={state.busy} disabled={!state.sourceUrl&&!state.busy} onClick={()=>state.busy?backend?.stopCurrent():backend?.optimize(2.99)}>{state.busy?'ОСТАНОВИТЬ':'ОПТИМИЗИРОВАТЬ ДО 3 MB'}</Button><Button quiet disabled={!state.outputPath} onClick={()=>backend?.openOutputFolder()}>ПАПКА РЕЗУЛЬТАТА</Button></section>
    </>}
  </main>
}

function Compare({index,state,backend,setScreen}) {
  const item=(state.batchItems||[])[index]; const [view,setView]=useState({s:1,x:0,y:0})
  if(!item)return <main className="workspace"><Button onClick={()=>setScreen('batch')}>ВЕРНУТЬСЯ К СПИСКУ</Button></main>
  return <main className="workspace compare-scene"><div className="workspace-head"><Button quiet onClick={()=>setScreen('batch')}>← ВЕРНУТЬСЯ К СПИСКУ</Button><div><small>DEEP ANALYSIS / 03</small><h1>{item.name}</h1></div></div>
    <section className="compare-card dark"><div className="compare-title"><h2>СРАВНИТЕЛЬНЫЙ АНАЛИЗ / AUTO RGB24</h2><span>{Math.round(view.s*100)}%</span></div><div className="compare-grid"><ZoomPane title="BEFORE" src={item.comparisonSourceUrl||item.sourceUrl} view={view} setView={setView}/><ZoomPane title="AFTER" src={item.comparisonResultUrl||item.resultUrl} view={view} setView={setView}/></div><div className="compare-tools"><Button tip="Показать изображения целиком" quiet onClick={()=>setView({s:1,x:0,y:0})}>ВПИСАТЬ</Button><Button tip="Открыть папку с готовой текстурой" quiet onClick={()=>backend?.openBatchOutput(index)}>ОТКРЫТЬ ПАПКУ</Button></div></section></main>
}

function App() {
  const {backend,state}=useBackend(); const [routeRaw,setScreenRaw]=useState('home'); const [progress,setProgress]=useState(0); const [holding,setHolding]=useState(false); const [decode,setDecode]=useState(false);const [motion,setMotion]=useState({x:0,y:0,energy:0})
  const progressRef=useRef({value:0}); const screen=routeRaw.startsWith('compare')?'compare':routeRaw
  const motionRef=useRef({x:0,y:0,energy:0})
  const setScreen=useCallback(next=>{setScreenRaw(next);setProgress(0);progressRef.current.value=0},[])
  useEffect(()=>{const react=e=>{Object.assign(motionRef.current,e.detail);setMotion({...motionRef.current});gsap.killTweensOf(motionRef.current);gsap.to(motionRef.current,{x:0,y:0,energy:0,duration:1.15,ease:'power3.out',onUpdate:()=>setMotion({...motionRef.current})})};window.addEventListener('agr-motion',react);return()=>window.removeEventListener('agr-motion',react)},[])
  useEffect(()=>{
    const down=e=>{if(screen!=='home'||e.button!==0||e.target.closest('[data-no-hold]'))return;setHolding(true);gsap.killTweensOf(progressRef.current);gsap.to(progressRef.current,{value:1,duration:3.1,ease:'power1.inOut',onUpdate:()=>setProgress(progressRef.current.value)})}
    const up=()=>{if(!holding)return;setHolding(false);gsap.killTweensOf(progressRef.current);gsap.to(progressRef.current,{value:0,duration:1.15,ease:'power3.inOut',onUpdate:()=>setProgress(progressRef.current.value)})}
    window.addEventListener('pointerdown',down);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);return()=>{window.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up)}
  },[screen,holding])
  const hidden=screen==='home'&&progress>.025
  return <div className={`app scene-${screen} ${hidden?'is-cinematic':''}`}>
    <AmbientBackdrop screen={screen} motion={motion}/>
    <div className="webgl">{HEADLESS_TEST?<div className="headless-scene"/>:<Scene progress={progress} screen={screen} decode={decode||holding} motion={motion}/>}</div>
    <div className={`chrome ${hidden?'hidden':''}`}><Nav screen={screen} setScreen={setScreen} state={state} setDecode={setDecode} backend={backend}/></div>
    {screen==='home'&&<Home setScreen={setScreen} hidden={hidden} setDecode={setDecode}/>} {screen==='npm'&&<Workspace kind="npm" state={state} backend={backend} setScreen={setScreen} setDecode={setDecode}/>} {screen==='batch'&&<Workspace kind="batch" state={state} backend={backend} setScreen={setScreen} setDecode={setDecode}/>} {screen==='compare'&&<Compare index={Number(routeRaw.split(':')[1]||0)} state={state} backend={backend} setScreen={setScreen}/>} 
    <p className="signature"><b>by issmaker</b></p>
    <div className="cinematic-progress" style={{transform:`scaleX(${progress})`}}/>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
