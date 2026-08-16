#include <QApplication>
#include <QDateTime>
#include <QColor>
#include <QFile>
#include <QEventLoop>
#include <QIcon>
#include <QImageReader>
#include <QMutex>
#include <QMutexLocker>
#include <QMainWindow>
#include <QWebChannel>
#include <QWebEnginePage>
#include <QWebEngineProfile>
#include <QWebEngineSettings>
#include <QWebEngineUrlRequestJob>
#include <QWebEngineUrlScheme>
#include <QWebEngineUrlSchemeHandler>
#include <QWebEngineView>
#include <QTimer>
#include <QTextStream>
#include <QTemporaryDir>
#include "OptimizerEngine.h"
#include "PngEncoder.h"

#ifdef Q_OS_WIN
#include <windows.h>
#endif

#ifndef AGR_APP_VERSION
#define AGR_APP_VERSION "44"
#endif

namespace {
QString g_startupLogPath;
QMutex g_logMutex;

class TextureSchemeHandler final : public QWebEngineUrlSchemeHandler {
public:
    using QWebEngineUrlSchemeHandler::QWebEngineUrlSchemeHandler;
    void requestStarted(QWebEngineUrlRequestJob *job) override {
        const QByteArray encoded=job->requestUrl().path().mid(1).toLatin1();
        const QString path=QString::fromUtf8(QByteArray::fromBase64(encoded,QByteArray::Base64UrlEncoding));
        auto *file=new QFile(path,job);
        if(!file->open(QIODevice::ReadOnly)){delete file;job->fail(QWebEngineUrlRequestJob::UrlNotFound);return;}
        job->reply(QByteArrayLiteral("image/png"),file);
    }
};

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
    QEventLoop importLoop;QTimer importTimeout;importTimeout.setSingleShot(true);
    QObject::connect(&previewEngine,&OptimizerEngine::batchImportBusyChanged,&importLoop,[&]{if(!previewEngine.batchImportBusy())importLoop.quit();});
    QObject::connect(&importTimeout,&QTimer::timeout,&importLoop,&QEventLoop::quit);importTimeout.start(15000);
    if(previewEngine.batchImportBusy())importLoop.exec();if(previewEngine.batchImportBusy())return 12;
    const QVariantList previewItems=previewEngine.batchItems();if(previewItems.size()!=1)return 12;
    const QString comparisonUrl=previewItems.constFirst().toMap().value("comparisonSourceUrl").toString();
    QImageReader comparisonReader(QUrl(comparisonUrl).toLocalFile(),"PNG");
    const QSize comparisonSize=comparisonReader.size();
    if(!comparisonSize.isValid()||qMax(comparisonSize.width(),comparisonSize.height())!=2048||comparisonSize.width()<=comparisonSize.height())return 13;
    previewEngine.removeBatchItem(0);if(!previewEngine.batchItems().isEmpty())return 14;

    const QString copyPath=directory.filePath(QStringLiteral("self-test-copy.png"));
    if(!input.save(copyPath,"PNG"))return 15;
    QVariantList batchFiles;batchFiles.append(QUrl::fromLocalFile(inputPath));batchFiles.append(QUrl::fromLocalFile(copyPath));
    QEventLoop batchImportLoop;QTimer batchImportTimeout;batchImportTimeout.setSingleShot(true);
    QObject::connect(&previewEngine,&OptimizerEngine::batchImportBusyChanged,&batchImportLoop,[&]{if(!previewEngine.batchImportBusy())batchImportLoop.quit();});
    QObject::connect(&batchImportTimeout,&QTimer::timeout,&batchImportLoop,&QEventLoop::quit);
    previewEngine.addBatchFiles(batchFiles);batchImportTimeout.start(15000);
    if(previewEngine.batchImportBusy())batchImportLoop.exec();if(previewEngine.batchImportBusy()||previewEngine.batchItems().size()!=2)return 16;

