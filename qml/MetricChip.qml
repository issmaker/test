import QtQuick

Rectangle {
    id: root
    property alias text: label.text
    property color accentColor: Theme.teal
    property bool checked: false
    implicitHeight: 28
    implicitWidth: content.implicitWidth + 22
    radius: Theme.radiusSmall
    color: Theme.surfaceRaised
    border.width: 1
    border.color: checked
        ? Qt.rgba(accentColor.r, accentColor.g, accentColor.b, .48)
        : Theme.stroke

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
            color: root.checked ? Theme.text : Theme.textMuted
            font.pixelSize: 10
            font.weight: Font.DemiBold
        }
    }
}
