#include "OptimizerEngine.h"
#include <QtConcurrent>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QUrl>
#include <QDesktopServices>
#include <stdexcept>

OptimizerEngine::OptimizerEngine(QObject *p):QObject(p){
    connect(&m_watcher,&QFutureWatcher<TextureResult>::finished,this,[this]{
        try{
            const auto r=m_watcher.result(); const QFileInfo src(localPath());
            QDir dir(src.absolutePath());
            if(!dir.mkpath("original")||!dir.mkpath("compressed"))
                throw std::runtime_error("Не удалось создать папки original/compressed");
            const QString original=dir.filePath("original/"+src.fileName());
            if(QFile::exists(original)) QFile::remove(original);
            if(!QFile::copy(src.absoluteFilePath(),original))
                throw std::runtime_error("Не удалось сохранить копию в original");
            const QString reference=dir.filePath("original/"+src.completeBaseName()+"_2K_REFERENCE.png");
            if(!r.original.save(reference,"PNG",100))
                throw std::runtime_error("Не удалось сохранить рабочий 2K-эталон");
            const QString out=dir.filePath("compressed/"+src.completeBaseName()+"_AGR_RGB24.png");
            QFile f(out);
            if(!f.open(QIODevice::WriteOnly|QIODevice::Truncate)||f.write(r.png)!=r.png.size())
                throw std::runtime_error("Не удалось записать оптимизированный PNG");
            f.close();
            m_outputPath=QDir::toNativeSeparators(out);
            m_referenceUrl=QUrl::fromLocalFile(reference).toString();
            m_resultUrl=QUrl::fromLocalFile(out).toString();m_report=r.report+"\n\nСохранено: "+m_outputPath;m_status="Готово — файл сохранён";
            emit resultUrlChanged();emit referenceUrlChanged();emit reportChanged();emit outputPathChanged();emit statusChanged();
        }catch(const std::exception&e){m_status=QString("Ошибка: ")+e.what();emit statusChanged();}
        m_busy=false;emit busyChanged();
    });
}
QString OptimizerEngine::localPath()const{return QUrl(m_sourceUrl).toLocalFile();}
void OptimizerEngine::load(const QString&value){if(m_busy)return;const QUrl u(value);m_sourceUrl=u.isLocalFile()?u.toString():QUrl::fromLocalFile(value).toString();m_resultUrl={};m_referenceUrl={};m_outputPath={};m_report={};m_status="Текстура готова к анализу";emit sourceUrlChanged();emit resultUrlChanged();emit referenceUrlChanged();emit outputPathChanged();emit reportChanged();emit statusChanged();}
void OptimizerEngine::setProgress(double p,const QString&s){QMetaObject::invokeMethod(this,[=]{m_progress=p;m_status=s;emit progressChanged();emit statusChanged();},Qt::QueuedConnection);}
void OptimizerEngine::optimize(double maxMb){if(m_sourceUrl.isEmpty()||m_busy)return;m_busy=true;m_progress=0;emit busyChanged();emit progressChanged();const QString p=localPath();m_watcher.setFuture(QtConcurrent::run([this,p,maxMb]{return TextureProcessor::process(p,qint64(maxMb*1000000.0),[this](double v,const QString&s){setProgress(v,s);});}));}
void OptimizerEngine::openSourceFolder(){const QFileInfo f(localPath());if(f.exists())QDesktopServices::openUrl(QUrl::fromLocalFile(f.absolutePath()));}
void OptimizerEngine::openOutputFolder(){if(!m_outputPath.isEmpty())QDesktopServices::openUrl(QUrl::fromLocalFile(QFileInfo(m_outputPath).absolutePath()));}
