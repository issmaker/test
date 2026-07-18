import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Rectangle {
    id: root
    property real value: 3.0
    property color accentColor: "#ff641f"
    implicitWidth: 188
    implicitHeight: 48
    radius: 15
    color: "#101920"
    border.width: 1
    border.color: Qt.rgba(accentColor.r,accentColor.g,accentColor.b,.38)

    function change(delta) { value=Math.max(1,Math.min(10,Math.round((value+delta)*10)/10)) }

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
            validator: DoubleValidator{bottom:1;top:10;decimals:1;notation:DoubleValidator.StandardNotation}
            onEditingFinished: {
                const parsed=Number(text.replace(",","."))
                if(!isNaN(parsed))root.value=Math.max(1,Math.min(10,Math.round(parsed*10)/10))
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
