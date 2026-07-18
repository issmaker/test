import QtQuick

Item {
    id: root
    property real pointerX: 0
    property real pointerY: 0
    property bool pointerActive: false
    property bool warp: false
    property real progress: 0
    property real clock: 0
    property var stars: []
    property int caughtMeteor: -1
    property real burstStart: -10000
    property real burstX: 0
    property real burstY: 0

    Component.onCompleted: {
        let a=[]; let seed=918273
        function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
        for(let i=0;i<220;i++)a.push({x:rnd(),y:rnd(),z:.25+rnd()*.75,p:rnd(),h:rnd()})
        stars=a; sky.requestPaint()
    }
    Timer{interval:33;running:true;repeat:true;onTriggered:{
        root.clock+=33
        const cycle=Math.floor(root.clock/7600),phase=(root.clock%7600)/7600
        const mx=-180+phase*(root.width+360),my=root.height*.11+phase*root.height*.29
        const px=(root.pointerX+.5)*root.width,py=(root.pointerY+.5)*root.height
        if(root.pointerActive&&root.caughtMeteor!==cycle&&Math.hypot(px-mx,py-my)<58){root.caughtMeteor=cycle;root.burstStart=root.clock;root.burstX=mx;root.burstY=my}
        sky.requestPaint()
    }}
    Canvas{
        id:sky;anchors.fill:parent
        onPaint:{
            const c=getContext("2d"),w=width,h=height;c.clearRect(0,0,w,h)
            const bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,"#03070d");bg.addColorStop(.48,"#071119");bg.addColorStop(1,"#100717");c.fillStyle=bg;c.fillRect(0,0,w,h)
            const cx=w*.72+root.pointerX*34,cy=h*.30+root.pointerY*24,maxR=Math.sqrt(w*w+h*h)*.78
            for(let i=0;i<root.stars.length;i++){
                const s=root.stars[i];let x,y,tail=0
                if(root.warp){const phase=(s.p+root.clock*(.000055+s.z*.00009)*(1+root.progress*2.4))%1;const ang=s.x*6.283185+root.pointerX*.08;const rr=(.06+phase*.94)*maxR;x=cx+Math.cos(ang)*rr;y=cy+Math.sin(ang)*rr*.62;tail=5+32*s.z*(.35+root.progress)}
                else{x=((s.x+root.pointerX*(.006+s.z*.018)+1)%1)*w;y=((s.y+root.pointerY*(.006+s.z*.018)+1)%1)*h}
                const alpha=.22+s.z*.65,size=.55+s.z*1.7;c.strokeStyle=s.h>.82?`rgba(115,225,211,${alpha})`:s.h<.12?`rgba(168,139,250,${alpha})`:`rgba(220,235,255,${alpha})`;c.lineWidth=size
                c.beginPath();if(tail){const dx=x-cx,dy=y-cy,len=Math.max(1,Math.sqrt(dx*dx+dy*dy));c.moveTo(x-dx/len*tail,y-dy/len*tail);c.lineTo(x,y)}else{c.moveTo(x,y);c.lineTo(x+.3,y+.3)}c.stroke()
            }
            const haloRadius=root.warp?540:410,halo=c.createRadialGradient(cx,cy,26,cx,cy,haloRadius);halo.addColorStop(0,"rgba(0,0,0,1)");halo.addColorStop(.24,"rgba(0,0,0,.98)");halo.addColorStop(.37,root.warp?"rgba(68,226,207,.32)":"rgba(73,103,178,.17)");halo.addColorStop(.58,"rgba(116,54,190,.19)");halo.addColorStop(1,"rgba(0,0,0,0)");c.fillStyle=halo;c.fillRect(cx-haloRadius,cy-haloRadius,haloRadius*2,haloRadius*2)
            c.save();c.translate(cx,cy);c.rotate(-.17);c.scale(1,root.warp?.25:.19);for(let j=0;j<5;j++){c.beginPath();c.arc(0,0,166+j*25,0,6.283185);c.strokeStyle=j%2?`rgba(106,224,210,${.16+j*.035})`:`rgba(158,93,242,${.13+j*.03})`;c.lineWidth=root.warp?12:8;c.shadowColor=j%2?"#58e5d5":"#9b5df2";c.shadowBlur=root.warp?18:9;c.stroke()}c.restore();c.shadowBlur=0
            const hole=c.createRadialGradient(cx-16,cy-18,3,cx,cy,150);hole.addColorStop(0,"#000000");hole.addColorStop(.82,"#000000");hole.addColorStop(1,"rgba(0,0,0,.08)");c.fillStyle=hole;c.beginPath();c.arc(cx,cy,154,0,6.283185);c.fill()

            // A catchable shooting star crosses the upper orbit. Bringing the
            // cursor close to it turns the tail into a deterministic burst.
            const meteorCycle=Math.floor(root.clock/7600),meteorPhase=(root.clock%7600)/7600,mx=-180+meteorPhase*(w+360),my=h*.11+meteorPhase*h*.29
            if(root.caughtMeteor!==meteorCycle){const tail=c.createLinearGradient(mx-125,my-52,mx,my);tail.addColorStop(0,"rgba(108,225,215,0)");tail.addColorStop(1,"rgba(235,252,255,.95)");c.strokeStyle=tail;c.lineWidth=2.4;c.shadowColor="#79eee1";c.shadowBlur=13;c.beginPath();c.moveTo(mx-125,my-52);c.lineTo(mx,my);c.stroke();c.shadowBlur=0;c.fillStyle="#ffffff";c.beginPath();c.arc(mx,my,3.2,0,6.283185);c.fill()}
            const age=root.clock-root.burstStart
            if(age>=0&&age<1150){const t=age/1150;c.save();c.globalAlpha=1-t;for(let i=0;i<52;i++){const angle=i*2.399963+root.burstX*.0017,rr=(18+105*t)*(.55+(i%9)/12);const x=root.burstX+Math.cos(angle)*rr,y=root.burstY+Math.sin(angle)*rr;c.strokeStyle=i%3===0?"#a86cff":i%3===1?"#73eadb":"#f3fbff";c.lineWidth=1+(i%4)*.35;c.beginPath();c.moveTo(x,y);c.lineTo(x-Math.cos(angle)*(6+18*(1-t)),y-Math.sin(angle)*(6+18*(1-t)));c.stroke()}c.restore()}
        }
    }
}
