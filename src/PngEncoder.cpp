#include "PngEncoder.h"
#include <libdeflate.h>
#include <QtEndian>
#include <array>
#include <cstring>
#include <limits>

namespace {
quint32 crc32(const QByteArray &data) {
    static const auto table = [] {
        std::array<quint32, 256> t{};
        for (quint32 n = 0; n < 256; ++n) {
            quint32 c = n;
            for (int k = 0; k < 8; ++k) c = (c & 1) ? 0xedb88320U ^ (c >> 1) : c >> 1;
            t[n] = c;
        }
        return t;
    }();
    quint32 c = 0xffffffffU;
    for (const auto ch : data) c = table[(c ^ quint8(ch)) & 255] ^ (c >> 8);
    return c ^ 0xffffffffU;
}
void append32(QByteArray &out, quint32 value) {
    const quint32 be = qToBigEndian(value);
    out.append(reinterpret_cast<const char *>(&be), 4);
}
void chunk(QByteArray &out, const char name[5], const QByteArray &payload) {
    append32(out, quint32(payload.size()));
    QByteArray body(name, 4); body += payload;
    out += body; append32(out, crc32(body));
}
inline int paeth(int a, int b, int c) {
    const int p = a + b - c, pa = qAbs(p-a), pb = qAbs(p-b), pc = qAbs(p-c);
    return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
}
}

QByteArray PngEncoder::filtered(const QImage &input, int strategy) {
    const QImage image = input.convertToFormat(QImage::Format_RGB888);
    const int rowBytes = image.width() * 3;
    QByteArray result((rowBytes + 1) * image.height(), Qt::Uninitialized);
    std::array<QByteArray, 5> trial;
    for (auto &v : trial) v.resize(rowBytes);
    for (int y = 0; y < image.height(); ++y) {
        const uchar *cur = image.constScanLine(y);
        const uchar *up = y ? image.constScanLine(y-1) : nullptr;
        std::array<quint64, 5> score{};
        for (int x = 0; x < rowBytes; ++x) {
            const int raw = cur[x], left = x >= 3 ? cur[x-3] : 0;
            const int above = up ? up[x] : 0, upperLeft = up && x >= 3 ? up[x-3] : 0;
            const int pred[5] = {0, left, above, (left+above)/2, paeth(left,above,upperLeft)};
            for (int f=0; f<5; ++f) {
                const quint8 v = quint8(raw-pred[f]); trial[f][x] = char(v);
                score[f] += qMin(unsigned(v), 256U-unsigned(v));
            }
        }
        int chosen = strategy;
        if (strategy == 5) {
            chosen = 0;
            for (int f=1; f<5; ++f) if (score[f] < score[chosen]) chosen=f;
        }
        char *dst = result.data() + y*(rowBytes+1);
        dst[0] = char(chosen);
        memcpy(dst+1, trial[chosen].constData(), size_t(rowBytes));
    }
    return result;
}

EncodedPng PngEncoder::encodeRgb24(const QImage &input, int level) {
    const QImage image = input.convertToFormat(QImage::Format_RGB888);
    QByteArray best;
    int bestFilter = 0;
    for (int strategy : {0, 1, 2, 4, 5}) {
        const QByteArray rows = filtered(image, strategy);
        libdeflate_compressor *c = libdeflate_alloc_compressor(qBound(1, level, 12));
        const size_t bound = libdeflate_zlib_compress_bound(c, size_t(rows.size()));
        QByteArray packed(qsizetype(bound), Qt::Uninitialized);
        const size_t written = libdeflate_zlib_compress(c, rows.constData(), size_t(rows.size()),
                                                        packed.data(), bound);
        libdeflate_free_compressor(c);
        if (!written) continue;
        packed.resize(qsizetype(written));
        if (best.isEmpty() || packed.size() < best.size()) { best=packed; bestFilter=strategy; }
    }
    QByteArray png("\x89PNG\r\n\x1a\n", 8), ihdr;
    append32(ihdr, quint32(image.width())); append32(ihdr, quint32(image.height()));
    ihdr.append(char(8)); ihdr.append(char(2)); ihdr.append(char(0)); ihdr.append(char(0)); ihdr.append(char(0));
    chunk(png, "IHDR", ihdr); chunk(png, "IDAT", best); chunk(png, "IEND", {});
    return {png, bestFilter};
}

bool PngEncoder::verifyRgb24(const QByteArray &png, const QImage &expected) {
    if (png.size() < 26 || quint8(png[24]) != 8 || quint8(png[25]) != 2) return false;
    const QImage decoded = QImage::fromData(png, "PNG").convertToFormat(QImage::Format_RGB888);
    const QImage source = expected.convertToFormat(QImage::Format_RGB888);
    return !decoded.isNull() && decoded.size()==source.size() && decoded==source;
}
