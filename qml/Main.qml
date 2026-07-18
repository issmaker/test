import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs

ApplicationWindow {
    id: win
    width: 1500; height: 920; minimumWidth: 1120; minimumHeight: 720; visible: true
    title: "Adaptive Texture Optimizer 1.0"; color: "#080d16"
    property real targetMb: 3.0
    property real fitValue: .25
    property real viewScale: fitValue
    property real panX: 0
    property real panY: 0
    property bool linkedViews: true

    function resetView() { viewScale=fitValue;panX=0;panY=0 }
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

    Rectangle { anchors.fill:parent;gradient:Gradient{GradientStop{position:0;color:"#09080d"}GradientStop{position:.55;color:"#0d0b12"}GradientStop{position:1;color:"#100b18"}} }
    Rectangle { width:560;height:560;radius:280;x:-260;y:-300;color:"#6d28d9";opacity:.12 }
    Rectangle { width:500;height:500;radius:250;anchors.right:parent.right;anchors.bottom:parent.bottom;anchors.margins:-210;color:"#8b5cf6";opacity:.09 }
    DropArea { anchors.fill:parent;onDropped:drop=>{if(drop.hasUrls){optimizer.load(drop.urls[0]);win.resetView()}} }

    ColumnLayout { anchors.fill:parent;anchors.margins:22;spacing:14
        RowLayout { Layout.fillWidth:true;Layout.preferredHeight:68;spacing:14
            Rectangle { width:54;height:54;radius:17;gradient:Gradient{GradientStop{position:0;color:"#6d28d9"}GradientStop{position:1;color:"#a855f7"}}Text{anchors.centerIn:parent;text:"AGR";color:"white";font.bold:true;font.pixelSize:16} }
            Column { Layout.fillWidth:true;spacing:3;Text{text:"Adaptive Texture Optimizer";color:"white";font.pixelSize:24;font.weight:Font.DemiBold}Text{text:"High fidelity RGB24 texture pipeline";color:"#8f829f";font.pixelSize:12} }
            MetricChip{text:"v1.0"} MetricChip{text:"2K / 8K → 2K"} MetricChip{text:"RGB24 verified"}
        }

        GlassCard { Layout.fillWidth:true;Layout.preferredHeight:82
            RowLayout { anchors.fill:parent;anchors.margins:14;spacing:12
                AppButton { text:"Открыть PNG";accent:"#282330";onClicked:picker.open();ToolTip.visible:hovered;ToolTip.text:"Выбрать файл — Ctrl+O" }
                ColumnLayout { Layout.fillWidth:true;spacing:5
                    Text{text:optimizer.status;color:"white";font.pixelSize:14;font.weight:Font.DemiBold;elide:Text.ElideMiddle;Layout.fillWidth:true}
                    ProgressBar{Layout.fillWidth:true;from:0;to:1;value:optimizer.progress;visible:optimizer.busy}
                }
                Text{text:"Лимит";color:"#9385a3"}
                SpinBox{id:limit;from:10;to:100;value:30;stepSize:1;editable:true;textFromValue:v=>(v/10).toFixed(1)+" MB";valueFromText:t=>Math.round(parseFloat(t)*10);onValueChanged:win.targetMb=value/10}
                AppButton{text:"Оптимизировать";enabled:optimizer.sourceUrl&&!optimizer.busy;onClicked:optimizer.optimize(win.targetMb)}
            }
        }

        RowLayout { Layout.fillWidth:true;Layout.preferredHeight:48;spacing:8
            AppButton{text:"Вписать";accent:"#24202b";implicitHeight:40;onClicked:win.resetView();ToolTip.visible:hovered;ToolTip.text:"Показать текстуру целиком — Ctrl+0"}
            AppButton{text:"1:1";accent:"#24202b";implicitHeight:40;onClicked:win.actualPixels();ToolTip.visible:hovered;ToolTip.text:"Один пиксель изображения = один пиксель экрана — Ctrl+1"}
            Slider { Layout.preferredWidth:220;from:.08;to:8;value:win.viewScale;onMoved:{win.viewScale=value;win.panX=0;win.panY=0} }
            MetricChip{text:Math.round(win.viewScale*100)+"%"}
            Item{Layout.fillWidth:true}
            AppButton{text:"Папка исходника";accent:"#24202b";implicitHeight:40;enabled:optimizer.sourceUrl;onClicked:optimizer.openSourceFolder();ToolTip.visible:hovered;ToolTip.text:"Открыть папку, где лежит исходный PNG"}
            AppButton{text:"Папка результата";accent:"#5b21b6";implicitHeight:40;enabled:optimizer.outputPath;onClicked:optimizer.openOutputFolder();ToolTip.visible:hovered;ToolTip.text:"Открыть папку compressed"}
        }

        RowLayout { Layout.fillWidth:true;Layout.fillHeight:true;spacing:14
            GlassCard { Layout.fillWidth:true;Layout.fillHeight:true
                ZoomView { anchors.fill:parent;anchors.margins:10;title:optimizer.referenceUrl?"Рабочий эталон 2K":"Оригинал";imageSource:optimizer.referenceUrl||optimizer.sourceUrl;sharedScale:win.viewScale;sharedPanX:win.panX;sharedPanY:win.panY;onViewChanged:(s,x,y)=>win.updateView(s,x,y);onResetRequested:win.resetView();onFitCalculated:s=>{win.fitValue=s;if(win.panX===0&&win.panY===0)win.viewScale=s} }
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
