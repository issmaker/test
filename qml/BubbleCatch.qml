import QtQuick

Item {
    id:root
    property bool running:true
    property color accentColor:"#29c7ad"
    signal caught(real x,real y)
    function relocate(){
        bubble.x=150+Math.random()*Math.max(20,width-bubble.width-230)
        bubble.y=70+Math.random()*Math.max(20,height-bubble.height-140)
        drift.restart()
    }
    onRunningChanged:{if(running)relocate();else drift.stop()}
    Rectangle {
        id:bubble;visible:root.running;width:38;height:38;radius:19
        color:"#22090c0c"
        border.width:2;border.color:Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.82)
        Rectangle{anchors.centerIn:parent;width:10;height:10;radius:5;color:root.accentColor}
        Rectangle{anchors.fill:parent;anchors.margins:-8;radius:width/2;color:"transparent";border.width:2;border.color:Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.20);SequentialAnimation on scale{loops:Animation.Infinite;NumberAnimation{from:.82;to:1.18;duration:650;easing.type:Easing.OutCubic}NumberAnimation{from:1.18;to:.82;duration:650;easing.type:Easing.InCubic}}}
        Rectangle{anchors.centerIn:parent;width:parent.width+12;height:3;radius:2;color:Qt.rgba(root.accentColor.r,root.accentColor.g,root.accentColor.b,.38);rotation:45;RotationAnimation on rotation{from:0;to:360;duration:2600;loops:Animation.Infinite}}
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
