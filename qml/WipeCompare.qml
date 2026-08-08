import QtQuick

Item {
    id: root
    required property url beforeSource
    required property url afterSource
    property real sharedScale: 1
    property real sharedPanX: 0
    property real sharedPanY: 0
    property real divider: .5
    property color accentColor: "#ff641f"
    property real parallaxX: 0
    property real parallaxY: 0
    signal viewChanged(real scale, real panX, real panY)
    signal resetRequested()
    signal fitCalculated(real scale)
    signal zoomPulse(real direction)

    function limitX(value, scaleValue) {
        if(beforeImage.status!==Image.Ready)return 0
        const edge=Math.max(0,(beforeImage.sourceSize.width*scaleValue-frame.width)/2)
        return Math.max(-edge,Math.min(edge,value))
    }
    function limitY(value, scaleValue) {
        if(beforeImage.status!==Image.Ready)return 0
        const edge=Math.max(0,(beforeImage.sourceSize.height*scaleValue-frame.height)/2)
        return Math.max(-edge,Math.min(edge,value))
    }
    function publish(scaleValue,xValue,yValue) {
        const safe=Math.max(.08,Math.min(16,scaleValue))
        root.viewChanged(safe,limitX(xValue,safe),limitY(yValue,safe))
    }
    function calculateFit() {
        if(beforeImage.status===Image.Ready&&beforeImage.sourceSize.width>0)
            root.fitCalculated(Math.min((frame.width-28)/beforeImage.sourceSize.width,
                                        (frame.height-28)/beforeImage.sourceSize.height))
    }
    function zoomAt(scaleValue,screenX,screenY) {
        const old=Math.max(.0001,root.sharedScale)
        const next=Math.max(.08,Math.min(16,scaleValue))
        const localX=screenX-frame.width/2
        const localY=screenY-frame.height/2
        const ratio=next/old
        publish(next,localX-(localX-root.sharedPanX)*ratio,
                     localY-(localY-root.sharedPanY)*ratio)
    }
    function imageX(image) { return frame.width/2-image.width/2+root.sharedPanX }
    function imageY(image) { return frame.height/2-image.height/2+root.sharedPanY }

    onWidthChanged: calculateFit()
    onHeightChanged: calculateFit()

    Rectangle {
        anchors.fill: frame
        anchors.margins: -3
        radius: 20
        color: "transparent"
        border.width: 1
        border.color: Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.22)
        transform: Translate {
            x: root.parallaxX*3
            y: root.parallaxY*3
            Behavior on x { NumberAnimation{duration:220;easing.type:Easing.OutCubic} }
            Behavior on y { NumberAnimation{duration:220;easing.type:Easing.OutCubic} }
        }
    }

    Rectangle {
        id: frame
        anchors.fill: parent
        anchors.margins: 6
        radius: 17
        clip: true
        color: "#b00b0a0e"
        border.width: 1
        border.color: "#12ffffff"

        Image {
            id: beforeImage
            source: root.beforeSource
            asynchronous:true;cache:false;smooth:root.sharedScale<4
            width:sourceSize.width;height:sourceSize.height
            x:root.imageX(this);y:root.imageY(this)
            scale:root.sharedScale;transformOrigin:Item.Center
            onStatusChanged:if(status===Image.Ready)Qt.callLater(root.calculateFit)
        }
        Item {
            id: reveal
            x: frame.width*root.divider
            width: frame.width-x
            height: frame.height
            clip:true
            Image {
                id: afterImage
                source:root.afterSource
                asynchronous:true;cache:false;smooth:root.sharedScale<4
                width:sourceSize.width;height:sourceSize.height
                x:root.imageX(this)-reveal.x
                y:root.imageY(this)
                scale:root.sharedScale;transformOrigin:Item.Center
            }
        }

        Rectangle {
            x:frame.width*root.divider-width/2
            width:2;height:frame.height;color:root.accentColor
            Rectangle {
                anchors.centerIn:parent;width:42;height:42;radius:15
                color:"#ed16151b";border.width:2;border.color:root.accentColor
                Text{anchors.centerIn:parent;text:"‹  ›";color:"#ffffff";font.pixelSize:16;font.bold:true}
            }
        }
        Rectangle {
            x:12;y:12;width:beforeLabel.width+20;height:28;radius:10;color:"#d416151b"
            border.width:1;border.color:"#18ffffff"
            Text{id:beforeLabel;anchors.centerIn:parent;text:"BEFORE / ORIGINAL";color:"#f4f1f6";font.pixelSize:9;font.bold:true;font.letterSpacing:.6}
        }
        Rectangle {
            anchors.right:parent.right;anchors.rightMargin:12;y:12;width:afterLabel.width+20;height:28;radius:10;color:"#d416151b"
            border.width:1;border.color:Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.34)
            Text{id:afterLabel;anchors.centerIn:parent;text:"AFTER / AGR RGB24";color:"#f4f1f6";font.pixelSize:9;font.bold:true;font.letterSpacing:.6}
        }
        Rectangle {
            anchors.right:parent.right;anchors.bottom:parent.bottom;anchors.margins:12
            width:zoomText.width+20;height:28;radius:10;color:"#d416151b"
            border.width:1;border.color:Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.3)
            Text{id:zoomText;anchors.centerIn:parent;text:Math.round(root.sharedScale*100)+"%";color:"#d1ccd6";font.pixelSize:10;font.weight:Font.DemiBold}
        }
    }

    WheelHandler {
        acceptedDevices:PointerDevice.Mouse|PointerDevice.TouchPad
        onWheel:event=>{
            const delta=event.angleDelta.y!==0?event.angleDelta.y:event.pixelDelta.y*8
            root.zoomPulse(delta>=0?1:-1)
            root.zoomAt(root.sharedScale*Math.pow(1.0015,delta),event.x,event.y)
            event.accepted=true
        }
    }
    DragHandler {
        id:panHandler
        target:null
        acceptedButtons:Qt.RightButton|Qt.MiddleButton
        property real startX:0
        property real startY:0
        onActiveChanged:if(active){startX=root.sharedPanX;startY=root.sharedPanY}
        onTranslationChanged:root.publish(root.sharedScale,startX+translation.x,startY+translation.y)
    }
    DragHandler {
        id:dividerHandler
        target:null
        acceptedButtons:Qt.LeftButton
        onCentroidChanged:if(active)root.divider=Math.max(.03,Math.min(.97,centroid.position.x/frame.width))
    }
    TapHandler{acceptedButtons:Qt.LeftButton;onDoubleTapped:root.resetRequested()}
}
