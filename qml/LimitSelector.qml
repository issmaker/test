import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Rectangle {
    id: root
    property real value: 3.0
    property color accentColor: "#ff7139"
    signal valueEdited(real newValue)
    implicitWidth: 174
    implicitHeight: 42
    radius: 13
    color: "#b416151b"
    border.width: 1
    border.color: Qt.rgba(accentColor.r, accentColor.g, accentColor.b, .32)

    function commit(candidate) {
        const next = Math.max(.5, Math.min(20, Math.round(candidate * 10) / 10))
        root.valueEdited(next)
        editor.text = next.toFixed(1)
    }
    function change(delta) { commit(root.value + delta) }

    RowLayout {
        anchors.fill: parent
        anchors.margins: 4
        spacing: 3
        AppButton {
            text: "−"; implicitWidth: 34; implicitHeight: 34
            leftPadding: 0; rightPadding: 0; quiet: true
            accent: root.accentColor
            tip: "Уменьшить предел на 0,1 MB"
            onClicked: root.change(-.1)
        }
        TextInput {
            id: editor
            Layout.fillWidth: true
            text: root.value.toFixed(1)
            color: "#ffffff"
            font.pixelSize: 15
            font.weight: Font.DemiBold
            horizontalAlignment: Text.AlignRight
            verticalAlignment: Text.AlignVCenter
            selectByMouse: true
            validator: DoubleValidator { bottom: .5; top: 20; decimals: 1 }
            onEditingFinished: {
                const parsed = Number(text.replace(",", "."))
                if (!isNaN(parsed)) root.commit(parsed)
                text = root.value.toFixed(1)
            }
            Connections {
                target: root
                function onValueChanged() { if (!editor.activeFocus) editor.text = root.value.toFixed(1) }
            }
        }
        Text { text: "MB"; color: "#8f8b98"; font.pixelSize: 10; font.weight: Font.DemiBold }
        AppButton {
            text: "+"; implicitWidth: 34; implicitHeight: 34
            leftPadding: 0; rightPadding: 0
            accent: root.accentColor
            tip: "Увеличить предел на 0,1 MB"
            onClicked: root.change(.1)
        }
    }
}
