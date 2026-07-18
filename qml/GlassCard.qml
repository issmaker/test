import QtQuick
Rectangle {
    radius: 20; color: "#ed11131c"; border.color: "#33443a58"; border.width: 1
    Rectangle { z:-2;anchors.fill:parent;anchors.margins:-5;radius:parent.radius+5;color:"transparent";border.width:1;border.color:"#1f62ddd0";opacity:.75 }
    Rectangle { z:-1;anchors.fill:parent;anchors.margins:-2;radius:parent.radius+2;color:"transparent";border.width:1;border.color:"#3659cfc4" }
    Rectangle { anchors.fill:parent;anchors.margins:1;radius:parent.radius-1;color:"transparent";border.width:1;border.color:"#12000000" }
}
