#include "TextureProcessor.h"
#include "PngEncoder.h"
#include <algorithm>
#include <QFileInfo>
#include <QBuffer>
#include <QImageReader>
#include <QImageWriter>
#include <QElapsedTimer>
#include <array>
#include <climits>
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
            // Strong edges and tiny atlas lines remain exact. Inside a
            // material we smooth chroma only: the original luminance is put
            // back pixel-for-pixel, preserving cobbles, brick, grass and sand.
            const int amount = maxDiff>24 ? 0 : smooth;
            if(amount==0){dst[x*3]=uchar(qRed(p));dst[x*3+1]=uchar(qGreen(p));dst[x*3+2]=uchar(qBlue(p));continue;}
            const int pr=qRed(p),pg=qGreen(p),pb=qBlue(p);
            const int yy=(77*pr+150*pg+29*pb+128)>>8;
            const int ar=sumR/n,ag=sumG/n,ab=sumB/n;
            const int pcb=(-43*pr-85*pg+128*pb+128)>>8;
            const int pcr=(128*pr-107*pg-21*pb+128)>>8;
            const int acb=(-43*ar-85*ag+128*ab+128)>>8;
            const int acr=(128*ar-107*ag-21*ab+128)>>8;
            int cb=(pcb*(100-amount)+acb*amount+50)/100;
            int cr=(pcr*(100-amount)+acr*amount+50)/100;
            const int localQ=maxDiff>24 ? qMax(1,quant/2) : quant;
            cb=quantizeSigned(cb,localQ);cr=quantizeSigned(cr,localQ);
            const int r=qBound(0,yy+((359*cr)>>8),255);
            const int g=qBound(0,yy-((88*cb+183*cr)>>8),255);
            const int b=qBound(0,yy+((454*cb)>>8),255);
            dst[x*3]=uchar(r); dst[x*3+1]=uchar(g); dst[x*3+2]=uchar(b);
        }
    }
    return out;
}

QImage TextureProcessor::paletteCandidate(const QImage &input,int colors,int preserveThreshold){
    const QImage src=input.convertToFormat(QImage::Format_RGB888);
    const QImage indexed=src.convertToFormat(QImage::Format_Indexed8,Qt::AvoidDither);
    const auto table=indexed.colorTable();std::vector<quint64> counts(table.size());
    for(int y=0;y<indexed.height();++y){const uchar*p=indexed.constScanLine(y);for(int x=0;x<indexed.width();++x)if(p[x]<counts.size())++counts[p[x]];}
    std::vector<int> order(table.size());for(int i=0;i<int(order.size());++i)order[i]=i;
    std::sort(order.begin(),order.end(),[&](int a,int b){return counts[a]>counts[b];});if(int(order.size())>colors)order.resize(colors);
    std::vector<int> remap(table.size());for(int i=0;i<int(table.size());++i){int best=order.front(),bestD=INT_MAX;const QRgb a=table[i];for(const int j:order){const QRgb b=table[j];const int dr=qRed(a)-qRed(b),dg=qGreen(a)-qGreen(b),db=qBlue(a)-qBlue(b),dist=2*dr*dr+4*dg*dg+db*db;if(dist<bestD){bestD=dist;best=j;}}remap[i]=best;}
    QImage out(src.size(),QImage::Format_RGB888);for(int y=0;y<src.height();++y){const uchar*s=src.constScanLine(y),*ix=indexed.constScanLine(y);uchar*d=out.scanLine(y);for(int x=0;x<src.width();++x){const QRgb q=table[remap[ix[x]]];const int r=qRed(q),g=qGreen(q),b=qBlue(q),worst=std::max({qAbs(r-int(s[x*3])),qAbs(g-int(s[x*3+1])),qAbs(b-int(s[x*3+2]))});if(worst>preserveThreshold){d[x*3]=s[x*3];d[x*3+1]=s[x*3+1];d[x*3+2]=s[x*3+2];}else{d[x*3]=uchar(r);d[x*3+1]=uchar(g);d[x*3+2]=uchar(b);}}}return out;
}

