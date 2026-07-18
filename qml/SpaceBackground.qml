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
        interval: 33
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
            background.addColorStop(0,"#02070b")
            background.addColorStop(.48,"#071016")
            background.addColorStop(1,"#020609")
            c.fillStyle=background;c.fillRect(0,0,w,h)

            const age=root.clock-root.burstStart
            const burst=age>=0&&age<1500?Math.sin(Math.PI*age/1500):0
            const effect=Math.max(root.warp?.42+root.progress*.58:0,root.zoomPulse)
            const direction=root.warp?1:root.zoomDirection
            const cx=w*.70+root.pointerX*88,cy=h*.29+root.pointerY*62
            const maxR=Math.sqrt(w*w+h*h)*.82

            // A restrained star field. It stays at 30 FPS, but the expensive
            // blur filters are replaced by small vector strokes rendered on
            // the Canvas render thread.
            for(let i=0;i<root.stars.length;i++){
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
                const alpha=.25+s.z*.68,size=.55+s.z*1.45
                c.strokeStyle=s.h>.84?root.tint(alpha):`rgba(220,238,248,${alpha})`
                c.lineWidth=size;c.beginPath()
                if(tail){
                    const dx=x-cx,dy=y-cy,len=Math.max(1,Math.sqrt(dx*dx+dy*dy)),sign=direction>0?1:-1
                    c.moveTo(x-dx/len*tail*sign,y-dy/len*tail*sign);c.lineTo(x,y)
                }else{c.moveTo(x,y);c.lineTo(x+.35,y+.35)}
                c.stroke()
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

            c.save();c.rotate(-.025+Math.sin(root.clock*.00015)*.008);c.scale(1,.20)
            for(let ring=0;ring<12;ring++){
                const radius=172+ring*20
                c.strokeStyle=root.tint(.12+ring*.036)
                c.lineWidth=5+(ring%3)*2
                c.beginPath();c.arc(0,0,radius,0,6.283185);c.stroke()
            }
            c.restore()

            c.save();c.scale(1,.56)
            for(let lens=0;lens<7;lens++){
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
            c.restore()

        }
    }
}
