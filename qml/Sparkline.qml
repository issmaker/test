import QtQuick

Item {
    id: root
    property var values: []
    property color lineColor: Theme.teal
    property string title: ""
    property string valueText: ""
    property bool active: false
    property real phase: 0

    Text{x:2;y:0;text:root.title;color:"#77727d";font.pixelSize:9;font.weight:Font.DemiBold;font.letterSpacing:.8}
    Text{anchors.right:parent.right;y:0;text:root.valueText;color:root.lineColor;font.pixelSize:10;font.weight:Font.DemiBold}
    Timer{interval:90;running:root.active&&root.visible;repeat:true;onTriggered:{root.phase+=.24;graph.requestPaint()}}

    Canvas {
        id: graph
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        height: parent.height-18
        renderStrategy: Canvas.Threaded
        onPaint: {
            const c=getContext("2d"),w=width,h=height
            c.clearRect(0,0,w,h)
            c.strokeStyle="rgba(255,255,255,.055)";c.lineWidth=1
            for(let gy=4;gy<h;gy+=16){c.beginPath();c.moveTo(0,gy);c.lineTo(w,gy);c.stroke()}
            if(!root.values||root.values.length<2)return
            const n=root.values.length,dx=w/Math.max(1,n-1),ys=[]
            for(let i=0;i<n;i++){
                const raw=Math.max(0,Math.min(1,Number(root.values[i])))
                const wave=root.active?(.055*Math.sin(i*.91+root.phase)+.026*Math.sin(i*2.37-root.phase*1.4))*(.35+.65*raw):0
                ys.push(h-Math.max(0,Math.min(1,raw+wave))*(h-5)-2)
            }
            c.beginPath();c.moveTo(0,h);c.lineTo(0,ys[0])
            for(let i=1;i<n;i++){const mx=(i-.5)*dx,my=(ys[i-1]+ys[i])*.5;c.quadraticCurveTo((i-1)*dx,ys[i-1],mx,my)}
            c.lineTo((n-1)*dx,ys[n-1]);c.lineTo((n-1)*dx,h);c.closePath()
            const fill=c.createLinearGradient(0,0,0,h);fill.addColorStop(0,Qt.rgba(root.lineColor.r,root.lineColor.g,root.lineColor.b,.48));fill.addColorStop(1,Qt.rgba(root.lineColor.r,root.lineColor.g,root.lineColor.b,.02));c.fillStyle=fill;c.fill()
            c.beginPath();c.moveTo(0,ys[0])
            for(let i=1;i<n;i++){const mx=(i-.5)*dx,my=(ys[i-1]+ys[i])*.5;c.quadraticCurveTo((i-1)*dx,ys[i-1],mx,my)}
            c.lineTo((n-1)*dx,ys[n-1])
            c.strokeStyle=Qt.rgba(root.lineColor.r,root.lineColor.g,root.lineColor.b,.16);c.lineWidth=5;c.stroke()
            c.strokeStyle=root.lineColor;c.lineWidth=1.5;c.stroke()
            const lastY=ys[n-1];c.fillStyle="#ffffff";c.beginPath();c.arc((n-1)*dx,lastY,2.2,0,6.283185);c.fill()
        }
        Connections{target:root;function onValuesChanged(){graph.requestPaint()}function onLineColorChanged(){graph.requestPaint()}}
        Component.onCompleted:requestPaint()
    }
}
