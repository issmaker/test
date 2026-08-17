#include "OptimizerEngine.h"
#include <QtConcurrent>
#include <QCryptographicHash>
#include <QCoreApplication>
#include <QColor>
#include <QDateTime>
#include <QDesktopServices>
#include <QDir>
#include <QFile>
#include <QFileDialog>
#include <QFileInfo>
#include <QImageReader>
#include <QException>
#include <QStandardPaths>
#include <QThread>
#include <QThreadPool>
#include <QUrl>
#include <algorithm>
#include <array>
#include <cmath>
#include <future>
#include <memory>
#include <stdexcept>

#ifdef Q_OS_WIN
#include <windows.h>
#include <psapi.h>
#endif

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
    QImageReader meta(path,"PNG");meta.setAutoTransform(true);const QSize native=meta.size();
    result.sourceWidth=native.width();result.sourceHeight=native.height();
    if(!native.isValid()){result.error="PNG не удалось прочитать";return result;}
    const int longest=qMax(native.width(),native.height());
    QSize target=native;
    if(longest>2048){const double scale=2048.0/longest;target=QSize(qMax(1,int(std::lround(native.width()*scale))),qMax(1,int(std::lround(native.height()*scale))));}
    QImageReader reader(path,"PNG");reader.setAutoTransform(true);
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

QString prepareComparisonPreview(const QString &path,const QString &cacheKey){
    QImageReader meta(path,"PNG");const QSize native=meta.size();
    if(!native.isValid()||qMax(native.width(),native.height())<=2048)return QUrl::fromLocalFile(path).toString();
    const double scale=2048.0/qMax(native.width(),native.height());
    const QSize target(qMax(1,int(std::lround(native.width()*scale))),qMax(1,int(std::lround(native.height()*scale))));
    QImageReader reader(path,"PNG");reader.setAutoTransform(true);reader.setScaledSize(target);
    const QImage preview=reader.read().convertToFormat(QImage::Format_RGB888);if(preview.isNull())return {};
    const QString directory=QStandardPaths::writableLocation(QStandardPaths::CacheLocation)+"/comparison-previews";
    QDir().mkpath(directory);const QString output=directory+"/"+cacheKey+".png";
    return preview.save(output,"PNG",1)?QUrl::fromLocalFile(output).toString():QString();
}

QString saveComparisonPreview(const QImage &image,const QString &cacheKey){
    if(image.isNull()||qMax(image.width(),image.height())<=2048)return {};
    const double scale=2048.0/qMax(image.width(),image.height());
    const QSize target(qMax(1,int(std::lround(image.width()*scale))),qMax(1,int(std::lround(image.height()*scale))));
    const QImage preview=image.scaled(target,Qt::KeepAspectRatio,Qt::SmoothTransformation).convertToFormat(QImage::Format_RGB888);
    const QString directory=QStandardPaths::writableLocation(QStandardPaths::CacheLocation)+"/comparison-previews";
    QDir().mkpath(directory);const QString output=directory+"/"+cacheKey+".png";
    return preview.save(output,"PNG",1)?QUrl::fromLocalFile(output).toString():QString();
}

QString browserTextureUrl(const QString &value){
    if(value.isEmpty())return {};
    const QUrl url(value);const QString path=url.isLocalFile()?url.toLocalFile():value;
    const QByteArray encoded=path.toUtf8().toBase64(QByteArray::Base64UrlEncoding|QByteArray::OmitTrailingEquals);
    return QStringLiteral("texture://local/")+QString::fromLatin1(encoded);
}
}

