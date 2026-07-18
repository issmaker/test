import QtQuick
Rectangle {
    radius: 20; color: "#ed11131c"; border.color: "#33443a58"; border.width: 1
    Rectangle { anchors.fill:parent;anchors.margins:1;radius:parent.radius-1;color:"transparent";border.width:1;border.color:"#12000000" }
}
