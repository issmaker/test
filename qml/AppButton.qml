import QtQuick
import QtQuick.Controls

Button {
    id: root
    property color accent: "#d95718"
    property string tip: ""
    property real accentLuma: accent.r*.2126+accent.g*.7152+accent.b*.0722
    property real shadeFactor: accentLuma>.62?1.90:(accentLuma>.45?1.55:1.25)
    property color safeAccent: Qt.darker(accent,shadeFactor)
    implicitHeight: 48
    leftPadding: 22
    rightPadding: 22

    contentItem: Text {
        text: root.text
        color: root.enabled?"#f6fbfd":"#60717a"
        font.pixelSize: 13
        font.weight: Font.DemiBold
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
    }
    background: Rectangle {
        radius: 14
        color: !root.enabled?"#111920":root.down?Qt.darker(root.safeAccent,1.15):root.hovered?Qt.lighter(root.safeAccent,1.10):root.safeAccent
        scale: root.down?.97:root.hovered?1.015:1
        border.width: 1
        border.color: root.hovered?Qt.rgba(root.accent.r,root.accent.g,root.accent.b,.85):"#30404a"
        Rectangle {
            z: -1
            anchors.fill: parent
            anchors.margins: root.hovered?-7:-2
            radius: parent.radius+7
            color: "transparent"
            border.width: 1
            border.color: Qt.rgba(root.accent.r,root.accent.g,root.accent.b,.30)
            opacity: root.hovered?.95:.22
            Behavior on opacity{NumberAnimation{duration:200}}
            Behavior on anchors.margins{NumberAnimation{duration:220;easing.type:Easing.OutCubic}}
        }
        Behavior on color{ColorAnimation{duration:180}}
        Behavior on scale{NumberAnimation{duration:140;easing.type:Easing.OutCubic}}
    }

    ToolTip {
        visible: root.hovered&&root.tip.length>0
        delay: 330
        timeout: 8000
        y: root.height+8
        contentItem: Text {
            text: root.tip
            color: "#dcebf0"
            font.pixelSize: 11
            wrapMode: Text.Wrap
            width: Math.min(310,Math.max(150,implicitContentWidth))
        }
        background: Rectangle {
            radius: 11
            color: "#f00a1117"
            border.width: 1
            border.color: Qt.rgba(root.accent.r,root.accent.g,root.accent.b,.55)
            Rectangle{anchors.fill:parent;anchors.margins:-3;radius:14;color:"transparent";border.width:1;border.color:Qt.rgba(root.accent.r,root.accent.g,root.accent.b,.14)}
        }
    }
}
