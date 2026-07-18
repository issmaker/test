#pragma once
#include <QObject>
#include <QFutureWatcher>
#include <QVariantList>
#include "TextureProcessor.h"

class OptimizerEngine final : public QObject {
    Q_OBJECT
    Q_PROPERTY(QString sourceUrl READ sourceUrl NOTIFY sourceUrlChanged)
    Q_PROPERTY(QString resultUrl READ resultUrl NOTIFY resultUrlChanged)
    Q_PROPERTY(QString referenceUrl READ referenceUrl NOTIFY referenceUrlChanged)
    Q_PROPERTY(QString status READ status NOTIFY statusChanged)
    Q_PROPERTY(QString report READ report NOTIFY reportChanged)
    Q_PROPERTY(QString outputPath READ outputPath NOTIFY outputPathChanged)
    Q_PROPERTY(double progress READ progress NOTIFY progressChanged)
    Q_PROPERTY(bool busy READ busy NOTIFY busyChanged)
    Q_PROPERTY(QVariantList progressHistory READ progressHistory NOTIFY telemetryChanged)
    Q_PROPERTY(QVariantList activityHistory READ activityHistory NOTIFY telemetryChanged)
public:
    explicit OptimizerEngine(QObject *parent=nullptr);
    QString sourceUrl()const{return m_sourceUrl;} QString resultUrl()const{return m_resultUrl;}
    QString referenceUrl()const{return m_referenceUrl;}
    QString status()const{return m_status;} QString report()const{return m_report;}
    QString outputPath()const{return m_outputPath;}
    double progress()const{return m_progress;} bool busy()const{return m_busy;}
    QVariantList progressHistory()const{return m_progressHistory;} QVariantList activityHistory()const{return m_activityHistory;}
    Q_INVOKABLE void load(const QString &url); Q_INVOKABLE void optimize(double maxMb=3.0,int algorithmId=0);
    Q_INVOKABLE void openSourceFolder(); Q_INVOKABLE void openOutputFolder();
signals:
    void sourceUrlChanged(); void resultUrlChanged(); void referenceUrlChanged(); void statusChanged(); void reportChanged();
    void outputPathChanged();
    void progressChanged(); void busyChanged();
    void telemetryChanged();
private:
    QString localPath()const; void setProgress(double,const QString&);
    QString m_sourceUrl,m_resultUrl,m_referenceUrl,m_status="Перетащите PNG",m_report,m_outputPath; double m_progress=0; bool m_busy=false;
    QVariantList m_progressHistory,m_activityHistory;
    QFutureWatcher<TextureResult> m_watcher;
};
