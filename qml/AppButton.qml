import QtQuick
import QtQuick.Controls

Button {
    id: root
    property color accent: "#ff7139"
    property string tip: ""
    property bool tipRight: false
    property bool quiet: false
    property real accentLuma: accent.r*.2126 + accent.g*.7152 + accent.b*.0722
    property color safeAccent: accentLuma > .58 ? Qt.darker(accent, 1.45) : accent
    implicitHeight: 42
    leftPadding: 18
    rightPadding: 18

    contentItem: Text {
        text: root.text
        color: root.enabled ? "#f8f7fb" : "#696873"
        font.pixelSize: 12
        font.weight: Font.DemiBold
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
    }
    background: Rectangle {
        radius: 14
        color: !root.enabled ? "#18171c"
             : root.down ? Qt.darker(root.safeAccent, 1.2)
             : root.hovered ? Qt.lighter(root.safeAccent, 1.08)
             : root.quiet ? "#6e29262f" : root.safeAccent
        border.width: 1
        border.color: root.hovered
            ? Qt.rgba(root.accent.r, root.accent.g, root.accent.b, .82)
            : (root.quiet ? "#28ffffff" : Qt.rgba(1, 1, 1, .24))
        scale: root.down ? .975 : (root.hovered ? 1.018 : 1)
        Behavior on color { ColorAnimation { duration: 160 } }
        Behavior on scale { NumberAnimation { duration: 130; easing.type: Easing.OutCubic } }
    }

    ToolTip {
        visible: root.hovered && root.tip.length > 0
        delay: 360
        timeout: 7000
        x: root.tipRight ? root.width + 10 : 0
        y: root.tipRight ? 0 : root.height + 8
        contentItem: Text {
            text: root.tip
            color: "#e9e7ee"
            font.pixelSize: 11
            wrapMode: Text.Wrap
            width: Math.min(300, Math.max(150, implicitContentWidth))
        }
        background: Rectangle {
            radius: 12
            color: "#f016151a"
            border.width: 1
            border.color: Qt.rgba(root.accent.r, root.accent.g, root.accent.b, .45)
        }
    }
}
