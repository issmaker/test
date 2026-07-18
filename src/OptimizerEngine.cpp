#include "OptimizerEngine.h"
#include <QtConcurrent>
#include <QCryptographicHash>
#include <QColor>
#include <QDateTime>
#include <QDesktopServices>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QImageReader>
#include <QStandardPaths>
#include <QUrl>
#include <array>
#include <cmath>
#include <stdexcept>

namespace {
QString analyseAccent(const QImage &input) {
    const QImage image=input.scaled(144,144,Qt::KeepAspectRatio,Qt::SmoothTransformation).convertToFormat(QImage::Format_RGB888);
    struct Bin{quint64 r=0,g=0,b=0,weight=0,count=0;};
    std::array<Bin,4096> bins{};
    for(int y=0;y<image.height();++y){
        const uchar*p=image.constScanLine(y);
        for(int x=0;x<image.width();++x){
            const int r=p[x*3],g=p[x*3+1],b=p[x*3+2];
            const int hi=qMax(r,qMax(g,b)),lo=qMin(r,qMin(g,b)),range=hi-lo;
            const int luma=(54*r+183*g+19*b)>>8;
            if(luma<35||luma>224||range<22)continue; // no black, white or grey neighbours
            const int key=(r>>4)*256+(g>>4)*16+(b>>4);
            const quint64 weight=quint64(32+range)*quint64(32+range);
            auto&bin=bins[size_t(key)];bin.r+=quint64(r)*weight;bin.g+=quint64(g)*weight;bin.b+=quint64(b)*weight;bin.weight+=weight;++bin.count;
        }
    }
    const Bin*best=nullptr;quint64 bestScore=0;
    for(const auto&bin:bins){const quint64 score=bin.count*bin.weight;if(score>bestScore){bestScore=score;best=&bin;}}
    if(!best||!best->weight)return "#ff641f";
    QColor colour(int(best->r/best->weight),int(best->g/best->weight),int(best->b/best->weight));
    // The texture controls only the hue of the UI.  Saturation and lightness
    // are kept inside a safe range so a pale facade, snow or sand can never
    // turn buttons white and destroy text contrast.
    float hue=0.0f,saturation=0.0f,lightness=0.0f,alpha=1.0f;
    colour.getHslF(&hue,&saturation,&lightness,&alpha);
    if(hue<0.0f)return "#ff641f";
    saturation=qBound(0.50f,saturation,0.86f);
    lightness=qBound(0.40f,lightness,0.58f);
    colour.setHslF(hue,saturation,lightness,1.0f);
    return colour.name(QColor::HexRgb);
}

SourcePreview preparePreview(const QString &path,int generation,const QString &cachePath) {
    SourcePreview result;result.generation=generation;
    QImageReader meta(path);meta.setAutoTransform(true);const QSize native=meta.size();
    result.sourceWidth=native.width();result.sourceHeight=native.height();
    if(!native.isValid()){result.error="PNG не удалось прочитать";return result;}
    const int longest=qMax(native.width(),native.height());
    QSize target=native;
    if(longest>2048){const double scale=2048.0/longest;target=QSize(qMax(1,int(std::lround(native.width()*scale))),qMax(1,int(std::lround(native.height()*scale))));}
    QImageReader reader(path);reader.setAutoTransform(true);
    if(target!=native)reader.setScaledSize(target);
    QImage working=reader.read().convertToFormat(QImage::Format_RGB888);
    if(working.isNull()){result.error="PNG не удалось декодировать";return result;}
    if(working.size()!=target)working=working.scaled(target,Qt::IgnoreAspectRatio,Qt::SmoothTransformation).convertToFormat(QImage::Format_RGB888);
    result.workingWidth=working.width();result.workingHeight=working.height();result.accent=analyseAccent(working);
    if(longest>2048){
        QDir().mkpath(QFileInfo(cachePath).absolutePath());
        if(working.save(cachePath,"PNG",1))result.previewPath=cachePath;
    }
    return result;
}
}

