import QtQuick

Rectangle {
    id: root
    property color accentColor: "#29c7ad"
    property real glassOpacity: .76
    radius: 26
    color: Qt.rgba(.075, .078, .086, glassOpacity*.88)
    border.width: 1
    border.color: Qt.rgba(1, 1, 1, .12)

    Rectangle {
        z:-2;anchors.fill:parent;anchors.margins:-5;radius:root.radius+5;color:"transparent";border.width:2
        border.color:Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.12)
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
        height: Math.min(42, parent.height * .32)
        radius: root.radius - 1
        opacity: .9
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
