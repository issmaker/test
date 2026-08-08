#include <QGuiApplication>
#include <QDateTime>
#include <QColor>
#include <QFile>
#include <QIcon>
#include <QImageReader>
#include <QMutex>
#include <QMutexLocker>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickStyle>
#include <QQuickItem>
#include <QTextStream>
#include <QTemporaryDir>
#include "OptimizerEngine.h"
#include "PngEncoder.h"

#ifdef Q_OS_WIN
#include <windows.h>
#endif

namespace {
QString g_startupLogPath;
QMutex g_logMutex;

void startupMessageHandler(QtMsgType type,
                           const QMessageLogContext &context,
                           const QString &message) {
    QMutexLocker lock(&g_logMutex);
    QFile file(g_startupLogPath);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Append | QIODevice::Text))
        return;

    const char *level = "INFO";
    if (type == QtDebugMsg) level = "DEBUG";
    else if (type == QtWarningMsg) level = "WARNING";
    else if (type == QtCriticalMsg) level = "CRITICAL";
    else if (type == QtFatalMsg) level = "FATAL";

    QTextStream out(&file);
    out << QDateTime::currentDateTime().toString(Qt::ISODateWithMs)
        << " [" << level << "] " << message;
    if (context.file)
        out << " (" << context.file << ':' << context.line << ')';
    out << '\n';
    out.flush();
}

void showStartupFailure(const QString &details) {
#ifdef Q_OS_WIN
    const QString title = QStringLiteral("Adaptive Texture Optimizer — ошибка запуска");
    const QString body = QStringLiteral(
        "Не удалось создать интерфейс приложения.\n\n%1\n\n"
        "Отправьте файл AdaptiveTextureOptimizer-startup.log разработчику.")
        .arg(details);
    MessageBoxW(nullptr,
                reinterpret_cast<LPCWSTR>(body.utf16()),
                reinterpret_cast<LPCWSTR>(title.utf16()),
                MB_OK | MB_ICONERROR);
#else
    Q_UNUSED(details)
#endif
}

int runSelfTest() {
    QTemporaryDir directory;
    if (!directory.isValid()) return 2;

    QImage input(512, 512, QImage::Format_RGB888);
    quint32 state = 0x34a6f19dU;
    for (int y = 0; y < input.height(); ++y) {
        uchar *line = input.scanLine(y);
        for (int x = 0; x < input.width(); ++x) {
            state = state * 1664525U + 1013904223U;
            line[x*3] = uchar((x + (state >> 24)) & 255);
            line[x*3+1] = uchar((y + (state >> 16)) & 255);
            line[x*3+2] = uchar((x + y + (state >> 8)) & 255);
        }
    }
    const QString inputPath = directory.filePath(QStringLiteral("self-test.png"));
    if (!input.save(inputPath, "PNG")) return 3;

    constexpr qint64 limit = 250000;
    const TextureResult result = TextureProcessor::process(inputPath, limit, [](double,const QString&){});
    if (result.png.isEmpty() || result.png.size() > limit) return 4;
    if (!PngEncoder::verifyRgb24(result.png, result.output)) return 5;
    if (result.output.size() != input.size()) return 6;
    const TextureResult automatic = TextureProcessor::processAutomatic(inputPath, [](double,const QString&){});
    if (automatic.png.isEmpty()) return 7;
    if (!PngEncoder::verifyRgb24(automatic.png, automatic.output)) return 8;
    if (automatic.output.size() != input.size()) return 9;
    bool cancellationObserved=false;
    try { TextureProcessor::processAutomatic(inputPath, [](double,const QString&){}, []{return true;}); }
    catch(...) { cancellationObserved=true; }
    if(!cancellationObserved)return 10;
    QImage wide(8192,256,QImage::Format_RGB888);wide.fill(QColor(37,112,103));
    const QString widePath=directory.filePath(QStringLiteral("self-test-8k-width.png"));
    if(!wide.save(widePath,"PNG"))return 11;
    OptimizerEngine previewEngine;QVariantList previewFiles;previewFiles.append(QUrl::fromLocalFile(widePath));previewEngine.addBatchFiles(previewFiles);
    const QVariantList previewItems=previewEngine.batchItems();if(previewItems.size()!=1)return 12;
    const QString comparisonUrl=previewItems.constFirst().toMap().value("comparisonSourceUrl").toString();
    QImageReader comparisonReader(QUrl(comparisonUrl).toLocalFile(),"PNG");
    const QSize comparisonSize=comparisonReader.size();
    if(!comparisonSize.isValid()||qMax(comparisonSize.width(),comparisonSize.height())!=3072||comparisonSize.width()<=comparisonSize.height())return 13;
    return 0;
}
} // namespace

int main(int argc,char**argv){
    QGuiApplication app(argc,argv);app.setApplicationName("Adaptive Texture Optimizer");app.setApplicationVersion("34");
    app.setWindowIcon(QIcon(QStringLiteral(":/icons/liquid.svg")));
    g_startupLogPath = QCoreApplication::applicationDirPath()
        + QStringLiteral("/AdaptiveTextureOptimizer-startup.log");
    {
        QFile log(g_startupLogPath);
        if (log.open(QIODevice::WriteOnly | QIODevice::Truncate | QIODevice::Text)) {
            QTextStream out(&log);
            out << "Adaptive Texture Optimizer 34 startup\n";
            out << "Qt " << qVersion() << "\n";
        }
    }
    qInstallMessageHandler(startupMessageHandler);
    if(app.arguments().contains(QStringLiteral("--self-test")))return runSelfTest();
    QQuickStyle::setStyle("Basic");OptimizerEngine optimizer;QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty("optimizer",&optimizer);
    engine.loadFromModule("AGR.TextureOptimizer","Main");
    if(engine.rootObjects().isEmpty()){
        const QString details = QStringLiteral("QML root object was not created. Log: %1")
            .arg(g_startupLogPath);
        startupMessageHandler(QtCriticalMsg, QMessageLogContext(), details);
        if (qEnvironmentVariableIsEmpty("AGR_STARTUP_TEST"))
            showStartupFailure(details);
        return -1;
    }
    if(app.arguments().contains(QStringLiteral("--ui-layout-test"))){
        QObject *root=engine.rootObjects().constFirst();
        const auto verify=[&](int screen,const char *name,double minimumHeight){
            root->setProperty("screen",screen);
            for(int i=0;i<5;++i)QCoreApplication::processEvents();
            QObject *item=root->findChild<QObject*>(QString::fromLatin1(name));
            return item&&item->property("visible").toBool()&&item->property("height").toDouble()>=minimumHeight;
        };
        if(!verify(1,"npmComparisonPanel",360.0))return 21;
        if(!verify(2,"batchListPanel",460.0))return 22;
        if(!verify(3,"batchComparisonPanel",460.0))return 23;
        const QColor brandColor=root->property("brandContrastColor").value<QColor>();
        if(!brandColor.isValid()||brandColor.lightnessF()<.70)return 24;
        return 0;
    }
    if(argc>1)optimizer.load(QUrl::fromLocalFile(QString::fromLocal8Bit(argv[1])).toString());
    return app.exec();
}
