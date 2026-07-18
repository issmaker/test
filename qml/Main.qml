import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs

ApplicationWindow {
    id: win
    width: 1500; height: 920; minimumWidth: 1120; minimumHeight: 720; visible: true
    title: "Adaptive Texture Optimizer 1.0"; color: "#080d16"
    property real targetMb: 3.0
    property real viewScale: fitScale()
    property real panX: 0
    property real panY: 0
    property bool linkedViews: true

    function fitScale() { return .25 }
    function resetView() { viewScale=fitScale();panX=0;panY=0 }
    function actualPixels() { viewScale=1;panX=0;panY=0 }
    function updateView(s,x,y) { viewScale=s;panX=x;panY=y }

    FileDialog {
        id: picker; title:"Выберите PNG-текстуру"
        nameFilters:["PNG textures (*.png)"]
        onAccepted:{optimizer.load(selectedFile);win.resetView()}
    }
    Shortcut { sequence:StandardKey.Open;onActivated:picker.open() }
    Shortcut { sequence:"Ctrl+0";onActivated:win.resetView() }
    Shortcut { sequence:"Ctrl+1";onActivated:win.actualPixels() }

    Rectangle { anchors.fill:parent;gradient:Gradient{GradientStop{position:0;color:"#08152b"}GradientStop{position:.48;color:"#0c1020"}GradientStop{position:1;color:"#190d2a"}} }
    Rectangle { width:620;height:620;radius:310;x:-220;y:-260;color:"#183e92";opacity:.22 }
    Rectangle { width:520;height:520;radius:260;anchors.right:parent.right;anchors.bottom:parent.bottom;anchors.margins:-190;color:"#6c248f";opacity:.18 }
    DropArea { anchors.fill:parent;onDropped:drop=>{if(drop.hasUrls){optimizer.load(drop.urls[0]);win.resetView()}} }

    ColumnLayout { anchors.fill:parent;anchors.margins:22;spacing:14
        RowLayout { Layout.fillWidth:true;Layout.preferredHeight:68;spacing:14
            Rectangle { width:54;height:54;radius:17;gradient:Gradient{GradientStop{position:0;color:"#6878ff"}GradientStop{position:1;color:"#8d5cff"}}Text{anchors.centerIn:parent;text:"AGR";color:"white";font.bold:true;font.pixelSize:16} }
            Column { Layout.fillWidth:true;spacing:3;Text{text:"Adaptive Texture Optimizer";color:"white";font.pixelSize:24;font.weight:Font.DemiBold}Text{text:"C++20  ·  RGB24  ·  linked pixel comparison";color:"#7892b5";font.pixelSize:12} }
            MetricChip{text:"v1.0"} MetricChip{text:"2K / 8K → 2K"} MetricChip{text:"RGB24 verified"}
        }

        GlassCard { Layout.fillWidth:true;Layout.preferredHeight:82
            RowLayout { anchors.fill:parent;anchors.margins:14;spacing:12
                AppButton { text:"Открыть PNG";accent:"#263b58";onClicked:picker.open();ToolTip.visible:hovered;ToolTip.text:"Выбрать файл — Ctrl+O" }
                ColumnLayout { Layout.fillWidth:true;spacing:5
                    Text{text:optimizer.status;color:"white";font.pixelSize:14;font.weight:Font.DemiBold;elide:Text.ElideMiddle;Layout.fillWidth:true}
                    ProgressBar{Layout.fillWidth:true;from:0;to:1;value:optimizer.progress;visible:optimizer.busy}
                }
                Text{text:"Лимит";color:"#7892b5"}
                SpinBox{id:limit;from:10;to:100;value:30;stepSize:1;editable:true;textFromValue:v=>(v/10).toFixed(1)+" MB";valueFromText:t=>Math.round(parseFloat(t)*10);onValueChanged:win.targetMb=value/10}
                AppButton{text:"Оптимизировать";enabled:optimizer.sourceUrl&&!optimizer.busy;onClicked:optimizer.optimize(win.targetMb)}
            }
        }

        RowLayout { Layout.fillWidth:true;Layout.preferredHeight:48;spacing:8
            AppButton{text:"Вписать";accent:"#1a2a40";implicitHeight:40;onClicked:win.resetView();ToolTip.visible:hovered;ToolTip.text:"Показать текстуру целиком — Ctrl+0"}
            AppButton{text:"1:1";accent:"#1a2a40";implicitHeight:40;onClicked:win.actualPixels();ToolTip.visible:hovered;ToolTip.text:"Один пиксель изображения = один пиксель экрана — Ctrl+1"}
            Slider { Layout.preferredWidth:220;from:.08;to:8;value:win.viewScale;onMoved:{win.viewScale=value;win.panX=0;win.panY=0} }
            MetricChip{text:Math.round(win.viewScale*100)+"%"}
            Item{Layout.fillWidth:true}
            AppButton{text:"Папка исходника";accent:"#1a2a40";implicitHeight:40;enabled:optimizer.sourceUrl;onClicked:optimizer.openSourceFolder();ToolTip.visible:hovered;ToolTip.text:"Открыть папку, где лежит исходный PNG"}
            AppButton{text:"Папка результата";accent:"#236b61";implicitHeight:40;enabled:optimizer.outputPath;onClicked:optimizer.openOutputFolder();ToolTip.visible:hovered;ToolTip.text:"Открыть папку compressed"}
        }

        RowLayout { Layout.fillWidth:true;Layout.fillHeight:true;spacing:14
            GlassCard { Layout.fillWidth:true;Layout.fillHeight:true
                ZoomView { anchors.fill:parent;anchors.margins:10;title:"Оригинал";imageSource:optimizer.sourceUrl;sharedScale:win.viewScale;sharedPanX:win.panX;sharedPanY:win.panY;onViewChanged:(s,x,y)=>win.updateView(s,x,y);onResetRequested:win.resetView() }
            }
            GlassCard { Layout.fillWidth:true;Layout.fillHeight:true
                ZoomView { anchors.fill:parent;anchors.margins:10;title:"Результат / изменения";imageSource:optimizer.resultUrl;sharedScale:win.viewScale;sharedPanX:win.panX;sharedPanY:win.panY;onViewChanged:(s,x,y)=>win.updateView(s,x,y);onResetRequested:win.resetView() }
            }
        }

        GlassCard { Layout.fillWidth:true;Layout.preferredHeight:104
            RowLayout { anchors.fill:parent;anchors.margins:14;spacing:14
                Text { text:optimizer.report||"Колесо мыши — масштаб по курсору  ·  перетаскивание — синхронное перемещение  ·  двойной клик — вписать";color:optimizer.report?"#c7daf2":"#60738f";font.pixelSize:12;lineHeight:1.2;wrapMode:Text.Wrap;Layout.fillWidth:true;Layout.fillHeight:true;verticalAlignment:Text.AlignVCenter }
                Text{text:"by issmaker";color:"#465975";font.pixelSize:10;Layout.alignment:Qt.AlignBottom}
            }
        }
    }
}
