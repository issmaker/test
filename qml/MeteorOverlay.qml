import QtQuick

Item {
    id: root
    property real cursorX: .5
    property real cursorY: .5
    property bool pointerActive: false
    property color accentColor: "#ff641f"
    property bool lightFx: false
    property real clock: 0
    property int caughtCycle: -1
    property real burstStart: -10000
    property real burstX: 0
    property real burstY: 0
    signal caught(real x,real y)

    function tint(alpha) {
        return Qt.rgba(accentColor.r,accentColor.g,accentColor.b,alpha)
    }
    function hash(value) {
        const n=Math.sin(value*91.731+17.113)*43758.5453
        return n-Math.floor(n)
    }
    function meteorPosition(w,h,phase,cycle) {
        const edge=Math.floor(hash(cycle+3)*4)
        const a=.08+hash(cycle+11)*.70
        const b=.12+hash(cycle+29)*.74
        let sx,sy,ex,ey
        if(edge===0){sx=-170;sy=h*a;ex=w+170;ey=h*b}
        else if(edge===1){sx=w+170;sy=h*a;ex=-170;ey=h*b}
        else if(edge===2){sx=w*a;sy=-120;ex=w*b;ey=h+120}
        else{sx=w*a;sy=h+120;ex=w*b;ey=-120}
        const eased=phase<.5?2*phase*phase:1-Math.pow(-2*phase+2,2)/2
        return {x:sx+(ex-sx)*eased,y:sy+(ey-sy)*eased,dx:ex-sx,dy:ey-sy}
    }

    Timer {
        interval: root.lightFx?66:33
        running: root.visible
        repeat: true
        onTriggered: {
            root.clock+=interval
            const cycle=Math.floor(root.clock/9200)
            const phase=(root.clock%9200)/9200
            const meteor=root.meteorPosition(root.width,root.height,phase,cycle)
            const px=root.cursorX*root.width
            const py=root.cursorY*root.height
            // Exact cursor coordinates and a generous magnetic capture radius
            // make the mini interaction reliable on high-DPI displays.
            if(root.pointerActive&&root.caughtCycle!==cycle&&Math.hypot(px-meteor.x,py-meteor.y)<112){
                root.caughtCycle=cycle
                root.burstStart=root.clock
                root.burstX=meteor.x
                root.burstY=meteor.y
                root.caught(meteor.x,meteor.y)
            }
            overlay.requestPaint()
        }
    }

    Canvas {
        id: overlay
        anchors.fill: parent
        renderStrategy: Canvas.Threaded
        antialiasing: true
        onPaint: {
            const c=getContext("2d"),w=width,h=height
            c.clearRect(0,0,w,h)
            const cycle=Math.floor(root.clock/9200),phase=(root.clock%9200)/9200
            const meteor=root.meteorPosition(w,h,phase,cycle)
            const length=Math.max(1,Math.sqrt(meteor.dx*meteor.dx+meteor.dy*meteor.dy))
            const tx=meteor.dx/length,ty=meteor.dy/length
            const cursorPx=root.cursorX*w,cursorPy=root.cursorY*h
            const distance=Math.hypot(cursorPx-meteor.x,cursorPy-meteor.y)
            const near=root.pointerActive?Math.max(0,1-distance/230):0

            if(root.caughtCycle!==cycle){
                if(near>0){
                    const halo=c.createRadialGradient(meteor.x,meteor.y,4,meteor.x,meteor.y,30+near*38)
                    halo.addColorStop(0,root.tint(.42+.35*near));halo.addColorStop(1,root.tint(0))
                    c.fillStyle=halo;c.fillRect(meteor.x-72,meteor.y-72,144,144)
                    c.strokeStyle=root.tint(.22+.52*near);c.lineWidth=1.2+near*2
                    c.beginPath();c.arc(meteor.x,meteor.y,18+near*12,0,6.283185);c.stroke()
                }
                const tail=c.createLinearGradient(meteor.x-tx*220,meteor.y-ty*220,meteor.x,meteor.y)
                tail.addColorStop(0,root.tint(0));tail.addColorStop(.70,root.tint(.62));tail.addColorStop(1,"rgba(255,255,255,.99)")
                c.strokeStyle=tail;c.lineWidth=8;c.globalAlpha=.14;c.beginPath();c.moveTo(meteor.x-tx*220,meteor.y-ty*220);c.lineTo(meteor.x,meteor.y);c.stroke()
                c.globalAlpha=1;c.lineWidth=2.4;c.beginPath();c.moveTo(meteor.x-tx*220,meteor.y-ty*220);c.lineTo(meteor.x,meteor.y);c.stroke()
                c.fillStyle="#ffffff";c.beginPath();c.arc(meteor.x,meteor.y,4.2,0,6.283185);c.fill()
            }

            const age=root.clock-root.burstStart
            if(age>=0&&age<2400){
                const t=age/2400,fade=Math.pow(1-t,1.35),particles=root.lightFx?54:168
                const flash=c.createRadialGradient(root.burstX,root.burstY,3,root.burstX,root.burstY,45+220*t)
                flash.addColorStop(0,`rgba(255,255,255,${fade*.90})`);flash.addColorStop(.18,root.tint(fade*.72));flash.addColorStop(1,root.tint(0))
                c.fillStyle=flash;c.fillRect(root.burstX-280,root.burstY-280,560,560)
                for(let wave=0;wave<(root.lightFx?1:4);wave++){
                    const wt=Math.max(0,Math.min(1,t*1.75-wave*.18))
                    if(wt>0&&wt<1){
                        c.strokeStyle=wave===0?`rgba(255,255,255,${(1-wt)*.72})`:root.tint((1-wt)*.58)
                        c.lineWidth=1.5+(1-wt)*4
                        c.beginPath();c.arc(root.burstX,root.burstY,26+wt*(260+wave*72),0,6.283185);c.stroke()
                    }
                }
                c.save();c.globalAlpha=fade
                for(let j=0;j<particles;j++){
                    const angle=j*2.399963+root.burstX*.0017
                    const radius=(20+245*t)*(.42+(j%13)/17)
                    const x=root.burstX+Math.cos(angle)*radius,y=root.burstY+Math.sin(angle)*radius
                    c.strokeStyle=j%4===0?"#ffffff":root.tint(.82)
                    c.lineWidth=1+(j%6)*.38;c.beginPath();c.moveTo(x,y);c.lineTo(x-Math.cos(angle)*(12+34*fade),y-Math.sin(angle)*(12+34*fade));c.stroke()
                }
                c.restore()

                // Six bright diffraction spikes and a short-lived captured
                // star symbol make the successful interaction unmistakable.
                c.save();c.translate(root.burstX,root.burstY);c.rotate(t*.9)
                for(let spike=0;spike<(root.lightFx?4:8);spike++){
                    c.rotate(root.lightFx?Math.PI/2:Math.PI/4)
                    const spikeGradient=c.createLinearGradient(0,0,150*fade,0)
                    spikeGradient.addColorStop(0,`rgba(255,255,255,${fade})`)
                    spikeGradient.addColorStop(.35,root.tint(fade*.75))
                    spikeGradient.addColorStop(1,root.tint(0))
                    c.strokeStyle=spikeGradient;c.lineWidth=2.4
                    c.beginPath();c.moveTo(7,0);c.lineTo(155*fade,0);c.stroke()
                }
                c.restore()
                if(t<.48){
                    const pop=Math.sin(Math.PI*t/.48)
                    c.save();c.translate(root.burstX,root.burstY);c.rotate(-.2+t*.35)
                    c.fillStyle=`rgba(255,255,255,${pop*.92})`
                    c.beginPath()
                    for(let point=0;point<10;point++){
                        const radius=(point%2===0?19:7)*(1+pop*.8)
                        const angle=-Math.PI/2+point*Math.PI/5
                        const px=Math.cos(angle)*radius,py=Math.sin(angle)*radius
                        if(point===0)c.moveTo(px,py);else c.lineTo(px,py)
                    }
                    c.closePath();c.fill();c.restore()
                }
            }
        }
    }
}
