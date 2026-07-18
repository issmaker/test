#pragma once
#include <QObject>
#include <QFutureWatcher>
#include "TextureProcessor.h"

class OptimizerEngine final : public QObject {
    Q_OBJECT
    Q_PROPERTY(QString sourceUrl READ sourceUrl NOTIFY sourceUrlChanged)
    Q_PROPERTY(QString resultUrl READ resultUrl NOTIFY resultUrlChanged)
    Q_PROPERTY(QString status READ status NOTIFY statusChanged)
    Q_PROPERTY(QString report READ report NOTIFY reportChanged)
    Q_PROPERTY(QString outputPath READ outputPath NOTIFY outputPathChanged)
    Q_PROPERTY(double progress READ progress NOTIFY progressChanged)
    Q_PROPERTY(bool busy READ busy NOTIFY busyChanged)
public:
    explicit OptimizerEngine(QObject *parent=nullptr);
    QString sourceUrl()const{return m_sourceUrl;} QString resultUrl()const{return m_resultUrl;}
    QString status()const{return m_status;} QString report()const{return m_report;}
    QString outputPath()const{return m_outputPath;}
    double progress()const{return m_progress;} bool busy()const{return m_busy;}
    Q_INVOKABLE void load(const QString &url); Q_INVOKABLE void optimize(double maxMb=3.0);
    Q_INVOKABLE void openSourceFolder(); Q_INVOKABLE void openOutputFolder();
signals:
    void sourceUrlChanged(); void resultUrlChanged(); void statusChanged(); void reportChanged();
    void outputPathChanged();
    void progressChanged(); void busyChanged();
private:
    QString localPath()const; void setProgress(double,const QString&);
    QString m_sourceUrl,m_resultUrl,m_status="Перетащите PNG",m_report,m_outputPath; double m_progress=0; bool m_busy=false;
    QFutureWatcher<TextureResult> m_watcher;
};