OptimizerEngine::OptimizerEngine(QObject *parent):QObject(parent) {
    setPerformanceMode(QStringLiteral("balanced"));
    m_systemClock.start();
    QTimer::singleShot(0,this,[this]{sampleSystemTelemetry();});
    m_telemetryTimer.setInterval(180);
    connect(&m_telemetryTimer,&QTimer::timeout,this,[this]{
        sampleSystemTelemetry();
        if(m_batchBusy){
            m_batchProgressHistory.append(m_batchProgress);
            m_batchActivityHistory.append(m_cpuLoad);
            while(m_batchProgressHistory.size()>72)m_batchProgressHistory.removeFirst();
            while(m_batchActivityHistory.size()>72)m_batchActivityHistory.removeFirst();
            emit batchTelemetryChanged();
        }else{
            appendTelemetry(m_progress,m_cpuLoad);
        }
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
        m_status=sourceIsLarge()?"Рабочий эталон 2K подготовлен из исходной 8K-текстуры":"Текстура готова к оптимизации";
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
            m_report=result.report+"\n\nСохранено: "+m_outputPath;m_status="Готово — AGR Adaptive RGB24 сохранён";
            emit resultUrlChanged();emit referenceUrlChanged();emit reportChanged();emit outputPathChanged();emit outputSizeChanged();emit statusChanged();
        }catch(const QException&error){m_status=m_cancelRequested.load()?"Остановлено пользователем":QString("Ошибка обработки: ")+QString::fromUtf8(error.what());emit statusChanged();}
        catch(const std::exception&error){m_status=m_cancelRequested.load()?"Остановлено пользователем":QString("Ошибка обработки: ")+QString::fromUtf8(error.what());emit statusChanged();}
        catch(...){m_status="Ошибка обработки: неизвестный сбой";emit statusChanged();}
        m_busy=false;if(!m_batchBusy)m_telemetryTimer.stop();sampleSystemTelemetry();emit busyChanged();
    });

    connect(&m_batchImportWatcher,&QFutureWatcher<BatchImportResult>::finished,this,[this]{
        const BatchImportResult run=m_batchImportWatcher.result();int ready=0,failed=0;
        for(const BatchImportItem &item:run.items){
            if(item.index<0||item.index>=m_batchEntries.size())continue;
            if(item.error.isEmpty()){m_batchEntries[item.index]=item.entry;++ready;}
            else{
                BatchEntry &entry=m_batchEntries[item.index];entry.importing=false;entry.failed=true;
                entry.status="Ошибка импорта: "+item.error;entry.report=entry.status;++failed;
            }
        }
        m_batchImportBusy=false;m_batchImportProgress=1;
        m_batchImportStatus=failed
            ?QString("Подготовлено %1 PNG · ошибок %2").arg(ready).arg(failed)
            :QString("Подготовлено %1 PNG").arg(ready);
        if(run.skipped)m_batchImportStatus+=QString(" · пропущено %1").arg(run.skipped);
        m_batchStatus=m_batchImportStatus;
        emit batchItemsChanged();emit batchImportBusyChanged();emit batchImportProgressChanged();
        emit batchImportStatusChanged();emit batchStatusChanged();
    });

    connect(&m_batchWatcher,&QFutureWatcher<BatchRunResult>::finished,this,[this]{
        const BatchRunResult run=m_batchWatcher.result();int succeeded=0,failed=0;
        for(const BatchRunItem &item:run.items){
            if(item.index<0||item.index>=m_batchEntries.size())continue;
            BatchEntry &entry=m_batchEntries[item.index];entry.progress=1;
            if(item.error.isEmpty()){
                entry.resultUrl=item.resultUrl;entry.comparisonResultUrl=item.comparisonResultUrl.isEmpty()?item.resultUrl:item.comparisonResultUrl;entry.outputPath=item.outputPath;
                entry.outputMb=item.outputMb;entry.report=item.report;
                entry.status="Готово";entry.done=true;entry.failed=false;++succeeded;
            }else if(run.cancelled&&item.error.contains("Остановлено",Qt::CaseInsensitive)){
                entry.status="Остановлено";entry.report="Операция остановлена пользователем";
                entry.done=false;entry.failed=false;entry.progress=0;
            }else{
                entry.status="Ошибка: "+item.error;entry.report=item.error;
                entry.done=false;entry.failed=true;++failed;
            }
        }
        if(run.cancelled){
            for(BatchEntry &entry:m_batchEntries)if(!entry.done&&!entry.failed){entry.status="Остановлено";entry.progress=0;}
        }
        m_batchBusy=false;m_batchProgress=run.cancelled?m_batchProgress:1;
        m_batchStatus=run.cancelled?QString("Остановлено пользователем · готово %1").arg(succeeded):(failed
            ?QString("Завершено: %1 готово, %2 с ошибкой").arg(succeeded).arg(failed)
            :QString("Готово: обработано %1 файлов").arg(succeeded));
        if(!m_busy)m_telemetryTimer.stop();sampleSystemTelemetry();
        emit batchItemsChanged();emit batchBusyChanged();emit batchProgressChanged();emit batchStatusChanged();
    });
}

