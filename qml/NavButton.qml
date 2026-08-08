import QtQuick
import QtQuick.Controls

Button {
    id:root
    property string kind:"home"
    property bool selected:false
    property color accentColor:"#29c7ad"
    property string tip:""
    implicitWidth:62;implicitHeight:62;padding:0
    contentItem:NavIcon { width:25;height:25;anchors.centerIn:parent;kind:root.kind;iconColor:root.enabled?(root.selected?"white":"#a9a4af"):"#55515a" }
    background:Rectangle {
        radius:root.selected?22:18
        color:root.selected?root.accentColor:(root.hovered?"#2bffffff":"#17161c")
        border.width:1;border.color:root.selected?"#4affffff":"#16ffffff"
        scale:root.down ? .94 : (root.hovered ? 1.06 : 1)
        Rectangle { anchors.fill:parent;anchors.margins:-7;radius:parent.radius+7;color:"transparent";border.width:1;border.color:Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,root.selected ? .34 : 0);opacity:root.selected?1:0 }
        Behavior on color{ColorAnimation{duration:180}} Behavior on scale{NumberAnimation{duration:150;easing.type:Easing.OutCubic}}
    }
    ToolTip {
        visible:root.hovered&&root.tip.length>0
        delay:280
        x:root.width+12
        y:8
        contentItem:Text { text:root.tip;color:"white";font.pixelSize:11 }
        background:Rectangle { radius:11;color:"#ee17151d";border.width:1;border.color:"#38ffffff" }
    }
}
