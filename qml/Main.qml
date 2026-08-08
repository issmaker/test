import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs

ApplicationWindow {
    id: win
    width: 1560
    height: 960
    minimumWidth: 1180
    minimumHeight: 760
    visible: true
    visibility: Window.FullScreen
    title: "Adaptive Texture Optimizer 29 — AGR Astro"
    color: "#050507"

    // 0 — start, 1 — НПМ, 2 — batch list, 3 — batch comparison
    property int screen: 0
    property int batchIndex: -1
    property bool wipeMode: false
    property real fitValue: .25
    property real viewScale: fitValue
    property real panX: 0
    property real panY: 0
    property real pointerX: 0
    property real pointerY: 0
    readonly property var batchItem: batchIndex >= 0 && batchIndex < optimizer.batchItems.length
                                     ? optimizer.batchItems[batchIndex] : null
    property color uiAccent: screen >= 2 ? "#8b4ed8" : "#ed6d32"
    property color warmAccent: Qt.tint("#ff6530", Qt.rgba(uiAccent.r, uiAccent.g, uiAccent.b, .28))
    readonly property url npmBefore: optimizer.referenceUrl ? optimizer.referenceUrl
                                    : (optimizer.workingPreviewUrl ? optimizer.workingPreviewUrl
                                       : (optimizer.sourceIsLarge ? "" : optimizer.sourceUrl))

    palette.window: "#050507"
    palette.windowText: "#f5f3f7"
    palette.base: "#121116"
    palette.text: "#f5f3f7"
    palette.button: "#1a191f"
    palette.buttonText: "#f5f3f7"
    palette.highlight: uiAccent

    Behavior on uiAccent { ColorAnimation { duration: 600; easing.type: Easing.InOutCubic } }
    Behavior on pointerX { NumberAnimation { duration: 100; easing.type: Easing.OutCubic } }
    Behavior on pointerY { NumberAnimation { duration: 100; easing.type: Easing.OutCubic } }

    function resetView() { viewScale = fitValue; panX = 0; panY = 0 }
    function actualPixels() { viewScale = 1; panX = 0; panY = 0 }
    function updateView(scale, x, y) { viewScale = scale; panX = x; panY = y }
    function enterNpm() { screen = 1; wipeMode = false; resetView() }
    function enterBatch() { screen = 2; wipeMode = false; batchIndex = -1; resetView() }
    function compareBatch(index) { batchIndex = index; screen = 3; wipeMode = false; resetView() }
    function fileName(url) {
        if (!url) return "PNG не выбран"
        const raw = url.toString().split("/").pop()
        try { return decodeURIComponent(raw) } catch (error) { return raw }
    }
    function mb(value) { return value > 0 ? Number(value).toFixed(2) + " MB" : "—" }
    function addDropped(urls) {
        const values=[]; for(let i=0;i<urls.length;++i)values.push(urls[i])
        optimizer.addBatchFiles(values)
    }

    FileDialog {
        id: npmPicker
        title: "Выберите НПМ PNG-текстуру"
        nameFilters: ["PNG textures (*.png)"]
        onAccepted: { optimizer.load(selectedFile); win.enterNpm() }
    }
    FileDialog {
        id: batchPicker
        title: "Добавьте PNG-текстуры"
        fileMode: FileDialog.OpenFiles
        nameFilters: ["PNG textures (*.png)"]
        onAccepted: {
            const values=[]; for(let i=0;i<selectedFiles.length;++i)values.push(selectedFiles[i])
            optimizer.addBatchFiles(values)
        }
    }
    Shortcut { sequence: StandardKey.Open; onActivated: win.screen === 1 ? npmPicker.open() : batchPicker.open() }
    Shortcut { sequence: "Ctrl+0"; onActivated: win.resetView() }
    Shortcut { sequence: "Ctrl+1"; onActivated: win.actualPixels() }
    Shortcut { sequence: StandardKey.Cancel; enabled: !optimizer.busy && !optimizer.batchBusy; onActivated: { if(win.screen === 3)win.screen=2; else if(win.screen!==0)win.screen=0 } }

    MarsBackdrop {
        anchors.fill: parent
        accentColor: win.screen >= 2 ? "#8b4ed8" : "#ed6d32"
        pointerX: win.pointerX
        pointerY: win.pointerY
        activity: optimizer.busy ? optimizer.progress : (optimizer.batchBusy ? optimizer.batchProgress : 0)
        opacity: win.screen === 0 ? 1 : .78
    }
    HoverHandler {
        onPointChanged: {
            win.pointerX = (point.position.x - win.width / 2) / win.width
            win.pointerY = (point.position.y - win.height / 2) / win.height
        }
    }
    DropArea {
        anchors.fill: parent
        onDropped: drop => {
            if(!drop.hasUrls)return
            if(win.screen === 1){ optimizer.load(drop.urls[0]); win.resetView() }
            else if(win.screen === 2)win.addDropped(drop.urls)
        }
    }

    Rectangle {
        anchors.fill: parent
        anchors.margins: 16
        radius: 32
        color: "#10000000"
        border.width: 1
        border.color: "#16ffffff"

        GlassCard {
            id: sideRail
            z: 40
            visible: win.screen !== 0
            anchors.left: parent.left; anchors.top: parent.top; anchors.bottom: parent.bottom
            anchors.margins: 14
            width: 96
            accentColor: win.uiAccent
            glassOpacity: .76

            ColumnLayout {
                anchors.fill: parent; anchors.margins: 11; spacing: 11
                Rectangle {
                    Layout.alignment: Qt.AlignHCenter
                    width: 54; height: 54; radius: 18; color: win.uiAccent
                    Text { anchors.centerIn:parent; text:"A✦"; color:"white"; font.pixelSize:17; font.bold:true }
                }
                Text { Layout.alignment:Qt.AlignHCenter; text:"AGR+"; color:"white"; font.pixelSize:12; font.weight:Font.DemiBold }
                Rectangle { Layout.fillWidth:true; height:1; color:"#14ffffff" }
                AppButton { Layout.fillWidth:true; text:"⌂"; quiet:win.screen!==0; accent:win.uiAccent; leftPadding:0; rightPadding:0; tipRight:true; tip:"Главный экран и выбор режима"; enabled:!optimizer.busy&&!optimizer.batchBusy; onClicked:win.screen=0 }
                AppButton { Layout.fillWidth:true; text:"НПМ"; quiet:win.screen!==1; accent:win.uiAccent; leftPadding:0; rightPadding:0; tipRight:true; tip:"Оптимизация НПМ-текстур до 3 MB"; enabled:!optimizer.batchBusy; onClicked:win.enterNpm() }
                AppButton { Layout.fillWidth:true; text:"▦"; quiet:win.screen!==2; accent:win.uiAccent; leftPadding:0; rightPadding:0; tipRight:true; tip:"Список пакетной оптимизации текстур"; enabled:!optimizer.busy; onClicked:win.screen=2 }
                AppButton { Layout.fillWidth:true; text:"◫"; quiet:win.screen!==3; accent:win.uiAccent; leftPadding:0; rightPadding:0; tipRight:true; tip:"Сравнительный анализ выбранной текстуры"; enabled:win.batchItem&&win.batchItem.done&&!optimizer.batchBusy; onClicked:win.screen=3 }
                Item { Layout.fillHeight:true }
                MetricChip { Layout.alignment:Qt.AlignHCenter; text:"v29"; checked:true; accentColor:win.uiAccent }
                AppButton { Layout.fillWidth:true; text:"⏻"; quiet:true; accent:"#d45563"; leftPadding:0; rightPadding:0; tipRight:true; tip:"Закрыть приложение"; enabled:!optimizer.busy&&!optimizer.batchBusy; onClicked:Qt.quit() }
            }
        }

        // START SCREEN
        Item {
            anchors.fill: parent
            visible: win.screen === 0

            ColumnLayout {
                anchors.centerIn: parent
                width: Math.min(1040, parent.width - 80)
                spacing: 24

                RowLayout {
                    Layout.alignment: Qt.AlignHCenter
                    spacing: 14
                    Rectangle {
                        width: 58; height: 58; radius: 19; color: win.warmAccent
                        Text { anchors.centerIn: parent; text: "A+"; color: "white"; font.pixelSize: 20; font.bold: true }
                    }
                    ColumnLayout {
                        spacing: 1
                        Text { text: "Adaptive Texture Optimizer"; color: "white"; font.pixelSize: 30; font.weight: Font.DemiBold }
                        Text { text: "AGR ASTRO  /  VERSION 29  /  ВЫБЕРИТЕ ЗАДАЧУ"; color: "#8b8691"; font.pixelSize: 10; font.letterSpacing: 1.4 }
                    }
                }

                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: "Как будем оптимизировать текстуры?"
                    color: "#f6f3f8"; font.pixelSize: 18
                }

                RowLayout {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 340
                    spacing: 20

                    GlassCard {
                        Layout.fillWidth: true; Layout.fillHeight: true
                        accentColor: win.warmAccent; glassOpacity: .84
                        ColumnLayout {
                            anchors.fill: parent; anchors.margins: 28; spacing: 14
                            Rectangle {
                                width: 50; height: 50; radius: 16; color: win.warmAccent
                                Text { anchors.centerIn: parent; text: "≤3"; color: "white"; font.pixelSize: 16; font.bold: true }
                            }
                            Text { text: "Оптимизация для\nНПМ-текстур"; color: "white"; font.pixelSize: 26; font.weight: Font.DemiBold; lineHeight: .95 }
                            Text {
                                Layout.fillWidth: true
                                text: "Одна текстура. Автоматический предел меньше 3 MB, рабочий размер до 2K и обязательный RGB24."
                                color: "#9d98a3"; font.pixelSize: 12; wrapMode: Text.Wrap; lineHeight: 1.3
                            }
                            Item { Layout.fillHeight: true }
                            Row { spacing: 8
                                MetricChip { text: "≤ 3 MB"; checked: true; accentColor: win.warmAccent }
                                MetricChip { text: "RGB24"; checked: true; accentColor: win.warmAccent }
                                MetricChip { text: "1 FILE"; accentColor: win.warmAccent }
                            }
                            AppButton { Layout.fillWidth: true; text: "Открыть НПМ-оптимизатор"; accent: win.warmAccent; implicitHeight: 50; tip:"Один PNG, автоматический предел меньше 3 MB"; onClicked: win.enterNpm() }
                        }
                    }

                    GlassCard {
                        Layout.fillWidth: true; Layout.fillHeight: true
                        accentColor: "#745cff"; glassOpacity: .84
                        ColumnLayout {
                            anchors.fill: parent; anchors.margins: 28; spacing: 14
                            Rectangle {
                                width: 50; height: 50; radius: 16; color: "#745cff"
                                Text { anchors.centerIn: parent; text: "∞"; color: "white"; font.pixelSize: 24; font.bold: true }
                            }
                            Text { text: "Оптимизация\nтекстур"; color: "white"; font.pixelSize: 26; font.weight: Font.DemiBold; lineHeight: .95 }
                            Text {
                                Layout.fillWidth: true
                                text: "Много файлов 2K/4K. Без лимита MB: автоматический поиск лучшего уменьшения веса при безопасном качестве."
                                color: "#9d98a3"; font.pixelSize: 12; wrapMode: Text.Wrap; lineHeight: 1.3
                            }
                            Item { Layout.fillHeight: true }
                            Row { spacing: 8
                                MetricChip { text: "AUTO QUALITY"; checked: true; accentColor: "#745cff" }
                                MetricChip { text: "RGB24"; checked: true; accentColor: "#745cff" }
                                MetricChip { text: "BATCH"; accentColor: "#745cff" }
                            }
                            AppButton { Layout.fillWidth: true; text: "Открыть оптимизатор текстур"; accent: "#745cff"; implicitHeight: 50; onClicked: win.enterBatch() }
                        }
                    }
                }
                Text { Layout.alignment: Qt.AlignHCenter; text: "Все результаты сохраняются рядом с исходниками в папке compressed"; color: "#68636e"; font.pixelSize: 10 }
            }
        }

        // НПМ WORKSPACE
        ColumnLayout {
            anchors.fill: parent
            anchors.leftMargin: 124; anchors.rightMargin: 14; anchors.topMargin: 14; anchors.bottomMargin: 14
            visible: win.screen === 1
            spacing: 12

            RowLayout {
                Layout.fillWidth: true; Layout.minimumHeight: 54; Layout.maximumHeight: 54
                AppButton { text: "← Выбор режима"; quiet: true; accent: win.uiAccent; enabled: !optimizer.busy; onClicked: win.screen = 0 }
                ColumnLayout { Layout.fillWidth: true; spacing: 0
                    Text { text: "AGR Astro ✦  /  Оптимизация для НПМ-текстур"; color: "white"; font.pixelSize: 20; font.weight: Font.DemiBold }
                    Text { text: "Фиксированный предел ≤ 3 MB  /  AGR ADAPTIVE RGB24"; color: "#817c87"; font.pixelSize: 9; font.letterSpacing: .8 }
                }
                AppButton { text: "Импорт PNG"; accent: win.warmAccent; enabled: !optimizer.busy; onClicked: npmPicker.open() }
            }

            RowLayout {
                Layout.fillWidth: true; Layout.minimumHeight: 82; Layout.maximumHeight: 82; spacing: 10
                GlassCard { Layout.fillWidth: true; Layout.fillHeight: true; accentColor: win.uiAccent
                    Column { anchors.fill: parent; anchors.margins: 13; spacing: 6
                        Text { text: "SOURCE"; color: "#77727d"; font.pixelSize: 9; font.bold: true }
                        Text { text: win.mb(optimizer.sourceFileMb); color: "white"; font.pixelSize: 19; font.weight: Font.DemiBold }
                        Text { text: optimizer.sourceWidth > 0 ? optimizer.sourceWidth + " × " + optimizer.sourceHeight : "PNG не выбран"; color: "#8c8792"; font.pixelSize: 9 }
                    }
                }
                GlassCard { Layout.fillWidth: true; Layout.fillHeight: true; accentColor: win.warmAccent
                    Column { anchors.fill: parent; anchors.margins: 13; spacing: 6
                        Text { text: "НПМ TARGET"; color: "#77727d"; font.pixelSize: 9; font.bold: true }
                        Text { text: "≤ 3.0 MB"; color: "white"; font.pixelSize: 19; font.weight: Font.DemiBold }
                        Text { text: "фиксировано автоматически"; color: win.warmAccent; font.pixelSize: 9 }
                    }
                }
                GlassCard { Layout.fillWidth: true; Layout.fillHeight: true; accentColor: win.uiAccent
                    Column { anchors.fill: parent; anchors.margins: 13; spacing: 6
                        Text { text: "OUTPUT"; color: "#77727d"; font.pixelSize: 9; font.bold: true }
                        Text { text: win.mb(optimizer.outputFileMb); color: "white"; font.pixelSize: 19; font.weight: Font.DemiBold }
                        Text { text: optimizer.resultUrl ? "verified RGB24" : "ожидание"; color: optimizer.resultUrl ? win.uiAccent : "#77727d"; font.pixelSize: 9 }
                    }
                }
                GlassCard { Layout.preferredWidth: 290; Layout.fillHeight: true; accentColor: win.uiAccent
                    Column { anchors.fill: parent; anchors.margins: 13; spacing: 7
                        Text { text: optimizer.busy ? "PROCESSING  " + Math.round(optimizer.progress*100) + "%" : "SYSTEM READY"; color: optimizer.busy ? win.uiAccent : "#8f8a95"; font.pixelSize: 9; font.bold: true }
                        Rectangle { width: parent.width; height: 7; radius: 4; color: "#29262e"
                            Rectangle { width: parent.width*(optimizer.busy?optimizer.progress:(optimizer.resultUrl?1:.06)); height: parent.height; radius: 4; color: win.uiAccent; Behavior on width { NumberAnimation { duration: 200 } } }
                        }
                        Text { text: optimizer.status; width: parent.width; elide: Text.ElideRight; color: "#8c8792"; font.pixelSize: 9 }
                    }
                }
            }

            GlassCard {
                objectName: "npmComparisonPanel"
                Layout.fillWidth: true; Layout.fillHeight: true; Layout.minimumHeight: 390
                accentColor: win.uiAccent; glassOpacity: .28
                ColumnLayout {
                    anchors.fill: parent; anchors.margins: 12; spacing: 9
                    RowLayout { Layout.fillWidth: true; Layout.minimumHeight: 38; Layout.maximumHeight: 38
                        ColumnLayout { Layout.fillWidth: true; spacing: 0
                            Text { text: "СРАВНИТЕЛЬНЫЙ АНАЛИЗ"; color: "white"; font.pixelSize: 13; font.weight: Font.DemiBold; font.letterSpacing: .6 }
                            Text { text: win.wipeMode ? "интерактивная граница" : "два синхронных окна"; color: "#77727d"; font.pixelSize: 9 }
                        }
                        AppButton { text: "Два окна"; quiet: win.wipeMode; accent: win.uiAccent; implicitHeight: 32; onClicked: win.wipeMode=false }
                        AppButton { text: "Шторка"; quiet: !win.wipeMode; accent: win.uiAccent; implicitHeight: 32; enabled: optimizer.resultUrl; onClicked: win.wipeMode=true }
                        MetricChip { text: Math.round(win.viewScale*100)+"%"; accentColor: win.uiAccent }
                    }
                    RowLayout { visible: !win.wipeMode; Layout.fillWidth: true; Layout.fillHeight: true; spacing: 10
                        ZoomView { id:npmLeft; Layout.fillWidth:true; Layout.fillHeight:true; title:"BEFORE / ORIGINAL"; imageSource:win.npmBefore; sharedScale:win.viewScale; sharedPanX:win.panX; sharedPanY:win.panY; accentColor:win.uiAccent; onViewChanged:(s,x,y)=>win.updateView(s,x,y); onZoomPulse:d=>{}; onResetRequested:win.resetView(); onFitCalculated:s=>{win.fitValue=s;if(win.panX===0&&win.panY===0)win.viewScale=s} }
                        ZoomView { Layout.fillWidth:true; Layout.fillHeight:true; title:"AFTER / AGR RGB24"; imageSource:optimizer.resultUrl; sharedScale:win.viewScale; sharedPanX:win.panX; sharedPanY:win.panY; accentColor:win.uiAccent; onViewChanged:(s,x,y)=>win.updateView(s,x,y); onZoomPulse:d=>{}; onResetRequested:win.resetView() }
                    }
                    WipeCompare { visible:win.wipeMode; Layout.fillWidth:true; Layout.fillHeight:true; beforeSource:win.npmBefore; afterSource:optimizer.resultUrl; sharedScale:win.viewScale; sharedPanX:win.panX; sharedPanY:win.panY; accentColor:win.uiAccent; onViewChanged:(s,x,y)=>win.updateView(s,x,y); onZoomPulse:d=>{}; onResetRequested:win.resetView(); onFitCalculated:s=>{win.fitValue=s;if(win.panX===0&&win.panY===0)win.viewScale=s} }
                    RowLayout { Layout.fillWidth:true; Layout.minimumHeight:36; Layout.maximumHeight:36
                        AppButton { text:"Вписать"; quiet:true; accent:win.uiAccent; implicitHeight:32; onClicked:win.resetView() }
                        AppButton { text:"1:1"; quiet:true; accent:win.uiAccent; implicitHeight:32; onClicked:win.actualPixels() }
                        Slider { id:npmScale; Layout.fillWidth:true; from:.01; to:8; value:win.viewScale; onMoved:npmLeft.publish(value,win.panX,win.panY) }
                    }
                }
            }

            GlassCard {
                Layout.fillWidth: true; Layout.minimumHeight: 108; Layout.maximumHeight: 108; accentColor: win.uiAccent
                RowLayout { anchors.fill:parent; anchors.margins:11; spacing:12
                    Text { Layout.preferredWidth:280; text:optimizer.report||"Импортируйте PNG. Исходник и результат появятся в двух окнах выше."; color:optimizer.report?"#aaa5af":"#77727d"; font.pixelSize:9; wrapMode:Text.Wrap; maximumLineCount:4; elide:Text.ElideRight }
                    Sparkline { Layout.fillWidth:true; Layout.fillHeight:true; values:optimizer.progressHistory; active:optimizer.busy; lineColor:"#ba3d93"; title:"RGB24 PIPELINE"; valueText:Math.round(optimizer.progress*100)+"%" }
                    Sparkline { Layout.fillWidth:true; Layout.fillHeight:true; values:optimizer.activityHistory; active:optimizer.busy; lineColor:"#4678ce"; title:"ANALYSIS LOAD"; valueText:optimizer.busy?"LIVE":"IDLE" }
                    RadialGauge { Layout.preferredWidth:82; Layout.fillHeight:true; value:optimizer.progress; accentColor:"#ba3d93"; label:"ENCODE" }
                    RadialGauge { Layout.preferredWidth:82; Layout.fillHeight:true; value:optimizer.busy ? .72 : (optimizer.resultUrl ? 1 : 0); accentColor:"#4678ce"; label:"RGB24" }
                    AppButton { text:optimizer.busy?"Остановить":"Оптимизировать до 3 MB"; accent:optimizer.busy?"#d45563":win.uiAccent; implicitWidth:210; enabled:optimizer.busy||(optimizer.sourceUrl&&!optimizer.previewBusy); tip:optimizer.busy?"Безопасно остановить текущую обработку":"Запустить НПМ-оптимизацию"; onClicked:optimizer.busy?optimizer.stopCurrent():optimizer.optimize(2.99) }
                    AppButton { text:"Папка результата"; quiet:true; accent:win.uiAccent; enabled:optimizer.outputPath; onClicked:optimizer.openOutputFolder() }
                }
            }
        }

        // BATCH LIST
        ColumnLayout {
            anchors.fill: parent; anchors.leftMargin:124; anchors.rightMargin:14; anchors.topMargin:14; anchors.bottomMargin:14
            visible: win.screen === 2; spacing: 12

            RowLayout {
                Layout.fillWidth:true; Layout.minimumHeight:54; Layout.maximumHeight:54; spacing:10
                AppButton { text:"← Выбор режима"; quiet:true; accent:win.uiAccent; enabled:!optimizer.batchBusy; onClicked:win.screen=0 }
                ColumnLayout { Layout.fillWidth:true; spacing:0
                    Text { text:"AGR Astro ✦  /  Оптимизация текстур"; color:"white"; font.pixelSize:20; font.weight:Font.DemiBold }
                    Text { text:"ПАКЕТНЫЙ RGB24  /  AUTO QUALITY  /  БЕЗ ЛИМИТА MB"; color:"#85808e"; font.pixelSize:9; font.letterSpacing:.8 }
                }
                MetricChip { text:optimizer.batchItems.length+" FILES"; checked:optimizer.batchItems.length>0; accentColor:win.uiAccent }
                AppButton { text:"Добавить PNG"; accent:win.uiAccent; enabled:!optimizer.batchBusy; onClicked:batchPicker.open() }
                AppButton { text:"Очистить"; quiet:true; accent:win.uiAccent; enabled:!optimizer.batchBusy&&optimizer.batchItems.length>0; onClicked:optimizer.clearBatch() }
                AppButton { text:optimizer.batchBusy?"Остановить":"Оптимизировать все"; accent:optimizer.batchBusy?"#d45563":"#8b4ed8"; implicitWidth:180; enabled:optimizer.batchBusy||optimizer.batchItems.length>0; tip:optimizer.batchBusy?"Остановить очередь после безопасного шага":"Запустить быструю пакетную оптимизацию"; onClicked:optimizer.batchBusy?optimizer.stopBatch():optimizer.optimizeBatch() }
            }

            GlassCard {
                Layout.fillWidth:true; Layout.minimumHeight:108; Layout.maximumHeight:108; accentColor:win.uiAccent
                RowLayout { anchors.fill:parent; anchors.margins:12; spacing:14
                    ColumnLayout { Layout.fillWidth:true; spacing:5
                        RowLayout { Layout.fillWidth:true
                            Text { text:optimizer.batchStatus; color:"#d3ced8"; font.pixelSize:11; font.weight:Font.DemiBold; Layout.fillWidth:true; elide:Text.ElideRight }
                            Text { text:Math.round(optimizer.batchProgress*100)+"%"; color:win.uiAccent; font.pixelSize:11; font.bold:true }
                        }
                        Rectangle { Layout.fillWidth:true; height:7; radius:4; color:"#29262e"
                            Rectangle { width:parent.width*optimizer.batchProgress; height:parent.height; radius:4; color:win.uiAccent; Behavior on width { NumberAnimation { duration:220 } } }
                        }
                    }
                    Sparkline { Layout.preferredWidth:240; Layout.fillHeight:true; values:optimizer.batchProgressHistory; active:optimizer.batchBusy; lineColor:"#ba3d93"; title:"QUEUE PROGRESS"; valueText:Math.round(optimizer.batchProgress*100)+"%" }
                    Sparkline { Layout.preferredWidth:240; Layout.fillHeight:true; values:optimizer.batchActivityHistory; active:optimizer.batchBusy; lineColor:"#4678ce"; title:"PALETTE ACTIVITY"; valueText:optimizer.batchBusy?"LIVE":"IDLE" }
                    RadialGauge { Layout.preferredWidth:82; Layout.fillHeight:true; value:optimizer.batchProgress; accentColor:"#ba3d93"; label:"BATCH" }
                    RadialGauge { Layout.preferredWidth:82; Layout.fillHeight:true; value:optimizer.batchBusy ? .76 : (optimizer.batchProgress >= 1 ? 1 : 0); accentColor:"#4678ce"; label:"RGB24" }
                }
            }

            GlassCard {
                objectName: "batchListPanel"
                Layout.fillWidth:true; Layout.fillHeight:true; Layout.minimumHeight:500
                accentColor:win.uiAccent; glassOpacity:.86

                Text {
                    anchors.centerIn:parent; visible:optimizer.batchItems.length===0
                    text:"Добавьте PNG-файлы\n\nЗдесь появится список с крупными превью «до» и «после»."
                    color:"#76717c"; font.pixelSize:14; horizontalAlignment:Text.AlignHCenter; lineHeight:1.25
                }
                ListView {
                    id:batchList
                    anchors.fill:parent; anchors.margins:12; clip:true; spacing:10
                    visible:optimizer.batchItems.length>0
                    model:optimizer.batchItems
                    ScrollBar.vertical:ScrollBar{}
                    delegate: Rectangle {
                        required property var modelData
                        required property int index
                        width:batchList.width-12
                        height:190; radius:18; color:"#a5121117"; border.width:1; border.color:"#14ffffff"
                        RowLayout { anchors.fill:parent; anchors.margins:10; spacing:12
                            Rectangle { Layout.preferredWidth:250; Layout.fillHeight:true; radius:13; clip:true; color:"#0a090d"
                                Image { anchors.fill:parent; anchors.margins:5; source:modelData.sourceUrl; asynchronous:true; cache:false; fillMode:Image.PreserveAspectFit; sourceSize:Qt.size(420,260) }
                                MetricChip { anchors.left:parent.left; anchors.top:parent.top; anchors.margins:9; text:"BEFORE"; accentColor:win.uiAccent }
                            }
                            Rectangle { Layout.preferredWidth:250; Layout.fillHeight:true; radius:13; clip:true; color:"#0a090d"
                                Image { anchors.fill:parent; anchors.margins:5; source:modelData.resultUrl; asynchronous:true; cache:false; fillMode:Image.PreserveAspectFit; sourceSize:Qt.size(420,260) }
                                Text { anchors.centerIn:parent; visible:!modelData.resultUrl; text:modelData.failed?"Ошибка обработки":"AFTER\nожидает обработки"; color:modelData.failed?"#ef6c72":"#66616c"; font.pixelSize:11; horizontalAlignment:Text.AlignHCenter }
                                MetricChip { anchors.left:parent.left; anchors.top:parent.top; anchors.margins:9; text:"AFTER"; checked:modelData.done; accentColor:win.uiAccent }
                            }
                            ColumnLayout { Layout.fillWidth:true; Layout.fillHeight:true; spacing:7
                                Text { Layout.fillWidth:true; text:modelData.name; color:"white"; font.pixelSize:15; font.weight:Font.DemiBold; elide:Text.ElideMiddle }
                                Text { text:modelData.width+" × "+modelData.height+"  •  "+win.mb(modelData.sourceMb)+(modelData.done?"  →  "+win.mb(modelData.outputMb):""); color:"#99949f"; font.pixelSize:10 }
                                Rectangle { Layout.fillWidth:true; height:6; radius:3; color:"#29262e"
                                    Rectangle { width:parent.width*modelData.progress; height:parent.height; radius:3; color:modelData.failed?"#ef6c72":win.uiAccent }
                                }
                                Text { Layout.fillWidth:true; Layout.fillHeight:true; text:modelData.report||modelData.status; color:modelData.failed?"#ef8b90":"#817c87"; font.pixelSize:9; wrapMode:Text.Wrap; maximumLineCount:4; elide:Text.ElideRight }
                                RowLayout { Layout.fillWidth:true
                                    AppButton { text:"Сравнительный анализ"; accent:win.uiAccent; enabled:modelData.done; implicitHeight:34; tip:"Открыть два синхронных окна до/после"; onClicked:win.compareBatch(index) }
                                    AppButton { text:"Папка"; quiet:true; accent:win.uiAccent; enabled:modelData.done; implicitHeight:34; tip:"Открыть папку compressed"; onClicked:optimizer.openBatchOutput(index) }
                                    Item { Layout.fillWidth:true }
                                    MetricChip { text:modelData.failed?"ERROR":(modelData.done?"READY":"QUEUE"); checked:modelData.done; accentColor:modelData.failed?"#ef6c72":win.uiAccent }
                                }
                            }
                        }
                    }
                }
            }
        }

        // BATCH COMPARISON
        ColumnLayout {
            anchors.fill:parent; anchors.leftMargin:124; anchors.rightMargin:14; anchors.topMargin:14; anchors.bottomMargin:14
            visible:win.screen===3; spacing:12

            RowLayout { Layout.fillWidth:true; Layout.minimumHeight:54; Layout.maximumHeight:54
                AppButton { text:"← Вернуться к списку"; quiet:true; accent:win.uiAccent; onClicked:win.screen=2 }
                ColumnLayout { Layout.fillWidth:true; spacing:0
                    Text { text:win.batchItem?win.batchItem.name:"Файл недоступен"; color:"white"; font.pixelSize:19; font.weight:Font.DemiBold; elide:Text.ElideMiddle; Layout.fillWidth:true }
                    Text { text:win.batchItem?win.batchItem.width+" × "+win.batchItem.height+"  •  "+win.mb(win.batchItem.sourceMb)+" → "+win.mb(win.batchItem.outputMb):""; color:"#8b8691"; font.pixelSize:9 }
                }
                AppButton { text:"Два окна"; quiet:win.wipeMode; accent:win.uiAccent; onClicked:win.wipeMode=false }
                AppButton { text:"Шторка"; quiet:!win.wipeMode; accent:win.uiAccent; onClicked:win.wipeMode=true }
            }

            GlassCard {
                objectName: "batchComparisonPanel"
                Layout.fillWidth:true; Layout.fillHeight:true; Layout.minimumHeight:500; accentColor:win.uiAccent; glassOpacity:.28
                ColumnLayout { anchors.fill:parent; anchors.margins:12; spacing:9
                    RowLayout { Layout.fillWidth:true; Layout.minimumHeight:34; Layout.maximumHeight:34
                        Text { text:"СРАВНИТЕЛЬНЫЙ АНАЛИЗ / AUTO QUALITY RGB24"; color:"white"; font.pixelSize:12; font.weight:Font.DemiBold; Layout.fillWidth:true }
                        MetricChip { text:Math.round(win.viewScale*100)+"%"; accentColor:win.uiAccent }
                    }
                    RowLayout { visible:!win.wipeMode; Layout.fillWidth:true; Layout.fillHeight:true; spacing:10
                        ZoomView { id:batchLeft; Layout.fillWidth:true; Layout.fillHeight:true; title:"BEFORE / ORIGINAL"; imageSource:win.batchItem?win.batchItem.sourceUrl:""; sharedScale:win.viewScale; sharedPanX:win.panX; sharedPanY:win.panY; accentColor:win.uiAccent; onViewChanged:(s,x,y)=>win.updateView(s,x,y); onZoomPulse:d=>{}; onResetRequested:win.resetView(); onFitCalculated:s=>{win.fitValue=s;if(win.panX===0&&win.panY===0)win.viewScale=s} }
                        ZoomView { Layout.fillWidth:true; Layout.fillHeight:true; title:"AFTER / AUTO RGB24"; imageSource:win.batchItem?win.batchItem.resultUrl:""; sharedScale:win.viewScale; sharedPanX:win.panX; sharedPanY:win.panY; accentColor:win.uiAccent; onViewChanged:(s,x,y)=>win.updateView(s,x,y); onZoomPulse:d=>{}; onResetRequested:win.resetView() }
                    }
                    WipeCompare { visible:win.wipeMode; Layout.fillWidth:true; Layout.fillHeight:true; beforeSource:win.batchItem?win.batchItem.sourceUrl:""; afterSource:win.batchItem?win.batchItem.resultUrl:""; sharedScale:win.viewScale; sharedPanX:win.panX; sharedPanY:win.panY; accentColor:win.uiAccent; onViewChanged:(s,x,y)=>win.updateView(s,x,y); onZoomPulse:d=>{}; onResetRequested:win.resetView(); onFitCalculated:s=>{win.fitValue=s;if(win.panX===0&&win.panY===0)win.viewScale=s} }
                    RowLayout { Layout.fillWidth:true; Layout.minimumHeight:38; Layout.maximumHeight:38
                        AppButton { text:"Вписать"; quiet:true; accent:win.uiAccent; implicitHeight:32; onClicked:win.resetView() }
                        AppButton { text:"1:1"; quiet:true; accent:win.uiAccent; implicitHeight:32; onClicked:win.actualPixels() }
                        Slider { Layout.fillWidth:true; from:.01; to:8; value:win.viewScale; onMoved:batchLeft.publish(value,win.panX,win.panY) }
                        AppButton { text:"Открыть папку"; quiet:true; accent:win.uiAccent; implicitHeight:32; onClicked:optimizer.openBatchOutput(win.batchIndex) }
                    }
                }
            }
            GlassCard { Layout.fillWidth:true; Layout.minimumHeight:68; Layout.maximumHeight:68; accentColor:win.uiAccent
                Text { anchors.fill:parent; anchors.margins:12; text:win.batchItem?win.batchItem.report:"Выбранный элемент больше недоступен. Вернитесь к списку."; color:"#aaa5af"; font.pixelSize:9; wrapMode:Text.Wrap; maximumLineCount:3; elide:Text.ElideRight }
            }
        }
    }
}
