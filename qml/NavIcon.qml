import QtQuick

Canvas {
    id:root
    property string kind:"home"
    property color iconColor:"white"
    onPaint:{
        const c=getContext("2d"),w=width,h=height;c.clearRect(0,0,w,h)
        c.strokeStyle=root.iconColor;c.fillStyle=root.iconColor;c.lineWidth=1.8;c.lineCap="round";c.lineJoin="round"
        const X=v=>v*w/24,Y=v=>v*h/24
        c.beginPath()
        if(kind==="home"){c.moveTo(X(4),Y(11));c.lineTo(X(12),Y(4));c.lineTo(X(20),Y(11));c.moveTo(X(6.5),Y(9.5));c.lineTo(X(6.5),Y(20));c.lineTo(X(17.5),Y(20));c.lineTo(X(17.5),Y(9.5));c.moveTo(X(10),Y(20));c.lineTo(X(10),Y(14));c.lineTo(X(14),Y(14));c.lineTo(X(14),Y(20))}
        else if(kind==="npm"){c.rect(X(5),Y(5),X(14),Y(14));c.moveTo(X(9),Y(5));c.lineTo(X(9),Y(19));c.moveTo(X(15),Y(5));c.lineTo(X(15),Y(19));c.moveTo(X(5),Y(10));c.lineTo(X(19),Y(10));c.moveTo(X(5),Y(15));c.lineTo(X(19),Y(15))}
        else if(kind==="batch"){for(let j=0;j<2;++j)for(let i=0;i<2;++i)c.rect(X(4+i*9),Y(4+j*9),X(7),Y(7))}
        else if(kind==="compare"){c.rect(X(3),Y(5),X(18),Y(14));c.moveTo(X(12),Y(5));c.lineTo(X(12),Y(19));c.moveTo(X(9),Y(12));c.lineTo(X(6),Y(12));c.moveTo(X(15),Y(12));c.lineTo(X(18),Y(12))}
        else if(kind==="play"){c.arc(X(12),Y(12),X(7),0,Math.PI*2);c.moveTo(X(10),Y(8));c.lineTo(X(16),Y(12));c.lineTo(X(10),Y(16));c.closePath()}
        else if(kind==="exit"){c.moveTo(X(10),Y(5));c.lineTo(X(5),Y(5));c.lineTo(X(5),Y(19));c.lineTo(X(10),Y(19));c.moveTo(X(10),Y(12));c.lineTo(X(21),Y(12));c.moveTo(X(17),Y(8));c.lineTo(X(21),Y(12));c.lineTo(X(17),Y(16))}
        c.stroke()
    }
    onKindChanged:requestPaint();onIconColorChanged:requestPaint();Component.onCompleted:requestPaint()
}
