import QtQuick

Item {
    id: root
    property int scene: 0
    property real pointerX: 0
    property real pointerY: 0
    property real activity: 0
    readonly property color primary: scene === 1 ? "#ff4f9a" : "#ed2f8a"
    readonly property color secondary: scene === 3 ? "#9a37dd" : "#7b1459"

    Rectangle { anchors.fill: parent; color: "#050204" }

    Canvas {
        id: atmosphere
        anchors.fill: parent
        renderStrategy: Canvas.Threaded
        onPaint: {
            const c=getContext("2d"),w=width,h=height;c.clearRect(0,0,w,h)
            const glow=c.createRadialGradient(w*.62,h*.46,0,w*.62,h*.46,w*.68)
            glow.addColorStop(0,root.scene===1?"rgba(105,13,67,.62)":"rgba(92,7,61,.72)")
            glow.addColorStop(.48,"rgba(54,4,37,.34)");glow.addColorStop(1,"rgba(0,0,0,0)")
            c.fillStyle=glow;c.fillRect(0,0,w,h)
            const edge=c.createLinearGradient(0,0,w,h)
            edge.addColorStop(0,"rgba(0,0,0,.72)");edge.addColorStop(.4,"rgba(0,0,0,.04)");edge.addColorStop(1,"rgba(0,0,0,.58)")
            c.fillStyle=edge;c.fillRect(0,0,w,h)
            for(let i=0;i<1500;++i){
                const x=(i*1543%10007)/10007*w,y=(i*3323%9973)/9973*h
                const a=.012+(i%7)*.003;c.fillStyle="rgba(255,170,224,"+a+")";c.fillRect(x,y,1,1)
            }
            for(let i=0;i<18;++i){
                const x=(i*307%1000)/1000*w,y=(i*613%1000)/1000*h,r=1+(i%4)*.65
                c.fillStyle=i%3===0?"rgba(255,63,151,.34)":"rgba(255,255,255,.13)"
                c.beginPath();c.arc(x,y,r,0,6.283);c.fill()
            }
        }
        Connections { target:root; function onSceneChanged(){atmosphere.requestPaint()} }
    }

    Item {
        id: ribbonField
        anchors.fill: parent
        transform: Translate {
            x: root.pointerX*54; y: root.pointerY*38
            Behavior on x { NumberAnimation { duration:260;easing.type:Easing.OutCubic } }
            Behavior on y { NumberAnimation { duration:260;easing.type:Easing.OutCubic } }
        }
        Canvas {
            id: ribbons
            anchors.fill: parent
            renderStrategy: Canvas.Threaded
            onPaint: {
                const c=getContext("2d"),w=width,h=height;c.clearRect(0,0,w,h);c.lineCap="round";c.lineJoin="round"
                function path(offset,shift){
                    c.beginPath();c.moveTo(w*(-.04+shift),h*(1.14+offset))
                    c.bezierCurveTo(w*(.32+shift),h*(.88+offset),w*(.49+shift),h*(.26+offset),w*(.71+shift),h*(.48+offset))
                    c.bezierCurveTo(w*(.84+shift),h*(.62+offset),w*(.86+shift),h*(.24+offset),w*(1.08+shift),h*(.20+offset))
                }
                function ribbon(offset,shift,size,bright){
                    path(offset,shift);c.strokeStyle="rgba(255,20,145,.08)";c.lineWidth=size*1.55;c.stroke()
                    path(offset+.015,shift-.008);c.strokeStyle="rgba(18,0,12,.92)";c.lineWidth=size*1.12;c.stroke()
                    const body=c.createLinearGradient(w*.24,h,w*.92,0)
                    body.addColorStop(0,"#3a0829");body.addColorStop(.46,bright?"#9d1d70":"#651047");body.addColorStop(.72,bright?"#c12a83":"#86165e");body.addColorStop(1,"#3b092b")
                    path(offset,shift);c.strokeStyle=body;c.lineWidth=size;c.stroke()
                    path(offset-.018,shift+.003);c.strokeStyle=bright?"rgba(255,87,176,.66)":"rgba(255,74,166,.30)";c.lineWidth=Math.max(2,size*.055);c.stroke()
                    path(offset-.029,shift+.006);c.strokeStyle="rgba(255,220,242,.18)";c.lineWidth=1;c.stroke()
                }
                ribbon(.22,-.06,Math.max(58,w*.055),false)
                ribbon(.07,.10,Math.max(74,w*.068),true)
                ribbon(-.12,.27,Math.max(62,w*.058),false)
                ribbon(-.27,.43,Math.max(48,w*.046),true)
            }
            Connections { target:root; function onSceneChanged(){ribbons.requestPaint()} }
        }
        SequentialAnimation on scale {
            loops:Animation.Infinite
            NumberAnimation{from:.998;to:1.006;duration:3200;easing.type:Easing.InOutSine}
            NumberAnimation{from:1.006;to:.998;duration:3200;easing.type:Easing.InOutSine}
        }
    }

    Rectangle {
        anchors.fill:parent
        gradient:Gradient {
            orientation:Gradient.Vertical
            GradientStop{position:0;color:"#18000000"}
            GradientStop{position:.58;color:"#00000000"}
            GradientStop{position:1;color:"#65000000"}
        }
    }
}
