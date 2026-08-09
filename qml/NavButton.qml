import QtQuick
import QtQuick.Controls

Button {
    id: root
    property string kind: "home"
    property string label: "Главная"
    property bool selected: false
    property color accentColor: AppTheme.teal
    property string tip: ""
    implicitWidth: 184
    implicitHeight: 46
    padding: 0

    contentItem: Item {
        Row {
            anchors.left: parent.left
            anchors.leftMargin: 14
            anchors.verticalCenter: parent.verticalCenter
            spacing: 12
            NavIcon {
                width: 20; height: 20
                anchors.verticalCenter: parent.verticalCenter
                kind: root.kind
                iconColor: !root.enabled ? AppTheme.contentTertiary : (root.selected ? root.accentColor : AppTheme.contentSecondary)
            }
            Text {
                anchors.verticalCenter: parent.verticalCenter
                text: root.label
                color: !root.enabled ? AppTheme.contentTertiary : (root.selected ? AppTheme.contentPrimary : AppTheme.contentSecondary)
                font.pixelSize: 12
                font.weight: root.selected ? Font.DemiBold : Font.Medium
            }
        }
    }

    background: Rectangle {
        radius: AppTheme.radiusMedium
        color: root.selected
             ? Qt.rgba(root.accentColor.r, root.accentColor.g, root.accentColor.b, .11)
             : (root.hovered ? AppTheme.surfaceHover : "transparent")
        border.width: 1
        border.color: root.selected
                    ? Qt.rgba(root.accentColor.r, root.accentColor.g, root.accentColor.b, .26)
                    : (root.hovered ? AppTheme.stroke : "transparent")
        Rectangle {
            visible: root.selected
            anchors.left: parent.left
            anchors.leftMargin: 4
            anchors.verticalCenter: parent.verticalCenter
            width: 3; height: 20; radius: 2
            color: root.accentColor
        }
        scale: root.down ? .985 : 1
        Behavior on color { ColorAnimation { duration: 140 } }
        Behavior on scale { NumberAnimation { duration: 100; easing.type: Easing.OutCubic } }
    }

    ToolTip {
        visible: root.hovered && root.tip.length > 0
        delay: 420
        x: root.width + 10
        y: 5
        contentItem: Text { text: root.tip; color: AppTheme.contentPrimary; font.pixelSize: 11 }
        background: Rectangle { radius: AppTheme.radiusSmall; color: "#f0131614"; border.width: 1; border.color: AppTheme.strokeStrong }
    }
}
