#pragma once
#include <QImage>
#include <QString>
#include <functional>

struct TextureResult {
    QImage original;
    QImage output;
    QByteArray png;
    QString report;
    double psnr = 0;
    double meanError = 0;
    int maxError = 0;
    int tested = 0;
    bool lossless = false;
    int paletteColors = 0;
    QString algorithmName;
    QString textureKind = "COLOR";
};

class TextureProcessor final {
public:
    using Progress = std::function<void(double, const QString &)>;
    using Cancel = std::function<bool()>;
    static TextureResult process(const QString &path, qint64 limitBytes, const Progress &progress, const Cancel &cancel={}, bool preserveResolution=false);
    static TextureResult processAutomatic(const QString &path, const Progress &progress, const Cancel &cancel={});
    static QString detectKind(const QString &path);
private:
    static QImage perceptualPaletteCandidate(const QImage &, int colors, int model, int orderedStrength, const Cancel &cancel={});
    static QImage areaDownsample(const QImage &, const QSize &);
    static QImage semanticCandidate(const QImage &, int levels, const QString &kind, const Cancel &cancel={});
    static TextureResult processSemantic(const QString &path, qint64 limitBytes, const QString &kind, const Progress &, const Cancel &cancel={});
    static void measure(const QImage &, const QImage &, double &, double &, int &);
};
