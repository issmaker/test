import QtQuick

Item {
    id: root
    property int scene: 0
    property real pointerX: 0
    property real pointerY: 0
    property real activity: 0
    readonly property color primary: scene===1 ? "#ff6b55" : (scene===2 ? "#37c8e8" : (scene===3 ? "#ff4fb8" : "#b54cff"))
    readonly property color secondary: scene===1 ? "#ffb45b" : (scene===2 ? "#496dff" : (scene===3 ? "#765cff" : "#ff4fc8"))

    Rectangle {
        anchors.fill:parent
        gradient:Gradient {
            orientation:Gradient.Horizontal
            GradientStop { position:0; color:root.scene===1?"#170b12":(root.scene===2?"#06141d":"#10091b") }
            GradientStop { position:.5; color:root.scene===1?"#09090e":(root.scene===2?"#070b15":"#080812") }
            GradientStop { position:1; color:"#050508" }
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
                ribbon(h*.22,h*.18,44,.72,p);ribbon(h*.58,-h*.20,62,.55,s);ribbon(h*.86,h*.12,24,.38,p)
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
                color:Qt.rgba(index%2?root.primary.r:root.secondary.r,index%2?root.primary.g:root.secondary.g,index%2?root.primary.b:root.secondary.b,.025+index*.004)
                border.width:1
                border.color:Qt.rgba(1,1,1,.035)
            }
        }
    }

    Item {
        id: orb
        visible:root.scene===0
        width:Math.min(root.width,root.height)*.34;height:width
        x:root.width*.5-width/2+root.pointerX*76
        y:root.height*.48-height/2+root.pointerY*58
        Behavior on x { NumberAnimation{duration:210;easing.type:Easing.OutCubic} }
        Behavior on y { NumberAnimation{duration:210;easing.type:Easing.OutCubic} }
        Rectangle { anchors.fill:parent;anchors.margins:-26;radius:width/2;color:"transparent";border.width:22;border.color:"#10c34dff" }
        Rectangle {
            anchors.fill:parent;radius:width/2
            gradient:Gradient {
                orientation:Gradient.Vertical
                GradientStop{position:0;color:"#8566ff"}
                GradientStop{position:.48;color:"#51256d"}
                GradientStop{position:.70;color:"#120d1d"}
                GradientStop{position:.78;color:"#ff50ca"}
                GradientStop{position:1;color:"#ff904d"}
            }
            border.width:2;border.color:"#70ffffff"
        }
        Rectangle { width:parent.width*.62;height:parent.height*.13;radius:height/2;anchors.horizontalCenter:parent.horizontalCenter;y:parent.height*.62;color:"#de09070e";border.width:2;border.color:"#9eff5ed7" }
        SequentialAnimation on scale { loops:Animation.Infinite; NumberAnimation{from:.985;to:1.015;duration:1900;easing.type:Easing.InOutSine} NumberAnimation{from:1.015;to:.985;duration:1900;easing.type:Easing.InOutSine} }
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
