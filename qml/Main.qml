import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs

ApplicationWindow {
    id: win
    width: 1560
    height: 960
    minimumWidth: 1160
    minimumHeight: 760
    visible: true
    title: "Adaptive Texture Optimizer 27 — Mars"
    color: "#050507"
    palette.window: "#050507"
    palette.windowText: "#f5f3f7"
    palette.base: "#121116"
    palette.text: "#f5f3f7"
    palette.button: "#1a191f"
    palette.buttonText: "#f5f3f7"
    palette.highlight: win.accentColor

    property real targetMb: 3.0
    property real fitValue: .25
    property real viewScale: fitValue
    property real panX: 0
    property real panY: 0
    property real pointerX: 0
    property real pointerY: 0
    property real lastSliderValue: .25
    property bool wipeMode: false
    property color accentColor: optimizer.accentColor
    property color warmAccent: Qt.tint("#ff6530", Qt.rgba(accentColor.r, accentColor.g, accentColor.b, .34))
    readonly property url leftImage: optimizer.referenceUrl
                                      ? optimizer.referenceUrl
                                      : (optimizer.workingPreviewUrl
                                         ? optimizer.workingPreviewUrl
                                         : (optimizer.sourceIsLarge ? "" : optimizer.sourceUrl))

    Behavior on accentColor { ColorAnimation { duration: 700; easing.type: Easing.InOutCubic } }
    Behavior on pointerX { NumberAnimation { duration: 100; easing.type: Easing.OutCubic } }
    Behavior on pointerY { NumberAnimation { duration: 100; easing.type: Easing.OutCubic } }

    function resetView() {
        viewScale = fitValue; lastSliderValue = viewScale; panX = 0; panY = 0
    }
    function actualPixels() {
        viewScale = 1; lastSliderValue = viewScale; panX = 0; panY = 0
    }
    function updateView(scale, x, y) {
        viewScale = scale; lastSliderValue = scale; panX = x; panY = y
    }
    function importTexture(url) {
        wipeMode = false; optimizer.load(url); resetView()
    }
    function fileName() {
        if (!optimizer.sourceUrl) return "Перетащите PNG в окно"
        const raw = optimizer.sourceUrl.toString().split("/").pop()
        try { return decodeURIComponent(raw) } catch (error) { return raw }
    }
    function mb(value) { return value > 0 ? value.toFixed(2) + " MB" : "—" }

    FileDialog {
        id: picker
        title: "Выберите PNG-текстуру"
        nameFilters: ["PNG textures (*.png)"]
        onAccepted: win.importTexture(selectedFile)
    }
    Shortcut { sequence: StandardKey.Open; onActivated: picker.open() }
    Shortcut { sequence: "Ctrl+0"; onActivated: win.resetView() }
    Shortcut { sequence: "Ctrl+1"; onActivated: win.actualPixels() }

    MarsBackdrop {
        anchors.fill: parent
        accentColor: win.warmAccent
        pointerX: win.pointerX
        pointerY: win.pointerY
        activity: optimizer.busy ? optimizer.progress : 0
    }

    HoverHandler {
        id: hover
        onPointChanged: {
            win.pointerX = (point.position.x - win.width / 2) / win.width
            win.pointerY = (point.position.y - win.height / 2) / win.height
        }
    }
    DropArea {
        anchors.fill: parent
        onDropped: drop => { if (drop.hasUrls) win.importTexture(drop.urls[0]) }
    }

    Rectangle {
        anchors.fill: parent
        anchors.margins: 16
        radius: 32
        color: "#09000000"
        border.width: 1
        border.color: "#14ffffff"

        RowLayout {
            anchors.fill: parent
            anchors.margins: 14
            spacing: 16

            GlassCard {
                Layout.preferredWidth: 168
                Layout.fillHeight: true
                accentColor: win.warmAccent
                glassOpacity: .70

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 10

                    RowLayout {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 54
                        Rectangle {
                            width: 44; height: 44; radius: 15
                            color: win.warmAccent
                            Text { anchors.centerIn: parent; text: "A+"; color: "white"; font.bold: true; font.pixelSize: 16 }
                        }
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 0
                            Text { text: "AGR"; color: "#ffffff"; font.pixelSize: 17; font.weight: Font.DemiBold }
                            Text { text: "MARS  /  27"; color: "#77727e"; font.pixelSize: 9; font.letterSpacing: 1.2 }
                        }
                    }

                    Rectangle { Layout.fillWidth: true; height: 1; color: "#12ffffff" }

                    Text { text: "РАБОЧЕЕ МЕСТО"; color: "#696570"; font.pixelSize: 9; font.weight: Font.DemiBold; font.letterSpacing: 1 }
                    AppButton {
                        Layout.fillWidth: true; text: "＋  Импорт PNG"; accent: win.warmAccent
                        tip: "Открыть PNG — Ctrl+O"; onClicked: picker.open()
                    }
                    AppButton {
                        Layout.fillWidth: true; text: "◫  Сравнение"; accent: win.accentColor; quiet: true
                        enabled: optimizer.sourceUrl; onClicked: win.wipeMode = false
                    }
                    AppButton {
                        Layout.fillWidth: true; text: "◐  Шторка"; accent: win.accentColor; quiet: !win.wipeMode
                        enabled: optimizer.resultUrl; onClicked: win.wipeMode = true
                    }

                    Text { text: "МАСШТАБ"; color: "#696570"; font.pixelSize: 9; font.weight: Font.DemiBold; font.letterSpacing: 1; Layout.topMargin: 8 }
                    AppButton {
                        Layout.fillWidth: true; text: "Вписать"; quiet: true; accent: win.accentColor
                        onClicked: win.resetView(); tip: "Показать текстуру целиком — Ctrl+0"
                    }
                    AppButton {
                        Layout.fillWidth: true; text: "Пиксели 1:1"; quiet: true; accent: win.accentColor
                        onClicked: win.actualPixels(); tip: "Один пиксель изображения равен пикселю экрана — Ctrl+1"
                    }

                    Item { Layout.fillHeight: true }

                    GlassCard {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 106
                        accentColor: win.accentColor
                        glassOpacity: .62
                        Column {
                            anchors.fill: parent; anchors.margins: 12; spacing: 5
                            Text { text: "AGR ADAPTIVE"; color: "#ffffff"; font.pixelSize: 11; font.weight: Font.DemiBold }
                            Text { text: "RGB24 / ONE MODE"; color: win.accentColor; font.pixelSize: 9; font.weight: Font.Bold }
                            Text {
                                width: parent.width
                                text: "Адаптивный цветовой бюджет без смены режима."
                                color: "#85808b"; font.pixelSize: 9; wrapMode: Text.Wrap
                            }
                        }
                    }
                    Text { text: "by issmaker"; color: "#5d5963"; font.pixelSize: 9; Layout.alignment: Qt.AlignHCenter }
                }
            }

            ColumnLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                spacing: 14

                RowLayout {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 86
                    spacing: 12

                    GlassCard {
                        Layout.fillWidth: true; Layout.fillHeight: true; accentColor: win.accentColor
                        Column { anchors.fill: parent; anchors.margins: 14; spacing: 7
                            Text { text: "SOURCE"; color: "#74707b"; font.pixelSize: 9; font.weight: Font.DemiBold; font.letterSpacing: 1 }
                            Text { text: win.mb(optimizer.sourceFileMb); color: "#ffffff"; font.pixelSize: 20; font.weight: Font.DemiBold }
                            Text { text: optimizer.workingWidth > 0 ? optimizer.workingWidth + " × " + optimizer.workingHeight : "PNG texture"; color: "#8e8994"; font.pixelSize: 9 }
                        }
                    }
                    GlassCard {
                        Layout.fillWidth: true; Layout.fillHeight: true; accentColor: win.warmAccent
                        Column { anchors.fill: parent; anchors.margins: 14; spacing: 7
                            Text { text: "TARGET"; color: "#74707b"; font.pixelSize: 9; font.weight: Font.DemiBold; font.letterSpacing: 1 }
                            Text { text: "≤ " + win.targetMb.toFixed(1) + " MB"; color: "#ffffff"; font.pixelSize: 20; font.weight: Font.DemiBold }
                            Text { text: "editable budget"; color: win.warmAccent; font.pixelSize: 9 }
                        }
                    }
                    GlassCard {
                        Layout.fillWidth: true; Layout.fillHeight: true; accentColor: win.accentColor
                        Column { anchors.fill: parent; anchors.margins: 14; spacing: 7
                            Text { text: "OUTPUT"; color: "#74707b"; font.pixelSize: 9; font.weight: Font.DemiBold; font.letterSpacing: 1 }
                            Text { text: win.mb(optimizer.outputFileMb); color: "#ffffff"; font.pixelSize: 20; font.weight: Font.DemiBold }
                            Text { text: optimizer.resultUrl ? "verified RGB24" : "waiting for result"; color: optimizer.resultUrl ? win.accentColor : "#77727d"; font.pixelSize: 9 }
                        }
                    }
                    GlassCard {
                        Layout.preferredWidth: 230; Layout.fillHeight: true; accentColor: win.accentColor
                        Column { anchors.fill: parent; anchors.margins: 14; spacing: 7
                            Row {
                                width: parent.width; spacing: 8
                                Text { text: optimizer.busy ? "PROCESSING" : "SYSTEM"; color: "#74707b"; font.pixelSize: 9; font.weight: Font.DemiBold; font.letterSpacing: 1 }
                                Text { text: optimizer.busy ? Math.round(optimizer.progress * 100) + "%" : "READY"; color: win.accentColor; font.pixelSize: 9; font.weight: Font.Bold }
                            }
                            Rectangle {
                                width: parent.width; height: 7; radius: 4; color: "#242129"
                                Rectangle { width: parent.width * (optimizer.busy ? optimizer.progress : (optimizer.resultUrl ? 1 : .08)); height: parent.height; radius: 4; color: win.accentColor; Behavior on width { NumberAnimation { duration: 220 } } }
                            }
                            Text { text: optimizer.busy ? optimizer.status : "AGR engine online"; width: parent.width; elide: Text.ElideRight; color: "#8e8994"; font.pixelSize: 9 }
                        }
                    }
                }

                RowLayout {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    spacing: 16

                    Item {
                        Layout.preferredWidth: Math.max(270, win.width * .20)
                        Layout.fillHeight: true

                        Column {
                            anchors.left: parent.left
                            anchors.right: parent.right
                            anchors.bottom: parent.bottom
                            anchors.bottomMargin: 24
                            spacing: 10

                            MetricChip { text: "TEXTURE LAB  /  MARS"; checked: true; accentColor: win.warmAccent }
                            Text {
                                text: "Texture\nOptimizer"
                                color: "#ffffff"
                                font.pixelSize: Math.max(38, Math.min(64, win.width * .037))
                                font.weight: Font.DemiBold
                                lineHeight: .86
                            }
                            Text {
                                width: parent.width
                                text: win.fileName()
                                color: "#aaa5ae"
                                font.pixelSize: 12
                                elide: Text.ElideMiddle
                            }
                            Text {
                                width: parent.width
                                text: "Один точный RGB24-конвейер. Интерфейс подхватывает характер загруженного изображения."
                                color: "#77727d"
                                font.pixelSize: 10
                                wrapMode: Text.Wrap
                                lineHeight: 1.25
                            }
                            Row {
                                spacing: 8
                                MetricChip { text: "SYNC ZOOM"; checked: true; accentColor: win.accentColor }
                                MetricChip { text: "RGB24"; checked: optimizer.resultUrl; accentColor: win.accentColor }
                            }
                        }
                    }

                    GlassCard {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        Layout.minimumWidth: 590
                        accentColor: win.accentColor
                        glassOpacity: .82

                        ColumnLayout {
                            anchors.fill: parent
                            anchors.margins: 12
                            spacing: 10

                            RowLayout {
                                Layout.fillWidth: true
                                Layout.preferredHeight: 42
                                spacing: 8
                                ColumnLayout {
                                    Layout.fillWidth: true; spacing: 1
                                    Text { text: "COMPARISON COCKPIT"; color: "#f5f3f7"; font.pixelSize: 13; font.weight: Font.DemiBold; font.letterSpacing: .7 }
                                    Text { text: win.wipeMode ? "один кадр / интерактивная граница" : "два синхронных окна"; color: "#77727d"; font.pixelSize: 9 }
                                }
                                AppButton { text: "Два окна"; quiet: !win.wipeMode; accent: win.accentColor; implicitHeight: 34; onClicked: win.wipeMode = false }
                                AppButton { text: "Шторка"; quiet: win.wipeMode; accent: win.accentColor; implicitHeight: 34; enabled: optimizer.resultUrl; onClicked: win.wipeMode = true }
                                MetricChip { text: Math.round(win.viewScale * 100) + "%"; accentColor: win.accentColor }
                            }

                            RowLayout {
                                visible: !win.wipeMode
                                Layout.fillWidth: true
                                Layout.fillHeight: true
                                spacing: 10
                                ZoomView {
                                    id: leftZoom
                                    Layout.fillWidth: true; Layout.fillHeight: true
                                    title: optimizer.sourceIsLarge ? "BEFORE  /  WORKING 2K" : "BEFORE  /  ORIGINAL"
                                    imageSource: win.leftImage
                                    sharedScale: win.viewScale; sharedPanX: win.panX; sharedPanY: win.panY
                                    parallaxX: win.pointerX; parallaxY: win.pointerY; accentColor: win.accentColor
                                    onViewChanged: (scale, x, y) => win.updateView(scale, x, y)
                                    onZoomPulse: direction => {}
                                    onResetRequested: win.resetView()
                                    onFitCalculated: scale => { win.fitValue = scale; if (win.panX === 0 && win.panY === 0) { win.viewScale = scale; win.lastSliderValue = scale } }
                                }
                                ZoomView {
                                    Layout.fillWidth: true; Layout.fillHeight: true
                                    title: "AFTER  /  AGR RGB24"
                                    imageSource: optimizer.resultUrl
                                    sharedScale: win.viewScale; sharedPanX: win.panX; sharedPanY: win.panY
                                    parallaxX: win.pointerX; parallaxY: win.pointerY; accentColor: win.accentColor
                                    onViewChanged: (scale, x, y) => win.updateView(scale, x, y)
                                    onZoomPulse: direction => {}
                                    onResetRequested: win.resetView()
                                }
                            }

                            WipeCompare {
                                visible: win.wipeMode
                                Layout.fillWidth: true
                                Layout.fillHeight: true
                                beforeSource: win.leftImage
                                afterSource: optimizer.resultUrl
                                sharedScale: win.viewScale; sharedPanX: win.panX; sharedPanY: win.panY
                                parallaxX: win.pointerX; parallaxY: win.pointerY; accentColor: win.accentColor
                                onViewChanged: (scale, x, y) => win.updateView(scale, x, y)
                                onZoomPulse: direction => {}
                                onResetRequested: win.resetView()
                                onFitCalculated: scale => { win.fitValue = scale; if (win.panX === 0 && win.panY === 0) { win.viewScale = scale; win.lastSliderValue = scale } }
                            }

                            RowLayout {
                                Layout.fillWidth: true
                                Layout.preferredHeight: 44
                                spacing: 8
                                AppButton { text: "Вписать"; quiet: true; accent: win.accentColor; implicitHeight: 34; onClicked: win.resetView() }
                                AppButton { text: "1:1"; quiet: true; accent: win.accentColor; implicitHeight: 34; onClicked: win.actualPixels() }
                                Slider {
                                    id: scaleSlider
                                    Layout.fillWidth: true
                                    from: .08; to: 8; value: win.viewScale
                                    onMoved: leftZoom.publish(value, win.panX, win.panY)
                                    background: Rectangle {
                                        x: scaleSlider.leftPadding; y: scaleSlider.topPadding + scaleSlider.availableHeight / 2 - height / 2
                                        width: scaleSlider.availableWidth; height: 5; radius: 3; color: "#29262e"
                                        Rectangle { width: scaleSlider.visualPosition * parent.width; height: parent.height; radius: 3; color: win.accentColor }
                                    }
                                    handle: Rectangle {
                                        x: scaleSlider.leftPadding + scaleSlider.visualPosition * (scaleSlider.availableWidth - width)
                                        y: scaleSlider.topPadding + scaleSlider.availableHeight / 2 - height / 2
                                        width: 17; height: 17; radius: 9; color: "#ffffff"; border.width: 4; border.color: win.accentColor
                                    }
                                }
                            }
                        }
                    }
                }

                GlassCard {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 102
                    accentColor: win.accentColor
                    RowLayout {
                        anchors.fill: parent
                        anchors.margins: 12
                        spacing: 12

                        ColumnLayout {
                            Layout.preferredWidth: 210; spacing: 3
                            Text { text: "OUTPUT BUDGET"; color: "#74707b"; font.pixelSize: 9; font.weight: Font.DemiBold; font.letterSpacing: 1 }
                            LimitSelector { value: win.targetMb; accentColor: win.accentColor; onValueEdited: newValue => win.targetMb = newValue }
                        }
                        Rectangle { width: 1; Layout.fillHeight: true; color: "#12ffffff" }
                        Sparkline {
                            Layout.fillWidth: true; Layout.fillHeight: true
                            values: optimizer.progressHistory; active: optimizer.busy; lineColor: win.accentColor
                            title: optimizer.busy ? "LIVE PIPELINE" : "PROCESS HISTORY"
                            valueText: Math.round(optimizer.progress * 100) + "%"
                        }
                        ColumnLayout {
                            Layout.preferredWidth: 330; Layout.fillHeight: true; spacing: 5
                            Text { text: "STATUS"; color: "#74707b"; font.pixelSize: 9; font.weight: Font.DemiBold; font.letterSpacing: 1 }
                            Text { text: optimizer.report || optimizer.status; color: "#aaa6b0"; font.pixelSize: 9; wrapMode: Text.Wrap; elide: Text.ElideRight; maximumLineCount: 3; Layout.fillWidth: true; Layout.fillHeight: true }
                        }
                        AppButton {
                            text: optimizer.busy ? "Оптимизация…" : "Оптимизировать"
                            accent: win.accentColor; implicitWidth: 170; implicitHeight: 48
                            enabled: optimizer.sourceUrl && !optimizer.busy && !optimizer.previewBusy
                            tip: "Запустить AGR Adaptive RGB24 с проверкой размера и RGB24"
                            onClicked: optimizer.optimize(win.targetMb)
                        }
                        ColumnLayout {
                            spacing: 5
                            AppButton { text: "Исходник"; quiet: true; accent: win.accentColor; implicitHeight: 32; enabled: optimizer.sourceUrl; onClicked: optimizer.openSourceFolder() }
                            AppButton { text: "Результат"; quiet: true; accent: win.accentColor; implicitHeight: 32; enabled: optimizer.outputPath; onClicked: optimizer.openOutputFolder() }
                        }
                    }
                }
            }
        }
    }
}
