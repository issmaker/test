#include "TextureProcessor.h"
#include "PngEncoder.h"
#include <algorithm>
#include <QFileInfo>
#include <QImageReader>
#include <QElapsedTimer>
#include <array>
#include <cmath>
#include <limits>
#include <stdexcept>
#include <vector>

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
    // Serpentine Floyd-Steinberg on luminance avoids the visible 8x8 grid of
    // ordered dithering. Error is kept in fixed-point /16 units.
    std::vector<int> error(src.width()+2),nextError(src.width()+2);
    for(int y=0;y<src.height();++y){
        const uchar*s=src.constScanLine(y);uchar*d=out.scanLine(y);
        std::fill(nextError.begin(),nextError.end(),0);
        const bool reverse=(y&1)!=0;
        for(int i=0;i<src.width();++i){
            const int x=reverse?src.width()-1-i:i;
            const int r=s[x*3],g=s[x*3+1],b=s[x*3+2];
            const int yy=(77*r+150*g+29*b+128)>>8;
            int cb=(((-43*r-85*g+128*b+128)>>8)+128);
            int cr=(((128*r-107*g-21*b+128)>>8)+128);
            int gradient=0,range=0;
            const auto inspect=[&](const uchar*p){const int py=(77*p[0]+150*p[1]+29*p[2]+128)>>8;gradient=qMax(gradient,qAbs(yy-py));range=qMax(range,std::max({qAbs(r-int(p[0])),qAbs(g-int(p[1])),qAbs(b-int(p[2]))}));};
            if(x>0)inspect(s+(x-1)*3);if(x+1<src.width())inspect(s+(x+1)*3);
            if(y>0)inspect(src.constScanLine(y-1)+x*3);if(y+1<src.height())inspect(src.constScanLine(y+1)+x*3);
            // Exact flat colours cost almost nothing in DEFLATE and must never
            // acquire dots, stripes, brightness drift or chroma drift.
            if(range<=1){d[x*3]=uchar(r);d[x*3+1]=uchar(g);d[x*3+2]=uchar(b);continue;}
            const int ys=gradient>22?qMax(1,yStep/3):(gradient>10?qMax(1,yStep/2):yStep);
            const int cs=gradient>22?qMax(2,cStep/2):cStep;
            const int adjusted=qBound(0,yy+(error[x+1]>=0?(error[x+1]+8)/16:-((-error[x+1]+8)/16)),255);
            const int qy=quantize(adjusted,ys);
            const int propagated=adjusted-qy;
            if(!reverse){error[x+2]+=propagated*7;nextError[x]+=propagated*3;nextError[x+1]+=propagated*5;nextError[x+2]+=propagated;}
            else{error[x]+=propagated*7;nextError[x+2]+=propagated*3;nextError[x+1]+=propagated*5;nextError[x]+=propagated;}
            cb=qBound(0,128+quantizeSigned(cb-128,cs),255);
            cr=qBound(0,128+quantizeSigned(cr-128,cs),255);
            const int Cb=cb-128,Cr=cr-128;
            d[x*3]=uchar(qBound(0,qy+((359*Cr)>>8),255));
            d[x*3+1]=uchar(qBound(0,qy-((88*Cb+183*Cr)>>8),255));
            d[x*3+2]=uchar(qBound(0,qy+((454*Cb)>>8),255));
        }
        error.swap(nextError);
    }
    return out;
}