QString OptimizerEngine::localPath()const{return QUrl(m_sourceUrl).toLocalFile();}

QVariantMap OptimizerEngine::snapshot() const {
    QVariantMap state;
    state["sourceUrl"]=browserTextureUrl(m_sourceUrl);state["resultUrl"]=browserTextureUrl(m_resultUrl);state["referenceUrl"]=browserTextureUrl(m_referenceUrl);
    state["workingPreviewUrl"]=browserTextureUrl(m_workingPreviewUrl);state["status"]=m_status;state["report"]=m_report;
    state["outputPath"]=m_outputPath;state["progress"]=m_progress;state["sourceFileMb"]=m_sourceFileMb;
    state["outputFileMb"]=m_outputFileMb;state["sourceWidth"]=m_sourceWidth;state["sourceHeight"]=m_sourceHeight;
    state["workingWidth"]=m_workingWidth;state["workingHeight"]=m_workingHeight;state["sourceIsLarge"]=sourceIsLarge();
    state["previewBusy"]=m_previewBusy;state["busy"]=m_busy;state["progressHistory"]=m_progressHistory;
    state["activityHistory"]=m_activityHistory;
    QVariantList webBatch=batchItems();for(QVariant &value:webBatch){QVariantMap item=value.toMap();
        for(const char *key:{"sourceUrl","resultUrl","comparisonSourceUrl","comparisonResultUrl"})item[key]=browserTextureUrl(item.value(key).toString());
        value=item;}state["batchItems"]=webBatch;state["batchBusy"]=m_batchBusy;
    state["batchProgress"]=m_batchProgress;state["batchStatus"]=m_batchStatus;
    state["batchImportBusy"]=m_batchImportBusy;state["batchImportProgress"]=m_batchImportProgress;
    state["batchImportStatus"]=m_batchImportStatus;state["batchWorkers"]=m_batchWorkers;
    state["batchProgressHistory"]=m_batchProgressHistory;state["batchActivityHistory"]=m_batchActivityHistory;
    state["cpuLoad"]=m_cpuLoad;state["memoryMb"]=m_memoryMb;state["processingRate"]=m_processingRate;
    state["performanceMode"]=m_performanceMode;state["hardwareThreads"]=m_workerLimit;
    return state;
}

void OptimizerEngine::chooseNpmFile() {
    if(m_busy)return;
    const QString path=QFileDialog::getOpenFileName(nullptr,QStringLiteral("Выберите НПМ PNG-текстуру"),{},QStringLiteral("PNG textures (*.png)"));
    if(!path.isEmpty())load(QUrl::fromLocalFile(path).toString());
}

void OptimizerEngine::chooseBatchFiles() {
    if(m_batchBusy||m_batchImportBusy)return;
    const QStringList paths=QFileDialog::getOpenFileNames(nullptr,QStringLiteral("Добавьте PNG-текстуры"),{},QStringLiteral("PNG textures (*.png)"));
    QVariantList urls;urls.reserve(paths.size());for(const QString &path:paths)urls.append(QUrl::fromLocalFile(path).toString());
    if(!urls.isEmpty())addBatchFiles(urls);
}

