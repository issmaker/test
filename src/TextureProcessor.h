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
    int algorithmId = 0;
    int paletteColors = 0;
    QString algorithmName;
};

class TextureProcessor final {
public:
    using Progress = std::function<void(double, const QString &)>;
    static TextureResult process(const QString &path, qint64 limitBytes, int algorithmId, const Progress &progress);
private:
    static QImage edgeAwareCandidate(const QImage &, int smooth, int quant);
    static QImage paletteCandidate(const QImage &, int colors, int preserveThreshold);
    static QImage perceptualPaletteCandidate(const QImage &, int colors, int model, int orderedStrength);
    static QImage jpegBridgeCandidate(const QImage &, int quality);
    static QImage lumaChromaCandidate(const QImage &, int lumaStep, int chromaStep);
    static QImage auditRepair(const QImage &, const QImage &, int strength, int &correctedPixels);
    static QImage guardCandidate(const QImage &, const QImage &, int rgbGuard, int chromaGuard);
    static QImage areaDownsample(const QImage &, const QSize &);
    static void measure(const QImage &, const QImage &, double &, double &, int &);
};
