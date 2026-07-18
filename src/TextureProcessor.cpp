#include "TextureProcessor.h"
#include "PngEncoder.h"
#include <QFileInfo>
#include <QImageReader>
#include <array>
#include <cmath>
#include <limits>
#include <stdexcept>

namespace {
inline int lum(QRgb p) { return (54*qRed(p)+183*qGreen(p)+19*qBlue(p))>>8; }
inline int quantize(int v, int q) { return q<=1 ? v : qBound(0, ((v+q/2)/q)*q, 255); }
}

QImage TextureProcessor::edgeAwareCandidate(const QImage &input, int smooth, int quant) {
    const QImage src=input.convertToFormat(QImage::Format_RGB32);
    QImage out(src.size(), QImage::Format_RGB888);
    for (int y=0; y<src.height(); ++y) {
        uchar *dst=out.scanLine(y);
        for (int x=0; x<src.width(); ++x) {
            const QRgb p=src.pixel(x,y);
            int sumR=0,sumG=0,sumB=0,n=0,maxDiff=0;
            for (int oy=-1; oy<=1; ++oy) for (int ox=-1; ox<=1; ++ox) {
                const QRgb q=src.pixel(qBound(0,x+ox,src.width()-1),qBound(0,y+oy,src.height()-1));
                const int d=qAbs(lum(q)-lum(p)); maxDiff=qMax(maxDiff,d);
                if (d <= 10) { sumR+=qRed(q); sumG+=qGreen(q); sumB+=qBlue(q); ++n; }
            }
            // Strong edges and tiny atlas lines remain exact. Only locally
            // similar pixels participate, preventing colour bleeding.
            const int amount = maxDiff>24 ? 0 : smooth;
            int r=(qRed(p)*(100-amount)+(sumR/n)*amount+50)/100;
            int g=(qGreen(p)*(100-amount)+(sumG/n)*amount+50)/100;
            int b=(qBlue(p)*(100-amount)+(sumB/n)*amount+50)/100;
            const int localQ=maxDiff>14 ? 1 : quant;
            r=quantize(r,localQ); g=quantize(g,localQ); b=quantize(b,localQ);
            dst[x*3]=uchar(r); dst[x*3+1]=uchar(g); dst[x*3+2]=uchar(b);
        }
    }
    return out;
}

void TextureProcessor::measure(const QImage &a0,const QImage &b0,double &mean,double &psnr,int &maximum) {
    const QImage a=a0.convertToFormat(QImage::Format_RGB888), b=b0.convertToFormat(QImage::Format_RGB888);
    quint64 sum=0,squared=0; maximum=0;
    for (int y=0;y<a.height();++y) {
        const uchar *pa=a.constScanLine(y),*pb=b.constScanLine(y);
        for(int x=0;x<a.width()*3;++x){const int d=int(pa[x])-int(pb[x]);sum+=qAbs(d);squared+=quint64(d*d);maximum=qMax(maximum,qAbs(d));}
    }
    const double count=double(a.width())*a.height()*3; mean=sum/count;
    psnr=squared ? 10.0*std::log10(255.0*255.0/(squared/count)) : std::numeric_limits<double>::infinity();
}

TextureResult TextureProcessor::process(const QString &path,qint64 limit,const Progress &progress) {
    QImageReader reader(path); reader.setAutoTransform(true);
    QImage source=reader.read().convertToFormat(QImage::Format_RGB888);
    if(source.isNull()) throw std::runtime_error("PNG не удалось прочитать");
    if(qMax(source.width(),source.height())>2048)
        source=source.scaled(2048,2048,Qt::KeepAspectRatio,Qt::SmoothTransformation).convertToFormat(QImage::Format_RGB888);
    progress(.12,"Lossless RGB24: фильтры и libdeflate");
    auto exact=PngEncoder::encodeRgb24(source,10);
    TextureResult best{source,source,exact.bytes,{},0,0,0,1,true};
    if(exact.bytes.size()>=limit){
        // Ordered by visual quality, never by a guessed material category.
        const std::array<std::pair<int,int>,10> ladder={{{4,1},{7,1},{10,2},{14,2},{18,2},{22,3},{28,3},{34,4},{42,5},{52,6}}};
        for(const auto [smooth,q]:ladder){
            progress(.15+.07*best.tested,QString("Локальная модель %1% · RGB/%2").arg(smooth).arg(q));
            QImage candidate=edgeAwareCandidate(source,smooth,q);
            auto encoded=PngEncoder::encodeRgb24(candidate,9); ++best.tested;
            if(encoded.bytes.size()<limit){best.output=candidate;best.png=encoded.bytes;best.lossless=false;break;}
        }
    }
    if(!PngEncoder::verifyRgb24(best.png,best.output)) throw std::runtime_error("RGB24-проверка не пройдена");
    measure(source,best.output,best.meanError,best.psnr,best.maxError);
    best.report=QString("%1 × %2  ·  RGB24\n%3 MB  ·  PSNR %4 dB  ·  mean ΔRGB %5  ·  max %6\nПроверено вариантов: %7")
        .arg(source.width()).arg(source.height()).arg(best.png.size()/1000000.0,0,'f',3)
        .arg(std::isinf(best.psnr)?QString("∞"):QString::number(best.psnr,'f',1))
        .arg(best.meanError,0,'f',2).arg(best.maxError).arg(best.tested);
    progress(1.0,"Готово"); return best;
}