void OptimizerEngine::quitApp(){QCoreApplication::quit();}
void OptimizerEngine::toggleFullscreen(){emit fullscreenRequested();}

void OptimizerEngine::setPerformanceMode(const QString &value){
    const QString mode=(value=="eco"||value=="max")?value:QStringLiteral("balanced");
    const int cores=qMax(1,QThread::idealThreadCount());
    const int limit=mode=="eco"?qMax(1,cores/4):(mode=="max"?cores:qMax(1,cores-1));
    const bool changed=m_performanceMode!=mode||m_workerLimit!=limit;
    m_performanceMode=mode;m_workerLimit=limit;
    QThreadPool::globalInstance()->setMaxThreadCount(limit);
    if(changed)emit performanceModeChanged();
}

void OptimizerEngine::appendTelemetry(double progressValue,double activityValue){
    m_progressHistory.append(qBound(0.0,progressValue,1.0));m_activityHistory.append(qBound(0.0,activityValue,1.0));
    while(m_progressHistory.size()>72)m_progressHistory.removeFirst();while(m_activityHistory.size()>72)m_activityHistory.removeFirst();emit telemetryChanged();
}

void OptimizerEngine::sampleSystemTelemetry(){
    const qint64 now=m_systemClock.elapsed();
    const qint64 elapsed=qMax<qint64>(1,now-m_lastSystemSample);
    const double progressValue=m_batchBusy?m_batchProgress:m_progress;
    const double instantRate=(m_busy||m_batchBusy)
        ?qMax(0.0,progressValue-m_lastTelemetryProgress)*100000.0/elapsed
        :0.0;
    m_processingRate=m_processingRate*.72+instantRate*.28;
    m_lastTelemetryProgress=progressValue;m_lastSystemSample=now;
#ifdef Q_OS_WIN
    FILETIME creation{},exit{},kernel{},user{};
    if(GetProcessTimes(GetCurrentProcess(),&creation,&exit,&kernel,&user)){
        ULARGE_INTEGER k{},u{};k.LowPart=kernel.dwLowDateTime;k.HighPart=kernel.dwHighDateTime;
        u.LowPart=user.dwLowDateTime;u.HighPart=user.dwHighDateTime;
        const quint64 ticks=k.QuadPart+u.QuadPart;
        if(m_lastProcessTicks){
            const double cpuMs=double(ticks-m_lastProcessTicks)/10000.0;
            m_cpuLoad=qBound(0.0,cpuMs/(elapsed*qMax(1,QThread::idealThreadCount())),1.0);
        }
        m_lastProcessTicks=ticks;
    }
    PROCESS_MEMORY_COUNTERS_EX memory{};memory.cb=sizeof(memory);
    if(GetProcessMemoryInfo(GetCurrentProcess(),reinterpret_cast<PROCESS_MEMORY_COUNTERS*>(&memory),sizeof(memory)))
        m_memoryMb=double(memory.WorkingSetSize)/(1024.0*1024.0);
#else
    m_cpuLoad=(m_busy||m_batchBusy)?qBound(0.0,m_cpuLoad*.82+.12,1.0):m_cpuLoad*.72;
#endif
    emit systemTelemetryChanged();
}

