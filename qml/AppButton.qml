import QtQuick
import QtQuick.Controls
Button {
    id: root; property color accent: "#7c3aed"
    implicitHeight: 50; leftPadding: 24; rightPadding: 24
    contentItem: Text { text: root.text; color: "white"; font.pixelSize: 14; font.weight: Font.DemiBold; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
    background: Rectangle { radius: 15; color: root.down ? Qt.darker(root.accent,1.18) : root.hovered ? Qt.lighter(root.accent,1.08) : root.accent; scale: root.down ? .97 : 1; Rectangle{z:-1;anchors.fill:parent;anchors.margins:root.hovered?-5:-2;radius:parent.radius+5;color:"transparent";border.width:1;border.color:"#706be0d2";opacity:root.hovered?.9:.28;Behavior on opacity{NumberAnimation{duration:180}}} Behavior on color { ColorAnimation{duration:160} } Behavior on scale { NumberAnimation{duration:120;easing.type:Easing.OutCubic} } }
}
