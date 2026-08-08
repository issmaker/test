import QtQuick
import QtQuick.Effects

Item {
    id: root
    property string kind: "home"
    property color iconColor: Theme.text
    readonly property string iconName: kind === "home" ? "house"
                                       : kind === "npm" ? "scan-line"
                                       : kind === "batch" ? "images"
                                       : kind === "compare" ? "columns-2"
                                       : kind === "play" ? "activity"
                                       : "log-out"

    Image {
        id: glyph
        anchors.fill: parent
        source: "qrc:/icons/lucide/" + root.iconName + ".svg"
        sourceSize: Qt.size(Math.ceil(width * 2), Math.ceil(height * 2))
        smooth: true
        visible: false
    }
    MultiEffect {
        anchors.fill: glyph
        source: glyph
        colorization: 1
        colorizationColor: root.iconColor
    }
}