void OptimizerEngine::load(const QString &value){
    if(m_busy)return;const QUrl url(value);const QString candidate=url.isLocalFile()?url.toLocalFile():value;
    const QFileInfo candidateInfo(candidate);
    if(!candidateInfo.exists()||candidateInfo.suffix().compare("png",Qt::CaseInsensitive)!=0){
        m_status="Ошибка: выберите существующий PNG-файл";emit statusChanged();return;
    }
    m_sourceUrl=QUrl::fromLocalFile(candidate).toString();
    const QString path=localPath();const QFileInfo info(path);QImageReader meta(path,"PNG");const QSize size=meta.size();
    if(!size.isValid()){
        m_sourceUrl.clear();m_status="Ошибка: PNG повреждён или не поддерживается";
        emit sourceUrlChanged();emit statusChanged();return;
    }
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

void OptimizerEngine::optimize(double maxMb){
    if(m_sourceUrl.isEmpty()||m_busy||m_previewBusy)return;m_cancelRequested=false;m_busy=true;m_progress=0;m_progressHistory={0.0};m_activityHistory={0.0};m_telemetryPhase=0;m_lastTelemetryProgress=0;
    const double requestedMb=qBound(.5,maxMb,20.0);
    const qint64 requestedBytes=qint64(std::llround(requestedMb*1000000.0));
    m_status=QString("Запуск с пределом %1 MB…").arg(requestedMb,0,'f',1);
    emit busyChanged();emit progressChanged();emit telemetryChanged();emit statusChanged();m_telemetryTimer.start();const QString path=localPath();
    m_watcher.setFuture(QtConcurrent::run([this,path,requestedBytes]{return TextureProcessor::process(path,requestedBytes,[this](double value,const QString&text){setProgress(value,text);},[this]{return m_cancelRequested.load();});}));
}

void OptimizerEngine::toggleMasterView(){if(!sourceIsLarge())return;m_showingMaster=!m_showingMaster;emit showingMasterChanged();}
void OptimizerEngine::openSourceFolder(){const QFileInfo file(localPath());if(file.exists())QDesktopServices::openUrl(QUrl::fromLocalFile(file.absolutePath()));}
void OptimizerEngine::openOutputFolder(){if(!m_outputPath.isEmpty())QDesktopServices::openUrl(QUrl::fromLocalFile(QFileInfo(m_outputPath).absolutePath()));}

QVariantList OptimizerEngine::batchItems()const{
    QVariantList result;result.reserve(m_batchEntries.size());
    for(const BatchEntry &entry:m_batchEntries){
        QVariantMap item;
        item["sourceUrl"]=entry.sourceUrl;item["resultUrl"]=entry.resultUrl;
        item["comparisonSourceUrl"]=entry.comparisonSourceUrl;item["comparisonResultUrl"]=entry.comparisonResultUrl;
        item["outputPath"]=entry.outputPath;item["name"]=entry.name;
        item["status"]=entry.status;item["report"]=entry.report;item["accent"]=entry.accent;
        item["sourceMb"]=entry.sourceMb;item["outputMb"]=entry.outputMb;
        item["progress"]=entry.progress;item["width"]=entry.width;item["height"]=entry.height;
        item["done"]=entry.done;item["failed"]=entry.failed;item["importing"]=entry.importing;result.append(item);
    }
    return result;
}

void OptimizerEngine::addBatchFiles(const QVariantList &values){
    if(m_batchBusy||m_batchImportBusy)return;int added=0,skipped=0;
    QVector<QPair<int,QString>> jobs;jobs.reserve(values.size());
    for(const QVariant &value:values){
        const QUrl url(value.toString());const QString path=url.isLocalFile()?url.toLocalFile():value.toString();
        const QFileInfo info(path);if(!info.exists()||info.suffix().compare("png",Qt::CaseInsensitive)!=0){++skipped;continue;}
        const QString canonical=info.canonicalFilePath();bool duplicate=false;
        for(const BatchEntry &existing:m_batchEntries)if(QFileInfo(QUrl(existing.sourceUrl).toLocalFile()).canonicalFilePath()==canonical){duplicate=true;break;}
        if(duplicate){++skipped;continue;}
        BatchEntry placeholder;placeholder.sourceUrl=QUrl::fromLocalFile(path).toString();placeholder.name=info.fileName();
        placeholder.status="Подготовка превью…";placeholder.sourceMb=info.size()/1000000.0;placeholder.importing=true;
        const int index=m_batchEntries.size();m_batchEntries.append(placeholder);jobs.append({index,path});++added;
    }
    if(!added){m_batchStatus=QString("Новых PNG нет%1").arg(skipped?QString(" — пропущено %1").arg(skipped):QString());emit batchStatusChanged();return;}
    m_batchImportBusy=true;m_batchImportProgress=0;
    const int generation=++m_batchImportGeneration;
    m_batchImportStatus=QString("Подготовка 0 из %1 PNG").arg(added);m_batchStatus=m_batchImportStatus;
    emit batchItemsChanged();emit batchImportBusyChanged();emit batchImportProgressChanged();emit batchImportStatusChanged();emit batchStatusChanged();
    m_batchImportWatcher.setFuture(QtConcurrent::run([this,jobs,skipped,generation]{
        BatchImportResult run;run.skipped=skipped;run.items.reserve(jobs.size());const int total=jobs.size();
        for(int position=0;position<total;++position){
            const int index=jobs[position].first;const QString path=jobs[position].second;const QFileInfo info(path);
            BatchImportItem prepared;prepared.index=index;BatchEntry entry;entry.sourceUrl=QUrl::fromLocalFile(path).toString();entry.name=info.fileName();entry.sourceMb=info.size()/1000000.0;
            QImageReader meta(path,"PNG");meta.setAutoTransform(true);const QSize dimensions=meta.size();
            if(!dimensions.isValid())prepared.error="PNG повреждён или не поддерживается";
            else{
                entry.width=dimensions.width();entry.height=dimensions.height();entry.status="Готов к обработке";
                QImageReader accentReader(path,"PNG");accentReader.setAutoTransform(true);
                const double scale=qMin(1.0,144.0/qMax(dimensions.width(),dimensions.height()));
                accentReader.setScaledSize(QSize(qMax(1,int(dimensions.width()*scale)),qMax(1,int(dimensions.height()*scale))));
                const QImage accentImage=accentReader.read();
                const QString canonical=info.canonicalFilePath();
                const QByteArray previewKey=QCryptographicHash::hash((canonical+QString::number(info.lastModified().toMSecsSinceEpoch())+"_source").toUtf8(),QCryptographicHash::Sha1).toHex();
                entry.comparisonSourceUrl=prepareComparisonPreview(path,QString::fromLatin1(previewKey));
                if(entry.comparisonSourceUrl.isEmpty())entry.comparisonSourceUrl=entry.sourceUrl;
                if(!accentImage.isNull())entry.accent=analyseAccent(accentImage);prepared.entry=entry;
            }
            run.items.append(prepared);
            QMetaObject::invokeMethod(this,[this,index,position,total,prepared,generation]{
                if(generation!=m_batchImportGeneration||!m_batchImportBusy)return;
                const QString name=(index>=0&&index<m_batchEntries.size())?m_batchEntries[index].name:QStringLiteral("PNG");
                if(index>=0&&index<m_batchEntries.size())m_batchEntries[index].status=prepared.error.isEmpty()?"Превью готово":"Ошибка импорта";
                m_batchImportProgress=double(position+1)/qMax(1,total);
                m_batchImportStatus=QString("Подготовка %1 из %2 PNG · %3").arg(position+1).arg(total).arg(prepared.entry.name.isEmpty()?name:prepared.entry.name);
                m_batchStatus=m_batchImportStatus;emit batchItemsChanged();emit batchImportProgressChanged();emit batchImportStatusChanged();emit batchStatusChanged();
            },Qt::QueuedConnection);
        }
        return run;
    }));
}

void OptimizerEngine::clearBatch(){
    if(m_batchBusy||m_batchImportBusy)return;m_batchEntries.clear();m_batchProgress=0;m_batchStatus="Добавьте PNG-файлы";m_batchProgressHistory.clear();m_batchActivityHistory.clear();
    emit batchItemsChanged();emit batchProgressChanged();emit batchStatusChanged();emit batchTelemetryChanged();
}

void OptimizerEngine::removeBatchItem(int index){
    if(m_batchBusy||m_batchImportBusy||index<0||index>=m_batchEntries.size())return;
    m_batchEntries.removeAt(index);m_batchProgress=0;
    m_batchStatus=m_batchEntries.isEmpty()?"Добавьте PNG-файлы":QString("В очереди %1 PNG").arg(m_batchEntries.size());
    emit batchItemsChanged();emit batchProgressChanged();emit batchStatusChanged();
}

void OptimizerEngine::optimizeBatch(){
    if(m_batchBusy||m_batchImportBusy||m_batchEntries.isEmpty())return;
    QVector<QPair<int,QString>> jobs;jobs.reserve(m_batchEntries.size());
    for(int index=0;index<m_batchEntries.size();++index){
        BatchEntry &entry=m_batchEntries[index];if(entry.done||entry.failed||entry.importing)continue;
        jobs.append({index,QUrl(entry.sourceUrl).toLocalFile()});entry.progress=0;entry.done=false;entry.failed=false;
        entry.resultUrl.clear();entry.comparisonResultUrl.clear();entry.outputPath.clear();entry.outputMb=0;entry.report.clear();entry.status="В очереди";
    }
    if(jobs.isEmpty()){m_batchStatus="Нет готовых PNG для обработки";emit batchStatusChanged();return;}
    const int logicalCores=qMax(1,QThread::idealThreadCount());
    bool contains8K=false;
    for(const auto &job:jobs){const BatchEntry &entry=m_batchEntries[job.first];
        if(qMax(entry.width,entry.height)>4096||qint64(entry.width)*qint64(entry.height)>24000000){contains8K=true;break;}
    }
    qint64 availableBytes=4ll*1024*1024*1024;
#ifdef Q_OS_WIN
    MEMORYSTATUSEX memory{};memory.dwLength=sizeof(memory);
    if(GlobalMemoryStatusEx(&memory))availableBytes=qint64(memory.ullAvailPhys);
#endif
    qint64 largestPixels=1;
    for(const auto &job:jobs){const BatchEntry &entry=m_batchEntries[job.first];largestPixels=qMax(largestPixels,qint64(entry.width)*entry.height);}
    // Source, candidate, encoder rows and comparison metrics coexist. Keep a
    // conservative per-job budget and reserve 35% of free RAM for Windows,
    // Chromium/WebGL and responsive navigation.
    const qint64 bytesPerJob=qMax<qint64>(320ll*1024*1024,largestPixels*18);
    const int memorySafe=qMax(1,int((availableBytes*65/100)/bytesPerJob));
    const int responsiveCpu=qMax(1,logicalCores-1);
    const int requested=m_performanceMode=="eco"?1:(m_performanceMode=="max"?responsiveCpu:qMax(1,logicalCores/2));
    // windows.h defines a min macro, so call std::min through parentheses.
    const int safeWorkers=(std::min)(requested,(std::min)(memorySafe,int(jobs.size())));
    m_batchWorkers=qBound(1,safeWorkers,int(jobs.size()));
    const int generation=++m_batchGeneration;
    m_batchCancelRequested=false;m_batchBusy=true;m_batchProgress=0;
    m_batchStatus=QString("Умная нагрузка · %1 потоков · %2 PNG%3").arg(m_batchWorkers).arg(jobs.size()).arg(contains8K?QStringLiteral(" · 8K RAM GUARD"):QString());
    m_batchProgressHistory={0.0};m_batchActivityHistory={0.0};m_lastTelemetryProgress=0;m_telemetryTimer.start();
    emit batchItemsChanged();emit batchBusyChanged();emit batchProgressChanged();emit batchStatusChanged();emit batchTelemetryChanged();emit batchWorkersChanged();
    const auto activeIndexes=std::make_shared<QVector<int>>();activeIndexes->reserve(jobs.size());
    for(const auto &job:jobs)activeIndexes->append(job.first);
    m_batchWatcher.setFuture(QtConcurrent::run([this,jobs,activeIndexes,workers=m_batchWorkers,generation]{
        BatchRunResult run;const int total=jobs.size();run.items.reserve(total);std::atomic_int next{0};
        const auto worker=[this,&jobs,&next,total,generation,activeIndexes]{
            QVector<BatchRunItem> completed;
            while(true){
                const int job=next.fetch_add(1);if(job>=total||m_batchCancelRequested.load())break;
                const int index=jobs[job].first;const QString path=jobs[job].second;BatchRunItem summary;summary.index=index;
            try{
                const TextureResult result=TextureProcessor::processAutomatic(path,[this,index,total,generation,activeIndexes](double value,const QString &text){
                    QMetaObject::invokeMethod(this,[this,index,total,value,text,generation,activeIndexes]{
                        if(generation!=m_batchGeneration||!m_batchBusy)return;
                        if(index>=0&&index<m_batchEntries.size()){
                            m_batchEntries[index].progress=value;m_batchEntries[index].status=text;
                            double aggregate=0;for(const int activeIndex:*activeIndexes)if(activeIndex>=0&&activeIndex<m_batchEntries.size())aggregate+=m_batchEntries[activeIndex].progress;
                            m_batchProgress=qBound(0.0,aggregate/qMax(1,total),1.0);
                            m_batchStatus=QString("%1 потока · %2 · %3").arg(m_batchWorkers).arg(m_batchEntries[index].name).arg(text);
                            emit batchItemsChanged();emit batchProgressChanged();emit batchStatusChanged();emit batchTelemetryChanged();
                        }
                    },Qt::QueuedConnection);
                },[this]{return m_batchCancelRequested.load();});
                const QFileInfo source(path);QDir outputDir(source.absolutePath()+"/compressed");
                if(!outputDir.exists()&&!QDir().mkpath(outputDir.absolutePath()))throw std::runtime_error("Не удалось создать папку compressed");
                const QString out=outputDir.filePath(source.completeBaseName()+"_AGR_AUTO_RGB24.png");QFile file(out);
                if(!file.open(QIODevice::WriteOnly|QIODevice::Truncate)||file.write(result.png)!=result.png.size())throw std::runtime_error("Не удалось записать результат");
                file.close();summary.resultUrl=QUrl::fromLocalFile(out).toString();summary.outputPath=QDir::toNativeSeparators(out);
                const QByteArray previewKey=QCryptographicHash::hash((path+QString::number(source.lastModified().toMSecsSinceEpoch())+"_result").toUtf8(),QCryptographicHash::Sha1).toHex();
                summary.comparisonResultUrl=saveComparisonPreview(result.output,QString::fromLatin1(previewKey));
                if(summary.comparisonResultUrl.isEmpty())summary.comparisonResultUrl=summary.resultUrl;
                summary.outputMb=result.png.size()/1000000.0;summary.report=result.report;
            }catch(const std::exception &error){summary.error=QString::fromUtf8(error.what());}
            catch(...){summary.error="Неизвестный сбой обработки";}
                completed.append(summary);if(m_batchCancelRequested.load())break;
            }
            return completed;
        };
        std::vector<std::future<QVector<BatchRunItem>>> futures;futures.reserve(size_t(workers));
        for(int i=0;i<workers;++i)futures.emplace_back(std::async(std::launch::async,worker));
        for(auto &future:futures){const QVector<BatchRunItem> completed=future.get();for(const BatchRunItem &item:completed)run.items.append(item);}
        run.cancelled=m_batchCancelRequested.load();
        return run;
    }));
}

void OptimizerEngine::stopCurrent(){
    if(!m_busy)return;m_cancelRequested=true;m_status="Остановка после текущего безопасного шага…";emit statusChanged();
}

void OptimizerEngine::stopBatch(){
    if(!m_batchBusy)return;m_batchCancelRequested=true;m_batchStatus="Остановка после текущего безопасного шага…";emit batchStatusChanged();
}

void OptimizerEngine::openBatchOutput(int index){
    if(index<0||index>=m_batchEntries.size()||m_batchEntries[index].outputPath.isEmpty())return;
    QDesktopServices::openUrl(QUrl::fromLocalFile(QFileInfo(m_batchEntries[index].outputPath).absolutePath()));
}
