import QtQuick

Rectangle {
    id: root
    property color accentColor: "#ff641f"
    radius: 21
    color: "#e90b1218"
    border.color: Qt.rgba(accentColor.r,accentColor.g,accentColor.b,.22)
    border.width: 1
    Rectangle {
        z: -2;anchors.fill:parent;anchors.margins:-6;radius:parent.radius+6
        color:"transparent";border.width:1
        border.color:Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.09)
    }
    Rectangle {
        z: -1;anchors.fill:parent;anchors.margins:-2;radius:parent.radius+2
        color:"transparent";border.width:1
        border.color:Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.16)
    }
    Rectangle {
        anchors.fill:parent;anchors.margins:1;radius:parent.radius-1
        color:"transparent";border.width:1;border.color:"#16ffffff"
    }
}
