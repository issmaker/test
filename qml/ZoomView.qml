import QtQuick

Item {
    id: root
    required property url imageSource
    required property string title
    property real sharedScale: 1
    property real sharedPanX: 0
    property real sharedPanY: 0
    property real parallaxX: 0
    property real parallaxY: 0
    property color accentColor: "#ff641f"
    signal viewChanged(real scale, real panX, real panY)
    signal resetRequested()
    signal fitCalculated(real scale)
    signal zoomPulse(real direction)

    function limitX(value,scaleValue) {
        if(picture.status!==Image.Ready)return 0
        const edge=Math.max(0,(picture.sourceSize.width*scaleValue-viewport.width)/2)
        return Math.max(-edge,Math.min(edge,value))
    }
    function limitY(value,scaleValue) {
        if(picture.status!==Image.Ready)return 0
        const edge=Math.max(0,(picture.sourceSize.height*scaleValue-viewport.height)/2)
        return Math.max(-edge,Math.min(edge,value))
    }
    function publish(scaleValue,xValue,yValue) {
        const safeScale=Math.max(.08,Math.min(16,scaleValue))
        root.viewChanged(safeScale,limitX(xValue,safeScale),limitY(yValue,safeScale))
    }
    function calculateFit() {
        if(picture.status===Image.Ready&&picture.sourceSize.width>0)
            fitCalculated(Math.min((viewport.width-26)/picture.sourceSize.width,(viewport.height-26)/picture.sourceSize.height))
    }
    function zoomAt(scaleValue,screenX,screenY) {
        const old=Math.max(.0001,root.sharedScale)
        const next=Math.max(.08,Math.min(16,scaleValue))
        const localX=screenX-(viewport.x+viewport.width/2)
        const localY=screenY-(viewport.y+viewport.height/2)
        const ratio=next/old
        const nextX=localX-(localX-root.sharedPanX)*ratio
        const nextY=localY-(localY-root.sharedPanY)*ratio
        publish(next,nextX,nextY)
    }
    onWidthChanged: calculateFit()
    onHeightChanged: calculateFit()

    // Only this decorative plate follows the cursor.  Image coordinates stay
    // fixed, so parallax can no longer fight wheel zoom and synchronized pan.
    Rectangle {
        id: outerGlow
        anchors.fill: viewport
        anchors.margins: -7
        radius: 22
        color: "#a8070d12"
        border.width: 1
        border.color: Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.30)
        transform: Translate {
            x: root.parallaxX*5
            y: root.parallaxY*4
            Behavior on x { NumberAnimation{duration:210;easing.type:Easing.OutCubic} }
            Behavior on y { NumberAnimation{duration:210;easing.type:Easing.OutCubic} }
        }
        Rectangle {
            anchors.fill:parent
            anchors.margins:-4
            radius:parent.radius+4
            color:"transparent"
            border.width:1
            border.color:Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.09)
        }
    }

    Rectangle {
        id: viewport
        anchors.fill: parent
        anchors.margins: 10
        radius: 16
        clip: true
        color: "#070c11"

        Rectangle {
            anchors.fill: parent
            gradient: Gradient {
                GradientStop{position:0;color:"#0b141b"}
                GradientStop{position:.55;color:"#060b10"}
                GradientStop{position:1;color:"#10100d"}
            }
        }

        Image {
            id: picture
            source: root.imageSource
            asynchronous: true
            cache: false
            smooth: root.sharedScale<4
            width: sourceSize.width
            height: sourceSize.height
            x: viewport.width/2-width/2+root.sharedPanX
            y: viewport.height/2-height/2+root.sharedPanY
            scale: root.sharedScale
            transformOrigin: Item.Center
            opacity: status===Image.Ready?1:0
            onStatusChanged: if(status===Image.Ready)Qt.callLater(root.calculateFit)
            Behavior on opacity { NumberAnimation{duration:360;easing.type:Easing.OutCubic} }
        }

        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            height: 66
            gradient: Gradient {
                GradientStop{position:0;color:"#c9070c11"}
                GradientStop{position:1;color:"#00070c11"}
            }
        }
        Text {
            x: 15;y: 12;z: 5
            text: root.title
            color: "#edf6fb"
            font.pixelSize: 13
            font.weight: Font.DemiBold
        }
        Text {
            anchors.centerIn: parent
            visible: !root.imageSource
            text: "Выберите или перетащите PNG"
            color: "#60717d"
        }
        Rectangle {
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.margins: 12
            width: scaleText.width+20;height: 28;radius: 9
            color: "#d70a1219"
            border.width: 1
            border.color: Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.30)
            Text{id:scaleText;anchors.centerIn:parent;text:Math.round(root.sharedScale*100)+"%";color:"#b9d2df";font.pixelSize:11}
        }
    }

    WheelHandler {
        acceptedDevices: PointerDevice.Mouse|PointerDevice.TouchPad
        onWheel: event => {
            const delta=event.angleDelta.y!==0?event.angleDelta.y:event.pixelDelta.y*8
            const direction=delta>=0?1:-1
            const next=root.sharedScale*Math.pow(1.0015,delta)
            root.zoomPulse(direction)
            root.zoomAt(next,event.x,event.y)
            event.accepted=true
        }
    }
    DragHandler {
        target: null
        property real startX: 0
        property real startY: 0
        onActiveChanged: if(active){startX=root.sharedPanX;startY=root.sharedPanY}
        onTranslationChanged: root.publish(root.sharedScale,startX+translation.x,startY+translation.y)
    }
    TapHandler { acceptedButtons:Qt.LeftButton;onDoubleTapped:root.resetRequested() }
}
