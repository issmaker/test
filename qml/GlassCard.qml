import QtQuick

Rectangle {
    id: root
    property color accentColor: "#ff7139"
    property real glassOpacity: .76
    radius: 24
    color: Qt.rgba(.055, .055, .072, glassOpacity)
    border.width: 1
    border.color: Qt.rgba(1, 1, 1, .105)

    Rectangle {
        anchors.fill: parent
        anchors.margins: 1
        radius: root.radius - 1
        color: "transparent"
        border.width: 1
        border.color: Qt.rgba(root.accentColor.r, root.accentColor.g, root.accentColor.b, .055)
    }
    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.margins: 1
        height: Math.min(42, parent.height * .32)
        radius: root.radius - 1
        opacity: .7
        gradient: Gradient {
            GradientStop { position: 0; color: "#10ffffff" }
            GradientStop { position: 1; color: "#00ffffff" }
        }
    }
}
