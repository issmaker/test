import QtQuick

Item {
    id: root
    property real pointerX: 0
    property real pointerY: 0
    property bool warp: false
    property real progress: 0
    property real clock: 0
    property var stars: []

    Component.onCompleted: {
        let a=[]; let seed=918273
        function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
        for(let i=0;i<220;i++)a.push({x:rnd(),y:rnd(),z:.25+rnd()*.75,p:rnd(),h:rnd()})
        stars=a; sky.requestPaint()
    }
    Timer{interval:33;running:true;repeat:true;onTriggered:{root.clock+=33;sky.requestPaint()}}
    Canvas{
        id:sky;anchors.fill:parent
        onPaint:{
            const c=getContext("2d"),w=width,h=height;c.clearRect(0,0,w,h)
            const bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,"#03070d");bg.addColorStop(.48,"#071119");bg.addColorStop(1,"#100717");c.fillStyle=bg;c.fillRect(0,0,w,h)
            const cx=w*.52+root.pointerX*24,cy=h*.43+root.pointerY*18,maxR=Math.sqrt(w*w+h*h)*.72
            for(let i=0;i<root.stars.length;i++){
                const s=root.stars[i];let x,y,tail=0
                if(root.warp){const phase=(s.p+root.clock*(.000055+s.z*.00009)*(1+root.progress*2.4))%1;const ang=s.x*6.283185+root.pointerX*.08;const rr=(.06+phase*.94)*maxR;x=cx+Math.cos(ang)*rr;y=cy+Math.sin(ang)*rr*.62;tail=5+32*s.z*(.35+root.progress)}
                else{x=((s.x+root.pointerX*(.006+s.z*.018)+1)%1)*w;y=((s.y+root.pointerY*(.006+s.z*.018)+1)%1)*h}
                const alpha=.22+s.z*.65,size=.55+s.z*1.7;c.strokeStyle=s.h>.82?`rgba(115,225,211,${alpha})`:s.h<.12?`rgba(168,139,250,${alpha})`:`rgba(220,235,255,${alpha})`;c.lineWidth=size
                c.beginPath();if(tail){const dx=x-cx,dy=y-cy,len=Math.max(1,Math.sqrt(dx*dx+dy*dy));c.moveTo(x-dx/len*tail,y-dy/len*tail);c.lineTo(x,y)}else{c.moveTo(x,y);c.lineTo(x+.3,y+.3)}c.stroke()
            }
            const halo=c.createRadialGradient(cx,cy,12,cx,cy,root.warp?250:170);halo.addColorStop(0,"rgba(0,0,0,1)");halo.addColorStop(.18,"rgba(0,0,0,1)");halo.addColorStop(.34,root.warp?"rgba(68,226,207,.28)":"rgba(73,103,178,.12)");halo.addColorStop(.55,"rgba(116,54,190,.16)");halo.addColorStop(1,"rgba(0,0,0,0)");c.fillStyle=halo;c.fillRect(cx-270,cy-270,540,540)
            c.save();c.translate(cx,cy);c.rotate(-.17);c.scale(1,root.warp?.22:.16);for(let j=0;j<4;j++){c.beginPath();c.arc(0,0,88+j*14,0,6.283185);c.strokeStyle=j%2?`rgba(106,224,210,${.16+j*.035})`:`rgba(158,93,242,${.13+j*.03})`;c.lineWidth=root.warp?8:5;c.stroke()}c.restore()
            const hole=c.createRadialGradient(cx-10,cy-12,2,cx,cy,78);hole.addColorStop(0,"#000000");hole.addColorStop(.78,"#000000");hole.addColorStop(1,"rgba(0,0,0,.15)");c.fillStyle=hole;c.beginPath();c.arc(cx,cy,80,0,6.283185);c.fill()
        }
    }
}
