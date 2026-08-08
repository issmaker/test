import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs

ApplicationWindow {
    id: win
    width: 1500
    height: 940
    minimumWidth: 1120
    minimumHeight: 790
    visible: true
    title: "Adaptive Texture Optimizer 26"
    color: "#05090d"
    palette.window: "#05090d"
    palette.windowText: "#f4fafb"
    palette.base: "#0b141a"
    palette.text: "#f4fafb"
    palette.button: "#17232a"
    palette.buttonText: "#f4fafb"
    palette.highlight: win.accentColor

    property real targetMb: 3.0
    property real fitValue: .25
    property real viewScale: fitValue
    property real panX: 0
    property real panY: 0
    property real parallaxX: 0
    property real parallaxY: 0
    property real pointerNormX: .5
    property real pointerNormY: .5
    property real zoomWarp: 0
    property real zoomDirection: 1
    property real lastSliderValue: .25
    property int caughtStars: 0
    property bool wipeMode: false
    property bool lightFx: false
    property color accentColor: optimizer.accentColor
    Behavior on accentColor{ColorAnimation{duration:750;easing.type:Easing.InOutCubic}}
    Behavior on parallaxX{NumberAnimation{duration:115;easing.type:Easing.OutCubic}}
    Behavior on parallaxY{NumberAnimation{duration:115;easing.type:Easing.OutCubic}}

    readonly property url leftImage: optimizer.referenceUrl
                                      ? optimizer.referenceUrl
                                      : (optimizer.workingPreviewUrl
                                         ? optimizer.workingPreviewUrl
                                         : (optimizer.sourceIsLarge?"":optimizer.sourceUrl))

    function triggerZoomWarp(direction) {
        zoomDirection=direction
        zoomFx.stop();zoomWarp=0;zoomFx.start()
    }
    function resetView() {
        triggerZoomWarp(fitValue>=viewScale?1:-1)
        viewScale=fitValue;lastSliderValue=viewScale;panX=0;panY=0
    }
    function actualPixels() {
        triggerZoomWarp(1)
        viewScale=1;lastSliderValue=viewScale;panX=0;panY=0
    }
    function updateView(scale,x,y) { viewScale=scale;lastSliderValue=scale;panX=x;panY=y }
    function importTexture(url) {
        wipeMode=false
        optimizer.load(url)
        resetView()
    }

    SequentialAnimation {
        id: zoomFx
        NumberAnimation{target:win;property:"zoomWarp";from:0;to:1;duration:130;easing.type:Easing.OutCubic}
        NumberAnimation{target:win;property:"zoomWarp";to:0;duration:520;easing.type:Easing.OutExpo}
    }

    FileDialog {
        id: picker
        title: "Выберите PNG-текстуру"
        nameFilters: ["PNG textures (*.png)"]
        onAccepted: win.importTexture(selectedFile)
    }
    Shortcut{sequence:StandardKey.Open;onActivated:picker.open()}
    Shortcut{sequence:"Ctrl+0";onActivated:win.resetView()}
    Shortcut{sequence:"Ctrl+1";onActivated:win.actualPixels()}

    SpaceBackground {
        id: cosmos
        anchors.fill: parent
        pointerX: win.parallaxX*1.65
        pointerY: win.parallaxY*1.65
        pointerActive: parallaxHover.hovered
        warp: optimizer.busy
        progress: optimizer.progress
        zoomPulse: win.zoomWarp
        zoomDirection: win.zoomDirection
        accentColor: win.accentColor
        lightFx: win.lightFx
    }
    Item {
        anchors.fill: parent
        HoverHandler {
            id: parallaxHover
            onPointChanged: {
                win.pointerNormX=Math.max(0,Math.min(1,point.position.x/win.width))
                win.pointerNormY=Math.max(0,Math.min(1,point.position.y/win.height))
                win.parallaxX=(point.position.x-win.width/2)/win.width
                win.parallaxY=(point.position.y-win.height/2)/win.height
            }
        }
    }
    DropArea{anchors.fill:parent;onDropped:drop=>{if(drop.hasUrls)win.importTexture(drop.urls[0])}}

    ColumnLayout {
        anchors.fill: parent
        anchors.leftMargin: 22;anchors.rightMargin:22;anchors.topMargin:18;anchors.bottomMargin:70
        spacing: 13

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 62
            spacing: 14
            Rectangle {
                width:52;height:52;radius:16;color:win.accentColor
                border.width:1;border.color:"#70ffffff"
                Rectangle{anchors.fill:parent;anchors.margins:-5;radius:21;color:"transparent";border.width:1;border.color:Qt.rgba(win.accentColor.r,win.accentColor.g,win.accentColor.b,.28)}
                Text{anchors.centerIn:parent;text:"AGR";color:"white";font.bold:true;font.pixelSize:16}
                Behavior on color{ColorAnimation{duration:700}}
            }
            Column {
                Layout.fillWidth: true
                spacing: 3
                Text{text:"Adaptive Texture Optimizer";color:"#f4fafb";font.pixelSize:24;font.weight:Font.DemiBold}
                Text{text:"AGR Adaptive RGB24  •  perceptual colour budget  •  verified RGB24";color:"#8599a3";font.pixelSize:12}
            }
            StarCounter{count:win.caughtStars;accentColor:win.accentColor}
            AppButton {
                text:win.lightFx?"FX ECO":"FX MAX"
                implicitWidth:84;implicitHeight:34
                accent:win.lightFx?"#17232a":win.accentColor
                tip:win.lightFx
                    ?"Облегчённые эффекты включены. Нажмите для максимального космического оформления."
                    :"Максимальные эффекты включены. Нажмите для режима слабых ПК."
                onClicked:win.lightFx=!win.lightFx
            }
            MetricChip{text:"v26";accentColor:win.accentColor}
            MetricChip{text:"AGR ADAPTIVE RGB24";accentColor:win.accentColor;checked:true}
        }

        GlassCard {
            accentColor: win.accentColor
            Layout.fillWidth: true
            Layout.preferredHeight: 94
            RowLayout {
                anchors.fill:parent;anchors.margins:13;spacing:12
                AppButton{text:"Открыть PNG";accent:"#17232a";tip:"Выбрать PNG-текстуру — Ctrl+O";onClicked:picker.open()}
                ColumnLayout {
                    Layout.fillWidth:true;spacing:5
                    Text{text:optimizer.status;color:"#f4fafb";font.pixelSize:13;font.weight:Font.DemiBold;elide:Text.ElideMiddle;Layout.fillWidth:true}
                    Sparkline{Layout.fillWidth:true;Layout.preferredHeight:38;values:optimizer.progressHistory;active:optimizer.busy;lineColor:win.accentColor;title:optimizer.busy?"LIVE PIPELINE":"СИСТЕМА ГОТОВА";valueText:Math.round(optimizer.progress*100)+"%";visible:optimizer.busy||optimizer.progress>0}
                }
                Column {
                    spacing:3
                    Text{text:"ПРЕДЕЛ ФАЙЛА";color:"#738893";font.pixelSize:9;font.weight:Font.DemiBold}
                    LimitSelector{value:win.targetMb;accentColor:win.accentColor;onValueEdited:newValue=>win.targetMb=newValue}
                }
                AppButton{text:optimizer.busy?"Оптимизация…":"Оптимизировать";accent:win.accentColor;enabled:optimizer.sourceUrl&&!optimizer.busy&&!optimizer.previewBusy;tip:"Запустить AGR Adaptive RGB24 с обязательной проверкой размера и RGB24";onClicked:optimizer.optimize(win.targetMb)}
            }
        }

        RowLayout {
            Layout.fillWidth:true
            Layout.preferredHeight:46
            spacing:8
            AppButton{text:"Вписать";accent:"#17232a";implicitHeight:38;tip:"Показать текстуру целиком — Ctrl+0";onClicked:win.resetView()}
            AppButton{text:"1:1";accent:"#17232a";implicitHeight:38;tip:"Один пиксель изображения равен одному пикселю экрана — Ctrl+1";onClicked:win.actualPixels()}
            Slider {
                id:scaleSlider
                Layout.preferredWidth:245
                from:.08;to:8;value:win.viewScale
                onMoved:{const dir=value>=win.lastSliderValue?1:-1;win.triggerZoomWarp(dir);win.lastSliderValue=value;leftZoom.publish(value,win.panX,win.panY)}
                background:Rectangle{x:scaleSlider.leftPadding;y:scaleSlider.topPadding+scaleSlider.availableHeight/2-height/2;width:scaleSlider.availableWidth;height:5;radius:3;color:"#1b2930";Rectangle{width:scaleSlider.visualPosition*parent.width;height:parent.height;radius:3;color:win.accentColor}}
                handle:Rectangle{x:scaleSlider.leftPadding+scaleSlider.visualPosition*(scaleSlider.availableWidth-width);y:scaleSlider.topPadding+scaleSlider.availableHeight/2-height/2;width:18;height:18;radius:9;color:"#eef8f8";border.width:4;border.color:win.accentColor}
            }
            MetricChip{text:Math.round(win.viewScale*100)+"%";accentColor:win.accentColor}
            AppButton {
                text:win.wipeMode?"Разделитель: ВКЛ":"Режим «Шторка»"
                accent:win.wipeMode?win.accentColor:"#17232a"
                implicitHeight:38
                enabled:optimizer.resultUrl
                tip:"Включить сравнение одним кадром. Тяните вертикальный разделитель мышью; панорамирование — правой кнопкой."
                onClicked:win.wipeMode=!win.wipeMode
            }
            Item{Layout.fillWidth:true}
            AppButton{text:"Папка исходника";accent:"#17232a";implicitHeight:38;enabled:optimizer.sourceUrl;tip:"Открыть папку исходной текстуры";onClicked:optimizer.openSourceFolder()}
            AppButton{text:"Папка результата";accent:win.accentColor;implicitHeight:38;enabled:optimizer.outputPath;tip:"Открыть папку compressed с готовым RGB24 PNG";onClicked:optimizer.openOutputFolder()}
        }

        RowLayout {
            visible:!win.wipeMode
            Layout.fillWidth:true
            Layout.fillHeight:true
            spacing:16
            ZoomView {
                id:leftZoom
                Layout.fillWidth:true;Layout.fillHeight:true
                title:optimizer.sourceIsLarge?"Рабочий эталон 2K":"Оригинал"
                imageSource:win.leftImage
                sharedScale:win.viewScale;sharedPanX:win.panX;sharedPanY:win.panY
                parallaxX:win.parallaxX*2.2;parallaxY:win.parallaxY*2.2;accentColor:win.accentColor
                onViewChanged:(scale,x,y)=>win.updateView(scale,x,y)
                onZoomPulse:direction=>win.triggerZoomWarp(direction)
                onResetRequested:win.resetView()
                onFitCalculated:scale=>{win.fitValue=scale;if(win.panX===0&&win.panY===0){win.viewScale=scale;win.lastSliderValue=scale}}
            }
            ZoomView {
                id:rightZoom
                Layout.fillWidth:true;Layout.fillHeight:true
                title:"Результат AGR Adaptive RGB24"
                imageSource:optimizer.resultUrl
                sharedScale:win.viewScale;sharedPanX:win.panX;sharedPanY:win.panY
                parallaxX:win.parallaxX*2.2;parallaxY:win.parallaxY*2.2;accentColor:win.accentColor
                onViewChanged:(scale,x,y)=>win.updateView(scale,x,y)
                onZoomPulse:direction=>win.triggerZoomWarp(direction)
                onResetRequested:win.resetView()
            }
        }
        WipeCompare {
            id:wipeCompare
            visible:win.wipeMode
            Layout.fillWidth:true
            Layout.fillHeight:true
            beforeSource:win.leftImage
            afterSource:optimizer.resultUrl
            sharedScale:win.viewScale;sharedPanX:win.panX;sharedPanY:win.panY
            parallaxX:win.parallaxX*2.2;parallaxY:win.parallaxY*2.2
            accentColor:win.accentColor
            onViewChanged:(scale,x,y)=>win.updateView(scale,x,y)
            onZoomPulse:direction=>win.triggerZoomWarp(direction)
            onResetRequested:win.resetView()
            onFitCalculated:scale=>{win.fitValue=scale;if(win.panX===0&&win.panY===0){win.viewScale=scale;win.lastSliderValue=scale}}
        }

        GlassCard {
            accentColor:win.accentColor
            Layout.fillWidth:true
            Layout.preferredHeight:116
            RowLayout {
                anchors.fill:parent;anchors.margins:13;spacing:14
                Text{text:optimizer.report||"Колесо — плавный масштаб по курсору  •  перетаскивание — синхронное перемещение  •  двойной клик — вписать";color:optimizer.report?"#c9dce2":"#60757f";font.pixelSize:11;lineHeight:1.2;wrapMode:Text.Wrap;Layout.fillWidth:true;Layout.fillHeight:true;verticalAlignment:Text.AlignVCenter}
                Rectangle{Layout.preferredWidth:1;Layout.fillHeight:true;color:Qt.rgba(win.accentColor.r,win.accentColor.g,win.accentColor.b,.18)}
                ColumnLayout {
                    Layout.preferredWidth:350;Layout.fillHeight:true;spacing:6
                    Sparkline{Layout.fillWidth:true;Layout.fillHeight:true;values:optimizer.progressHistory;active:optimizer.busy;lineColor:win.accentColor;title:"ПРОГРЕСС";valueText:Math.round(optimizer.progress*100)+"%"}
                    Sparkline{Layout.fillWidth:true;Layout.fillHeight:true;values:optimizer.activityHistory;active:optimizer.busy;lineColor:Qt.lighter(win.accentColor,1.25);title:"АКТИВНОСТЬ АНАЛИЗА";valueText:optimizer.busy?"LIVE":"IDLE"}
                }
                Text{text:"by issmaker";color:"#526871";font.pixelSize:10;Layout.alignment:Qt.AlignBottom}
            }
        }
    }

    Rectangle {
        z: 50
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 16
        height: 42
        width: statusRow.implicitWidth+30
        radius: 15
        color: "#ee091117"
        border.width: 1
        border.color: Qt.rgba(win.accentColor.r,win.accentColor.g,win.accentColor.b,.42)
        RowLayout {
            id: statusRow
            anchors.centerIn: parent
            spacing: 8
            MetricChip{checked:optimizer.workingWidth>0;text:optimizer.workingWidth+"×"+optimizer.workingHeight;accentColor:win.accentColor}
            MetricChip{checked:optimizer.resultUrl;text:"PNG RGB24";accentColor:win.accentColor}
            MetricChip{checked:optimizer.outputFileMb>0&&optimizer.outputFileMb<win.targetMb;text:optimizer.outputFileMb>0?optimizer.outputFileMb.toFixed(3)+" MB":"≤ "+win.targetMb.toFixed(1)+" MB";accentColor:win.accentColor}
            MetricChip{visible:optimizer.sourceFileMb>0;text:"Исходник "+optimizer.sourceFileMb.toFixed(2)+" MB";accentColor:win.accentColor}
        }
    }

    MeteorOverlay {
        anchors.fill: parent
        z: 1000
        enabled: false
        cursorX: win.pointerNormX
        cursorY: win.pointerNormY
        pointerActive: parallaxHover.hovered
        accentColor: win.accentColor
        lightFx: win.lightFx
        onCaught:(x,y)=>{win.caughtStars++;cosmos.triggerBurst(x,y)}
    }
}
