#include <QGuiApplication>
#include <QDateTime>
#include <QFile>
#include <QMutex>
#include <QMutexLocker>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickStyle>
#include <QTextStream>
#include "OptimizerEngine.h"

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
} // namespace

int main(int argc,char**argv){
    QGuiApplication app(argc,argv);app.setApplicationName("Adaptive Texture Optimizer");app.setApplicationVersion("1.0");
    g_startupLogPath = QCoreApplication::applicationDirPath()
        + QStringLiteral("/AdaptiveTextureOptimizer-startup.log");
    {
        QFile log(g_startupLogPath);
        if (log.open(QIODevice::WriteOnly | QIODevice::Truncate | QIODevice::Text)) {
            QTextStream out(&log);
            out << "Adaptive Texture Optimizer 1.0 startup\n";
            out << "Qt " << qVersion() << "\n";
        }
    }
    qInstallMessageHandler(startupMessageHandler);
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
    if(argc>1)optimizer.load(QUrl::fromLocalFile(QString::fromLocal8Bit(argv[1])).toString());
    return app.exec();
}
