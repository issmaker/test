import QtQuick
Rectangle { property alias text: label.text; height: 30; width: label.implicitWidth+22; radius: 10; color: "#1a1622"; border.color: "#392b50"; Text{id:label;anchors.centerIn:parent;color:"#cbb8ea";font.pixelSize:12} }
