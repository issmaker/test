#pragma once
#include <QByteArray>
#include <QImage>
#include <functional>

struct EncodedPng {
    QByteArray bytes;
    int filter = 0;
};

class PngEncoder final {
public:
    using Cancel = std::function<bool()>;
    static EncodedPng encodeRgb24(const QImage &image, int level = 10, const Cancel &cancel = {});
    static bool verifyRgb24(const QByteArray &png, const QImage &expected);
private:
    static QByteArray filtered(const QImage &image, int strategy, const Cancel &cancel);
};
