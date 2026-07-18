#pragma once

#include <QObject>
#include <QFutureWatcher>
#include <QTimer>
#include <QVariantList>
#include "TextureProcessor.h"

struct SourcePreview {
    int generation = 0;
    int sourceWidth = 0;
    int sourceHeight = 0;
    int workingWidth = 0;
    int workingHeight = 0;
    QString previewPath;
    QString accent = "#ff641f";
    QString error;
};

class OptimizerEngine final : public QObject {
    Q_OBJECT
    Q_PROPERTY(QString sourceUrl READ sourceUrl NOTIFY sourceUrlChanged)
    Q_PROPERTY(QString resultUrl READ resultUrl NOTIFY resultUrlChanged)
    Q_PROPERTY(QString referenceUrl READ referenceUrl NOTIFY referenceUrlChanged)
    Q_PROPERTY(QString workingPreviewUrl READ workingPreviewUrl NOTIFY previewChanged)
    Q_PROPERTY(QString accentColor READ accentColor NOTIFY accentColorChanged)
    Q_PROPERTY(QString status READ status NOTIFY statusChanged)
    Q_PROPERTY(QString report READ report NOTIFY reportChanged)
    Q_PROPERTY(QString outputPath READ outputPath NOTIFY outputPathChanged)
    Q_PROPERTY(double progress READ progress NOTIFY progressChanged)
    Q_PROPERTY(double sourceFileMb READ sourceFileMb NOTIFY sourceInfoChanged)
    Q_PROPERTY(double outputFileMb READ outputFileMb NOTIFY outputSizeChanged)
    Q_PROPERTY(int sourceWidth READ sourceWidth NOTIFY sourceInfoChanged)
    Q_PROPERTY(int sourceHeight READ sourceHeight NOTIFY sourceInfoChanged)
    Q_PROPERTY(int workingWidth READ workingWidth NOTIFY sourceInfoChanged)
    Q_PROPERTY(int workingHeight READ workingHeight NOTIFY sourceInfoChanged)
    Q_PROPERTY(bool sourceIsLarge READ sourceIsLarge NOTIFY sourceInfoChanged)
    Q_PROPERTY(bool showingMaster READ showingMaster NOTIFY showingMasterChanged)
    Q_PROPERTY(bool previewBusy READ previewBusy NOTIFY previewBusyChanged)
    Q_PROPERTY(bool busy READ busy NOTIFY busyChanged)
    Q_PROPERTY(QVariantList progressHistory READ progressHistory NOTIFY telemetryChanged)
    Q_PROPERTY(QVariantList activityHistory READ activityHistory NOTIFY telemetryChanged)

public:
    explicit OptimizerEngine(QObject *parent=nullptr);
    QString sourceUrl()const{return m_sourceUrl;}
    QString resultUrl()const{return m_resultUrl;}
    QString referenceUrl()const{return m_referenceUrl;}
    QString workingPreviewUrl()const{return m_workingPreviewUrl;}
    QString accentColor()const{return m_accentColor;}
    QString status()const{return m_status;}
    QString report()const{return m_report;}
    QString outputPath()const{return m_outputPath;}
    double progress()const{return m_progress;}
    double sourceFileMb()const{return m_sourceFileMb;}
    double outputFileMb()const{return m_outputFileMb;}
    int sourceWidth()const{return m_sourceWidth;}
    int sourceHeight()const{return m_sourceHeight;}
    int workingWidth()const{return m_workingWidth;}
    int workingHeight()const{return m_workingHeight;}
    bool sourceIsLarge()const{return qMax(m_sourceWidth,m_sourceHeight)>2048;}
    bool showingMaster()const{return m_showingMaster;}
    bool previewBusy()const{return m_previewBusy;}
    bool busy()const{return m_busy;}
    QVariantList progressHistory()const{return m_progressHistory;}
    QVariantList activityHistory()const{return m_activityHistory;}

    Q_INVOKABLE void load(const QString &url);
    Q_INVOKABLE void optimize(double maxMb=3.0,int algorithmId=1);
    Q_INVOKABLE void toggleMasterView();
    Q_INVOKABLE void openSourceFolder();
    Q_INVOKABLE void openOutputFolder();

signals:
    void sourceUrlChanged();
    void resultUrlChanged();
    void referenceUrlChanged();
    void previewChanged();
    void accentColorChanged();
    void statusChanged();
    void reportChanged();
    void outputPathChanged();
    void outputSizeChanged();
    void sourceInfoChanged();
    void showingMasterChanged();
    void previewBusyChanged();
    void progressChanged();
    void busyChanged();
    void telemetryChanged();

private:
    QString localPath()const;
    void setProgress(double,const QString&);
    void appendTelemetry(double,double);
    QString m_sourceUrl,m_resultUrl,m_referenceUrl,m_workingPreviewUrl;
    QString m_accentColor="#ff641f",m_status="Перетащите PNG",m_report,m_outputPath;
    double m_progress=0,m_sourceFileMb=0,m_outputFileMb=0,m_telemetryPhase=0;
    int m_sourceWidth=0,m_sourceHeight=0,m_workingWidth=0,m_workingHeight=0,m_previewGeneration=0;
    bool m_showingMaster=false,m_previewBusy=false,m_busy=false;
    QVariantList m_progressHistory,m_activityHistory;
    QTimer m_telemetryTimer;
    QFutureWatcher<TextureResult> m_watcher;
    QFutureWatcher<SourcePreview> m_previewWatcher;
};
