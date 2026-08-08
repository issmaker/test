import QtQuick
import QtQuick.Controls

Button {
    id: root
    property color accent: Theme.teal
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
        color: !root.enabled ? Theme.textFaint
             : (!root.quiet && root.accentLuma > .30 ? "#13020c" : Theme.text)
        font.pixelSize: 12
        font.weight: Font.DemiBold
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
    }
    background: Rectangle {
        radius: Theme.radiusMedium
        color: !root.enabled ? Theme.surface
             : root.down ? Qt.darker(root.safeAccent, 1.2)
             : root.hovered ? Qt.lighter(root.safeAccent, 1.08)
             : root.quiet ? Theme.surfaceRaised : root.safeAccent
        border.width: 1
        border.color: root.hovered
            ? Qt.rgba(root.accent.r, root.accent.g, root.accent.b, .82)
            : (root.quiet ? Theme.stroke : Qt.rgba(1, 1, 1, .20))
        scale: root.down ? .985 : 1
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
            color: Theme.text
            font.pixelSize: 11
            wrapMode: Text.Wrap
            width: Math.min(300, Math.max(150, implicitContentWidth))
        }
        background: Rectangle {
            radius: Theme.radiusMedium
            color: "#f0131614"
            border.width: 1
            border.color: Qt.rgba(root.accent.r, root.accent.g, root.accent.b, .45)
        }
    }
}