OptimizerEngine::OptimizerEngine(QObject *parent):QObject(parent) {
    m_telemetryTimer.setInterval(95);
    connect(&m_telemetryTimer,&QTimer::timeout,this,[this]{
        m_telemetryPhase+=.37;
        const double pulse=.54+.30*std::sin(m_telemetryPhase)+.14*std::sin(m_telemetryPhase*2.73+.8);
        const double visual=qBound(0.0,m_progress-.025+.025*std::sin(m_telemetryPhase*.71),1.0);
        appendTelemetry(visual,qBound(0.04,pulse,1.0));
    });

    connect(&m_previewWatcher,&QFutureWatcher<SourcePreview>::finished,this,[this]{
        const SourcePreview preview=m_previewWatcher.result();
        if(preview.generation!=m_previewGeneration)return;
        m_previewBusy=false;emit previewBusyChanged();
        if(!preview.error.isEmpty()){m_status="Ошибка: "+preview.error;emit statusChanged();return;}
        m_sourceWidth=preview.sourceWidth;m_sourceHeight=preview.sourceHeight;
        m_workingWidth=preview.workingWidth;m_workingHeight=preview.workingHeight;
        if(!preview.previewPath.isEmpty())m_workingPreviewUrl=QUrl::fromLocalFile(preview.previewPath).toString();
        m_accentColor=preview.accent;
        m_status=sourceIsLarge()?"Рабочий эталон 2K подготовлен · мастер 8K доступен отдельно":"Текстура готова к оптимизации";
        emit sourceInfoChanged();emit previewChanged();emit accentColorChanged();emit statusChanged();
    });

    connect(&m_watcher,&QFutureWatcher<TextureResult>::finished,this,[this]{
        try{
            const auto result=m_watcher.result();const QFileInfo source(localPath());QDir dir(source.absolutePath());
            if(!dir.mkpath("original")||!dir.mkpath("compressed"))throw std::runtime_error("Не удалось создать папки original/compressed");
            const QString original=dir.filePath("original/"+source.fileName());
            if(QFile::exists(original))QFile::remove(original);
            if(!QFile::copy(source.absoluteFilePath(),original))throw std::runtime_error("Не удалось сохранить копию в original");
            const QString reference=dir.filePath("original/"+source.completeBaseName()+"_2K_REFERENCE.png");
            if(!result.original.save(reference,"PNG",100))throw std::runtime_error("Не удалось сохранить рабочий 2K-эталон");
            const QString out=dir.filePath("compressed/"+source.completeBaseName()+"_AGR_RGB24.png");
            QFile file(out);
            if(!file.open(QIODevice::WriteOnly|QIODevice::Truncate)||file.write(result.png)!=result.png.size())throw std::runtime_error("Не удалось записать оптимизированный PNG");
            file.close();m_outputPath=QDir::toNativeSeparators(out);m_outputFileMb=result.png.size()/1000000.0;
            m_referenceUrl=QUrl::fromLocalFile(reference).toString();m_resultUrl=QUrl::fromLocalFile(out).toString();
            m_report=result.report+"\n\nСохранено: "+m_outputPath;m_status="Готово — Median RGB сохранён";
            emit resultUrlChanged();emit referenceUrlChanged();emit reportChanged();emit outputPathChanged();emit outputSizeChanged();emit statusChanged();
        }catch(const std::exception&error){m_status=QString("Ошибка: ")+error.what();emit statusChanged();}
        m_telemetryTimer.stop();m_busy=false;emit busyChanged();
    });
}

QString OptimizerEngine::localPath()const{return QUrl(m_sourceUrl).toLocalFile();}

void OptimizerEngine::appendTelemetry(double progressValue,double activityValue){
    m_progressHistory.append(qBound(0.0,progressValue,1.0));m_activityHistory.append(qBound(0.0,activityValue,1.0));
    while(m_progressHistory.size()>72)m_progressHistory.removeFirst();while(m_activityHistory.size()>72)m_activityHistory.removeFirst();emit telemetryChanged();
}

void OptimizerEngine::load(const QString &value){
    if(m_busy)return;const QUrl url(value);m_sourceUrl=url.isLocalFile()?url.toString():QUrl::fromLocalFile(value).toString();
    const QString path=localPath();const QFileInfo info(path);QImageReader meta(path);const QSize size=meta.size();
    m_sourceWidth=size.width();m_sourceHeight=size.height();m_workingWidth=qMin(2048,qMax(0,size.width()));m_workingHeight=qMin(2048,qMax(0,size.height()));
    if(size.isValid()&&qMax(size.width(),size.height())>2048){const double scale=2048.0/qMax(size.width(),size.height());m_workingWidth=qMax(1,int(std::lround(size.width()*scale)));m_workingHeight=qMax(1,int(std::lround(size.height()*scale)));}
    m_sourceFileMb=info.size()/1000000.0;m_outputFileMb=0;m_resultUrl={};m_referenceUrl={};m_workingPreviewUrl={};m_outputPath={};m_report={};m_showingMaster=false;
    m_accentColor="#ff641f";m_status="Подготовка рабочего 2K и цветового акцента…";m_previewBusy=true;++m_previewGeneration;
    emit sourceUrlChanged();emit resultUrlChanged();emit referenceUrlChanged();emit previewChanged();emit outputPathChanged();emit outputSizeChanged();emit reportChanged();emit showingMasterChanged();emit accentColorChanged();emit sourceInfoChanged();emit previewBusyChanged();emit statusChanged();
    const QByteArray key=QCryptographicHash::hash((path+QString::number(info.lastModified().toMSecsSinceEpoch())).toUtf8(),QCryptographicHash::Sha1).toHex();
    const QString cache=QStandardPaths::writableLocation(QStandardPaths::CacheLocation)+"/previews/"+QString::fromLatin1(key)+"_2K.png";
    const int generation=m_previewGeneration;m_previewWatcher.setFuture(QtConcurrent::run([path,generation,cache]{return preparePreview(path,generation,cache);}));
}

void OptimizerEngine::setProgress(double value,const QString &text){
    QMetaObject::invokeMethod(this,[=]{m_progress=value;m_status=text;emit progressChanged();emit statusChanged();},Qt::QueuedConnection);
}

void OptimizerEngine::optimize(double maxMb,int){
    if(m_sourceUrl.isEmpty()||m_busy||m_previewBusy)return;m_busy=true;m_progress=0;m_progressHistory={0.0};m_activityHistory={.18};m_telemetryPhase=0;
    emit busyChanged();emit progressChanged();emit telemetryChanged();m_telemetryTimer.start();const QString path=localPath();
    m_watcher.setFuture(QtConcurrent::run([this,path,maxMb]{return TextureProcessor::process(path,qint64(maxMb*1000000.0),1,[this](double value,const QString&text){setProgress(value,text);});}));
}

void OptimizerEngine::toggleMasterView(){if(!sourceIsLarge())return;m_showingMaster=!m_showingMaster;emit showingMasterChanged();}
void OptimizerEngine::openSourceFolder(){const QFileInfo file(localPath());if(file.exists())QDesktopServices::openUrl(QUrl::fromLocalFile(file.absolutePath()));}
void OptimizerEngine::openOutputFolder(){if(!m_outputPath.isEmpty())QDesktopServices::openUrl(QUrl::fromLocalFile(QFileInfo(m_outputPath).absolutePath()));}