QImage TextureProcessor::perceptualPaletteCandidate(const QImage &input,int colors,int model,int orderedStrength){
    const QImage src=input.convertToFormat(QImage::Format_RGB888);
    colors=qBound(2,colors,256);
    struct Bin{quint64 r=0,g=0,b=0,n=0;};
    struct Point{double r=0,g=0,b=0;quint64 n=0;int key=0;};
    std::vector<Bin> histogram(32768);
    for(int y=0;y<src.height();++y){const uchar*p=src.constScanLine(y);for(int x=0;x<src.width();++x){const int r=p[x*3],g=p[x*3+1],b=p[x*3+2],k=(r>>3)*1024+(g>>3)*32+(b>>3);auto&h=histogram[k];h.r+=r;h.g+=g;h.b+=b;++h.n;}}
    std::vector<Point> points;points.reserve(32768);
    for(int k=0;k<32768;++k)if(histogram[k].n){const auto&h=histogram[k];points.push_back({double(h.r)/h.n,double(h.g)/h.n,double(h.b)/h.n,h.n,k});}
    if(points.empty())return src;
    struct Box{std::vector<int> ids;double score=0;};
    const auto scoreBox=[&](Box&box){
        double lo[3]={255,255,255},hi[3]={0,0,0};quint64 count=0;
        for(const int i:box.ids){const auto&p=points[i];lo[0]=qMin(lo[0],p.r);lo[1]=qMin(lo[1],p.g);lo[2]=qMin(lo[2],p.b);hi[0]=qMax(hi[0],p.r);hi[1]=qMax(hi[1],p.g);hi[2]=qMax(hi[2],p.b);count+=p.n;}
        const double dr=hi[0]-lo[0],dg=hi[1]-lo[1],db=hi[2]-lo[2];box.score=double(count)*(2*dr*dr+4*dg*dg+db*db);
    };
    Box first;first.ids.resize(points.size());for(int i=0;i<int(points.size());++i)first.ids[i]=i;scoreBox(first);
    std::vector<Box> boxes;boxes.push_back(std::move(first));
    while(int(boxes.size())<colors){
        int selected=-1;double score=-1;for(int i=0;i<int(boxes.size());++i)if(boxes[i].ids.size()>1&&boxes[i].score>score){score=boxes[i].score;selected=i;}
        if(selected<0)break;
        Box current=std::move(boxes[selected]);
        double lo[3]={255,255,255},hi[3]={0,0,0};for(const int i:current.ids){const auto&p=points[i];lo[0]=qMin(lo[0],p.r);lo[1]=qMin(lo[1],p.g);lo[2]=qMin(lo[2],p.b);hi[0]=qMax(hi[0],p.r);hi[1]=qMax(hi[1],p.g);hi[2]=qMax(hi[2],p.b);}
        const double range[3]={2*(hi[0]-lo[0]),4*(hi[1]-lo[1]),hi[2]-lo[2]};int channel=range[1]>=range[0]&&range[1]>=range[2]?1:(range[0]>=range[2]?0:2);
        std::sort(current.ids.begin(),current.ids.end(),[&](int a,int b){const auto&A=points[a];const auto&B=points[b];return channel==0?A.r<B.r:(channel==1?A.g<B.g:A.b<B.b);});
        quint64 total=0;for(const int i:current.ids)total+=points[i].n;quint64 sum=0;size_t cut=1;for(;cut<current.ids.size();++cut){sum+=points[current.ids[cut-1]].n;if(sum*2>=total)break;}
        cut=qBound<size_t>(1,cut,current.ids.size()-1);Box a,b;a.ids.assign(current.ids.begin(),current.ids.begin()+cut);b.ids.assign(current.ids.begin()+cut,current.ids.end());scoreBox(a);scoreBox(b);boxes[selected]=std::move(a);boxes.push_back(std::move(b));
    }
    struct Colour{double r=0,g=0,b=0;};std::vector<Colour> palette;palette.reserve(boxes.size());
    for(const auto&box:boxes){long double r=0,g=0,b=0,n=0;for(const int i:box.ids){const auto&p=points[i];r+=p.r*p.n;g+=p.g*p.n;b+=p.b*p.n;n+=p.n;}palette.push_back({double(r/n),double(g/n),double(b/n)});}
    struct Lab{double l=0,a=0,b=0;};
    const auto lab=[](double r,double g,double b){
        auto linear=[](double v){v/=255.0;return v<=.04045?v/12.92:std::pow((v+.055)/1.055,2.4);};
        r=linear(r);g=linear(g);b=linear(b);const double l=std::cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=std::cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=std::cbrt(.0883024619*r+.2817188376*g+.6299787005*b);return Lab{.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s};
    };
    std::vector<Lab> pointLab(points.size());if(model==1)for(int i=0;i<int(points.size());++i)pointLab[i]=lab(points[i].r,points[i].g,points[i].b);
    const auto fastDistance=[&](const Point&p,const Colour&c){
        const double dr=p.r-c.r,dg=p.g-c.g,db=p.b-c.b;
        if(model==2){const double dy=(54*dr+183*dg+19*db)/256.0,dcb=(-43*dr-85*dg+128*db)/256.0,dcr=(128*dr-107*dg-21*db)/256.0;return 6*dy*dy+1.7*dcb*dcb+1.7*dcr*dcr;}
        return 2*dr*dr+4*dg*dg+db*db;
    };
    // Weighted Lloyd refinement on the compact 5-bit histogram. It has the
    // visual benefit of a full-image k-means pass without 4M×palette work.
    const int iterations=model==0?1:3;
    std::vector<int> assignment(points.size());
    std::vector<Lab> paletteLab(palette.size());
    for(int iteration=0;iteration<iterations;++iteration){
        if(model==1)for(int j=0;j<int(palette.size());++j)paletteLab[j]=lab(palette[j].r,palette[j].g,palette[j].b);
        std::vector<long double> sr(palette.size()),sg(palette.size()),sb(palette.size()),sn(palette.size());
        for(int i=0;i<int(points.size());++i){int best=0;double bestD=std::numeric_limits<double>::max();for(int j=0;j<int(palette.size());++j){double d;if(model==1){const auto&a=pointLab[i];const auto&b=paletteLab[j];const double dl=(a.l-b.l)*1.35,da=a.a-b.a,db=a.b-b.b;d=dl*dl+da*da+db*db;}else d=fastDistance(points[i],palette[j]);if(d<bestD){bestD=d;best=j;}}assignment[i]=best;const auto&p=points[i];sr[best]+=p.r*p.n;sg[best]+=p.g*p.n;sb[best]+=p.b*p.n;sn[best]+=p.n;}
        for(int j=0;j<int(palette.size());++j)if(sn[j]>0)palette[j]={double(sr[j]/sn[j]),double(sg[j]/sn[j]),double(sb[j]/sn[j])};
    }
    if(model==1)for(int j=0;j<int(palette.size());++j)paletteLab[j]=lab(palette[j].r,palette[j].g,palette[j].b);
    std::vector<QRgb> map(32768);
    for(int k=0;k<32768;++k){const auto&h=histogram[k];Point p;if(h.n)p={double(h.r)/h.n,double(h.g)/h.n,double(h.b)/h.n,h.n,k};else p={double(((k>>10)&31)*8+4),double(((k>>5)&31)*8+4),double((k&31)*8+4),1,k};const Lab pl=model==1?lab(p.r,p.g,p.b):Lab{};int best=0;double bestD=std::numeric_limits<double>::max();for(int j=0;j<int(palette.size());++j){double d;if(model==1){const auto&b=paletteLab[j];const double dl=(pl.l-b.l)*1.35,da=pl.a-b.a,db=pl.b-b.b;d=dl*dl+da*da+db*db;}else d=fastDistance(p,palette[j]);if(d<bestD){bestD=d;best=j;}}const auto&c=palette[best];map[k]=qRgb(qBound(0,int(std::lround(c.r)),255),qBound(0,int(std::lround(c.g)),255),qBound(0,int(std::lround(c.b)),255));}
    static constexpr int bayer[16]={0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5};
    QImage out(src.size(),QImage::Format_RGB888);
    for(int y=0;y<src.height();++y){const uchar*s=src.constScanLine(y);uchar*d=out.scanLine(y);for(int x=0;x<src.width();++x){int r=s[x*3],g=s[x*3+1],b=s[x*3+2];if(orderedStrength){const int o=(bayer[(y&3)*4+(x&3)]*2-15)*orderedStrength/16;r=qBound(0,r+o,255);g=qBound(0,g+o,255);b=qBound(0,b+o,255);}const QRgb c=map[(r>>3)*1024+(g>>3)*32+(b>>3)];d[x*3]=uchar(qRed(c));d[x*3+1]=uchar(qGreen(c));d[x*3+2]=uchar(qBlue(c));}}
    return out;
}

