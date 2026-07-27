import QtQuick

Item {
    id: root
    property real pointerX: 0
    property real pointerY: 0
    property bool pointerActive: false
    property bool warp: false
    property real progress: 0
    property real zoomPulse: 0
    property real zoomDirection: 1
    property color accentColor: "#ff641f"
    property bool lightFx: false
    property real clock: 0
    property var stars: []
    property real burstStart: -10000
    property real burstX: 0
    property real burstY: 0

    function tint(alpha) {
        return Qt.rgba(accentColor.r, accentColor.g, accentColor.b, alpha)
    }
    function hash(value) {
        const n=Math.sin(value*91.731+17.113)*43758.5453
        return n-Math.floor(n)
    }
    function triggerBurst(x,y) {
        burstStart=clock
        burstX=x
        burstY=y
        sky.requestPaint()
    }

    Component.onCompleted: {
        let result=[];let seed=918273
        function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
        for(let i=0;i<96;i++)result.push({x:rnd(),y:rnd(),z:.22+rnd()*.78,p:rnd(),h:rnd()})
        stars=result;sky.requestPaint()
    }

    Timer {
        interval: root.lightFx?66:33
        running: root.visible
        repeat: true
        onTriggered: {
            root.clock+=interval
            sky.requestPaint()
        }
    }

    Canvas {
        id: sky
        anchors.fill: parent
        renderStrategy: Canvas.Threaded
        renderTarget: Canvas.FramebufferObject
        antialiasing: true

        onPaint: {
            const c=getContext("2d"),w=width,h=height
            c.clearRect(0,0,w,h)

            const background=c.createLinearGradient(0,0,w,h)
            background.addColorStop(0,"#010307")
            background.addColorStop(.38,"#071118")
            background.addColorStop(.72,"#03070d")
            background.addColorStop(1,"#000205")
            c.fillStyle=background;c.fillRect(0,0,w,h)

            // Deep-space volume: layered nebulae and a faint galactic band.
            // ECO keeps only one inexpensive cloud.
            const cloudCount=root.lightFx?1:4
            const cloudData=[
                [.12,.74,.42,.16], [.46,.08,.34,.11],
                [.88,.72,.48,.12], [.60,.56,.28,.08]
            ]
            for(let cloudIndex=0;cloudIndex<cloudCount;cloudIndex++){
                const d=cloudData[cloudIndex]
                const nx=w*d[0]+root.pointerX*(25+cloudIndex*12)
                const ny=h*d[1]+root.pointerY*(18+cloudIndex*9)
                const nr=Math.max(w,h)*d[2]
                const nebula=c.createRadialGradient(nx,ny,0,nx,ny,nr)
                nebula.addColorStop(0,root.tint(d[3]))
                nebula.addColorStop(.24,root.tint(d[3]*.52))
                nebula.addColorStop(.68,`rgba(${cloudIndex%2?20:5},${cloudIndex%2?31:27},${cloudIndex%2?48:38},${d[3]*.20})`)
                nebula.addColorStop(1,root.tint(0))
                c.fillStyle=nebula;c.fillRect(nx-nr,ny-nr,nr*2,nr*2)
            }
            if(!root.lightFx){
                c.save()
                c.translate(w*.36+root.pointerX*42,h*.68+root.pointerY*28)
                c.rotate(-.31)
                const galaxy=c.createLinearGradient(-w*.45,0,w*.45,0)
                galaxy.addColorStop(0,"rgba(255,255,255,0)")
                galaxy.addColorStop(.25,root.tint(.025))
                galaxy.addColorStop(.52,"rgba(205,230,246,.055)")
                galaxy.addColorStop(.76,root.tint(.024))
                galaxy.addColorStop(1,"rgba(255,255,255,0)")
                c.fillStyle=galaxy;c.fillRect(-w*.52,-28,w*1.04,56)
                c.restore()

                // Slow aurora curtains. Several translucent Bézier ribbons
                // drift independently, so the background never looks frozen.
                for(let curtain=0;curtain<3;curtain++){
                    const drift=Math.sin(root.clock*(.00010+curtain*.000027)+curtain*2.1)
                    const baseY=h*(.18+curtain*.19)+root.pointerY*(18+curtain*7)
                    const aurora=c.createLinearGradient(0,baseY,w,baseY+80)
                    aurora.addColorStop(0,root.tint(0))
                    aurora.addColorStop(.22,root.tint(.055+curtain*.012))
                    aurora.addColorStop(.55,curtain===1?"rgba(70,126,168,.055)":root.tint(.095))
                    aurora.addColorStop(.82,root.tint(.038))
                    aurora.addColorStop(1,root.tint(0))
                    c.strokeStyle=aurora
                    c.lineWidth=22+curtain*15
                    c.beginPath()
                    c.moveTo(-80,baseY+drift*24)
                    c.bezierCurveTo(w*.22,baseY-70-drift*18,w*.37,baseY+85,w*.57,baseY-8)
                    c.bezierCurveTo(w*.74,baseY-68,w*.88,baseY+64+drift*25,w+100,baseY-25)
                    c.stroke()
                }
            }

            const age=root.clock-root.burstStart
            const burst=age>=0&&age<2200?Math.sin(Math.PI*Math.min(1,age/2200)):0
            const effect=Math.max(root.warp?.42+root.progress*.58:0,root.zoomPulse)
            const direction=root.warp?1:root.zoomDirection
            const cx=w*.70+root.pointerX*88,cy=h*.29+root.pointerY*62
            const maxR=Math.sqrt(w*w+h*h)*.82

            // A restrained star field. It stays at 30 FPS, but the expensive
            // blur filters are replaced by small vector strokes rendered on
            // the Canvas render thread.
            const starLimit=root.lightFx?44:root.stars.length

            if(!root.lightFx){
                // Faint constellations appear only in the far field.
                c.lineWidth=.65
                for(let constellation=0;constellation<5;constellation++){
                    const first=constellation*7
                    c.strokeStyle=constellation%2===0?root.tint(.10):"rgba(180,218,239,.085)"
                    c.beginPath()
                    for(let node=0;node<6;node++){
                        const s=root.stars[first+node]
                        const px=((s.x+root.pointerX*.022+1)%1)*w
                        const py=((s.y+root.pointerY*.022+1)%1)*h
                        if(node===0)c.moveTo(px,py);else c.lineTo(px,py)
                    }
                    c.stroke()
                }
            }
            for(let i=0;i<starLimit;i++){
                const s=root.stars[i]
                let x,y,tail=0
                if(effect>.01){
                    const phase=(s.p+root.clock*(.000026+s.z*.000055)*(direction>0?1:-1)+2)%1
                    const angle=s.x*6.283185+root.pointerX*.16
                    const radius=(.05+phase*.95)*maxR
                    x=cx+Math.cos(angle)*radius
                    y=cy+Math.sin(angle)*radius*.66
                    tail=(8+58*s.z)*effect
                }else{
                    x=((s.x+root.pointerX*(.025+s.z*.055)+1)%1)*w
                    y=((s.y+root.pointerY*(.025+s.z*.055)+1)%1)*h
                }
                const twinkle=root.lightFx?1:(.74+.26*Math.sin(root.clock*(.0011+s.h*.002)+s.p*11))
                const alpha=(.25+s.z*.68)*twinkle,size=.55+s.z*1.45
                c.strokeStyle=s.h>.84?root.tint(alpha):`rgba(220,238,248,${alpha})`
                c.lineWidth=size;c.beginPath()
                if(tail){
                    const dx=x-cx,dy=y-cy,len=Math.max(1,Math.sqrt(dx*dx+dy*dy)),sign=direction>0?1:-1
                    c.moveTo(x-dx/len*tail*sign,y-dy/len*tail*sign);c.lineTo(x,y)
                }else{c.moveTo(x,y);c.lineTo(x+.35,y+.35)}
                c.stroke()
            }

            if(!root.lightFx){
                // Foreground stardust moves more strongly than the distant
                // field and gives the mouse parallax real depth.
                for(let dust=0;dust<34;dust++){
                    const hx=root.hash(dust*4.17),hy=root.hash(dust*9.31+4)
                    const x=((hx+root.pointerX*.12+1)%1)*w
                    const y=((hy+root.pointerY*.10+1)%1)*h
                    const radius=.3+root.hash(dust+88)*1.2
                    c.fillStyle=dust%9===0?root.tint(.38):"rgba(218,236,246,.24)"
                    c.beginPath();c.arc(x,y,radius,0,6.283185);c.fill()
                }

                // A distant comet crosses the sky on a long cycle and remains
                // behind all application controls.
                const cometPhase=(root.clock%23800)/23800
                const cometEase=cometPhase*cometPhase*(3-2*cometPhase)
                const cometX=-180+(w+360)*cometEase
                const cometY=h*(.10+.18*Math.sin(cometPhase*Math.PI))+
                             root.pointerY*35
                const cometTail=c.createLinearGradient(cometX-190,cometY-74,cometX,cometY)
                cometTail.addColorStop(0,"rgba(255,255,255,0)")
                cometTail.addColorStop(.55,root.tint(.11))
                cometTail.addColorStop(1,"rgba(238,250,255,.72)")
                c.strokeStyle=cometTail;c.lineWidth=1.6
                c.beginPath();c.moveTo(cometX-190,cometY-74);c.lineTo(cometX,cometY);c.stroke()
                const cometGlow=c.createRadialGradient(cometX,cometY,0,cometX,cometY,18)
                cometGlow.addColorStop(0,"rgba(255,255,255,.90)")
                cometGlow.addColorStop(.18,root.tint(.48))
                cometGlow.addColorStop(1,root.tint(0))
                c.fillStyle=cometGlow;c.fillRect(cometX-20,cometY-20,40,40)

                // The cursor bends a small patch of starlight, reinforcing the
                // parallax without moving the texture view itself.
                if(root.pointerActive){
                    const cursorX=w*(.5+root.pointerX/.60)
                    const cursorY=h*(.5+root.pointerY/.60)
                    const cursorLens=c.createRadialGradient(cursorX,cursorY,8,cursorX,cursorY,92)
                    cursorLens.addColorStop(0,root.tint(.035))
                    cursorLens.addColorStop(.65,root.tint(.018))
                    cursorLens.addColorStop(1,root.tint(0))
                    c.fillStyle=cursorLens;c.fillRect(cursorX-95,cursorY-95,190,190)
                    c.strokeStyle=root.tint(.075);c.lineWidth=.8
                    c.beginPath();c.arc(cursorX,cursorY,30+4*Math.sin(root.clock*.002),0,6.283185);c.stroke()
                }
            }

            // A small living planet: atmosphere, surface bands, craters,
            // tilted rings and an orbiting moon all react to a caught meteor.
            const planetX=w*.145-root.pointerX*70,planetY=h*.18-root.pointerY*48
            const planetGlow=58+burst*165
            const pg=c.createRadialGradient(planetX,planetY,12,planetX,planetY,planetGlow)
            pg.addColorStop(0,root.tint(.48+.40*burst));pg.addColorStop(.24,root.tint(.20+.32*burst));pg.addColorStop(1,root.tint(0))
            c.fillStyle=pg;c.fillRect(planetX-planetGlow,planetY-planetGlow,planetGlow*2,planetGlow*2)

            c.strokeStyle=root.tint(.22+.36*burst);c.lineWidth=5+burst*4
            c.beginPath();c.ellipse(planetX-56,planetY-10,112,21);c.stroke()
            const planet=c.createRadialGradient(planetX-10,planetY-12,3,planetX,planetY,35)
            planet.addColorStop(0,"#e8f7f4");planet.addColorStop(.18,root.tint(.96));planet.addColorStop(.62,"#173640");planet.addColorStop(1,"#03080b")
            const planetRadius=34+burst*5
            c.fillStyle=planet;c.beginPath();c.arc(planetX,planetY,planetRadius,0,6.283185);c.fill()

            c.save();c.beginPath();c.arc(planetX,planetY,planetRadius-1,0,6.283185);c.clip()
            c.strokeStyle="rgba(215,246,245,.19)";c.lineWidth=4
            for(let belt=-1;belt<=1;belt++){
                const by=planetY+belt*11
                c.beginPath();c.moveTo(planetX-38,by-2);c.bezierCurveTo(planetX-15,by+6,planetX+12,by-7,planetX+39,by+1);c.stroke()
            }
            c.fillStyle="rgba(1,7,10,.38)";c.beginPath();c.arc(planetX+19,planetY+3,32,0,6.283185);c.fill()
            c.strokeStyle="rgba(225,248,246,.25)";c.lineWidth=1.4
            const craterData=[[-13,-9,4],[4,13,3],[15,-12,2.5],[-18,10,2]]
            for(let crater=0;crater<craterData.length;crater++){
                const d=craterData[crater];c.beginPath();c.arc(planetX+d[0],planetY+d[1],d[2],0,6.283185);c.stroke()
            }
            c.restore()

            c.strokeStyle=root.tint(.70+.25*burst);c.lineWidth=2.2+burst*3
            c.beginPath();c.arc(planetX,planetY,planetRadius+1,0,6.283185);c.stroke()
            c.strokeStyle=root.tint(.62+.32*burst);c.lineWidth=2+burst*2
            c.beginPath();c.ellipse(planetX-52,planetY-8,104,17);c.stroke()
            c.strokeStyle="rgba(242,255,255,.38)";c.lineWidth=1
            c.beginPath();c.ellipse(planetX-46,planetY-6,92,13);c.stroke()

            const moonAngle=root.clock*.00048
            const moonX=planetX+Math.cos(moonAngle)*66,moonY=planetY+Math.sin(moonAngle)*24
            const moonGlow=10+burst*22
            const mg=c.createRadialGradient(moonX,moonY,1,moonX,moonY,moonGlow)
            mg.addColorStop(0,`rgba(255,255,255,${.55+.35*burst})`);mg.addColorStop(1,root.tint(0))
            c.fillStyle=mg;c.fillRect(moonX-moonGlow,moonY-moonGlow,moonGlow*2,moonGlow*2)
            c.fillStyle="#d7e5e8";c.beginPath();c.arc(moonX,moonY,3.2+burst*1.8,0,6.283185);c.fill()

            // Black hole inspired by gravitational-lensing photography: a
            // wide accretion disc, bright equatorial band and bent light arcs.
            const diskScale=1+effect*.055
            c.save();c.translate(cx,cy);c.scale(diskScale,diskScale)
            const outer=470
            const halo=c.createRadialGradient(0,0,70,0,0,outer)
            halo.addColorStop(0,"rgba(0,0,0,1)")
            halo.addColorStop(.26,"rgba(0,0,0,.98)")
            halo.addColorStop(.42,root.tint(.23+.12*effect))
            halo.addColorStop(.68,root.tint(.09))
            halo.addColorStop(1,root.tint(0))
            c.fillStyle=halo;c.fillRect(-outer,-outer,outer*2,outer*2)

            if(!root.lightFx){
                // Bipolar relativistic jets become more energetic during the
                // compression warp and remain subtle while idle.
                const jetStrength=.15+effect*.42+burst*.28
                const upperJet=c.createLinearGradient(0,-530,0,-135)
                upperJet.addColorStop(0,root.tint(0))
                upperJet.addColorStop(.52,root.tint(jetStrength*.18))
                upperJet.addColorStop(.86,"rgba(205,239,255,"+(jetStrength*.34)+")")
                upperJet.addColorStop(1,root.tint(0))
                c.fillStyle=upperJet
                c.beginPath();c.moveTo(-3,-142);c.lineTo(-34,-540);c.lineTo(29,-540);c.lineTo(3,-142);c.closePath();c.fill()
                const lowerJet=c.createLinearGradient(0,135,0,530)
                lowerJet.addColorStop(0,root.tint(0))
                lowerJet.addColorStop(.18,"rgba(205,239,255,"+(jetStrength*.24)+")")
                lowerJet.addColorStop(.55,root.tint(jetStrength*.14))
                lowerJet.addColorStop(1,root.tint(0))
                c.fillStyle=lowerJet
                c.beginPath();c.moveTo(-3,142);c.lineTo(-26,530);c.lineTo(30,530);c.lineTo(3,142);c.closePath();c.fill()
            }

            // Slowly orbiting fragments make the black hole feel like a
            // physical system rather than a static illustration.
            const debrisCount=root.lightFx?10:56
            for(let debris=0;debris<debrisCount;debris++){
                const seed=root.hash(debris*13.7)
                const angle=debris*.91+root.clock*(.000025+.000055*seed)
                const radius=220+seed*235
                const flatten=.18+.08*root.hash(debris+91)
                const dx=Math.cos(angle)*radius
                const dy=Math.sin(angle)*radius*flatten
                const depth=.35+.65*(Math.sin(angle)*.5+.5)
                c.fillStyle=debris%7===0?"rgba(245,249,255,"+(depth*.38)+")":root.tint(depth*.34)
                c.save();c.translate(dx,dy);c.rotate(angle+.8)
                c.fillRect(-1.2-depth*2,-.5,2.4+depth*4,1+depth)
                c.restore()
            }

            c.save();c.rotate(-.025+Math.sin(root.clock*.00015)*.008);c.scale(1,.20)
            for(let ring=0;ring<(root.lightFx?6:15);ring++){
                const radius=172+ring*20
                c.strokeStyle=root.tint(.12+ring*.036)
                c.lineWidth=5+(ring%3)*2
                c.beginPath();c.arc(0,0,radius,0,6.283185);c.stroke()
            }
            c.restore()

            // Photon orbit and polar lensing arcs.
            const photonPulse=.62+.38*Math.sin(root.clock*.0022)
            c.strokeStyle=root.tint(.44+.24*photonPulse+.18*effect)
            c.lineWidth=1.2+photonPulse
            if(!root.lightFx){c.setLineDash([3,8]);c.lineDashOffset=-root.clock*.025}
            c.beginPath();c.arc(0,0,164,0,6.283185);c.stroke()
            if(!root.lightFx)c.setLineDash([])
            c.strokeStyle=root.tint(.18+.18*effect)
            c.lineWidth=2
            c.beginPath();c.ellipse(0,0,182,285,-.04,Math.PI*1.17,Math.PI*1.83);c.stroke()

            c.save();c.scale(1,.56)
            for(let lens=0;lens<(root.lightFx?3:9);lens++){
                c.strokeStyle=root.tint(.19+lens*.055)
                c.lineWidth=3+lens*.7
                c.beginPath();c.arc(0,12,145+lens*14,Math.PI+.12,6.283185-.12);c.stroke()
            }
            c.restore()

            const band=c.createLinearGradient(-430,0,430,0)
            band.addColorStop(0,root.tint(0));band.addColorStop(.17,root.tint(.58));band.addColorStop(.43,root.tint(.96));band.addColorStop(.5,"#fff2d6");band.addColorStop(.57,root.tint(.96));band.addColorStop(.83,root.tint(.58));band.addColorStop(1,root.tint(0))
            c.strokeStyle=band;c.lineWidth=5+effect*5;c.beginPath();c.moveTo(-440,5);c.bezierCurveTo(-270,-7,-150,4,0,3);c.bezierCurveTo(150,2,270,-8,440,5);c.stroke()

            const hole=c.createRadialGradient(-18,-20,4,0,0,145)
            hole.addColorStop(0,"#000000");hole.addColorStop(.83,"#000000");hole.addColorStop(1,"rgba(0,0,0,.06)")
            c.fillStyle=hole;c.beginPath();c.arc(0,0,148,0,6.283185);c.fill()
            c.strokeStyle=root.tint(.50+.22*effect+.22*burst);c.lineWidth=2.2+effect*2;c.beginPath();c.arc(0,0,151,0,6.283185);c.stroke()

            if(!root.lightFx){
                // Chromatic lensing and travelling gravitational waves.
                c.globalAlpha=.28+.22*effect
                c.strokeStyle="rgba(78,172,255,.28)";c.lineWidth=1.2
                c.beginPath();c.arc(-2,0,155,Math.PI*.18,Math.PI*1.48);c.stroke()
                c.strokeStyle="rgba(255,93,123,.22)"
                c.beginPath();c.arc(2,0,158,Math.PI*.58,Math.PI*1.92);c.stroke()
                c.globalAlpha=1
                for(let wave=0;wave<4;wave++){
                    const wavePhase=(root.clock*.000065+wave*.25)%1
                    c.strokeStyle=root.tint((1-wavePhase)*(.055+.09*effect))
                    c.lineWidth=.8+effect
                    c.beginPath()
                    c.ellipse(0,0,210+wavePhase*380,(210+wavePhase*380)*.42,-.02,0,6.283185)
                    c.stroke()
                }
            }

            // A subtle rotating gravitational reticle becomes stronger while
            // optimizing and when a meteor is caught.
            if(!root.lightFx){
                c.save();c.rotate(root.clock*.000045)
                c.strokeStyle=root.tint(.08+.14*effect+.20*burst);c.lineWidth=1
                for(let ray=0;ray<20;ray++){
                    c.rotate(Math.PI/10)
                    c.beginPath();c.moveTo(485,0);c.lineTo(520+effect*80+burst*75,0);c.stroke()
                }
                c.restore()
            }
            c.restore()

            if(burst>.01){
                const veil=c.createRadialGradient(root.burstX,root.burstY,1,root.burstX,root.burstY,260)
                veil.addColorStop(0,`rgba(255,255,255,${burst*.13})`)
                veil.addColorStop(.28,root.tint(burst*.10))
                veil.addColorStop(1,root.tint(0))
                c.fillStyle=veil;c.fillRect(0,0,w,h)
            }

        }
    }
}
