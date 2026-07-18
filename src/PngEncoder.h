#pragma once
#include <QByteArray>
#include <QImage>

struct EncodedPng {
    QByteArray bytes;
    int filter = 0;
};

class PngEncoder final {
public:
    static EncodedPng encodeRgb24(const QImage &image, int level = 10);
    static bool verifyRgb24(const QByteArray &png, const QImage &expected);
private:
    static QByteArray filtered(const QImage &image, int strategy);
};
