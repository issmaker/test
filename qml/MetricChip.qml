import QtQuick
Rectangle { property alias text: label.text; height: 30; width: label.implicitWidth+22; radius: 10; color: "#162235"; border.color: "#283c58"; Text{id:label;anchors.centerIn:parent;color:"#a9c7ee";font.pixelSize:12} }
