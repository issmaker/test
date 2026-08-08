import QtQuick
import QtQuick.Effects

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
    property real fitScale: .08
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
        const safeScale=Math.max(root.fitScale*.72,Math.min(16,scaleValue))
        root.viewChanged(safeScale,limitX(xValue,safeScale),limitY(yValue,safeScale))
    }
    function calculateFit() {
        if(picture.status===Image.Ready&&picture.sourceSize.width>0){
            root.fitScale=Math.max(.01,Math.min((viewport.width-22)/picture.sourceSize.width,(viewport.height-22)/picture.sourceSize.height))
            fitCalculated(root.fitScale)
        }
    }
    function zoomAt(scaleValue,screenX,screenY) {
        const old=Math.max(.0001,root.sharedScale)
        const next=Math.max(root.fitScale*.72,Math.min(16,scaleValue))
        const localX=screenX-(viewport.x+viewport.width/2)
        const localY=screenY-(viewport.y+viewport.height/2)
        const ratio=next/old
        const nextX=localX-(localX-root.sharedPanX)*ratio
        const nextY=localY-(localY-root.sharedPanY)*ratio
        publish(next,nextX,nextY)
    }
    onWidthChanged: calculateFit()
    onHeightChanged: calculateFit()

    Rectangle {
        id: outerGlow
        anchors.fill: viewport
        anchors.margins: -3
        radius: 20
        color: "transparent"
        border.width: 1
        border.color: Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.19)
        transform: Translate {
            x: root.parallaxX*3
            y: root.parallaxY*3
            Behavior on x { NumberAnimation{duration:210;easing.type:Easing.OutCubic} }
            Behavior on y { NumberAnimation{duration:210;easing.type:Easing.OutCubic} }
        }
    }

    Rectangle {
        id: viewport
        anchors.fill: parent
        anchors.margins: 6
        radius: 18
        clip: true
        color: "#09000000"
        border.width: 1
        border.color: "#12ffffff"
        layer.enabled: true
        layer.samples: 4
        layer.effect: MultiEffect {
            maskEnabled: true
            maskSource: roundedMask
            shadowEnabled: false
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
            x: 12; y: 12; z: 5
            width: titleText.width + 20; height: 28; radius: 10
            color: "#d416151b"
            border.width: 1
            border.color: Qt.rgba(root.accentColor.r, root.accentColor.g, root.accentColor.b, .28)
            Text {
                id: titleText; anchors.centerIn: parent; text: root.title
                color: "#f3f1f5"; font.pixelSize: 9; font.weight: Font.Bold; font.letterSpacing: .6
            }
        }
        Text {
            anchors.centerIn: parent
            visible: !root.imageSource
            text: root.title.indexOf("AFTER") >= 0 ? "Здесь появится результат" : "Выберите или перетащите PNG"
            color: "#625e68"
            font.pixelSize: 11
        }
        Rectangle {
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.margins: 12
            width: scaleText.width+20;height: 28;radius: 10
            color: "#d416151b"
            border.width: 1
            border.color: Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.30)
            Text{id:scaleText;anchors.centerIn:parent;text:Math.round(root.sharedScale*100)+"%";color:"#d1ccd6";font.pixelSize:10;font.weight:Font.DemiBold}
        }
    }

    Rectangle {
        id: roundedMask
        width: viewport.width; height: viewport.height; radius: viewport.radius
        visible: false; layer.enabled: true; color: "white"
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
