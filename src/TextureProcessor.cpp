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
inline int quantizeSigned(int v,int q){if(q<=1)return v;return v>=0?((v+q/2)/q)*q:-(((-v)+q/2)/q)*q;}
QImage blendSource(const QImage &candidate0,const QImage &source0,int sourcePercent){
    const QImage candidate=candidate0.convertToFormat(QImage::Format_RGB888),source=source0.convertToFormat(QImage::Format_RGB888);
    QImage out(source.size(),QImage::Format_RGB888);
    for(int y=0;y<source.height();++y){const uchar*a=candidate.constScanLine(y),*b=source.constScanLine(y);uchar*d=out.scanLine(y);for(int x=0;x<source.width()*3;++x)d[x]=uchar((int(a[x])*(100-sourcePercent)+int(b[x])*sourcePercent+50)/100);}
    return out;
}
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
            const int localQ=maxDiff>24 ? qMax(1,quant/2) : quant;
            r=quantize(r,localQ); g=quantize(g,localQ); b=quantize(b,localQ);
            dst[x*3]=uchar(r); dst[x*3+1]=uchar(g); dst[x*3+2]=uchar(b);
        }
    }
    return out;
}

QImage TextureProcessor::lumaChromaCandidate(const QImage &input,int yStep,int cStep) {
    const QImage src=input.convertToFormat(QImage::Format_RGB888);
    QImage out(src.size(),QImage::Format_RGB888);
    // 8x8 Bayer rank map: deterministic, locally balanced and much more PNG-
    // friendly than random noise. It preserves the mean luminance of concrete,
    // asphalt, soil and grass instead of producing isolated posterized blocks.
    static constexpr int bayer[8][8]={
        {0,32,8,40,2,34,10,42},{48,16,56,24,50,18,58,26},
        {12,44,4,36,14,46,6,38},{60,28,52,20,62,30,54,22},
        {3,35,11,43,1,33,9,41},{51,19,59,27,49,17,57,25},
        {15,47,7,39,13,45,5,37},{63,31,55,23,61,29,53,21}};
    for(int y=0;y<src.height();++y){
        const uchar*s=src.constScanLine(y);uchar*d=out.scanLine(y);
        for(int x=0;x<src.width();++x){
            const int r=s[x*3],g=s[x*3+1],b=s[x*3+2];
            const int yy=(77*r+150*g+29*b+128)>>8;
            int cb=(((-43*r-85*g+128*b+128)>>8)+128);
            int cr=(((128*r-107*g-21*b+128)>>8)+128);
            int gradient=0;
            if(x>0){const uchar*p=s+(x-1)*3;gradient=qMax(gradient,qAbs(yy-((77*p[0]+150*p[1]+29*p[2]+128)>>8)));}
            if(y>0){const uchar*p=src.constScanLine(y-1)+x*3;gradient=qMax(gradient,qAbs(yy-((77*p[0]+150*p[1]+29*p[2]+128)>>8)));}
            const int ys=gradient>22?qMax(1,yStep/3):(gradient>10?qMax(1,yStep/2):yStep);
            const int cs=gradient>22?qMax(2,cStep/2):cStep;
            const int base=(yy/ys)*ys,remainder=yy-base;
            const int threshold=(bayer[y&7][x&7]*ys+32)/64;
            const int qy=qBound(0,base+(remainder>threshold?ys:0),255);
            cb=qBound(0,128+quantizeSigned(cb-128,cs),255);
            cr=qBound(0,128+quantizeSigned(cr-128,cs),255);
            const int Cb=cb-128,Cr=cr-128;
            d[x*3]=uchar(qBound(0,qy+((359*Cr)>>8),255));
            d[x*3+1]=uchar(qBound(0,qy-((88*Cb+183*Cr)>>8),255));
            d[x*3+2]=uchar(qBound(0,qy+((454*Cb)>>8),255));
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
        // Luminance carries masonry/ground microtexture; chroma may be reduced
        // more strongly without turning a surface into large RGB blocks.
        const std::array<std::pair<int,int>,12> ladder={{{2,6},{3,8},{4,10},{5,12},{6,16},{8,20},{10,24},{12,32},{16,40},{20,48},{24,64},{32,80}}};
        for(const auto [ys,cs]:ladder){
            progress(.15+.055*best.tested,QString("Фактура Y/%1 · цветность/%2").arg(ys).arg(cs));
            QImage candidate=lumaChromaCandidate(source,ys,cs);
            auto encoded=PngEncoder::encodeRgb24(candidate,9); ++best.tested;
            if(encoded.bytes.size()<limit){best.output=candidate;best.png=encoded.bytes;best.lossless=false;break;}
        }
        // Web compressors gain most of their ratio from an adaptive palette.
        // We use the same rate model, then immediately expand it to RGB888 so
        // the final PNG remains color type 2 (RGB24), never indexed PNG8.
        if(best.png.size()>=limit){
            progress(.89,"Адаптивная цветовая модель RGB24");
            QImage palette=source.convertToFormat(QImage::Format_Indexed8,Qt::DiffuseDither|Qt::PreferDither)
                                 .convertToFormat(QImage::Format_RGB888);
            auto encoded=PngEncoder::encodeRgb24(palette,10);++best.tested;
            if(encoded.bytes.size()<limit){
                best.output=palette;best.png=encoded.bytes;best.lossless=false;
                // Return unused bytes monotonically toward the exact source.
                for(int restore:{75,50,25}){
                    QImage richer=blendSource(palette,source,restore);
                    auto rich=PngEncoder::encodeRgb24(richer,9);++best.tested;
                    if(rich.bytes.size()<limit){best.output=richer;best.png=rich.bytes;break;}
                }
            }
        }
        // Absolute size guarantee for pathological high-entropy RGB. These
        // last levels preserve edge geometry and hue ordering, while reducing
        // the channel alphabet until the measured stream is below the limit.
        for(const auto steps:{std::pair{40,96},std::pair{48,112},std::pair{64,128},std::pair{85,170},std::pair{128,255}}){
            if(best.png.size()<limit)break;
            progress(.93,QString("Строгий лимит · Y/%1 C/%2").arg(steps.first).arg(steps.second));
            QImage candidate=lumaChromaCandidate(source,steps.first,steps.second);
            auto encoded=PngEncoder::encodeRgb24(candidate,10);++best.tested;
            if(encoded.bytes.size()<limit){best.output=candidate;best.png=encoded.bytes;best.lossless=false;break;}
        }
    }
    if(!PngEncoder::verifyRgb24(best.png,best.output)) throw std::runtime_error("RGB24-проверка не пройдена");
    measure(source,best.output,best.meanError,best.psnr,best.maxError);
    best.report=QString("%1 × %2  ·  RGB24  ·  %3\n%4 MB  ·  PSNR %5 dB  ·  mean ΔRGB %6  ·  max %7\nПроверено вариантов: %8")
        .arg(source.width()).arg(source.height()).arg(best.png.size()<limit?"ЛИМИТ ДОСТИГНУТ":"ЛИМИТ НЕ ДОСТИГНУТ")
        .arg(best.png.size()/1000000.0,0,'f',3)
        .arg(std::isinf(best.psnr)?QString("∞"):QString::number(best.psnr,'f',1))
        .arg(best.meanError,0,'f',2).arg(best.maxError).arg(best.tested);
    progress(1.0,"Готово"); return best;
}
