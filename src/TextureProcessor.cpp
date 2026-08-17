#include "TextureProcessor.h"
#include "PngEncoder.h"
#include <algorithm>
#include <QImageReader>
#include <QFileInfo>
#include <QElapsedTimer>
#include <array>
#include <cmath>
#include <limits>
#include <initializer_list>
#include <stdexcept>
#include <vector>

QImage TextureProcessor::perceptualPaletteCandidate(const QImage &input,int colors,int model,int orderedStrength,const Cancel &cancel){
    const QImage src=input.convertToFormat(QImage::Format_RGB888);
    colors=qBound(1,colors,256);
    struct Bin{quint64 r=0,g=0,b=0,n=0;};
    struct Point{double r=0,g=0,b=0;quint64 n=0;int key=0;};
    std::vector<Bin> histogram(32768);
    for(int y=0;y<src.height();++y){if((y&31)==0&&cancel&&cancel())throw std::runtime_error("Остановлено пользователем");const uchar*p=src.constScanLine(y);for(int x=0;x<src.width();++x){const int r=p[x*3],g=p[x*3+1],b=p[x*3+2],k=(r>>3)*1024+(g>>3)*32+(b>>3);auto&h=histogram[k];h.r+=r;h.g+=g;h.b+=b;++h.n;}}
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
    for(int y=0;y<src.height();++y){if((y&31)==0&&cancel&&cancel())throw std::runtime_error("Остановлено пользователем");const uchar*s=src.constScanLine(y);uchar*d=out.scanLine(y);for(int x=0;x<src.width();++x){int r=s[x*3],g=s[x*3+1],b=s[x*3+2];if(orderedStrength){const int o=(bayer[(y&3)*4+(x&3)]*2-15)*orderedStrength/16;r=qBound(0,r+o,255);g=qBound(0,g+o,255);b=qBound(0,b+o,255);}const QRgb c=map[(r>>3)*1024+(g>>3)*32+(b>>3)];d[x*3]=uchar(qRed(c));d[x*3+1]=uchar(qGreen(c));d[x*3+2]=uchar(qBlue(c));}}
    return out;
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

QString TextureProcessor::detectKind(const QString &path){
    const QString name=QFileInfo(path).completeBaseName().toLower();
    const auto hasAny=[&](std::initializer_list<const char*> words){for(const char *word:words)if(name.contains(QLatin1String(word)))return true;return false;};
    if(name=="n"||name=="nrm"||name=="normal"||hasAny({"normal","normals","normalmap","_nrm","-nrm","_nor","-nor"})||name.endsWith("_n")||name.endsWith("-n"))return QStringLiteral("NORMAL");
    if(name=="erm"||name=="orm"||name=="rma"||name=="mra"||hasAny({"_erm","-erm","_orm","-orm","_rma","-rma","_mra","-mra","packed","metalrough","roughmetal"}))return QStringLiteral("ERM");

    QImageReader reader(path,"PNG");const QSize native=reader.size();
    if(!native.isValid())return QStringLiteral("COLOR");
    const double scale=qMin(1.0,192.0/qMax(native.width(),native.height()));
    reader.setScaledSize(QSize(qMax(1,int(native.width()*scale)),qMax(1,int(native.height()*scale))));
    const QImage probe=reader.read().convertToFormat(QImage::Format_RGB888);if(probe.isNull())return QStringLiteral("COLOR");
    quint64 count=0,blue=0,normalCentred=0,extreme=0,separated=0;
    for(int y=0;y<probe.height();++y){const uchar *p=probe.constScanLine(y);for(int x=0;x<probe.width();++x){const int r=p[x*3],g=p[x*3+1],b=p[x*3+2];++count;if(b>=r&&b>=g&&b>128)++blue;if(qAbs(r-128)<72&&qAbs(g-128)<72&&b>142)++normalCentred;const int ex=(r<18||r>237)+(g<18||g>237)+(b<18||b>237);if(ex>=2)++extreme;if(qMax(r,qMax(g,b))-qMin(r,qMin(g,b))>42)++separated;}}
    if(count&&blue*100/count>68&&normalCentred*100/count>52)return QStringLiteral("NORMAL");
    if(count&&extreme*100/count>46&&separated*100/count>38)return QStringLiteral("ERM");
    return QStringLiteral("COLOR");
}

QImage TextureProcessor::semanticCandidate(const QImage &input,int levels,const QString &kind,const Cancel &cancel){
    const QImage src=input.convertToFormat(QImage::Format_RGB888);levels=qBound(1,levels,256);
    if(levels==256)return src;
    QImage out(src.size(),QImage::Format_RGB888);
    const auto quantize=[levels](int value){if(levels<=1)return 0;const int slot=int(std::lround(double(value)*(levels-1)/255.0));return qBound(0,int(std::lround(double(slot)*255.0/(levels-1))),255);};
    for(int y=0;y<src.height();++y){if((y&31)==0&&cancel&&cancel())throw std::runtime_error("Остановлено пользователем");const uchar *s=src.constScanLine(y);uchar *d=out.scanLine(y);for(int x=0;x<src.width();++x){
        if(kind=="NORMAL"){
            if(levels<=1){d[x*3]=128;d[x*3+1]=128;d[x*3+2]=255;continue;}
            double nx=quantize(s[x*3])/127.5-1.0,ny=quantize(s[x*3+1])/127.5-1.0,nz=quantize(s[x*3+2])/127.5-1.0;
            const double length=std::sqrt(nx*nx+ny*ny+nz*nz);if(length<1e-8){nx=0;ny=0;nz=1;}else{nx/=length;ny/=length;nz/=length;}
            d[x*3]=uchar(qBound(0,int(std::lround((nx+1.0)*127.5)),255));d[x*3+1]=uchar(qBound(0,int(std::lround((ny+1.0)*127.5)),255));d[x*3+2]=uchar(qBound(0,int(std::lround((nz+1.0)*127.5)),255));
        }else{d[x*3]=uchar(quantize(s[x*3]));d[x*3+1]=uchar(quantize(s[x*3+1]));d[x*3+2]=uchar(quantize(s[x*3+2]));}
    }}
    return out;
}

TextureResult TextureProcessor::processSemantic(const QString &path,qint64 limit,const QString &kind,const Progress &progress,const Cancel &cancel){
    QElapsedTimer timer;timer.start();QImageReader reader(path,"PNG");reader.setAutoTransform(true);const QImage source=reader.read().convertToFormat(QImage::Format_RGB888);
    if(source.isNull())throw std::runtime_error("PNG не удалось прочитать");
    progress(.04,kind+QStringLiteral(" · lossless RGB24"));const auto exact=PngEncoder::encodeRgb24(source,10);
    TextureResult winner;winner.original=source;winner.output=source;winner.png=exact.bytes;winner.lossless=true;winner.tested=1;winner.algorithmName=kind=="NORMAL"?QStringLiteral("AGR Vector Normal"):QStringLiteral("AGR Channel-Safe ERM");winner.textureKind=kind;
    if(exact.bytes.size()<=limit){winner.meanError=0;winner.psnr=std::numeric_limits<double>::infinity();winner.report=QString("%1 × %2 · %3 · LOSSLESS RGB24\n%4 MB · векторы/каналы не изменены").arg(source.width()).arg(source.height()).arg(kind).arg(exact.bytes.size()/1000000.0,0,'f',3);progress(1,"Готово");return winner;}
    int previousFail=257,firstPass=-1,step=0;
    const std::array<int,21> levels={{256,240,224,208,192,176,160,144,128,112,96,80,64,48,32,24,16,8,4,2,1}};
    const auto evaluate=[&](int value){
        progress(qMin(.96,.08+.042*step++),QString("%1 · %2 уровней").arg(kind).arg(value));
        const QImage candidate=semanticCandidate(source,value,kind,cancel);const auto encoded=PngEncoder::encodeRgb24(candidate,10);++winner.tested;double mean=0,psnr=0;int maximum=0;measure(source,candidate,mean,psnr,maximum);const bool passing=encoded.bytes.size()<=limit;
        if((passing&&(winner.png.size()>limit||value>winner.paletteColors))||(!passing&&winner.png.size()>limit&&encoded.bytes.size()<winner.png.size())){winner.output=candidate;winner.png=encoded.bytes;winner.meanError=mean;winner.psnr=psnr;winner.maxError=maximum;winner.paletteColors=value;winner.lossless=false;}
        return passing;
    };
    for(const int value:levels){if(evaluate(value)){firstPass=value;break;}previousFail=value;}
    if(firstPass>0&&previousFail<=256){int low=firstPass,high=previousFail;for(int i=0;i<7&&high-low>1;++i){const int mid=(low+high)/2;if(evaluate(mid))low=mid;else high=mid;}}
    if(winner.png.size()>limit)throw std::runtime_error("Адаптивный semantic RGB24 не смог уменьшить PNG");
    if(!PngEncoder::verifyRgb24(winner.png,winner.output))throw std::runtime_error("RGB24-проверка не пройдена");
    measure(source,winner.output,winner.meanError,winner.psnr,winner.maxError);
    QString semanticMetric;
    if(kind=="NORMAL"){
        long double total=0;double maximum=0;quint64 pixels=0;
        for(int y=0;y<source.height();++y){const uchar *a=source.constScanLine(y),*b=winner.output.constScanLine(y);for(int x=0;x<source.width();++x){double ax=a[x*3]/127.5-1,ay=a[x*3+1]/127.5-1,az=a[x*3+2]/127.5-1,bx=b[x*3]/127.5-1,by=b[x*3+1]/127.5-1,bz=b[x*3+2]/127.5-1;const double al=std::sqrt(ax*ax+ay*ay+az*az),bl=std::sqrt(bx*bx+by*by+bz*bz);if(al<1e-8||bl<1e-8)continue;const double dot=qBound(-1.0,(ax*bx+ay*by+az*bz)/(al*bl),1.0),angle=std::acos(dot)*57.29577951308232;total+=angle;maximum=qMax(maximum,angle);++pixels;}}
        semanticMetric=QString("Средняя угловая ошибка %1° · максимум %2°").arg(pixels?double(total/pixels):0,0,'f',3).arg(maximum,0,'f',2);
    }else semanticMetric=QString("Независимые E/R/M-каналы · mean Δ %1 · max %2").arg(winner.meanError,0,'f',3).arg(winner.maxError);
    winner.report=QString("%1 × %2 · %3 · SEMANTIC RGB24\nАлгоритм: %4 · %5 уровней\n%6 MB · PSNR %7 dB\n%8\nПроверено %9 вариантов · %10 с").arg(source.width()).arg(source.height()).arg(kind).arg(winner.algorithmName).arg(winner.paletteColors).arg(winner.png.size()/1000000.0,0,'f',3).arg(winner.psnr,0,'f',1).arg(semanticMetric).arg(winner.tested).arg(timer.elapsed()/1000.0,0,'f',1);
    progress(1,"Готово");return winner;
}


TextureResult TextureProcessor::process(const QString &path,qint64 limit,const Progress &progress,const Cancel &cancel,bool preserveResolution) {
    if(limit<=0)throw std::runtime_error("Некорректный предел размера");
    QElapsedTimer timer;timer.start();
    QImageReader reader(path,"PNG");reader.setAutoTransform(true);
    QImage source=reader.read().convertToFormat(QImage::Format_RGB888);
    if(source.isNull())throw std::runtime_error("PNG не удалось прочитать");
    if(!preserveResolution&&qMax(source.width(),source.height())>2048){const double k=2048.0/qMax(source.width(),source.height());source=areaDownsample(source,QSize(qMax(1,int(std::lround(source.width()*k))),qMax(1,int(std::lround(source.height()*k)))));}

    if(cancel&&cancel())throw std::runtime_error("Остановлено пользователем");progress(.04,"Lossless RGB24 · libdeflate");
    const auto exact=PngEncoder::encodeRgb24(source,10);
    TextureResult exactResult;exactResult.original=source;exactResult.output=source;exactResult.png=exact.bytes;exactResult.lossless=true;exactResult.tested=1;exactResult.algorithmName="Lossless RGB24";
    if(exact.bytes.size()<=limit){
        exactResult.meanError=0;exactResult.psnr=std::numeric_limits<double>::infinity();exactResult.maxError=0;
        exactResult.report=QString("%1 × %2 · RGB24 · ЛИМИТ ДОСТИГНУТ\nLossless RGB24 · %3 MB · без изменений\nВремя обработки: %4 с").arg(source.width()).arg(source.height()).arg(exact.bytes.size()/1000000.0,0,'f',3).arg(timer.elapsed()/1000.0,0,'f',1);
        progress(1.0,"Готово");return exactResult;
    }

    int totalTested=1;
    const QString algorithmName="AGR Adaptive RGB24";
    const auto runPalette=[&]{
        TextureResult winner;winner.original=source;winner.output=source;winner.png=exact.bytes;winner.algorithmName=algorithmName;winner.meanError=std::numeric_limits<double>::max();
        int previousFail=257,firstPass=-1,step=0;
        const std::array<int,19> counts={{256,224,208,192,176,160,144,128,112,96,80,64,48,32,16,8,4,2,1}};
        const auto evaluate=[&](int colors){
            progress(qMin(.96,.08+.045*step++),QString("%1 · %2 цветов").arg(algorithmName).arg(colors));
            if(cancel&&cancel())throw std::runtime_error("Остановлено пользователем");const QImage candidate=perceptualPaletteCandidate(source,colors,0,0,cancel);const auto encoded=PngEncoder::encodeRgb24(candidate,10);++totalTested;
            double mean=0,psnr=0;int maximum=0;measure(source,candidate,mean,psnr,maximum);const bool passing=encoded.bytes.size()<=limit;
            if((passing&&(winner.png.size()>limit||psnr>winner.psnr+.005||(qAbs(psnr-winner.psnr)<.005&&encoded.bytes.size()>winner.png.size())))||(!passing&&winner.png.size()>limit&&encoded.bytes.size()<winner.png.size())){
                winner.output=candidate;winner.png=encoded.bytes;winner.meanError=mean;winner.psnr=psnr;winner.maxError=maximum;winner.paletteColors=colors;winner.lossless=false;
            }
            progress(qMin(.97,.10+.045*step),QString("%1 · %2 цветов · %3 MB%4").arg(algorithmName).arg(colors).arg(encoded.bytes.size()/1000000.0,0,'f',3).arg(passing?" · OK":""));return passing;
        };
        for(const int colors:counts){const bool passing=evaluate(colors);if(passing){firstPass=colors;break;}previousFail=colors;}
        if(firstPass>0&&previousFail<=256){int low=firstPass,high=previousFail;for(int i=0;i<6&&high-low>1;++i){const int mid=(low+high)/2;if(evaluate(mid))low=mid;else high=mid;}}
        // Spend safe bytes by increasing palette resolution. Mixing arbitrary
        // original pixels back in created the coloured outliers seen before.
        if(winner.png.size()<=limit&&winner.paletteColors>0&&winner.png.size()<limit*94/100){for(int add:{8,4,2,1}){const int c=qMin(256,winner.paletteColors+add);if(c>winner.paletteColors)evaluate(c);}}
        winner.tested=totalTested;return winner;
    };

    TextureResult best=runPalette();
    if(best.png.size()>limit)throw std::runtime_error("Заданный предел размера слишком мал для RGB24 PNG");

    best.original=source;best.tested=totalTested;
    if(!PngEncoder::verifyRgb24(best.png,best.output))throw std::runtime_error("RGB24-проверка не пройдена");
    measure(source,best.output,best.meanError,best.psnr,best.maxError);
    best.report=QString("%1 × %2 · RGB24 · %3\nАлгоритм: %4%5\n%6 MB · PSNR %7 dB · mean ΔRGB %8 · max %9\nПроверено вариантов: %10 · время: %11 с")
        .arg(source.width()).arg(source.height()).arg("ЛИМИТ ДОСТИГНУТ")
        .arg(best.algorithmName).arg(best.paletteColors?QString(" · %1 цветов").arg(best.paletteColors):QString())
        .arg(best.png.size()/1000000.0,0,'f',3).arg(std::isinf(best.psnr)?QString("∞"):QString::number(best.psnr,'f',1)).arg(best.meanError,0,'f',2).arg(best.maxError)
        .arg(best.tested).arg(timer.elapsed()/1000.0,0,'f',1);
    best.report+=QString("\nФинальная проверка: PNG color type 2 · bit depth 8 · запас %1 KB").arg(qMax<qint64>(0,limit-best.png.size())/1000.0,0,'f',1);
    progress(1.0,"Готово");return best;
}

TextureResult TextureProcessor::processAutomatic(const QString &path,const Progress &progress,const Cancel &cancel) {
    const qint64 inputBytes=QFileInfo(path).size();
    if(inputBytes<=0)throw std::runtime_error("Не удалось определить размер PNG");
    // Batch uses the proven NPM adaptive search, but keeps native dimensions
    // and derives its goal from the source itself instead of a fixed 3 MB cap.
    // The 1%/1 KB margin ensures the output is a real optimization; the full
    // 256→1 search guarantees a fitting RGB24 candidate exists.
    const qint64 savingMargin=qMax<qint64>(1024,inputBytes/100);
    const qint64 dynamicLimit=qMax<qint64>(1,inputBytes-savingMargin);
    QElapsedTimer timer;timer.start();
    const QString kind=detectKind(path);
    TextureResult best;
    try{
        best=kind=="COLOR"?process(path,dynamicLimit,progress,cancel,true):processSemantic(path,dynamicLimit,kind,progress,cancel);
    }catch(const std::exception &error){
        if(cancel&&cancel())throw;
        // A PNG that is already at its mathematical minimum must still be a
        // successful job. Keep native pixels and use our strongest lossless
        // RGB24 encoder instead of failing the whole queue.
        const QString message=QString::fromUtf8(error.what());
        if(!message.contains("слишком мал",Qt::CaseInsensitive)&&!message.contains("не смог уменьшить",Qt::CaseInsensitive))throw;
        best=kind=="COLOR"?process(path,std::numeric_limits<qint64>::max(),progress,cancel,true):processSemantic(path,std::numeric_limits<qint64>::max(),kind,progress,cancel);
    }
    best.textureKind=kind;
    if(kind=="COLOR")best.algorithmName="AGR Adaptive Native RGB24";
    const double saved=qMax(0.0,100.0-double(best.png.size())*100.0/inputBytes);
    if(kind!="COLOR"){best.report+=QString("\nЭкономия относительно исходника: %1%").arg(saved,0,'f',1);progress(1.0,"Готово · "+kind);return best;}
    best.report=QString("%1 × %2 · COLOR · АДАПТИВНАЯ ОПТИМИЗАЦИЯ\nАлгоритм: %3%4\n%5 MB · экономия %6% · PSNR %7 dB · mean ΔRGB %8 · max %9\nПроверено вариантов: %10 · время: %11 с")
        .arg(best.output.width()).arg(best.output.height()).arg(best.algorithmName)
        .arg(best.paletteColors?QString(" · %1 цветов").arg(best.paletteColors):QString())
        .arg(best.png.size()/1000000.0,0,'f',3).arg(saved,0,'f',1)
        .arg(std::isinf(best.psnr)?QString("∞"):QString::number(best.psnr,'f',1))
        .arg(best.meanError,0,'f',2).arg(best.maxError).arg(best.tested).arg(timer.elapsed()/1000.0,0,'f',1);
    progress(1.0,"Готово");return best;
}
