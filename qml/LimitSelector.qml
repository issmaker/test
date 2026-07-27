import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Rectangle {
    id: root
    property real value: 3.0
    property color accentColor: "#ff641f"
    signal valueEdited(real newValue)
    implicitWidth: 188
    implicitHeight: 48
    radius: 15
    color: "#101920"
    border.width: 1
    border.color: Qt.rgba(accentColor.r,accentColor.g,accentColor.b,.38)

    function commit(candidate) {
        const next=Math.max(.5,Math.min(20,Math.round(candidate*10)/10))
        root.valueEdited(next)
        editor.text=next.toFixed(1)
    }
    function change(delta) { commit(root.value+delta) }

    RowLayout {
        anchors.fill: parent
        anchors.margins: 5
        spacing: 4
        AppButton {
            text: "−";implicitWidth:36;implicitHeight:36;leftPadding:0;rightPadding:0
            accent:"#18242b";tip:"Уменьшить максимальный размер на 0,1 MB"
            onClicked:root.change(-.1)
        }
        TextInput {
            id: editor
            Layout.fillWidth: true
            text: root.value.toFixed(1)
            color: "#ffffff"
            font.pixelSize: 16
            font.weight: Font.DemiBold
            horizontalAlignment: Text.AlignRight
            verticalAlignment: Text.AlignVCenter
            selectByMouse: true
            validator: DoubleValidator{bottom:.5;top:20;decimals:1;notation:DoubleValidator.StandardNotation}
            onEditingFinished: {
                const parsed=Number(text.replace(",","."))
                if(!isNaN(parsed))root.commit(parsed)
                text=root.value.toFixed(1)
            }
            Connections{target:root;function onValueChanged(){if(!editor.activeFocus)editor.text=root.value.toFixed(1)}}
        }
        Text{text:"MB";color:"#8da0a8";font.pixelSize:11;font.weight:Font.DemiBold}
        AppButton {
            text: "+";implicitWidth:36;implicitHeight:36;leftPadding:0;rightPadding:0
            accent:root.accentColor;tip:"Увеличить максимальный размер на 0,1 MB"
            onClicked:root.change(.1)
        }
    }
}
