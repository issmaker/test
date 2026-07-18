#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickStyle>
#include "OptimizerEngine.h"

int main(int argc,char**argv){
    QGuiApplication app(argc,argv);app.setApplicationName("Adaptive Texture Optimizer");app.setApplicationVersion("1.0");
    QQuickStyle::setStyle("Basic");OptimizerEngine optimizer;QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty("optimizer",&optimizer);
    engine.loadFromModule("AGR.TextureOptimizer","Main");
    if(engine.rootObjects().isEmpty())return -1;
    if(argc>1)optimizer.load(QUrl::fromLocalFile(QString::fromLocal8Bit(argv[1])).toString());
    return app.exec();
}
