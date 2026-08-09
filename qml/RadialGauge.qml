import QtQuick

Item {
    id: root
    property real value: 0
    property color accentColor: AppTheme.teal
    property string valueText: Math.round(value * 100) + "%"
    property string label: "PROCESS"

    Canvas {
        id: dial
        anchors.fill: parent
        onPaint: {
            const c=getContext("2d"),w=width,h=height,cx=w/2,cy=h/2
            const r=Math.max(4,Math.min(w,h)/2-8),start=-Math.PI*.72,end=Math.PI*.72
            c.clearRect(0,0,w,h)
            c.lineCap="round";c.lineWidth=6;c.strokeStyle="rgba(255,255,255,.10)"
            c.beginPath();c.arc(cx,cy,r,start,end);c.stroke()
            const v=Math.max(0,Math.min(1,root.value))
            c.lineWidth=7;c.strokeStyle=root.accentColor
            c.beginPath();c.arc(cx,cy,r,start,start+(end-start)*v);c.stroke()
            c.lineWidth=1;c.strokeStyle="rgba(255,255,255,.15)"
            c.beginPath();c.arc(cx,cy,r-10,0,Math.PI*2);c.stroke()
        }
        Connections { target:root; function onValueChanged(){dial.requestPaint()} function onAccentColorChanged(){dial.requestPaint()} }
        Component.onCompleted: requestPaint()
    }
    Column {
        anchors.centerIn: parent; spacing: 2
        Text { anchors.horizontalCenter:parent.horizontalCenter; text:root.valueText; color:AppTheme.contentPrimary; font.pixelSize:15; font.weight:Font.DemiBold }
        Text { anchors.horizontalCenter:parent.horizontalCenter; text:root.label; color:AppTheme.contentSecondary; font.pixelSize:8; font.letterSpacing:.7 }
    }
}
