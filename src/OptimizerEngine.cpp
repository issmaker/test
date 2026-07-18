#include "OptimizerEngine.h"
#include <QtConcurrent>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QUrl>

OptimizerEngine::OptimizerEngine(QObject *p):QObject(p){
    connect(&m_watcher,&QFutureWatcher<TextureResult>::finished,this,[this]{
        try{
            const auto r=m_watcher.result(); const QFileInfo src(localPath());
            QDir dir(src.absolutePath()); dir.mkpath("original"); dir.mkpath("compresed");
            QFile::copy(src.absoluteFilePath(),dir.filePath("original/"+src.fileName()));
            const QString out=dir.filePath("compresed/"+src.completeBaseName()+"_AGR_RGB24.png");
            QFile f(out); if(f.open(QIODevice::WriteOnly)){f.write(r.png);f.close();}
            m_resultUrl=QUrl::fromLocalFile(out).toString();m_report=r.report;m_status="Оптимизация завершена";
            emit resultUrlChanged();emit reportChanged();emit statusChanged();
        }catch(const std::exception&e){m_status=QString("Ошибка: ")+e.what();emit statusChanged();}
        m_busy=false;emit busyChanged();
    });
}
QString OptimizerEngine::localPath()const{return QUrl(m_sourceUrl).toLocalFile();}
void OptimizerEngine::load(const QString&url){if(m_busy)return;m_sourceUrl=url;m_resultUrl={};m_report={};m_status="Текстура готова к анализу";emit sourceUrlChanged();emit resultUrlChanged();emit reportChanged();emit statusChanged();}
void OptimizerEngine::setProgress(double p,const QString&s){QMetaObject::invokeMethod(this,[=]{m_progress=p;m_status=s;emit progressChanged();emit statusChanged();},Qt::QueuedConnection);}
void OptimizerEngine::optimize(double maxMb){if(m_sourceUrl.isEmpty()||m_busy)return;m_busy=true;m_progress=0;emit busyChanged();emit progressChanged();const QString p=localPath();m_watcher.setFuture(QtConcurrent::run([this,p,maxMb]{return TextureProcessor::process(p,qint64(maxMb*1000000.0),[this](double v,const QString&s){setProgress(v,s);});}));}
