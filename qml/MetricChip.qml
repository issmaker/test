import QtQuick

Rectangle {
    id: root
    property alias text: label.text
    property color accentColor: "#ff7139"
    property bool checked: false
    implicitHeight: 28
    implicitWidth: content.implicitWidth + 22
    radius: 10
    color: "#9e1a191f"
    border.width: 1
    border.color: checked
        ? Qt.rgba(accentColor.r, accentColor.g, accentColor.b, .48)
        : "#13ffffff"

    Row {
        id: content
        anchors.centerIn: parent
        spacing: root.checked ? 7 : 0
        Rectangle {
            visible: root.checked
            width: 6; height: 6; radius: 3
            color: root.accentColor
        }
        Text {
            id: label
            color: root.checked ? "#f4f1f6" : "#aaa7b0"
            font.pixelSize: 10
            font.weight: Font.DemiBold
        }
    }
}
