import QtQuick

Rectangle {
    id: root
    property alias text: label.text
    property color accentColor: "#ff641f"
    property bool checked: false
    implicitHeight: 30
    implicitWidth: label.implicitWidth+24
    height: implicitHeight
    width: implicitWidth
    radius: 10
    color: "#151e24"
    border.color: Qt.rgba(accentColor.r,accentColor.g,accentColor.b,.28)
    Text {
        id: label
        anchors.centerIn: parent
        color: root.checked?"#dff9ed":"#c6d6dc"
        font.pixelSize: 11
        font.weight: root.checked?Font.DemiBold:Font.Normal
    }
}
