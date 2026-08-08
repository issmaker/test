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
};

class TextureProcessor final {
public:
    using Progress = std::function<void(double, const QString &)>;
    static TextureResult process(const QString &path, qint64 limitBytes, const Progress &progress);
    static TextureResult processAutomatic(const QString &path, const Progress &progress);
private:
    static QImage perceptualPaletteCandidate(const QImage &, int colors, int model, int orderedStrength);
    static QImage areaDownsample(const QImage &, const QSize &);
    static void measure(const QImage &, const QImage &, double &, double &, int &);
};
