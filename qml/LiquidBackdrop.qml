import QtQuick

Item {
    id: root
    property int scene: 0
    property real pointerX: 0
    property real pointerY: 0
    property real activity: 0
    property real journey: 0
    readonly property bool lightScene: scene === 1 || scene === 2
    readonly property color primary: scene === 1 ? "#ff4f9a" : "#ed2f8a"
    readonly property color secondary: scene === 3 ? "#9a37dd" : "#7b1459"

    Rectangle {
        anchors.fill: parent
        color: root.lightScene ? (root.scene === 1 ? "#f2f4f8" : "#eaf1f8") : "#050204"
        Behavior on color { ColorAnimation { duration: 650; easing.type: Easing.InOutCubic } }
    }

    Rectangle {
        anchors.fill: parent
        opacity: root.lightScene ? 1 : 0
        Behavior on opacity { NumberAnimation { duration: 520 } }
        gradient: Gradient {
            orientation: Gradient.Horizontal
            GradientStop { position: 0; color: root.scene === 1 ? "#dbe7f3" : "#d8e8f7" }
            GradientStop { position: .42; color: "#00ffffff" }
            GradientStop { position: 1; color: root.scene === 2 ? "#d7e1f2" : "#eef1f8" }
        }
    }

    Canvas {
        id: atmosphere
        anchors.fill: parent
        opacity: root.lightScene ? .13 : (root.scene === 0 ? 1 : .42)
        Behavior on opacity { NumberAnimation { duration:320 } }
        renderStrategy: Canvas.Threaded
        onPaint: {
            const c=getContext("2d"),w=width,h=height;c.clearRect(0,0,w,h)
            const glow=c.createRadialGradient(w*.62,h*.46,0,w*.62,h*.46,w*.68)
            glow.addColorStop(0,root.lightScene?"rgba(68,99,164,.24)":"rgba(92,7,61,.72)")
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
        opacity: root.journey > .02 ? 1 : (root.scene === 0 ? 1 : (root.lightScene ? .075 : .13))
        scale: root.journey < .82 ? 1 + root.journey * 4.5 : Math.max(.62, 4.69 - (root.journey - .82) * 22.6)
        rotation: root.journey * 28
        transformOrigin: Item.Center
        Behavior on opacity { NumberAnimation { duration:320 } }
        transform: Translate {
            x: root.pointerX*(54 + root.journey*80) - root.journey*root.width*.08
            y: root.pointerY*(38 + root.journey*60) + Math.sin(root.journey*9)*root.height*.035
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
    }

    Item {
        anchors.centerIn: parent
        width: Math.min(parent.width, parent.height) * .68
        height: width
        opacity: root.scene === 3 ? .72 : (root.journey > .78 ? (root.journey-.78)*4.5 : 0)
        scale: root.scene === 3 ? 1 : .72 + root.journey*.28
        Behavior on opacity { NumberAnimation { duration: 420 } }
        Canvas {
            anchors.fill: parent
            onPaint: {
                const c=getContext("2d"),w=width,h=height,r=w*.47
                c.clearRect(0,0,w,h)
                const halo=c.createRadialGradient(w/2,h/2,r*.16,w/2,h/2,r)
                halo.addColorStop(0,"rgba(255,54,155,.04)")
                halo.addColorStop(.72,"rgba(255,54,155,.11)")
                halo.addColorStop(.94,"rgba(255,111,188,.28)")
                halo.addColorStop(1,"rgba(255,111,188,0)")
                c.fillStyle=halo;c.beginPath();c.arc(w/2,h/2,r,0,Math.PI*2);c.fill()
                c.strokeStyle="rgba(255,139,205,.22)";c.lineWidth=1
                c.beginPath();c.arc(w/2,h/2,r*.88,0,Math.PI*2);c.stroke()
            }
        }
    }

    Text {
        anchors.left: parent.left; anchors.leftMargin: 42
        anchors.bottom: parent.bottom; anchors.bottomMargin: 24
        visible: root.lightScene
        text: root.scene === 1 ? "PIPELINE / 01" : "TEXTURE SYSTEM / 02"
        color: "#284c7399"; font.pixelSize: 10; font.letterSpacing: 2
        opacity: root.lightScene ? 1 : 0
    }

    Rectangle {
        anchors.fill:parent
        color:root.lightScene ? "transparent" : (root.scene===0?"transparent":"#8f050205")
        Behavior on color { ColorAnimation { duration:320 } }
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
