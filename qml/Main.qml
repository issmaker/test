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
    property bool showMaterials: false

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

    Rectangle { anchors.fill:parent;gradient:Gradient{GradientStop{position:0;color:"#080b12"}GradientStop{position:.48;color:"#0d1019"}GradientStop{position:1;color:"#110b1d"}} }
    Rectangle { width:720;height:720;radius:360;x:-340;y:-400;color:"#6d28d9";opacity:.10 }
    Rectangle { width:620;height:620;radius:310;anchors.right:parent.right;anchors.bottom:parent.bottom;anchors.margins:-280;color:"#7c3aed";opacity:.08 }
    Rectangle { anchors.horizontalCenter:parent.horizontalCenter;y:-280;width:900;height:420;radius:210;color:"#2563eb";opacity:.035 }
    DropArea { anchors.fill:parent;onDropped:drop=>{if(drop.hasUrls){optimizer.load(drop.urls[0]);win.resetView()}} }

    ColumnLayout { anchors.fill:parent;anchors.margins:22;spacing:14
        RowLayout { Layout.fillWidth:true;Layout.preferredHeight:68;spacing:14
            Rectangle { width:54;height:54;radius:17;gradient:Gradient{GradientStop{position:0;color:"#5b21b6"}GradientStop{position:.55;color:"#7c3aed"}GradientStop{position:1;color:"#a855f7"}}Rectangle{anchors.fill:parent;anchors.margins:1;radius:16;color:"transparent";border.color:"#50ffffff"}Text{anchors.centerIn:parent;text:"AGR";color:"white";font.bold:true;font.pixelSize:16} }
            Column { Layout.fillWidth:true;spacing:3;Text{text:"Adaptive Texture Optimizer";color:"#f7f4ff";font.pixelSize:24;font.weight:Font.DemiBold}Text{text:"Color-safe texture laboratory  •  adaptive RGB24 pipeline";color:"#9588aa";font.pixelSize:12} }
            MetricChip{text:"v1.0"} MetricChip{text:"2K / 8K → 2K"} MetricChip{text:"RGB24 verified"}
        }

        GlassCard { Layout.fillWidth:true;Layout.preferredHeight:96
            RowLayout { anchors.fill:parent;anchors.margins:14;spacing:12
                AppButton { text:"Открыть PNG";accent:"#282330";onClicked:picker.open();ToolTip.visible:hovered;ToolTip.text:"Выбрать файл — Ctrl+O" }
                ColumnLayout { Layout.fillWidth:true;spacing:5
                    Text{text:optimizer.status;color:"white";font.pixelSize:14;font.weight:Font.DemiBold;elide:Text.ElideMiddle;Layout.fillWidth:true}
                    Sparkline{Layout.fillWidth:true;Layout.preferredHeight:38;values:optimizer.progressHistory;title:optimizer.busy?"LIVE PIPELINE":"ГОТОВ К ЗАПУСКУ";valueText:Math.round(optimizer.progress*100)+"%";visible:optimizer.busy||optimizer.progress>0}
                }
                Text{text:"Лимит";color:"#9385a3"}
                SpinBox{id:limit;from:10;to:100;value:30;stepSize:1;editable:true;textFromValue:v=>(v/10).toFixed(1)+" MB";valueFromText:t=>Math.round(parseFloat(t)*10);onValueChanged:win.targetMb=value/10}
                AppButton{text:"Оптимизировать";enabled:optimizer.sourceUrl&&!optimizer.busy;onClicked:optimizer.optimize(win.targetMb)}
            }
        }

        RowLayout { Layout.fillWidth:true;Layout.preferredHeight:48;spacing:8
            AppButton{text:"Вписать";accent:"#24202b";implicitHeight:40;onClicked:win.resetView();ToolTip.visible:hovered;ToolTip.text:"Показать текстуру целиком — Ctrl+0"}
            AppButton{text:"1:1";accent:"#24202b";implicitHeight:40;onClicked:win.actualPixels();ToolTip.visible:hovered;ToolTip.text:"Один пиксель изображения = один пиксель экрана — Ctrl+1"}
            AppButton{text:win.showMaterials?"Показать результат":"Карта материалов";accent:win.showMaterials?"#0f766e":"#164e63";implicitHeight:40;enabled:optimizer.materialUrl;onClicked:win.showMaterials=!win.showMaterials;ToolTip.visible:hovered;ToolTip.text:"Цветная карта гипотез материалов по локальной фактуре"}
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
                ZoomView { anchors.fill:parent;anchors.margins:10;title:win.showMaterials?"Карта материалов / гипотезы":"Результат / изменения";imageSource:win.showMaterials?optimizer.materialUrl:optimizer.resultUrl;sharedScale:win.viewScale;sharedPanX:win.panX;sharedPanY:win.panY;onViewChanged:(s,x,y)=>win.updateView(s,x,y);onResetRequested:win.resetView() }
            }
        }

        GlassCard { Layout.fillWidth:true;Layout.preferredHeight:132
            RowLayout { anchors.fill:parent;anchors.margins:14;spacing:14
                Text { text:optimizer.report||"Колесо мыши — масштаб по курсору  ·  перетаскивание — синхронное перемещение  ·  двойной клик — вписать";color:optimizer.report?"#c7daf2":"#60738f";font.pixelSize:12;lineHeight:1.2;wrapMode:Text.Wrap;Layout.fillWidth:true;Layout.fillHeight:true;verticalAlignment:Text.AlignVCenter }
                Rectangle{Layout.preferredWidth:1;Layout.fillHeight:true;color:"#26344242"}
                ColumnLayout{Layout.preferredWidth:330;Layout.fillHeight:true;spacing:6
                    Sparkline{Layout.fillWidth:true;Layout.fillHeight:true;values:optimizer.progressHistory;title:"ПРОГРЕСС";valueText:Math.round(optimizer.progress*100)+"%"}
                    Sparkline{Layout.fillWidth:true;Layout.fillHeight:true;values:optimizer.activityHistory;title:"АКТИВНОСТЬ АНАЛИЗА";valueText:optimizer.busy?"LIVE":"IDLE";lineColor:"#52c7bd"}
                }
                Text{text:"by issmaker";color:"#465975";font.pixelSize:10;Layout.alignment:Qt.AlignBottom}
            }
        }
    }
}
