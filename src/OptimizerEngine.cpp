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
#include <QException>
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
        m_telemetryTimer.stop();m_busy=false;emit busyChanged();
    });

    connect(&m_batchWatcher,&QFutureWatcher<BatchRunResult>::finished,this,[this]{
        const BatchRunResult run=m_batchWatcher.result();int succeeded=0,failed=0;
        for(const BatchRunItem &item:run.items){
            if(item.index<0||item.index>=m_batchEntries.size())continue;
            BatchEntry &entry=m_batchEntries[item.index];entry.progress=1;
            if(item.error.isEmpty()){
                entry.resultUrl=item.resultUrl;entry.outputPath=item.outputPath;
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
        emit batchItemsChanged();emit batchBusyChanged();emit batchProgressChanged();emit batchStatusChanged();
    });
}

QString OptimizerEngine::localPath()const{return QUrl(m_sourceUrl).toLocalFile();}

void OptimizerEngine::appendTelemetry(double progressValue,double activityValue){
    m_progressHistory.append(qBound(0.0,progressValue,1.0));m_activityHistory.append(qBound(0.0,activityValue,1.0));
    while(m_progressHistory.size()>72)m_progressHistory.removeFirst();while(m_activityHistory.size()>72)m_activityHistory.removeFirst();emit telemetryChanged();
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
    if(m_sourceUrl.isEmpty()||m_busy||m_previewBusy)return;m_cancelRequested=false;m_busy=true;m_progress=0;m_progressHistory={0.0};m_activityHistory={.18};m_telemetryPhase=0;
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
        item["outputPath"]=entry.outputPath;item["name"]=entry.name;
        item["status"]=entry.status;item["report"]=entry.report;item["accent"]=entry.accent;
        item["sourceMb"]=entry.sourceMb;item["outputMb"]=entry.outputMb;
        item["progress"]=entry.progress;item["width"]=entry.width;item["height"]=entry.height;
        item["done"]=entry.done;item["failed"]=entry.failed;result.append(item);
    }
    return result;
}

void OptimizerEngine::addBatchFiles(const QVariantList &values){
    if(m_batchBusy)return;int added=0,skipped=0;
    for(const QVariant &value:values){
        const QUrl url(value.toString());const QString path=url.isLocalFile()?url.toLocalFile():value.toString();
        const QFileInfo info(path);if(!info.exists()||info.suffix().compare("png",Qt::CaseInsensitive)!=0){++skipped;continue;}
        const QString canonical=info.canonicalFilePath();bool duplicate=false;
        for(const BatchEntry &existing:m_batchEntries)if(QFileInfo(QUrl(existing.sourceUrl).toLocalFile()).canonicalFilePath()==canonical){duplicate=true;break;}
        if(duplicate){++skipped;continue;}
        QImageReader meta(path,"PNG");const QSize dimensions=meta.size();
        if(!dimensions.isValid()){++skipped;continue;}
        QImageReader accentReader(path,"PNG");accentReader.setAutoTransform(true);
        const double scale=qMin(1.0,144.0/qMax(dimensions.width(),dimensions.height()));
        accentReader.setScaledSize(QSize(qMax(1,int(dimensions.width()*scale)),qMax(1,int(dimensions.height()*scale))));
        const QImage accentImage=accentReader.read();
        BatchEntry entry;entry.sourceUrl=QUrl::fromLocalFile(path).toString();entry.name=info.fileName();
        entry.status="Готов к обработке";entry.sourceMb=info.size()/1000000.0;
        entry.width=dimensions.width();entry.height=dimensions.height();
        if(!accentImage.isNull())entry.accent=analyseAccent(accentImage);m_batchEntries.append(entry);++added;
    }
    m_batchStatus=added?QString("Добавлено %1 файлов%2").arg(added).arg(skipped?QString(", пропущено %1").arg(skipped):QString())
                       :QString("Новых корректных PNG нет%1").arg(skipped?QString(" — пропущено %1").arg(skipped):QString());
    emit batchItemsChanged();emit batchStatusChanged();
}