    QEventLoop batchLoop;QTimer batchTimeout;batchTimeout.setSingleShot(true);
    QObject::connect(&previewEngine,&OptimizerEngine::batchBusyChanged,&batchLoop,[&]{if(!previewEngine.batchBusy())batchLoop.quit();});
    QObject::connect(&batchTimeout,&QTimer::timeout,&batchLoop,&QEventLoop::quit);
    previewEngine.optimizeBatch();batchTimeout.start(60000);
    if(previewEngine.batchBusy())batchLoop.exec();if(previewEngine.batchBusy())return 17;
    if(previewEngine.batchWorkers()<1||previewEngine.batchWorkers()>2)return 18;
    for(const QVariant &value:previewEngine.batchItems()){
        const QVariantMap item=value.toMap();
        if(!item.value("done").toBool()||item.value("failed").toBool())return 19;
        if(!QFileInfo::exists(QUrl(item.value("resultUrl").toString()).toLocalFile()))return 20;
    }
    return 0;
}
} // namespace

int main(int argc,char**argv){
    QWebEngineUrlScheme textureScheme(QByteArrayLiteral("texture"));
    textureScheme.setSyntax(QWebEngineUrlScheme::Syntax::HostAndPort);
    textureScheme.setFlags(QWebEngineUrlScheme::SecureScheme|QWebEngineUrlScheme::LocalScheme|QWebEngineUrlScheme::LocalAccessAllowed|QWebEngineUrlScheme::CorsEnabled);
    QWebEngineUrlScheme::registerScheme(textureScheme);
    QApplication app(argc,argv);app.setApplicationName("Adaptive Texture Optimizer");app.setApplicationVersion(QStringLiteral(AGR_APP_VERSION));
    app.setWindowIcon(QIcon(QStringLiteral(":/icons/liquid.svg")));
    g_startupLogPath = QCoreApplication::applicationDirPath()
        + QStringLiteral("/AdaptiveTextureOptimizer-startup.log");
    {
        QFile log(g_startupLogPath);
        if (log.open(QIODevice::WriteOnly | QIODevice::Truncate | QIODevice::Text)) {
            QTextStream out(&log);
            out << "Adaptive Texture Optimizer " AGR_APP_VERSION " startup\n";
            out << "Qt " << qVersion() << "\n";
        }
    }
    qInstallMessageHandler(startupMessageHandler);
    if(app.arguments().contains(QStringLiteral("--self-test")))return runSelfTest();
    if(app.arguments().contains(QStringLiteral("--ui-layout-test"))){
        QFile html(QStringLiteral(":/web/index.html")),js(QStringLiteral(":/web/assets/app.js")),css(QStringLiteral(":/web/assets/app.css"));
        if(!html.open(QIODevice::ReadOnly)||!js.open(QIODevice::ReadOnly)||!css.open(QIODevice::ReadOnly))return 21;
        if(!html.readAll().contains("id=\"root\"")||js.size()<500000||css.size()<5000)return 22;
        return 0;
    }
    OptimizerEngine optimizer;optimizer.setObjectName(QStringLiteral("optimizer"));TextureSchemeHandler textureHandler;
    QMainWindow window;auto *view=new QWebEngineView(&window);auto *channel=new QWebChannel(view);
    QObject::connect(&optimizer,&OptimizerEngine::fullscreenRequested,&window,[&window]{
        if(window.isFullScreen())window.showMaximized();else window.showFullScreen();
    });
    view->page()->profile()->installUrlSchemeHandler(QByteArrayLiteral("texture"),&textureHandler);
    channel->registerObject(QStringLiteral("optimizer"),&optimizer);view->page()->setWebChannel(channel);
    view->settings()->setAttribute(QWebEngineSettings::LocalContentCanAccessFileUrls,true);
    view->settings()->setAttribute(QWebEngineSettings::WebGLEnabled,true);
    view->settings()->setAttribute(QWebEngineSettings::Accelerated2dCanvasEnabled,true);
    const bool startupTest=!qEnvironmentVariableIsEmpty("AGR_STARTUP_TEST");
    QObject::connect(view,&QWebEngineView::loadFinished,&window,[&](bool ok){
        if(!ok){startupMessageHandler(QtCriticalMsg,QMessageLogContext(),QStringLiteral("Web interface failed to load"));return;}
        if(startupTest){
            QTimer::singleShot(450,view,[view]{view->page()->runJavaScript(QStringLiteral(R"JS((()=>{
                const timer=setInterval(()=>{
                    const target=document.querySelector('.right-dock [data-route="npm"]');
                    if(!target)return;
                    clearInterval(timer);target.click();
                },100);
                setTimeout(()=>clearInterval(timer),3000);
            })())JS"));});
            QTimer::singleShot(1200,view,[view]{view->page()->runJavaScript(QStringLiteral(R"JS((()=>{
                const timer=setInterval(()=>{
                    const zoom=document.querySelector('.zoom-pane');
                    if(!zoom)return;
                    clearInterval(timer);
                    for(let i=0;i<40;i++)zoom.dispatchEvent(new WheelEvent('wheel',{deltaY:-180,clientX:500,clientY:420,bubbles:true,cancelable:true}));
                    let step=0;
                    const stress=setInterval(()=>{
                        dispatchEvent(new CustomEvent('agr-test-drag',{detail:{x:(step%3)-1,y:9}}));
                        if(++step>=120){clearInterval(stress);window.__AGR_STRESS_DONE__=true;}
                    },6);
                    dispatchEvent(new CustomEvent('agr-hint',{detail:{open:true,text:'TOOLTIP TEST',x:720,y:42}}));
                },100);
                setTimeout(()=>clearInterval(timer),3200);
            })())JS"));});
            QTimer::singleShot(3500,view,[view]{view->page()->runJavaScript(QStringLiteral("document.querySelector('.top-actions [data-action=\"settings\"]')?.click()"));});
            QTimer::singleShot(4800,view,[view]{
                view->page()->runJavaScript(QStringLiteral(R"JS((()=>{
                    const hint=document.querySelector('.floating-hint'),box=hint?.getBoundingClientRect();
                    const zoomLabel=document.querySelector('.zoom-orbit span');
                    const zoomed=Boolean(zoomLabel&&zoomLabel.textContent!=='100%');
                    const canvasReady=Boolean(document.querySelector('.zoom-pane canvas.ready'));
                    const verticalSafe=Math.abs(Number(window.__AGR_TEST_VERTICAL_Y__||0))>.1;
                    const stressSafe=Boolean(window.__AGR_STRESS_DONE__)&&Number(window.__AGR_WHEEL_COUNT__||0)>=40&&Number(window.__AGR_ZOOM_TARGET__||0)>=15.9;
                    const mask=(document.querySelector('.workspace')?1:0)|(document.querySelector('.settings-panel')?2:0)|(document.querySelector('.topbar')?4:0)|(zoomed?8:0)|(box&&box.left>10&&box.top>10?16:0)|(canvasReady?32:0)|(verticalSafe?64:0)|(stressSafe?128:0);
                    return `${mask}|${document.querySelector('.zoom-orbit span')?.textContent}|${window.__AGR_WHEEL_COUNT__||0}|${window.__AGR_ZOOM_TARGET__||0}|${document.querySelectorAll('.zoom-pane').length}|${document.querySelectorAll('canvas.ready').length}|${window.__AGR_TEST_VERTICAL_Y__||0}`;
                })())JS"),[](const QVariant &result){
                    const QString details=result.toString();const int mask=details.section('|',0,0).toInt();
                    constexpr int shellMask=1|2|4|128;
                    if((mask&shellMask)!=shellMask)
                        qCritical("React shell smoke test failed: %s",qPrintable(details));
                    else if(mask!=255)
                        qWarning("Offscreen interaction diagnostics incomplete: %s",qPrintable(details));
                });
            });
        }
    });
    window.setWindowTitle(QStringLiteral("Оптимизатор текстур " AGR_APP_VERSION));window.setCentralWidget(view);
    view->setUrl(QUrl(startupTest?QStringLiteral("qrc:/web/index.html?headless-test=1"):QStringLiteral("qrc:/web/index.html")));window.showFullScreen();
    if(argc>1)optimizer.load(QUrl::fromLocalFile(QString::fromLocal8Bit(argv[1])).toString());
    return app.exec();
}
