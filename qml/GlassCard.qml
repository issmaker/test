import QtQuick

Rectangle {
    id: root
    property color accentColor: Theme.teal
    property real glassOpacity: .76
    radius: Theme.radiusLarge
    color: Qt.rgba(.067, .078, .071, glassOpacity*.90)
    border.width: 1
    border.color: Theme.stroke

    Rectangle {
        z:-2;anchors.fill:parent;anchors.margins:-4;radius:root.radius+4;color:"transparent";border.width:1
        border.color:Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.08)
    }

    Rectangle {
        anchors.fill: parent
        anchors.margins: 1
        radius: root.radius - 1
        color: "transparent"
        border.width: 1
        border.color: Qt.rgba(root.accentColor.r, root.accentColor.g, root.accentColor.b, .16)
    }
    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.margins: 1
        height: Math.min(34, parent.height * .28)
        radius: root.radius - 1
        opacity: .72
        gradient: Gradient {
            GradientStop { position: 0; color: "#18ffffff" }
            GradientStop { position: 1; color: "#00ffffff" }
        }
    }
    Rectangle {
        id:sheen
        width:parent.width*.28;height:parent.height*.62;radius:width/2
        x:parent.width*.08;y:-height*.38;rotation:-18
        color:Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.028)
        SequentialAnimation on x { loops:Animation.Infinite; NumberAnimation{target:sheen;from:root.width*.04;to:root.width*.64;duration:5200;easing.type:Easing.InOutSine} NumberAnimation{target:sheen;from:root.width*.64;to:root.width*.04;duration:5200;easing.type:Easing.InOutSine} }
    }
}
