import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Effects

ApplicationWindow {
    id: win; width: 1500; height: 920; minimumWidth: 1080; minimumHeight: 700; visible: true
    title: "Adaptive Texture Optimizer 1.0"; color: "#080d16"
    property real targetMb: 3.0
    Rectangle { anchors.fill: parent; gradient: Gradient { GradientStop{position:0;color:"#08152b"} GradientStop{position:.48;color:"#0c1020"} GradientStop{position:1;color:"#190d2a"} } }
    Rectangle { width: 620;height:620;radius:310;x:-220;y:-260;color:"#183e92";opacity:.22 }
    Rectangle { width: 520;height:520;radius:260;anchors.right:parent.right;anchors.bottom:parent.bottom;anchors.margins:-190;color:"#6c248f";opacity:.18 }

    DropArea { anchors.fill: parent; onDropped: drop => { if(drop.hasUrls) optimizer.load(drop.urls[0]) } }
    ColumnLayout { anchors.fill:parent;anchors.margins:22;spacing:16
        RowLayout { Layout.fillWidth:true; Layout.preferredHeight:72; spacing:14
            Rectangle { width:54;height:54;radius:17;gradient:Gradient{GradientStop{position:0;color:"#6878ff"}GradientStop{position:1;color:"#8d5cff"}} Text{anchors.centerIn:parent;text:"AGR";color:"white";font.bold:true;font.pixelSize:16} }
            Column { Layout.fillWidth:true; spacing:3; Text{text:"Adaptive Texture Optimizer";color:"white";font.pixelSize:24;font.weight:Font.DemiBold} Text{text:"C++20  ·  RGB24  ·  edge-aware texture pipeline";color:"#7892b5";font.pixelSize:12} }
            MetricChip{text:"v1.0"} MetricChip{text:"2K / 8K → 2K"} MetricChip{text:"RGB24 verified"}
        }
        GlassCard { Layout.fillWidth:true;Layout.preferredHeight:78
            RowLayout { anchors.fill:parent;anchors.margins:14;spacing:14
                ColumnLayout { Layout.fillWidth:true;Text{text:optimizer.status;color:"white";font.pixelSize:14;font.weight:Font.DemiBold} ProgressBar{Layout.fillWidth:true;from:0;to:1;value:optimizer.progress;visible:optimizer.busy} }
                Text{text:"Лимит";color:"#7892b5"} SpinBox{id:limit;from:10;to:100;value:30;stepSize:1;editable:true; textFromValue:v=>(v/10).toFixed(1)+" MB";valueFromText:t=>Math.round(parseFloat(t)*10);onValueChanged:win.targetMb=value/10}
                AppButton{text:optimizer.sourceUrl?"Оптимизировать":"Перетащите PNG";enabled:optimizer.sourceUrl&&!optimizer.busy;onClicked:optimizer.optimize(win.targetMb)}
            }
        }
        RowLayout { Layout.fillWidth:true;Layout.fillHeight:true;spacing:16
            Repeater { model:[{"title":"Оригинал","url":optimizer.sourceUrl},{"title":"Результат RGB24","url":optimizer.resultUrl}]
                GlassCard { required property var modelData;Layout.fillWidth:true;Layout.fillHeight:true
                    ColumnLayout { anchors.fill:parent;anchors.margins:14;spacing:10
                        RowLayout{Layout.fillWidth:true;Text{text:modelData.title;color:"white";font.pixelSize:14;font.weight:Font.DemiBold}Item{Layout.fillWidth:true}MetricChip{text:modelData.url?"Загружено":"Ожидание"}}
                        Rectangle { Layout.fillWidth:true;Layout.fillHeight:true;radius:15;color:"#080d14";clip:true
                            Image{id:preview;anchors.fill:parent;anchors.margins:8;source:modelData.url;fillMode:Image.PreserveAspectFit;asynchronous:true;cache:false
                                opacity:status===Image.Ready?1:0;scale:status===Image.Ready?1:.985
                                Behavior on opacity{NumberAnimation{duration:420}} Behavior on scale{NumberAnimation{duration:500;easing.type:Easing.OutCubic}}
                            }
                            Text{anchors.centerIn:parent;visible:!modelData.url;text:"PNG можно перетащить в любую область";color:"#52657f";font.pixelSize:14}
                        }
                    }
                }
            }
        }
        GlassCard { Layout.fillWidth:true;Layout.preferredHeight:84
            RowLayout{anchors.fill:parent;anchors.margins:15;Text{text:optimizer.report||"После обработки здесь появятся размер, PSNR и точная ошибка RGB";color:optimizer.report?"#c7daf2":"#60738f";font.pixelSize:13;lineHeight:1.25;Layout.fillWidth:true}Text{text:"by issmaker";color:"#465975";font.pixelSize:10;Layout.alignment:Qt.AlignBottom}}
        }
    }
}
