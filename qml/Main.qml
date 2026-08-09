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
    title: "Adaptive Texture Optimizer 35 — Cinematic Scenes"
    color: AppTheme.canvas

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
    property int bubbleScore: 0
    property bool bubblesOn: true
    property real heroProgress: 0
    property bool heroHolding: false
    readonly property int heroPhase: heroProgress < .20 ? 0 : (heroProgress < .46 ? 1 : (heroProgress < .72 ? 2 : 3))
    readonly property string heroWord: heroPhase === 1 ? "БЫСТРЕЕ" : (heroPhase === 2 ? "МАСШТАБНЕЕ" : (heroPhase === 3 ? "ТОЧНЕЕ" : ""))
    readonly property color brandContrastColor: AppTheme.contentPrimary
    readonly property var batchItem: batchIndex >= 0 && batchIndex < optimizer.batchItems.length
                                     ? optimizer.batchItems[batchIndex] : null
    property color uiAccent: screen === 1 ? "#ff74b2" : "#ff3f93"
    property color warmAccent: "#ff4f9a"
    readonly property url npmBefore: optimizer.referenceUrl ? optimizer.referenceUrl
                                    : (optimizer.workingPreviewUrl ? optimizer.workingPreviewUrl
                                       : (optimizer.sourceIsLarge ? "" : optimizer.sourceUrl))

    palette.window: AppTheme.canvas
    palette.windowText: AppTheme.contentPrimary
    palette.base: AppTheme.surface
    palette.text: AppTheme.contentPrimary
    palette.button: AppTheme.surfaceRaised
    palette.buttonText: AppTheme.contentPrimary
    palette.highlight: uiAccent

    Behavior on uiAccent { ColorAnimation { duration: 600; easing.type: Easing.InOutCubic } }
    Behavior on pointerX { NumberAnimation { duration: 100; easing.type: Easing.OutCubic } }
    Behavior on pointerY { NumberAnimation { duration: 100; easing.type: Easing.OutCubic } }

    onScreenChanged: {
        AppTheme.lightMode = screen === 1 || screen === 2
        sceneTransition.restart()
    }
    Component.onCompleted: AppTheme.lightMode = false

    Timer {
        interval: 16; repeat: true; running: win.heroHolding && win.screen === 0 && win.heroProgress < 1
        onTriggered: win.heroProgress = Math.min(1, win.heroProgress + .0065)
    }
    NumberAnimation { id: heroRewind; target: win; property: "heroProgress"; to: 0; duration: 900; easing.type: Easing.InOutCubic }

    function resetView() { viewScale = fitValue; panX = 0; panY = 0 }
    function actualPixels() { viewScale = 1; panX = 0; panY = 0 }
    function updateView(scale, x, y) { viewScale = scale; panX = x; panY = y }
    function requestFit() { panX=0;panY=0;fitTimer.restart() }
    function enterNpm() { screen = 1; wipeMode = false; requestFit() }
    function enterBatch() { screen = 2; wipeMode = false; batchIndex = -1; resetView() }
    function compareBatch(index) { batchIndex = index; screen = 3; wipeMode = false; requestFit() }
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
        onAccepted: { win.enterNpm(); optimizer.load(selectedFile); Qt.callLater(win.resetView) }
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
    Timer { id:fitTimer;interval:180;repeat:false;onTriggered:{if(win.screen===1)npmLeft.calculateFit();else if(win.screen===3)batchLeft.calculateFit();win.resetView()} }
    Connections { target:optimizer; function onSourceUrlChanged(){win.requestFit()} }

    LiquidBackdrop {
        anchors.fill: parent
        scene: win.screen === 1 ? 1 : (win.screen === 2 ? 2 : (win.screen === 3 ? 3 : 0))
        pointerX: win.pointerX
        pointerY: win.pointerY
        activity: optimizer.busy ? optimizer.progress : (optimizer.batchBusy ? optimizer.batchProgress : 0)
        journey: win.screen === 0 ? win.heroProgress : 0
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
            if(win.screen === 1){ optimizer.load(drop.urls[0]); Qt.callLater(win.resetView) }
            else if(win.screen === 2)win.addDropped(drop.urls)
        }
    }

    Rectangle {
        id: sceneCurtain
        z: 90
        width: parent.width * 1.25; height: parent.height * 1.35
        x: -parent.width * .12; y: parent.height
        rotation: -3
        enabled: false
        color: win.screen === 1 || win.screen === 2 ? "#f2f4f8" : "#16030f"
        gradient: Gradient {
            orientation: Gradient.Horizontal
            GradientStop { position: 0; color: sceneCurtain.color }
            GradientStop { position: .64; color: win.screen === 1 || win.screen === 2 ? "#e2ebf5" : "#5a123e" }
            GradientStop { position: 1; color: "#ff3f93" }
        }
    }
    SequentialAnimation {
        id: sceneTransition
        NumberAnimation { target:sceneCurtain; property:"y"; from:win.height; to:-win.height*.12; duration:280; easing.type:Easing.InCubic }
        PauseAnimation { duration:60 }
        NumberAnimation { target:sceneCurtain; property:"y"; from:-win.height*.12; to:-win.height*1.5; duration:460; easing.type:Easing.OutCubic }
    }

    Rectangle {
        anchors.fill: parent
        radius: 0
        color: "transparent"
        border.width: 0

        Item {
            id: sideRail
            z: 40
            anchors.left:parent.left;anchors.right:parent.right;anchors.top:parent.top
            anchors.leftMargin:36;anchors.rightMargin:36;anchors.topMargin:22
            height:64
            opacity: win.screen === 0 ? Math.max(0, 1 - win.heroProgress * 2.8) : 1
            Behavior on opacity { NumberAnimation { duration: 180 } }

            RowLayout {
                anchors.fill:parent;spacing:18
                RowLayout { Layout.preferredWidth:245;spacing:12
                    Image { Layout.preferredWidth:42;Layout.preferredHeight:42;source:"qrc:/icons/liquid.svg";sourceSize:Qt.size(84,84);smooth:true }
                    ColumnLayout { spacing:0
                        Text { text:"Adaptive Texture";color:win.brandContrastColor;font.pixelSize:15;font.weight:Font.DemiBold }
                        Text { text:"FLOW INFRASTRUCTURE";color:AppTheme.contentSecondary;font.pixelSize:8;font.letterSpacing:1.1 }
                    }
                }
                Item { Layout.fillWidth:true }
                GlassCard {
                    Layout.preferredWidth:Math.min(1080,sideRail.width-275);Layout.fillHeight:true
                    accentColor:win.uiAccent;glassOpacity:.96;radius:12
                    RowLayout { anchors.fill:parent;anchors.margins:7;spacing:4
                        NavButton { Layout.preferredWidth:116;kind:"home";label:"Главная";selected:win.screen===0;accentColor:win.uiAccent;enabled:!optimizer.busy&&!optimizer.batchBusy;onClicked:win.screen=0 }
                        NavButton { Layout.preferredWidth:142;kind:"npm";label:"НПМ · 3 MB";selected:win.screen===1;accentColor:win.uiAccent;enabled:!optimizer.batchBusy;onClicked:win.enterNpm() }
                        NavButton { Layout.preferredWidth:142;kind:"batch";label:"Текстуры";selected:win.screen===2;accentColor:win.uiAccent;enabled:!optimizer.busy;onClicked:win.screen=2 }
                        NavButton { Layout.preferredWidth:142;kind:"compare";label:"Сравнение";selected:win.screen===3;accentColor:win.uiAccent;enabled:win.batchItem&&win.batchItem.done&&!optimizer.batchBusy;onClicked:win.screen=3 }
                        Item { Layout.fillWidth:true }
                        MetricChip { text:"SCORE "+win.bubbleScore;checked:win.bubbleScore>0;accentColor:win.uiAccent }
                        MetricChip { text:"v35";checked:true;accentColor:win.uiAccent }
                        NavButton { Layout.preferredWidth:112;kind:"play";label:"Импульс";selected:win.bubblesOn;accentColor:win.uiAccent;onClicked:win.bubblesOn=!win.bubblesOn }
                        NavButton { Layout.preferredWidth:102;kind:"exit";label:"Выход";accentColor:AppTheme.danger;enabled:!optimizer.busy&&!optimizer.batchBusy;onClicked:Qt.quit() }
                    }
                }
            }
        }

        // START SCREEN
        Item {
            anchors.fill: parent
            visible: win.screen === 0

            opacity: Math.max(0, 1 - win.heroProgress * 3.1)
            scale: 1 - win.heroProgress * .035
            Behavior on opacity { NumberAnimation { duration: 120 } }

            Column {
                anchors.left:parent.left;anchors.leftMargin:58
                anchors.verticalCenter:parent.verticalCenter
                anchors.verticalCenterOffset:70
                width:parent.width*.58;spacing:-5
                Text { text:"REAL-TIME";color:AppTheme.contentPrimary;font.pixelSize:Math.min(78,win.width*.046);font.weight:Font.Light }
                Text { text:"ОПТИМИЗАЦИЯ";color:AppTheme.contentPrimary;font.pixelSize:Math.min(78,win.width*.046);font.weight:Font.Light }
                Text { text:"ТЕКСТУР,";color:AppTheme.teal;font.pixelSize:Math.min(78,win.width*.046);font.weight:Font.Light }
                Text { text:"КОТОРАЯ РАБОТАЕТ";color:AppTheme.contentPrimary;font.pixelSize:Math.min(78,win.width*.046);font.weight:Font.Light }
                Text { text:"ВМЕСТЕ С ВАМИ";color:AppTheme.contentPrimary;font.pixelSize:Math.min(78,win.width*.046);font.weight:Font.Light }
            }

            GlassCard {
                anchors.right:parent.right;anchors.rightMargin:64
                anchors.verticalCenter:parent.verticalCenter;anchors.verticalCenterOffset:82
                width:420;height:380;radius:14;accentColor:AppTheme.teal;glassOpacity:.94
                ColumnLayout { anchors.fill:parent;anchors.margins:26;spacing:16
                    Text { text:"TEXTURE INFRASTRUCTURE";color:AppTheme.teal;font.pixelSize:9;font.weight:Font.DemiBold;font.letterSpacing:1.3 }
                    Text { Layout.fillWidth:true;text:"Два готовых конвейера для production-текстур";color:AppTheme.contentPrimary;font.pixelSize:24;font.weight:Font.Medium;wrapMode:Text.Wrap;lineHeight:1.05 }
                    Text { Layout.fillWidth:true;text:"Один файл для НПМ до 3 MB или пакетная RGB24-оптимизация 2K, 4K и 8K без ручного лимита.";color:AppTheme.contentSecondary;font.pixelSize:12;wrapMode:Text.Wrap;lineHeight:1.35 }
                    Item { Layout.fillHeight:true }
                    Row { spacing:8
                        MetricChip{text:"RGB24";checked:true;accentColor:AppTheme.teal}
                        MetricChip{text:"8K READY";checked:true;accentColor:AppTheme.teal}
                        MetricChip{text:"BATCH";accentColor:AppTheme.teal}
                    }
                    AppButton { Layout.fillWidth:true;implicitHeight:52;text:"НПМ · ОПТИМИЗИРОВАТЬ ДО 3 MB";accent:AppTheme.teal;onClicked:win.enterNpm() }
                    AppButton { Layout.fillWidth:true;implicitHeight:52;text:"ОТКРЫТЬ ОПТИМИЗАТОР ТЕКСТУР";accent:"#b52a77";quiet:true;onClicked:win.enterBatch() }
                    Text { Layout.alignment:Qt.AlignHCenter;text:"Результаты сохраняются в папке compressed";color:AppTheme.contentTertiary;font.pixelSize:9 }
                }
            }

            Item {
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.bottom: parent.bottom; anchors.bottomMargin: 34
                width: 128; height: 76
                opacity: 1

                Rectangle {
                    anchors.centerIn: parent
                    width: 64 + win.heroProgress * 16; height: width; radius: width / 2
                    color: win.heroHolding ? "#26ff4f9a" : "#12000000"
                    border.width: 1
                    border.color: win.heroHolding ? "#ff74b2" : "#70ffffff"
                    scale: holdArea.pressed ? .94 : 1
                    Behavior on scale { NumberAnimation { duration: 140; easing.type: Easing.OutCubic } }
                    Rectangle {
                        anchors.centerIn: parent; width: 43; height: 43; radius: 22
                        color: "#f2f7f2f6"
                        Rectangle {
                            anchors.centerIn: parent; width: 13; height: 13; radius: 7
                            color: "#ff3f93"
                        }
                    }
                    Canvas {
                        anchors.fill: parent
                        onPaint: {
                            const c=getContext("2d"),cx=width/2,cy=height/2,r=width/2-3
                            c.clearRect(0,0,width,height);c.beginPath();c.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*win.heroProgress)
                            c.strokeStyle="#ff3f93";c.lineWidth=3;c.lineCap="round";c.stroke()
                        }
                        Connections { target:win; function onHeroProgressChanged(){parent.requestPaint()} }
                    }
                }
                Text {
                    anchors.horizontalCenter: parent.horizontalCenter; anchors.bottom: parent.bottom
                    text: "НАЖМИТЕ И УДЕРЖИВАЙТЕ"; color: AppTheme.contentSecondary
                    font.pixelSize: 8; font.letterSpacing: .8
                }
                MouseArea {
                    id: holdArea; anchors.fill: parent
                    onPressed: { heroRewind.stop(); win.heroHolding = true }
                    onReleased: { win.heroHolding = false; heroRewind.from = win.heroProgress; heroRewind.start() }
                    onCanceled: { win.heroHolding = false; heroRewind.from = win.heroProgress; heroRewind.start() }
                }
            }
        }

        Text {
            z: 31
            anchors.centerIn: parent
            anchors.horizontalCenterOffset: win.heroPhase === 2 ? win.width * .12 : (win.heroPhase === 3 ? win.width * .23 : -win.width * .18)
            text: win.heroWord
            visible: win.screen === 0 && win.heroProgress > .18
            opacity: Math.min(1, (win.heroProgress - .18) * 6)
            color: "#f7f2f6"
            font.pixelSize: Math.min(70, win.width * .045)
            font.weight: Font.Light
            font.letterSpacing: 1.2
        }

        // НПМ WORKSPACE
        ColumnLayout {
            anchors.fill: parent
            anchors.leftMargin: 28; anchors.rightMargin: 28; anchors.topMargin: 104; anchors.bottomMargin: 20
            visible: win.screen === 1
            spacing: 12

            RowLayout {
                Layout.fillWidth: true; Layout.minimumHeight: 54; Layout.maximumHeight: 54
                AppButton { text: "← Выбор режима"; quiet: true; accent: win.uiAccent; enabled: !optimizer.busy; onClicked: win.screen = 0 }
                ColumnLayout { Layout.fillWidth: true; spacing: 0
                    Text { text: "Magenta Infrastructure  /  Оптимизация для НПМ-текстур"; color: AppTheme.contentPrimary; font.pixelSize: 20; font.weight: Font.DemiBold }
                    Text { text: "Фиксированный предел ≤ 3 MB  /  AGR ADAPTIVE RGB24"; color: AppTheme.contentSecondary; font.pixelSize: 9; font.letterSpacing: .8 }
                }
                AppButton { text: "Импорт PNG"; accent: win.warmAccent; enabled: !optimizer.busy; onClicked: npmPicker.open() }
            }

            RowLayout {
                Layout.fillWidth: true; Layout.minimumHeight: 82; Layout.maximumHeight: 82; spacing: 10
                GlassCard { Layout.fillWidth: true; Layout.fillHeight: true; accentColor: win.uiAccent
                    Column { anchors.fill: parent; anchors.margins: 13; spacing: 6
                        Text { text: "SOURCE"; color: AppTheme.contentTertiary; font.pixelSize: 9; font.bold: true }
                        Text { text: win.mb(optimizer.sourceFileMb); color: AppTheme.contentPrimary; font.pixelSize: 19; font.weight: Font.DemiBold }
                        Text { text: optimizer.sourceWidth > 0 ? optimizer.sourceWidth + " × " + optimizer.sourceHeight : "PNG не выбран"; color: AppTheme.contentSecondary; font.pixelSize: 9 }
                    }
                }
                GlassCard { Layout.fillWidth: true; Layout.fillHeight: true; accentColor: win.warmAccent
                    Column { anchors.fill: parent; anchors.margins: 13; spacing: 6
                        Text { text: "НПМ TARGET"; color: AppTheme.contentTertiary; font.pixelSize: 9; font.bold: true }
                        Text { text: "≤ 3.0 MB"; color: AppTheme.contentPrimary; font.pixelSize: 19; font.weight: Font.DemiBold }
                        Text { text: "фиксировано автоматически"; color: win.warmAccent; font.pixelSize: 9 }
                    }
                }
                GlassCard { Layout.fillWidth: true; Layout.fillHeight: true; accentColor: win.uiAccent
                    Column { anchors.fill: parent; anchors.margins: 13; spacing: 6
                        Text { text: "OUTPUT"; color: AppTheme.contentTertiary; font.pixelSize: 9; font.bold: true }
                        Text { text: win.mb(optimizer.outputFileMb); color: AppTheme.contentPrimary; font.pixelSize: 19; font.weight: Font.DemiBold }
                        Text { text: optimizer.resultUrl ? "verified RGB24" : "ожидание"; color: optimizer.resultUrl ? win.uiAccent : "#77727d"; font.pixelSize: 9 }
                    }
                }
                GlassCard { Layout.preferredWidth: 290; Layout.fillHeight: true; accentColor: win.uiAccent
                    Column { anchors.fill: parent; anchors.margins: 13; spacing: 7
                        Text { text: optimizer.busy ? "PROCESSING  " + Math.round(optimizer.progress*100) + "%" : "SYSTEM READY"; color: optimizer.busy ? win.uiAccent : "#8f8a95"; font.pixelSize: 9; font.bold: true }
                        Rectangle { width: parent.width; height: 7; radius: 4; color: AppTheme.surfaceRaised
                            Rectangle { width: parent.width*(optimizer.busy?optimizer.progress:(optimizer.resultUrl?1:.06)); height: parent.height; radius: 4; color: win.uiAccent; Behavior on width { NumberAnimation { duration: 200 } } }
                        }
                        Text { text: optimizer.status; width: parent.width; elide: Text.ElideRight; color: AppTheme.contentSecondary; font.pixelSize: 9 }
                    }
                }
            }

            GlassCard {
                objectName: "npmComparisonPanel"
                Layout.fillWidth: true; Layout.fillHeight: true; Layout.minimumHeight: 390
                accentColor: win.uiAccent; glassOpacity: .78
                ColumnLayout {
                    anchors.fill: parent; anchors.margins: 12; spacing: 9
                    RowLayout { Layout.fillWidth: true; Layout.minimumHeight: 38; Layout.maximumHeight: 38
                        ColumnLayout { Layout.fillWidth: true; spacing: 0
                            Text { text: "СРАВНИТЕЛЬНЫЙ АНАЛИЗ"; color: AppTheme.contentPrimary; font.pixelSize: 13; font.weight: Font.DemiBold; font.letterSpacing: .6 }
                            Text { text: win.wipeMode ? "интерактивная граница" : "два синхронных окна"; color: AppTheme.contentTertiary; font.pixelSize: 9 }
                        }
                        AppButton { text: "Два окна"; quiet: win.wipeMode; accent: win.uiAccent; implicitHeight: 32; onClicked: win.wipeMode=false }
                        AppButton { text: "Шторка"; quiet: !win.wipeMode; accent: win.uiAccent; implicitHeight: 32; enabled: optimizer.resultUrl; onClicked: win.wipeMode=true }
                        MetricChip { text: Math.round(win.viewScale*100)+"%"; accentColor: win.uiAccent }
                    }
                    RowLayout { visible: !win.wipeMode; Layout.fillWidth: true; Layout.fillHeight: true; spacing: 10
                        ZoomView { id:npmLeft; Layout.fillWidth:true; Layout.fillHeight:true; title:"BEFORE / ORIGINAL"; imageSource:win.npmBefore; sharedScale:win.viewScale; sharedPanX:win.panX; sharedPanY:win.panY; accentColor:win.uiAccent; onViewChanged:(s,x,y)=>win.updateView(s,x,y); onZoomPulse:d=>{}; onResetRequested:win.requestFit(); onFitCalculated:s=>{win.fitValue=s;if(win.panX===0&&win.panY===0)win.viewScale=s} }
                        ZoomView { Layout.fillWidth:true; Layout.fillHeight:true; title:"AFTER / AGR RGB24"; imageSource:optimizer.resultUrl; sharedScale:win.viewScale; sharedPanX:win.panX; sharedPanY:win.panY; accentColor:win.uiAccent; onViewChanged:(s,x,y)=>win.updateView(s,x,y); onZoomPulse:d=>{}; onResetRequested:win.resetView() }
                    }
                    WipeCompare { visible:win.wipeMode; Layout.fillWidth:true; Layout.fillHeight:true; beforeSource:win.npmBefore; afterSource:optimizer.resultUrl; sharedScale:win.viewScale; sharedPanX:win.panX; sharedPanY:win.panY; accentColor:win.uiAccent; onViewChanged:(s,x,y)=>win.updateView(s,x,y); onZoomPulse:d=>{}; onResetRequested:win.requestFit(); onFitCalculated:s=>{win.fitValue=s;if(win.panX===0&&win.panY===0)win.viewScale=s} }
                    RowLayout { Layout.fillWidth:true; Layout.minimumHeight:36; Layout.maximumHeight:36
                        AppButton { text:"Вписать"; quiet:true; accent:win.uiAccent; implicitHeight:32; onClicked:win.requestFit() }
                        AppButton { text:"1:1"; quiet:true; accent:win.uiAccent; implicitHeight:32; onClicked:win.actualPixels() }
                        Slider { id:npmScale; Layout.fillWidth:true; from:.01; to:8; value:win.viewScale; onMoved:npmLeft.publish(value,win.panX,win.panY) }
                    }
                }
            }

            GlassCard {
                Layout.fillWidth: true; Layout.minimumHeight: 108; Layout.maximumHeight: 108; accentColor: win.uiAccent
                RowLayout { anchors.fill:parent; anchors.margins:11; spacing:12
                    Text { Layout.preferredWidth:280; text:optimizer.report||"Импортируйте PNG. Исходник и результат появятся в двух окнах выше."; color:optimizer.report?"#aaa5af":"#77727d"; font.pixelSize:9; wrapMode:Text.Wrap; maximumLineCount:4; elide:Text.ElideRight }
                    Sparkline { Layout.fillWidth:true; Layout.fillHeight:true; values:optimizer.progressHistory; active:optimizer.busy; lineColor:"#ff4f9a"; title:"RGB24 PIPELINE"; valueText:Math.round(optimizer.progress*100)+"%" }
                    Sparkline { Layout.fillWidth:true; Layout.fillHeight:true; values:optimizer.activityHistory; active:optimizer.busy; lineColor:"#c34cff"; title:"ANALYSIS LOAD"; valueText:optimizer.busy?"LIVE":"IDLE" }
                    RadialGauge { Layout.preferredWidth:82; Layout.fillHeight:true; value:optimizer.progress; accentColor:"#ff4f9a"; label:"ENCODE" }
                    RadialGauge { Layout.preferredWidth:82; Layout.fillHeight:true; value:optimizer.busy ? .72 : (optimizer.resultUrl ? 1 : 0); accentColor:"#c34cff"; label:"RGB24" }
                    AppButton { text:optimizer.busy?"Остановить":"Оптимизировать до 3 MB"; accent:optimizer.busy?"#d45563":win.uiAccent; implicitWidth:210; enabled:optimizer.busy||(optimizer.sourceUrl&&!optimizer.previewBusy); tip:optimizer.busy?"Безопасно остановить текущую обработку":"Запустить НПМ-оптимизацию"; onClicked:optimizer.busy?optimizer.stopCurrent():optimizer.optimize(2.99) }
                    AppButton { text:"Папка результата"; quiet:true; accent:win.uiAccent; enabled:optimizer.outputPath; onClicked:optimizer.openOutputFolder() }
                }
            }
        }

        // BATCH LIST
        ColumnLayout {
            anchors.fill: parent; anchors.leftMargin:28; anchors.rightMargin:28; anchors.topMargin:104; anchors.bottomMargin:20
            visible: win.screen === 2; spacing: 12

            RowLayout {
                Layout.fillWidth:true; Layout.minimumHeight:54; Layout.maximumHeight:54; spacing:10
                AppButton { text:"← Выбор режима"; quiet:true; accent:win.uiAccent; enabled:!optimizer.batchBusy; onClicked:win.screen=0 }
                ColumnLayout { Layout.fillWidth:true; spacing:0
                    Text { text:"Magenta Infrastructure  /  Оптимизация текстур"; color:AppTheme.contentPrimary; font.pixelSize:20; font.weight:Font.DemiBold }
                    Text { text:"ПАКЕТНЫЙ RGB24  /  AUTO QUALITY  /  БЕЗ ЛИМИТА MB"; color:AppTheme.contentSecondary; font.pixelSize:9; font.letterSpacing:.8 }
                }
                MetricChip { text:optimizer.batchItems.length+" FILES"; checked:optimizer.batchItems.length>0; accentColor:win.uiAccent }
                AppButton { text:"Добавить PNG"; accent:win.uiAccent; enabled:!optimizer.batchBusy; onClicked:batchPicker.open() }
                AppButton { text:"Очистить"; quiet:true; accent:win.uiAccent; enabled:!optimizer.batchBusy&&optimizer.batchItems.length>0; onClicked:optimizer.clearBatch() }
                AppButton { text:optimizer.batchBusy?"Остановить":"Оптимизировать все"; accent:optimizer.batchBusy?"#d45563":"#ff3f93"; implicitWidth:180; enabled:optimizer.batchBusy||optimizer.batchItems.length>0; tip:optimizer.batchBusy?"Остановить очередь после безопасного шага":"Запустить быструю пакетную оптимизацию"; onClicked:optimizer.batchBusy?optimizer.stopBatch():optimizer.optimizeBatch() }
            }

            GlassCard {
                Layout.fillWidth:true; Layout.minimumHeight:108; Layout.maximumHeight:108; accentColor:win.uiAccent
                RowLayout { anchors.fill:parent; anchors.margins:12; spacing:14
                    ColumnLayout { Layout.fillWidth:true; spacing:5
                        RowLayout { Layout.fillWidth:true
                            Text { text:optimizer.batchStatus; color:AppTheme.contentPrimary; font.pixelSize:11; font.weight:Font.DemiBold; Layout.fillWidth:true; elide:Text.ElideRight }
                            Text { text:Math.round(optimizer.batchProgress*100)+"%"; color:win.uiAccent; font.pixelSize:11; font.bold:true }
                        }
                        Rectangle { Layout.fillWidth:true; height:7; radius:4; color:AppTheme.surfaceRaised
                            Rectangle { width:parent.width*optimizer.batchProgress; height:parent.height; radius:4; color:win.uiAccent; Behavior on width { NumberAnimation { duration:220 } } }
                        }
                    }
                    Sparkline { Layout.preferredWidth:240; Layout.fillHeight:true; values:optimizer.batchProgressHistory; active:optimizer.batchBusy; lineColor:"#ff3f93"; title:"QUEUE PROGRESS"; valueText:Math.round(optimizer.batchProgress*100)+"%" }
                    Sparkline { Layout.preferredWidth:240; Layout.fillHeight:true; values:optimizer.batchActivityHistory; active:optimizer.batchBusy; lineColor:"#c34cff"; title:"PALETTE ACTIVITY"; valueText:optimizer.batchBusy?"LIVE":"IDLE" }
                    RadialGauge { Layout.preferredWidth:82; Layout.fillHeight:true; value:optimizer.batchProgress; accentColor:"#ff3f93"; label:"BATCH" }
                    RadialGauge { Layout.preferredWidth:82; Layout.fillHeight:true; value:optimizer.batchBusy ? .76 : (optimizer.batchProgress >= 1 ? 1 : 0); accentColor:"#c34cff"; label:"RGB24" }
                }
            }

            GlassCard {
                objectName: "batchListPanel"
                Layout.fillWidth:true; Layout.fillHeight:true; Layout.minimumHeight:500
                accentColor:win.uiAccent; glassOpacity:.86

                Text {
                    anchors.centerIn:parent; visible:optimizer.batchItems.length===0
                    text:"Добавьте PNG-файлы\n\nЗдесь появится список с крупными превью «до» и «после»."
                    color:AppTheme.contentTertiary; font.pixelSize:14; horizontalAlignment:Text.AlignHCenter; lineHeight:1.25
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
                        height:190; radius:AppTheme.radiusLarge; color:AppTheme.surface; border.width:1; border.color:AppTheme.stroke
                        RowLayout { anchors.fill:parent; anchors.margins:10; spacing:12
                            Rectangle { Layout.preferredWidth:250; Layout.fillHeight:true; radius:AppTheme.radiusMedium; clip:true; color:"#070908"
                                Image { anchors.fill:parent; anchors.margins:5; source:modelData.comparisonSourceUrl||modelData.sourceUrl; asynchronous:true; cache:false; fillMode:Image.PreserveAspectFit; sourceSize:Qt.size(420,260) }
                                MetricChip { anchors.left:parent.left; anchors.top:parent.top; anchors.margins:9; text:"BEFORE"; accentColor:win.uiAccent }
                            }
                            Rectangle { Layout.preferredWidth:250; Layout.fillHeight:true; radius:AppTheme.radiusMedium; clip:true; color:"#070908"
                                Image { anchors.fill:parent; anchors.margins:5; source:modelData.comparisonResultUrl||modelData.resultUrl; asynchronous:true; cache:false; fillMode:Image.PreserveAspectFit; sourceSize:Qt.size(420,260) }
                                Text { anchors.centerIn:parent; visible:!modelData.resultUrl; text:modelData.failed?"Ошибка обработки":"AFTER\nожидает обработки"; color:modelData.failed?"#ef6c72":"#66616c"; font.pixelSize:11; horizontalAlignment:Text.AlignHCenter }
                                MetricChip { anchors.left:parent.left; anchors.top:parent.top; anchors.margins:9; text:"AFTER"; checked:modelData.done; accentColor:win.uiAccent }
                            }
                            ColumnLayout { Layout.fillWidth:true; Layout.fillHeight:true; spacing:7
                                Text { Layout.fillWidth:true; text:modelData.name; color:AppTheme.contentPrimary; font.pixelSize:15; font.weight:Font.DemiBold; elide:Text.ElideMiddle }
                                Text { text:modelData.width+" × "+modelData.height+"  •  "+win.mb(modelData.sourceMb)+(modelData.done?"  →  "+win.mb(modelData.outputMb):""); color:AppTheme.contentSecondary; font.pixelSize:10 }
                                Rectangle { Layout.fillWidth:true; height:6; radius:3; color:AppTheme.surfaceRaised
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
            anchors.fill:parent; anchors.leftMargin:28; anchors.rightMargin:28; anchors.topMargin:104; anchors.bottomMargin:20
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
                Layout.fillWidth:true; Layout.fillHeight:true; Layout.minimumHeight:500; accentColor:win.uiAccent; glassOpacity:.78
                ColumnLayout { anchors.fill:parent; anchors.margins:12; spacing:9
                    RowLayout { Layout.fillWidth:true; Layout.minimumHeight:34; Layout.maximumHeight:34
                        Text { text:"СРАВНИТЕЛЬНЫЙ АНАЛИЗ / AUTO QUALITY RGB24"; color:"white"; font.pixelSize:12; font.weight:Font.DemiBold; Layout.fillWidth:true }
                        MetricChip { text:Math.round(win.viewScale*100)+"%"; accentColor:win.uiAccent }
                    }
                    RowLayout { visible:!win.wipeMode; Layout.fillWidth:true; Layout.fillHeight:true; spacing:10
                        ZoomView { id:batchLeft; Layout.fillWidth:true; Layout.fillHeight:true; title:"BEFORE / ORIGINAL"; imageSource:win.batchItem?(win.batchItem.comparisonSourceUrl||win.batchItem.sourceUrl):""; sharedScale:win.viewScale; sharedPanX:win.panX; sharedPanY:win.panY; accentColor:win.uiAccent; onViewChanged:(s,x,y)=>win.updateView(s,x,y); onZoomPulse:d=>{}; onResetRequested:win.requestFit(); onFitCalculated:s=>{win.fitValue=s;if(win.panX===0&&win.panY===0)win.viewScale=s} }
                        ZoomView { Layout.fillWidth:true; Layout.fillHeight:true; title:"AFTER / AUTO RGB24"; imageSource:win.batchItem?(win.batchItem.comparisonResultUrl||win.batchItem.resultUrl):""; sharedScale:win.viewScale; sharedPanX:win.panX; sharedPanY:win.panY; accentColor:win.uiAccent; onViewChanged:(s,x,y)=>win.updateView(s,x,y); onZoomPulse:d=>{}; onResetRequested:win.requestFit() }
                    }
                    WipeCompare { visible:win.wipeMode; Layout.fillWidth:true; Layout.fillHeight:true; beforeSource:win.batchItem?(win.batchItem.comparisonSourceUrl||win.batchItem.sourceUrl):""; afterSource:win.batchItem?(win.batchItem.comparisonResultUrl||win.batchItem.resultUrl):""; sharedScale:win.viewScale; sharedPanX:win.panX; sharedPanY:win.panY; accentColor:win.uiAccent; onViewChanged:(s,x,y)=>win.updateView(s,x,y); onZoomPulse:d=>{}; onResetRequested:win.requestFit(); onFitCalculated:s=>{win.fitValue=s;if(win.panX===0&&win.panY===0)win.viewScale=s} }
                    RowLayout { Layout.fillWidth:true; Layout.minimumHeight:38; Layout.maximumHeight:38
                        AppButton { text:"Вписать"; quiet:true; accent:win.uiAccent; implicitHeight:32; onClicked:win.requestFit() }
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

    BubbleCatch {
        z:80;anchors.fill:parent;running:win.bubblesOn&&win.screen!==0&&!optimizer.busy&&!optimizer.batchBusy
        accentColor:win.screen===1?"#ff74b2":"#ff3f93"
        onCaught:(x,y)=>win.bubbleScore++
    }
}
