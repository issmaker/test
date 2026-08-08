import QtQuick

Rectangle {
    id: root
    property alias text: label.text
    property color accentColor: AppTheme.teal
    property bool checked: false
    implicitHeight: 28
    implicitWidth: content.implicitWidth + 22
    radius: AppTheme.radiusSmall
    color: AppTheme.surfaceRaised
    border.width: 1
    border.color: checked
        ? Qt.rgba(accentColor.r, accentColor.g, accentColor.b, .48)
        : AppTheme.stroke

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
            color: root.checked ? AppTheme.contentPrimary : AppTheme.contentSecondary
            font.pixelSize: 10
            font.weight: Font.DemiBold
        }
    }
}
