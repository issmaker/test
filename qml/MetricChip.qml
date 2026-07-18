import QtQuick

Rectangle {
    id: root
    property alias text: label.text
    property color accentColor: "#ff641f"
    property bool checked: false
    implicitHeight: 30
    implicitWidth: content.implicitWidth+24
    height: implicitHeight
    width: implicitWidth
    radius: 10
    color: "#151e24"
    border.width: 1
    border.color: checked?"#4753e996":Qt.rgba(accentColor.r,accentColor.g,accentColor.b,.28)

    Row {
        id: content
        anchors.centerIn: parent
        spacing: root.checked?6:0
        Text {
            visible: root.checked
            text: "✓"
            color: "#53e996"
            font.pixelSize: 12
            font.weight: Font.Bold
        }
        Text {
            id: label
            color: "#c6d6dc"
            font.pixelSize: 11
            font.weight: root.checked?Font.DemiBold:Font.Normal
        }
    }
}
