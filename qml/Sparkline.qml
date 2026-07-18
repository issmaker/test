import QtQuick

Item {
    id: root
    property var values: []
    property color lineColor: "#72e1d1"
    property string title: ""
    property string valueText: ""
    Text { x:2;y:0;text:root.title;color:"#72d8cf";font.pixelSize:10;font.weight:Font.DemiBold }
    Text { anchors.right:parent.right;y:0;text:root.valueText;color:"#e6fbf8";font.pixelSize:10;font.weight:Font.DemiBold }
    Canvas {
        id: graph;anchors.left:parent.left;anchors.right:parent.right;anchors.bottom:parent.bottom;height:parent.height-18
        onPaint:{const c=getContext("2d");c.clearRect(0,0,width,height);if(!root.values||root.values.length<2)return;const n=root.values.length;const dx=width/Math.max(1,n-1);c.beginPath();c.moveTo(0,height);for(let i=0;i<n;i++)c.lineTo(i*dx,height-Math.max(0,Math.min(1,Number(root.values[i])))*(height-4)-2);c.lineTo((n-1)*dx,height);c.closePath();const g=c.createLinearGradient(0,0,0,height);g.addColorStop(0,"#806be0d2");g.addColorStop(1,"#066be0d2");c.fillStyle=g;c.fill();c.beginPath();for(let i=0;i<n;i++){const x=i*dx,y=height-Math.max(0,Math.min(1,Number(root.values[i])))*(height-4)-2;if(i===0)c.moveTo(x,y);else c.lineTo(x,y)}c.strokeStyle=root.lineColor;c.lineWidth=1.4;c.shadowColor=root.lineColor;c.shadowBlur=7;c.stroke();c.shadowBlur=0}
        Connections{target:root;function onValuesChanged(){graph.requestPaint()}}
        Component.onCompleted:requestPaint()
    }
}
