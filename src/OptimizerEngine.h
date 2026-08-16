#pragma once

#include <QObject>
#include <QFutureWatcher>
#include <QElapsedTimer>
#include <QTimer>
#include <QVariantList>
#include <QVariantMap>
#include <QVector>
#include <atomic>
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

struct BatchEntry {
    QString sourceUrl;
    QString resultUrl;
    QString comparisonSourceUrl;
    QString comparisonResultUrl;
    QString outputPath;
    QString name;
    QString status;
    QString report;
    QString accent = "#765cff";
    double sourceMb = 0;
    double outputMb = 0;
    double progress = 0;
    int width = 0;
    int height = 0;
    bool done = false;
    bool failed = false;
    bool importing = false;
};

struct BatchImportItem {
    int index = -1;
    BatchEntry entry;
    QString error;
};

struct BatchImportResult {
    QVector<BatchImportItem> items;
    int skipped = 0;
};

struct BatchRunItem {
    int index = -1;
    QString resultUrl;
    QString comparisonResultUrl;
    QString outputPath;
    QString report;
    QString error;
    double outputMb = 0;
};

struct BatchRunResult { QVector<BatchRunItem> items; bool cancelled = false; };

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
    Q_PROPERTY(QVariantList batchItems READ batchItems NOTIFY batchItemsChanged)
    Q_PROPERTY(bool batchBusy READ batchBusy NOTIFY batchBusyChanged)
    Q_PROPERTY(double batchProgress READ batchProgress NOTIFY batchProgressChanged)
    Q_PROPERTY(QString batchStatus READ batchStatus NOTIFY batchStatusChanged)
    Q_PROPERTY(bool batchImportBusy READ batchImportBusy NOTIFY batchImportBusyChanged)
    Q_PROPERTY(double batchImportProgress READ batchImportProgress NOTIFY batchImportProgressChanged)
    Q_PROPERTY(QString batchImportStatus READ batchImportStatus NOTIFY batchImportStatusChanged)
    Q_PROPERTY(int batchWorkers READ batchWorkers NOTIFY batchWorkersChanged)
    Q_PROPERTY(QVariantList batchProgressHistory READ batchProgressHistory NOTIFY batchTelemetryChanged)
    Q_PROPERTY(QVariantList batchActivityHistory READ batchActivityHistory NOTIFY batchTelemetryChanged)
    Q_PROPERTY(double cpuLoad READ cpuLoad NOTIFY systemTelemetryChanged)
    Q_PROPERTY(double memoryMb READ memoryMb NOTIFY systemTelemetryChanged)
    Q_PROPERTY(double processingRate READ processingRate NOTIFY systemTelemetryChanged)

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
    QVariantList batchItems()const;
    bool batchBusy()const{return m_batchBusy;}
    double batchProgress()const{return m_batchProgress;}
    QString batchStatus()const{return m_batchStatus;}
    bool batchImportBusy()const{return m_batchImportBusy;}
    double batchImportProgress()const{return m_batchImportProgress;}
    QString batchImportStatus()const{return m_batchImportStatus;}
    int batchWorkers()const{return m_batchWorkers;}
    QVariantList batchProgressHistory()const{return m_batchProgressHistory;}
    QVariantList batchActivityHistory()const{return m_batchActivityHistory;}
    double cpuLoad()const{return m_cpuLoad;}
    double memoryMb()const{return m_memoryMb;}
    double processingRate()const{return m_processingRate;}

    Q_INVOKABLE void load(const QString &url);
    Q_INVOKABLE void optimize(double maxMb=3.0);
    Q_INVOKABLE void toggleMasterView();
    Q_INVOKABLE void openSourceFolder();
    Q_INVOKABLE void openOutputFolder();
    Q_INVOKABLE void addBatchFiles(const QVariantList &urls);
    Q_INVOKABLE void clearBatch();
    Q_INVOKABLE void removeBatchItem(int index);
    Q_INVOKABLE void optimizeBatch();
    Q_INVOKABLE void openBatchOutput(int index);
    Q_INVOKABLE void stopCurrent();
    Q_INVOKABLE void stopBatch();
    Q_INVOKABLE QVariantMap snapshot() const;
    Q_INVOKABLE void chooseNpmFile();
    Q_INVOKABLE void chooseBatchFiles();
    Q_INVOKABLE void quitApp();
    Q_INVOKABLE void toggleFullscreen();

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
    void batchItemsChanged();
    void batchBusyChanged();
    void batchProgressChanged();
    void batchStatusChanged();
    void batchImportBusyChanged();
    void batchImportProgressChanged();
    void batchImportStatusChanged();
    void batchWorkersChanged();
    void batchTelemetryChanged();
    void systemTelemetryChanged();
    void fullscreenRequested();

private:
    QString localPath()const;
    void setProgress(double,const QString&);
    void appendTelemetry(double,double);
    void sampleSystemTelemetry();
    QString m_sourceUrl,m_resultUrl,m_referenceUrl,m_workingPreviewUrl;
    QString m_accentColor="#ff641f",m_status="Перетащите PNG",m_report,m_outputPath;
    double m_progress=0,m_sourceFileMb=0,m_outputFileMb=0,m_telemetryPhase=0;
    int m_sourceWidth=0,m_sourceHeight=0,m_workingWidth=0,m_workingHeight=0,m_previewGeneration=0;
    bool m_showingMaster=false,m_previewBusy=false,m_busy=false;
    QVariantList m_progressHistory,m_activityHistory;
    QTimer m_telemetryTimer;
    QFutureWatcher<TextureResult> m_watcher;
    QFutureWatcher<SourcePreview> m_previewWatcher;
    QVector<BatchEntry> m_batchEntries;
    bool m_batchBusy=false;
    double m_batchProgress=0;
    QString m_batchStatus="Добавьте PNG-файлы";
    QFutureWatcher<BatchRunResult> m_batchWatcher;
    QFutureWatcher<BatchImportResult> m_batchImportWatcher;
    QVariantList m_batchProgressHistory,m_batchActivityHistory;
    bool m_batchImportBusy=false;
    double m_batchImportProgress=0;
    QString m_batchImportStatus="PNG не выбраны";
    int m_batchWorkers=1;
    int m_batchImportGeneration=0;
    int m_batchGeneration=0;
    std::atomic_bool m_cancelRequested{false};
    std::atomic_bool m_batchCancelRequested{false};
    QElapsedTimer m_systemClock;
    qint64 m_lastSystemSample=0;
    quint64 m_lastProcessTicks=0;
    double m_lastTelemetryProgress=0;
    double m_cpuLoad=0,m_memoryMb=0,m_processingRate=0;
};
