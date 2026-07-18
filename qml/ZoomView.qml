import QtQuick

Rectangle {
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
        root.viewChanged(scaleValue,limitX(xValue,scaleValue),limitY(yValue,scaleValue))
    }
    function calculateFit() {
        if(picture.status===Image.Ready&&picture.sourceSize.width>0)
            fitCalculated(Math.min((viewport.width-30)/picture.sourceSize.width,(viewport.height-30)/picture.sourceSize.height))
    }
    onWidthChanged: calculateFit()
    onHeightChanged: calculateFit()

    color: "#05090d"
    radius: 21
    border.width: 1
    border.color: Qt.rgba(accentColor.r,accentColor.g,accentColor.b,.28)

    Rectangle {
        anchors.fill: parent
        anchors.margins: -4
        radius: root.radius+4
        color: "transparent"
        border.width: 1
        border.color: Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.12)
    }

    Rectangle {
        id: viewport
        x: 8+root.parallaxX*8
        y: 8+root.parallaxY*6
        width: root.width-16
        height: root.height-16
        radius: 15
        clip: true
        color: "#070c11"
        border.width: 1
        border.color: Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.20)
        Behavior on x { NumberAnimation{duration:180;easing.type:Easing.OutCubic} }
        Behavior on y { NumberAnimation{duration:180;easing.type:Easing.OutCubic} }

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
            Behavior on scale { NumberAnimation{duration:105;easing.type:Easing.OutCubic} }
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
            const old=root.sharedScale
            const direction=event.angleDelta.y>=0?1:-1
            const next=Math.max(.08,Math.min(16,old*Math.pow(1.0015,event.angleDelta.y)))
            const px=event.x-root.width/2-root.sharedPanX
            const py=event.y-root.height/2-root.sharedPanY
            root.zoomPulse(direction)
            root.publish(next,root.sharedPanX-px*(next/old-1),root.sharedPanY-py*(next/old-1))
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