void OptimizerEngine::clearBatch(){
    if(m_batchBusy)return;m_batchEntries.clear();m_batchProgress=0;m_batchStatus="Добавьте PNG-файлы";m_batchProgressHistory.clear();m_batchActivityHistory.clear();
    emit batchItemsChanged();emit batchProgressChanged();emit batchStatusChanged();emit batchTelemetryChanged();
}

void OptimizerEngine::optimizeBatch(){
    if(m_batchBusy||m_batchEntries.isEmpty())return;
    QVector<QString> paths;paths.reserve(m_batchEntries.size());
    for(BatchEntry &entry:m_batchEntries){
        paths.append(QUrl(entry.sourceUrl).toLocalFile());entry.progress=0;entry.done=false;entry.failed=false;
        entry.resultUrl.clear();entry.outputPath.clear();entry.outputMb=0;entry.report.clear();entry.status="В очереди";
    }
    m_batchCancelRequested=false;m_batchBusy=true;m_batchProgress=0;m_batchStatus=QString("Обработка 0 из %1").arg(paths.size());m_batchProgressHistory={0.0};m_batchActivityHistory={.22};
    emit batchItemsChanged();emit batchBusyChanged();emit batchProgressChanged();emit batchStatusChanged();emit batchTelemetryChanged();
    m_batchWatcher.setFuture(QtConcurrent::run([this,paths]{
        BatchRunResult run;const int total=paths.size();run.items.reserve(total);
        for(int index=0;index<total;++index){
            if(m_batchCancelRequested.load()){run.cancelled=true;break;}
            BatchRunItem summary;summary.index=index;
            try{
                const QString path=paths[index];
                const TextureResult result=TextureProcessor::processAutomatic(path,[this,index,total](double value,const QString &text){
                    QMetaObject::invokeMethod(this,[this,index,total,value,text]{
                        if(index>=0&&index<m_batchEntries.size()){
                            m_batchEntries[index].progress=value;m_batchEntries[index].status=text;
                            m_batchProgress=(index+value)/qMax(1,total);
                            m_batchStatus=QString("Обработка %1 из %2 · %3").arg(index+1).arg(total).arg(text);
                            m_batchProgressHistory.append(m_batchProgress);
                            m_batchActivityHistory.append(qBound(.08,.52+.38*std::sin((m_batchProgressHistory.size()+1)*1.31),.96));
                            while(m_batchProgressHistory.size()>72)m_batchProgressHistory.removeFirst();while(m_batchActivityHistory.size()>72)m_batchActivityHistory.removeFirst();
                            emit batchItemsChanged();emit batchProgressChanged();emit batchStatusChanged();emit batchTelemetryChanged();
                        }
                    },Qt::QueuedConnection);
                },[this]{return m_batchCancelRequested.load();});
                const QFileInfo source(path);QDir outputDir(source.absolutePath()+"/compressed");
                if(!outputDir.exists()&&!QDir().mkpath(outputDir.absolutePath()))throw std::runtime_error("Не удалось создать папку compressed");
                const QString out=outputDir.filePath(source.completeBaseName()+"_AGR_AUTO_RGB24.png");QFile file(out);
                if(!file.open(QIODevice::WriteOnly|QIODevice::Truncate)||file.write(result.png)!=result.png.size())throw std::runtime_error("Не удалось записать результат");
                file.close();summary.resultUrl=QUrl::fromLocalFile(out).toString();summary.outputPath=QDir::toNativeSeparators(out);
                summary.outputMb=result.png.size()/1000000.0;summary.report=result.report;
            }catch(const std::exception &error){summary.error=QString::fromUtf8(error.what());if(m_batchCancelRequested.load())run.cancelled=true;}
            catch(...){summary.error="Неизвестный сбой обработки";}
            run.items.append(summary);
            if(run.cancelled)break;
        }
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