QImage TextureProcessor::jpegBridgeCandidate(const QImage &input,int quality){
    QByteArray bytes;QBuffer buffer(&bytes);buffer.open(QIODevice::WriteOnly);QImageWriter writer(&buffer,"JPEG");writer.setQuality(qBound(1,quality,100));writer.setOptimizedWrite(true);if(!writer.write(input.convertToFormat(QImage::Format_RGB888)))return input.convertToFormat(QImage::Format_RGB888);buffer.close();const QImage decoded=QImage::fromData(bytes,"JPEG");return decoded.isNull()?input.convertToFormat(QImage::Format_RGB888):decoded.convertToFormat(QImage::Format_RGB888);
}

QImage TextureProcessor::lumaChromaCandidate(const QImage &input,int yStep,int cStep) {
    const QImage src=input.convertToFormat(QImage::Format_RGB888);
    QImage out(src.size(),QImage::Format_RGB888);
    for(int y=0;y<src.height();++y){
        const uchar*s=src.constScanLine(y);uchar*d=out.scanLine(y);
        for(int i=0;i<src.width();++i){
            const int x=i;
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
            // Never diffuse quantisation error into neighbouring texels. Error
            // diffusion produced coloured salt-and-pepper noise, destroyed
            // DEFLATE locality and forced later candidates to become extreme.
            const int qy=quantize(yy,ys);
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

QImage TextureProcessor::guardCandidate(const QImage &source0,const QImage &candidate0,int rgbGuard,int chromaGuard){
    const QImage source=source0.convertToFormat(QImage::Format_RGB888),candidate=candidate0.convertToFormat(QImage::Format_RGB888);
    QImage out(source.size(),QImage::Format_RGB888);
    for(int y=0;y<source.height();++y){const uchar*s=source.constScanLine(y),*c=candidate.constScanLine(y);uchar*d=out.scanLine(y);for(int x=0;x<source.width();++x){
        const int dr=int(c[x*3])-int(s[x*3]),dg=int(c[x*3+1])-int(s[x*3+1]),db=int(c[x*3+2])-int(s[x*3+2]);
        const int maximum=std::max({qAbs(dr),qAbs(dg),qAbs(db)});
        const int dcb=qAbs((-43*dr-85*dg+128*db)/256),dcr=qAbs((128*dr-107*dg-21*db)/256),maximumChroma=qMax(dcb,dcr);
        // Leave a fractional safety margin: integer rounding must never turn a
        // mathematically valid colour into a one-code-value chroma outlier.
        double scale=1.0;if(maximum>rgbGuard)scale=qMin(scale,qMax(0.0,(rgbGuard-.35)/maximum));if(maximumChroma>chromaGuard)scale=qMin(scale,qMax(0.0,(chromaGuard-.35)/maximumChroma));
        int rr=qBound(0,int(s[x*3]+std::lround(dr*scale)),255),gg=qBound(0,int(s[x*3+1]+std::lround(dg*scale)),255),bb=qBound(0,int(s[x*3+2]+std::lround(db*scale)),255);
        int loR=255,loG=255,loB=255,hiR=0,hiG=0,hiB=0;for(int oy=-1;oy<=1;++oy){const uchar*n=source.constScanLine(qBound(0,y+oy,source.height()-1));for(int ox=-1;ox<=1;++ox){const int nx=qBound(0,x+ox,source.width()-1);loR=qMin(loR,int(n[nx*3]));loG=qMin(loG,int(n[nx*3+1]));loB=qMin(loB,int(n[nx*3+2]));hiR=qMax(hiR,int(n[nx*3]));hiG=qMax(hiG,int(n[nx*3+1]));hiB=qMax(hiB,int(n[nx*3+2]));}}
        d[x*3]=uchar(qBound(loR-2,rr,hiR+2));d[x*3+1]=uchar(qBound(loG-2,gg,hiG+2));d[x*3+2]=uchar(qBound(loB-2,bb,hiB+2));
    }}return out;
}

QImage TextureProcessor::areaDownsample(const QImage &input,const QSize &target){
    const QImage src=input.convertToFormat(QImage::Format_RGB888);
    if(src.width()%target.width()!=0||src.height()%target.height()!=0)return src.scaled(target,Qt::KeepAspectRatio,Qt::SmoothTransformation).convertToFormat(QImage::Format_RGB888);
    const int sx=src.width()/target.width(),sy=src.height()/target.height();QImage out(target,QImage::Format_RGB888);
    for(int y=0;y<target.height();++y){uchar*d=out.scanLine(y);for(int x=0;x<target.width();++x){quint64 r=0,g=0,b=0;for(int yy=0;yy<sy;++yy){const uchar*p=src.constScanLine(y*sy+yy)+(x*sx)*3;for(int xx=0;xx<sx;++xx){r+=p[xx*3];g+=p[xx*3+1];b+=p[xx*3+2];}}const int n=sx*sy;d[x*3]=uchar((r+n/2)/n);d[x*3+1]=uchar((g+n/2)/n);d[x*3+2]=uchar((b+n/2)/n);}}return out;
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

#if 0 // Legacy single-pipeline experiment kept only for historical comparison.
TextureResult TextureProcessor::process(const QString &path,qint64 limit,const Progress &progress) {
    QElapsedTimer timer;timer.start();
    QImageReader reader(path); reader.setAutoTransform(true);
    QImage source=reader.read().convertToFormat(QImage::Format_RGB888);
    if(source.isNull()) throw std::runtime_error("PNG не удалось прочитать");
    if(qMax(source.width(),source.height())>2048){const double k=2048.0/qMax(source.width(),source.height());source=areaDownsample(source,QSize(qMax(1,int(std::lround(source.width()*k))),qMax(1,int(std::lround(source.height()*k)))));}
    progress(.12,"Lossless RGB24: фильтры и libdeflate");
    auto exact=PngEncoder::encodeRgb24(source,10);
    TextureResult best{source,source,exact.bytes,{},0,0,0,1,true};
    int secondPassPixels=0,secondPassStrength=0,selectedRgbGuard=0,selectedChromaGuard=0,paletteRestore=0;
    if(exact.bytes.size()>=limit){
        const qint64 repairBudget=limit*90/100;
        bool selectedPalette=false;
        struct PaletteLevel{int colors,preserve;};
        for(const auto level:{PaletteLevel{256,24},PaletteLevel{224,28},PaletteLevel{192,32},PaletteLevel{160,40},PaletteLevel{128,48},PaletteLevel{96,64},PaletteLevel{64,96},PaletteLevel{48,128},PaletteLevel{32,255}}){
            progress(.13+.04*best.tested,QString("Перцептуальная палитра · %1 цветов · RGB24").arg(level.colors));
            QImage candidate=paletteCandidate(source,level.colors,level.preserve);
            auto encoded=PngEncoder::encodeRgb24(candidate,9);++best.tested;
            progress(.13+.035*best.tested,QString("Кандидат %1 · %2 MB").arg(best.tested).arg(encoded.bytes.size()/1000000.0,0,'f',3));
            if(encoded.bytes.size()<limit){
                best.output=candidate;best.png=encoded.bytes;best.lossless=false;selectedPalette=true;
                // Spend every safe byte below the contract by returning source
                // information. Greedy binary increments converge close to the
                // limit without ever allowing the result to cross it.
                for(const int add:{50,25,12,6,3,2,1}){const int attempt=paletteRestore+add;if(attempt>99)continue;QImage richer=blendSource(candidate,source,attempt);auto rich=PngEncoder::encodeRgb24(richer,9);++best.tested;progress(.56,QString("Восстановление %1% · %2 MB").arg(attempt).arg(rich.bytes.size()/1000000.0,0,'f',3));if(rich.bytes.size()<limit){best.output=richer;best.png=rich.bytes;paletteRestore=attempt;}}
                break;
            }
        }
        // First remove only intra-material high-frequency noise. The bilateral
        // neighbourhood rejects different luminance, so silhouettes, atlas
        // seams and thin markings do not bleed into their surroundings.
        const std::array<std::pair<int,int>,7> spatial={{{18,2},{28,2},{38,3},{50,3},{62,4},{74,5},{86,6}}};
        for(const auto [smooth,quant]:spatial){
            if(best.png.size()<limit)break;
            progress(.13+.035*best.tested,QString("Локальная фактура · %1% · RGB/%2").arg(smooth).arg(quant));
            const int rgb=qMin(12,6+quant),chroma=qMin(5,2+quant/2);
            QImage candidate=guardCandidate(source,edgeAwareCandidate(source,smooth,quant),rgb,chroma);
            auto encoded=PngEncoder::encodeRgb24(candidate,9);++best.tested;
            if(encoded.bytes.size()<limit){best.output=candidate;best.png=encoded.bytes;best.lossless=false;selectedRgbGuard=rgb;selectedChromaGuard=chroma;break;}
        }
        // Luminance carries masonry/ground microtexture; chroma may be reduced
        // more strongly without turning a surface into large RGB blocks.
        const std::array<std::pair<int,int>,12> ladder={{{2,6},{3,8},{4,10},{5,12},{6,16},{8,20},{10,24},{12,32},{16,40},{20,48},{24,64},{32,80}}};
        for(const auto [ys,cs]:ladder){
            if(best.png.size()<limit)break;
            progress(.15+.055*best.tested,QString("Фактура Y/%1 · цветность/%2").arg(ys).arg(cs));
            QImage candidate=guardCandidate(source,lumaChromaCandidate(source,ys,cs),8,3);
            auto encoded=PngEncoder::encodeRgb24(candidate,9); ++best.tested;
            if(encoded.bytes.size()<limit){
                if(best.png.size()>=limit){best.output=candidate;best.png=encoded.bytes;best.lossless=false;selectedRgbGuard=8;selectedChromaGuard=3;}
                if(encoded.bytes.size()<repairBudget){best.output=candidate;best.png=encoded.bytes;best.lossless=false;selectedRgbGuard=8;selectedChromaGuard=3;break;}
            }
        }
        // Web compressors gain most of their ratio from an adaptive palette.
        // We use the same rate model, then immediately expand it to RGB888 so
        // the final PNG remains color type 2 (RGB24), never indexed PNG8.
        if(best.png.size()>=limit){
            progress(.89,"Адаптивная цветовая модель RGB24");
            QImage palette=guardCandidate(source,source.convertToFormat(QImage::Format_Indexed8,Qt::AvoidDither)
                                 .convertToFormat(QImage::Format_RGB888),12,5);
            auto encoded=PngEncoder::encodeRgb24(palette,10);++best.tested;
            if(encoded.bytes.size()<limit){
                best.output=palette;best.png=encoded.bytes;best.lossless=false;selectedRgbGuard=12;selectedChromaGuard=5;
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
        struct StrictLevel{int y,c,rgb,chroma;};
        for(const auto level:{StrictLevel{40,96,10,4},StrictLevel{48,112,11,4},StrictLevel{64,128,12,5},StrictLevel{85,170,14,6},StrictLevel{128,255,16,7},StrictLevel{170,255,18,8},StrictLevel{255,255,20,9},StrictLevel{255,255,24,10},StrictLevel{255,255,28,12},StrictLevel{255,255,32,14}}){
            if(best.png.size()<limit)break;
            progress(.93,QString("Строгий лимит · Y/%1 C/%2 · защита %3/%4").arg(level.y).arg(level.c).arg(level.rgb).arg(level.chroma));
            QImage candidate=guardCandidate(source,lumaChromaCandidate(source,level.y,level.c),level.rgb,level.chroma);
            auto encoded=PngEncoder::encodeRgb24(candidate,10);++best.tested;
            if(encoded.bytes.size()<limit){best.output=candidate;best.png=encoded.bytes;best.lossless=false;selectedRgbGuard=level.rgb;selectedChromaGuard=level.chroma;break;}
        }
        // Independent second pass: compare every pixel, estimate systematic
        // colour bias per source-colour region, repair severe errors, re-encode
        // and keep the strongest repair that remains below the byte contract.
        if(best.png.size()<limit&&!best.lossless&&!selectedPalette){
            progress(.965,"Повторная проверка всех пикселей");
            const QImage base=best.output;
            for(int strength:{100,75,50,25}){
                int corrected=0;QImage repaired=auditRepair(source,base,strength,corrected);
                repaired=guardCandidate(source,repaired,selectedRgbGuard,selectedChromaGuard);
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
    if(selectedRgbGuard)best.report+=QString("\nЖёсткая защита: RGB≤%1 · цветность≤%2").arg(selectedRgbGuard).arg(selectedChromaGuard);
    if(paletteRestore)best.report+=QString("\nВозвращено исходной информации: %1% · запас до лимита %2 KB").arg(paletteRestore).arg((limit-best.png.size())/1000.0,0,'f',1);
    best.report+=QString("\nВремя обработки: %1 с").arg(timer.elapsed()/1000.0,0,'f',1);
    progress(1.0,"Готово"); return best;
}
#endif

TextureResult TextureProcessor::process(const QString &path,qint64 limit,int algorithmId,const Progress &progress) {
    QElapsedTimer timer;timer.start();
    QImageReader reader(path);reader.setAutoTransform(true);
    QImage source=reader.read().convertToFormat(QImage::Format_RGB888);
    if(source.isNull())throw std::runtime_error("PNG не удалось прочитать");
    if(qMax(source.width(),source.height())>2048){const double k=2048.0/qMax(source.width(),source.height());source=areaDownsample(source,QSize(qMax(1,int(std::lround(source.width()*k))),qMax(1,int(std::lround(source.height()*k)))));}

    progress(.04,"Lossless RGB24 · libdeflate");
    const auto exact=PngEncoder::encodeRgb24(source,10);
    TextureResult exactResult;exactResult.original=source;exactResult.output=source;exactResult.png=exact.bytes;exactResult.lossless=true;exactResult.tested=1;exactResult.algorithmId=algorithmId;exactResult.algorithmName="Lossless RGB24";
    if(exact.bytes.size()<limit){
        exactResult.meanError=0;exactResult.psnr=std::numeric_limits<double>::infinity();exactResult.maxError=0;
        exactResult.report=QString("%1 × %2 · RGB24 · ЛИМИТ ДОСТИГНУТ\nLossless RGB24 · %3 MB · без изменений\nВремя обработки: %4 с").arg(source.width()).arg(source.height()).arg(exact.bytes.size()/1000000.0,0,'f',3).arg(timer.elapsed()/1000.0,0,'f',1);
        progress(1.0,"Готово");return exactResult;
    }

    int totalTested=1;
    const auto runPalette=[&](const QImage&base,const QString&name,int id,int model,int ordered,double start,double span){
        TextureResult winner;winner.original=source;winner.output=source;winner.png=exact.bytes;winner.algorithmId=id;winner.algorithmName=name;winner.meanError=std::numeric_limits<double>::max();
        int previousFail=257,firstPass=-1,step=0;
        const std::array<int,14> counts={{256,224,208,192,176,160,144,128,112,96,80,64,48,32}};
        const auto evaluate=[&](int colors){
            progress(qMin(.96,start+span*(.08+.075*step++)),QString("%1 · %2 цветов").arg(name).arg(colors));
            const QImage candidate=perceptualPaletteCandidate(base,colors,model,ordered);const auto encoded=PngEncoder::encodeRgb24(candidate,10);++totalTested;
            double mean=0,psnr=0;int maximum=0;measure(source,candidate,mean,psnr,maximum);const bool passing=encoded.bytes.size()<limit;
            if((passing&&(winner.png.size()>=limit||psnr>winner.psnr+.005||(qAbs(psnr-winner.psnr)<.005&&encoded.bytes.size()>winner.png.size())))||(!passing&&winner.png.size()>=limit&&encoded.bytes.size()<winner.png.size())){
                winner.output=candidate;winner.png=encoded.bytes;winner.meanError=mean;winner.psnr=psnr;winner.maxError=maximum;winner.paletteColors=colors;winner.lossless=false;
            }
            progress(qMin(.97,start+span*(.12+.075*step)),QString("%1 · %2 цветов · %3 MB%4").arg(name).arg(colors).arg(encoded.bytes.size()/1000000.0,0,'f',3).arg(passing?" · OK":""));return passing;
        };
        for(const int colors:counts){const bool passing=evaluate(colors);if(passing){firstPass=colors;break;}previousFail=colors;}
        if(firstPass>0&&previousFail<=256){int low=firstPass,high=previousFail;for(int i=0;i<6&&high-low>1;++i){const int mid=(low+high)/2;if(evaluate(mid))low=mid;else high=mid;}}
        // Spend safe bytes by increasing palette resolution. Mixing arbitrary
        // original pixels back in created the coloured outliers seen before.
        if(winner.png.size()<limit&&winner.paletteColors>0&&winner.png.size()<limit*94/100){for(int add:{8,4,2,1}){const int c=qMin(256,winner.paletteColors+add);if(c>winner.paletteColors)evaluate(c);}}
        winner.tested=totalTested;return winner;
    };

    const auto runAlgorithm=[&](int id,double start,double span){
        switch(id){
        case 1:return runPalette(source,"Median RGB",id,0,0,start,span);
        case 2:return runPalette(source,"Perceptual Oklab",id,1,0,start,span);
        case 3:return runPalette(source,"Luma + Color",id,2,0,start,span);
        case 4:return runPalette(source,"Ordered Microdither",id,1,3,start,span);
        case 5:{
            progress(start+span*.05,"Qt Web Palette · 256 цветов");const QImage web=source.convertToFormat(QImage::Format_Indexed8,Qt::AvoidDither).convertToFormat(QImage::Format_RGB888);const auto encoded=PngEncoder::encodeRgb24(web,10);++totalTested;
            if(encoded.bytes.size()<limit){TextureResult r;r.original=source;r.output=web;r.png=encoded.bytes;r.algorithmId=id;r.algorithmName="Qt Web Palette";r.paletteColors=256;r.tested=totalTested;measure(source,web,r.meanError,r.psnr,r.maxError);return r;}
            return runPalette(source,"Qt Web + adaptive",id,0,0,start+span*.12,span*.88);
        }
        case 6:return runPalette(jpegBridgeCandidate(source,96),"JPEG 96 bridge + Oklab",id,1,0,start,span);
        case 7:return runPalette(jpegBridgeCandidate(source,90),"JPEG 90 bridge + Oklab",id,1,0,start,span);
        case 8:return runPalette(lumaChromaCandidate(source,2,6),"Texture Luma + Oklab",id,1,0,start,span);
        case 9:return runPalette(edgeAwareCandidate(source,28,2),"Edge Detail + Oklab",id,1,0,start,span);
        default:return runPalette(source,"Perceptual Oklab",2,1,0,start,span);
        }
    };

    TextureResult best;
    if(algorithmId==0){
        best.original=source;best.output=source;best.png=exact.bytes;best.meanError=std::numeric_limits<double>::max();best.algorithmId=0;best.algorithmName="AUTO Tournament";
        for(int id=1;id<=9;++id){TextureResult trial=runAlgorithm(id,.05+(id-1)*.1,.095);if(trial.png.size()<limit&&(best.png.size()>=limit||trial.psnr>best.psnr)){best=std::move(trial);best.algorithmId=0;best.algorithmName="AUTO → "+best.algorithmName;}}
        if(best.png.size()>=limit)best=runPalette(source,"AUTO emergency palette",0,1,0,.91,.08);
    }else best=runAlgorithm(qBound(1,algorithmId,9),.06,.9);

    best.original=source;best.tested=totalTested;
    if(!PngEncoder::verifyRgb24(best.png,best.output))throw std::runtime_error("RGB24-проверка не пройдена");
    measure(source,best.output,best.meanError,best.psnr,best.maxError);
    best.report=QString("%1 × %2 · RGB24 · %3\nАлгоритм: %4%5\n%6 MB · PSNR %7 dB · mean ΔRGB %8 · max %9\nПроверено вариантов: %10 · время: %11 с")
        .arg(source.width()).arg(source.height()).arg(best.png.size()<limit?"ЛИМИТ ДОСТИГНУТ":"ЛИМИТ НЕ ДОСТИГНУТ")
        .arg(best.algorithmName).arg(best.paletteColors?QString(" · %1 цветов").arg(best.paletteColors):QString())
        .arg(best.png.size()/1000000.0,0,'f',3).arg(std::isinf(best.psnr)?QString("∞"):QString::number(best.psnr,'f',1)).arg(best.meanError,0,'f',2).arg(best.maxError)
        .arg(best.tested).arg(timer.elapsed()/1000.0,0,'f',1);
    best.report+=QString("\nФинальная проверка: PNG color type 2 · bit depth 8 · запас %1 KB").arg(qMax<qint64>(0,limit-best.png.size())/1000.0,0,'f',1);
    progress(1.0,"Готово");return best;
}
