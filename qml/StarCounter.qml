import QtQuick

Rectangle {
    id: root
    property int count: 0
    property color accentColor: "#ff641f"
    implicitWidth: 136
    implicitHeight: 34
    radius: 12
    color: "#b50c151b"
    border.width: 1
    border.color: Qt.rgba(accentColor.r,accentColor.g,accentColor.b,.34)

    Row {
        anchors.centerIn: parent
        spacing: 7
        Text {
            id: star
            text: "★"
            color: root.accentColor
            font.pixelSize: 16
            transformOrigin: Item.Center
        }
        Text {
            text: root.count
            color: "#f3fafc"
            font.pixelSize: 13
            font.weight: Font.Bold
        }
        Text {
            text: "ПОЙМАНО"
            color: "#78909b"
            font.pixelSize: 9
            font.weight: Font.DemiBold
        }
    }

    SequentialAnimation {
        id: catchPulse
        ParallelAnimation {
            NumberAnimation{target:star;property:"scale";from:1;to:1.65;duration:130;easing.type:Easing.OutBack}
            NumberAnimation{target:root;property:"border.width";from:1;to:3;duration:130}
        }
        ParallelAnimation {
            NumberAnimation{target:star;property:"scale";to:1;duration:360;easing.type:Easing.OutElastic}
            NumberAnimation{target:root;property:"border.width";to:1;duration:300}
        }
    }
    onCountChanged: if(count>0){catchPulse.restart()}
}
