import QtQuick

Item {
    id:root
    property bool running:true
    property color accentColor:"#b24fff"
    signal caught(real x,real y)
    function relocate(){
        bubble.x=150+Math.random()*Math.max(20,width-bubble.width-230)
        bubble.y=70+Math.random()*Math.max(20,height-bubble.height-140)
        drift.restart()
    }
    onRunningChanged:{if(running)relocate();else drift.stop()}
    Rectangle {
        id:bubble;visible:root.running;width:34;height:34;radius:17
        color:Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.34)
        border.width:1;border.color:"#aaffffff"
        Rectangle{width:10;height:6;radius:4;x:7;y:6;rotation:-25;color:"#baffffff"}
        Rectangle{anchors.fill:parent;anchors.margins:-8;radius:width/2;color:"transparent";border.width:2;border.color:Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.18)}
        TapHandler { onTapped:{root.caught(bubble.x+bubble.width/2,bubble.y+bubble.height/2);pop.restart()} }
        SequentialAnimation {
            id:drift
            ParallelAnimation { NumberAnimation{target:bubble;property:"x";to:root.width*.72;duration:1800;easing.type:Easing.InOutSine} NumberAnimation{target:bubble;property:"y";to:root.height*.28;duration:1800;easing.type:Easing.InOutSine} }
            ParallelAnimation { NumberAnimation{target:bubble;property:"x";to:root.width*.34;duration:2300;easing.type:Easing.InOutSine} NumberAnimation{target:bubble;property:"y";to:root.height*.68;duration:2300;easing.type:Easing.InOutSine} }
            ScriptAction{script:root.relocate()}
        }
        SequentialAnimation { id:pop;NumberAnimation{target:bubble;property:"scale";to:1.65;duration:90} NumberAnimation{target:bubble;property:"opacity";to:0;duration:120} ScriptAction{script:{bubble.scale=1;bubble.opacity=1;root.relocate()}} }
    }
    Component.onCompleted:if(running)relocate()
}