QImage TextureProcessor::auditRepair(const QImage &source0,const QImage &candidate0,int strength,int &correctedPixels){
    const QImage source=source0.convertToFormat(QImage::Format_RGB888),candidate=candidate0.convertToFormat(QImage::Format_RGB888);
    struct Bin{qint64 dr=0,dg=0,db=0;int count=0;};
    std::array<Bin,4096> bins{};
    for(int y=0;y<source.height();++y){const uchar*s=source.constScanLine(y),*c=candidate.constScanLine(y);for(int x=0;x<source.width();++x){const int k=(s[x*3]>>4)*256+(s[x*3+1]>>4)*16+(s[x*3+2]>>4);auto&v=bins[k];v.dr+=int(s[x*3])-int(c[x*3]);v.dg+=int(s[x*3+1])-int(c[x*3+1]);v.db+=int(s[x*3+2])-int(c[x*3+2]);++v.count;}}
    QImage out(candidate.size(),QImage::Format_RGB888);correctedPixels=0;
    for(int y=0;y<source.height();++y){const uchar*s=source.constScanLine(y),*c=candidate.constScanLine(y);uchar*d=out.scanLine(y);for(int x=0;x<source.width();++x){
        const int k=(s[x*3]>>4)*256+(s[x*3+1]>>4)*16+(s[x*3+2]>>4);const auto&v=bins[k];
        int rr=c[x*3],gg=c[x*3+1],bb=c[x*3+2];
        if(v.count>=32){rr+=qBound(-16,int(v.dr/v.count),16)*strength/100;gg+=qBound(-16,int(v.dg/v.count),16)*strength/100;bb+=qBound(-16,int(v.db/v.count),16)*strength/100;}
        const int er=qAbs(int(s[x*3])-rr),eg=qAbs(int(s[x*3+1])-gg),eb=qAbs(int(s[x*3+2])-bb),worst=std::max({er,eg,eb});
        if(worst>12){const int extra=(worst-12)*strength/100;const int den=qMax(1,worst);rr+=(int(s[x*3])-rr)*extra/den;gg+=(int(s[x*3+1])-gg)*extra/den;bb+=(int(s[x*3+2])-bb)*extra/den;}
        d[x*3]=uchar(qBound(0,rr,255));d[x*3+1]=uchar(qBound(0,gg,255));d[x*3+2]=uchar(qBound(0,bb,255));
        if(d[x*3]!=c[x*3]||d[x*3+1]!=c[x*3+1]||d[x*3+2]!=c[x*3+2])++correctedPixels;
    }}
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
    QElapsedTimer timer;timer.start();
    QImageReader reader(path); reader.setAutoTransform(true);
    QImage source=reader.read().convertToFormat(QImage::Format_RGB888);
    if(source.isNull()) throw std::runtime_error("PNG не удалось прочитать");
    if(qMax(source.width(),source.height())>2048)
        source=source.scaled(2048,2048,Qt::KeepAspectRatio,Qt::SmoothTransformation).convertToFormat(QImage::Format_RGB888);
    progress(.12,"Lossless RGB24: фильтры и libdeflate");
    auto exact=PngEncoder::encodeRgb24(source,10);
    TextureResult best{source,source,exact.bytes,{},0,0,0,1,true};
    int secondPassPixels=0,secondPassStrength=0;
    if(exact.bytes.size()>=limit){
        const qint64 repairBudget=limit*90/100;
        // Luminance carries masonry/ground microtexture; chroma may be reduced
        // more strongly without turning a surface into large RGB blocks.
        const std::array<std::pair<int,int>,12> ladder={{{2,6},{3,8},{4,10},{5,12},{6,16},{8,20},{10,24},{12,32},{16,40},{20,48},{24,64},{32,80}}};
        for(const auto [ys,cs]:ladder){
            if(timer.elapsed()>42000)break;
            progress(.15+.055*best.tested,QString("Фактура Y/%1 · цветность/%2").arg(ys).arg(cs));
            QImage candidate=lumaChromaCandidate(source,ys,cs);
            auto encoded=PngEncoder::encodeRgb24(candidate,9); ++best.tested;
            if(encoded.bytes.size()<limit){
                if(best.png.size()>=limit){best.output=candidate;best.png=encoded.bytes;best.lossless=false;}
                if(encoded.bytes.size()<repairBudget){best.output=candidate;best.png=encoded.bytes;best.lossless=false;break;}
            }
        }
        // Web compressors gain most of their ratio from an adaptive palette.
        // We use the same rate model, then immediately expand it to RGB888 so
        // the final PNG remains color type 2 (RGB24), never indexed PNG8.
        if(best.png.size()>=limit&&timer.elapsed()<47000){
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
        // Independent second pass: compare every pixel, estimate systematic
        // colour bias per source-colour region, repair severe errors, re-encode
        // and keep the strongest repair that remains below the byte contract.
        if(best.png.size()<limit&&!best.lossless&&timer.elapsed()<50000){
            progress(.965,"Повторная проверка всех пикселей");
            const QImage base=best.output;
            for(int strength:{100,75,50,25}){
                if(timer.elapsed()>56000)break;
                int corrected=0;QImage repaired=auditRepair(source,base,strength,corrected);
                auto encoded=PngEncoder::encodeRgb24(repaired,10);++best.tested;
                if(encoded.bytes.size()<limit){best.output=repaired;best.png=encoded.bytes;secondPassPixels=corrected;secondPassStrength=strength;break;}
            }
        }
    }
    if(!PngEncoder::verifyRgb24(best.png,best.output)) throw std::runtime_error("RGB24-проверка не пройдена");
    measure(source,best.output,best.meanError,best.psnr,best.maxError);
    best.report=QString("%1 × %2  ·  RGB24  ·  %3\n%4 MB  ·  PSNR %5 dB  ·  mean ΔRGB %6  ·  max %7\nПроверено вариантов: %8")
        .arg(source.width()).arg(source.height()).arg(best.png.size()<limit?"ЛИМИТ ДОСТИГНУТ":"ЛИМИТ НЕ ДОСТИГНУТ")
        .arg(best.png.size()/1000000.0,0,'f',3)
        .arg(std::isinf(best.psnr)?QString("∞"):QString::number(best.psnr,'f',1))
        .arg(best.meanError,0,'f',2).arg(best.maxError).arg(best.tested);
    if(secondPassStrength)best.report+=QString("\nВторой проход: исправлено %1 пикселей · сила %2%").arg(secondPassPixels).arg(secondPassStrength);
    best.report+=QString("\nВремя обработки: %1 с").arg(timer.elapsed()/1000.0,0,'f',1);
    progress(1.0,"Готово"); return best;
}
