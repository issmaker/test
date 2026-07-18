import QtQuick

Rectangle {
    id: root
    required property url imageSource
    required property string title
    property real sharedScale: 1
    property real sharedPanX: 0
    property real sharedPanY: 0
    signal viewChanged(real scale, real panX, real panY)
    signal resetRequested()
    signal fitCalculated(real scale)
    function calculateFit() {
        if (picture.status===Image.Ready && picture.sourceSize.width>0)
            fitCalculated(Math.min((width-28)/picture.sourceSize.width,(height-28)/picture.sourceSize.height))
    }
    onWidthChanged:calculateFit();onHeightChanged:calculateFit()
    color: "#09080d"; radius: 15; clip: true

    Text { x:14;y:12;z:5;text:root.title;color:"#dceaff";font.pixelSize:13;font.weight:Font.DemiBold }
    Image {
        id: picture; source:root.imageSource; asynchronous:true;cache:false;smooth:root.sharedScale<4
        width: sourceSize.width; height: sourceSize.height
        x: root.width/2-width/2+root.sharedPanX; y:root.height/2-height/2+root.sharedPanY
        scale:root.sharedScale; transformOrigin:Item.Center
        opacity:status===Image.Ready?1:0
        onStatusChanged:if(status===Image.Ready)Qt.callLater(root.calculateFit)
        Behavior on opacity{NumberAnimation{duration:300}}
    }
    Text { anchors.centerIn:parent;visible:!root.imageSource;text:"Выберите или перетащите PNG";color:"#665f76" }
    WheelHandler {
        acceptedDevices: PointerDevice.Mouse|PointerDevice.TouchPad
        onWheel: event => {
            const old=root.sharedScale
            const next=Math.max(.08,Math.min(16,old*Math.pow(1.0015,event.angleDelta.y)))
            const px=event.x-root.width/2-root.sharedPanX
            const py=event.y-root.height/2-root.sharedPanY
            root.viewChanged(next,root.sharedPanX-px*(next/old-1),root.sharedPanY-py*(next/old-1))
        }
    }
    DragHandler {
        target:null
        property real startX:0;property real startY:0
        onActiveChanged:if(active){startX=root.sharedPanX;startY=root.sharedPanY}
        onTranslationChanged:root.viewChanged(root.sharedScale,startX+translation.x,startY+translation.y)
    }
    TapHandler { acceptedButtons:Qt.LeftButton;onDoubleTapped:root.resetRequested() }
    Rectangle { anchors.right:parent.right;anchors.bottom:parent.bottom;anchors.margins:12;width:scaleText.width+18;height:28;radius:9;color:"#c9142030";Text{id:scaleText;anchors.centerIn:parent;text:Math.round(root.sharedScale*100)+"%";color:"#9bb7d8";font.pixelSize:11} }
}
