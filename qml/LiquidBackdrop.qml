import QtQuick

Item {
    id: root
    property int scene: 0
    property real pointerX: 0
    property real pointerY: 0
    property real activity: 0
    readonly property color primary: scene===1 ? "#f0a34b" : (scene===2 ? "#29c7ad" : (scene===3 ? "#54d9c2" : "#32bca7"))
    readonly property color secondary: scene===1 ? "#d55b4b" : (scene===2 ? "#267f79" : (scene===3 ? "#b8a269" : "#5e716f"))

    Rectangle {
        anchors.fill:parent
        gradient:Gradient {
            orientation:Gradient.Horizontal
            GradientStop { position:0; color:root.scene===1?"#17110c":(root.scene===2?"#071311":"#101111") }
            GradientStop { position:.5; color:"#09090b" }
            GradientStop { position:1; color:"#030404" }
        }
    }

    Item {
        id: farLayer
        anchors.fill:parent
        transform:Translate {
            x:root.pointerX*32; y:root.pointerY*24
            Behavior on x { NumberAnimation{duration:260;easing.type:Easing.OutCubic} }
            Behavior on y { NumberAnimation{duration:260;easing.type:Easing.OutCubic} }
        }
        Canvas {
            id:ribbonCanvas
            anchors.fill:parent
            onPaint:{
                const c=getContext("2d"),w=width,h=height;c.clearRect(0,0,w,h);c.lineCap="round"
                const p=root.primary,s=root.secondary
                function ribbon(y,bend,width,alpha,color){
                    c.beginPath();c.moveTo(-w*.08,y);c.bezierCurveTo(w*.22,y-bend,w*.58,y+bend,w*1.08,y-bend*.25)
                    c.strokeStyle=Qt.rgba(color.r,color.g,color.b,alpha*.12);c.lineWidth=width*2.2;c.stroke()
                    c.strokeStyle=Qt.rgba(color.r,color.g,color.b,alpha*.34);c.lineWidth=width;c.stroke()
                    c.strokeStyle=Qt.rgba(1,1,1,alpha*.30);c.lineWidth=Math.max(1,width*.055);c.stroke()
                }
                ribbon(h*.18,h*.14,26,.52,p);ribbon(h*.57,-h*.17,38,.42,s);ribbon(h*.88,h*.10,15,.30,p)
            }
            Connections { target:root; function onSceneChanged(){ribbonCanvas.requestPaint()} }
        }
    }

    Item {
        anchors.fill:parent
        transform:Translate {
            x:root.pointerX*-58; y:root.pointerY*-44
            Behavior on x { NumberAnimation{duration:190;easing.type:Easing.OutCubic} }
            Behavior on y { NumberAnimation{duration:190;easing.type:Easing.OutCubic} }
        }
        Repeater {
            model:7
            Rectangle {
                required property int index
                width:90+index*31;height:width;radius:width/2
                x:(index*277%1100)/1100*parent.width-width/2
                y:(index*173%700)/700*parent.height-height/2
                color:Qt.rgba(index%2?root.primary.r:root.secondary.r,index%2?root.primary.g:root.secondary.g,index%2?root.primary.b:root.secondary.b,.018+index*.003)
                border.width:1
                border.color:Qt.rgba(1,1,1,.035)
            }
        }
    }

    Item {
        id: orb
        width:Math.min(root.width,root.height)*.44;height:width
        x:root.width*.66-width/2+root.pointerX*76
        y:root.height*.49-height/2+root.pointerY*58
        Behavior on x { NumberAnimation{duration:210;easing.type:Easing.OutCubic} }
        Behavior on y { NumberAnimation{duration:210;easing.type:Easing.OutCubic} }
        Rectangle { anchors.fill:parent;anchors.margins:-18;radius:width/2;color:"transparent";border.width:16;border.color:Qt.rgba(root.primary.r,root.primary.g,root.primary.b,.045) }
        Rectangle {
            anchors.centerIn:parent;width:parent.width*.36;height:width;radius:width/2
            gradient:Gradient {
                orientation:Gradient.Vertical
                GradientStop{position:0;color:Qt.lighter(root.primary,1.18)}
                GradientStop{position:.48;color:Qt.darker(root.primary,1.8)}
                GradientStop{position:1;color:"#090a0a"}
            }
            border.width:1;border.color:"#55ffffff"
        }
        Canvas {
            id:coilCanvas
            anchors.fill:parent
            onPaint:{
                const c=getContext("2d"),cx=width/2,cy=height/2;c.clearRect(0,0,width,height);c.lineCap="round"
                for(let arm=0;arm<16;++arm){
                    c.beginPath()
                    for(let i=0;i<46;++i){
                        const t=i/45,angle=arm*Math.PI*2/16+t*2.4,r=18+t*width*.40
                        const x=cx+Math.cos(angle)*r,y=cy+Math.sin(angle)*r
                        if(i===0)c.moveTo(x,y);else c.lineTo(x,y)
                    }
                    c.strokeStyle=arm%3===0?Qt.rgba(root.primary.r,root.primary.g,root.primary.b,.55):"rgba(210,218,216,.20)"
                    c.lineWidth=arm%3===0?1.6:.8;c.stroke()
                }
            }
            Connections{target:root;function onSceneChanged(){coilCanvas.requestPaint()}}
        }
        SequentialAnimation on scale { loops:Animation.Infinite; NumberAnimation{from:.985;to:1.015;duration:1900;easing.type:Easing.InOutSine} NumberAnimation{from:1.015;to:.985;duration:1900;easing.type:Easing.InOutSine} }
        RotationAnimation on rotation { from:0;to:360;duration:68000;loops:Animation.Infinite }
    }

    Canvas {
        anchors.fill:parent;opacity:.18
        onPaint:{
            const c=getContext("2d"),w=width,h=height;c.clearRect(0,0,w,h)
            for(let x=0;x<w;x+=52){c.strokeStyle="rgba(255,255,255,.025)";c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke()}
            for(let y=0;y<h;y+=52){c.strokeStyle="rgba(255,255,255,.025)";c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
        }
    }
    Rectangle {
        anchors.fill:parent
        gradient:Gradient { orientation:Gradient.Vertical; GradientStop{position:0;color:"#06000000"} GradientStop{position:.72;color:"#10000000"} GradientStop{position:1;color:"#68000000"} }
    }
}
