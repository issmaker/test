import QtQuick
import QtQuick.Controls
Button {
    id: root; property color accent: "#7c3aed"
    implicitHeight: 50; leftPadding: 24; rightPadding: 24
    contentItem: Text { text: root.text; color: "white"; font.pixelSize: 14; font.weight: Font.DemiBold; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
    background: Rectangle { radius: 15; color: root.down ? Qt.darker(root.accent,1.18) : root.hovered ? Qt.lighter(root.accent,1.08) : root.accent; scale: root.down ? .97 : 1; Behavior on color { ColorAnimation{duration:160} } Behavior on scale { NumberAnimation{duration:120;easing.type:Easing.OutCubic} } }
}
