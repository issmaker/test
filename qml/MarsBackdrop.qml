import QtQuick

Item {
    id: root
    property color accentColor: "#ff7139"
    property real pointerX: 0
    property real pointerY: 0
    property real activity: 0

    Rectangle {
        anchors.fill: parent
        color: "#07070a"
        gradient: Gradient {
            orientation: Gradient.Horizontal
            GradientStop { position: 0; color: "#100b0e" }
            GradientStop { position: .55; color: "#08080c" }
            GradientStop { position: 1; color: "#050508" }
        }
    }

    Canvas {
        id: sky
        anchors.fill: parent
        renderStrategy: Canvas.Threaded
        onPaint: {
            const c = getContext("2d"), w = width, h = height
            c.clearRect(0, 0, w, h)
            for (let i = 0; i < 145; ++i) {
                const x = ((i * 173 + 41) % 997) / 997 * w
                const y = ((i * 277 + 83) % 991) / 991 * h
                const r = i % 17 === 0 ? 1.2 : (i % 5 === 0 ? .7 : .35)
                c.fillStyle = i % 19 === 0 ? "rgba(255,162,106,.58)" : "rgba(238,232,244,.34)"
                c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill()
            }
        }
    }

    Item {
        id: planet
        width: Math.min(root.width * .62, root.height * .92)
        height: width
        x: -width * .17 + root.pointerX * 10
        y: root.height * .18 + root.pointerY * 8
        Behavior on x { NumberAnimation { duration: 260; easing.type: Easing.OutCubic } }
        Behavior on y { NumberAnimation { duration: 260; easing.type: Easing.OutCubic } }

        Rectangle {
            anchors.fill: parent
            anchors.margins: -22
            radius: width / 2
            color: "transparent"
            border.width: 18
            border.color: Qt.rgba(root.accentColor.r, root.accentColor.g, root.accentColor.b, .055 + root.activity * .07)
        }
        Rectangle {
            anchors.fill: parent
            radius: width / 2
            clip: true
            gradient: Gradient {
                orientation: Gradient.Horizontal
                GradientStop { position: 0; color: "#cf451c" }
                GradientStop { position: .34; color: "#9e2918" }
                GradientStop { position: .72; color: "#4d1716" }
                GradientStop { position: 1; color: "#140c11" }
            }

            Canvas {
                anchors.fill: parent
                opacity: .78
                onPaint: {
                    const c = getContext("2d"), w = width, h = height
                    c.clearRect(0, 0, w, h)
                    for (let i = 0; i < 52; ++i) {
                        const px = ((i * 97 + 29) % 463) / 463 * w
                        const py = ((i * 151 + 71) % 457) / 457 * h
                        const rr = (8 + (i * 23) % 43) * w / 650
                        c.beginPath(); c.arc(px, py, rr, 0, Math.PI * 2)
                        c.fillStyle = i % 3 === 0 ? "rgba(42,8,12,.20)" : "rgba(255,132,71,.075)"
                        c.fill()
                        c.strokeStyle = "rgba(255,170,108,.08)"; c.lineWidth = 1; c.stroke()
                    }
                    c.strokeStyle = "rgba(255,179,116,.12)"; c.lineWidth = 2
                    for (let j = 0; j < 7; ++j) {
                        c.beginPath()
                        for (let x = 0; x <= w; x += 12) {
                            const y = h * (.18 + j * .105) + Math.sin(x / 54 + j * 1.7) * (8 + j * 2)
                            if (x === 0) c.moveTo(x, y); else c.lineTo(x, y)
                        }
                        c.stroke()
                    }
                }
            }
            Rectangle {
                anchors.fill: parent
                radius: width / 2
                gradient: Gradient {
                    orientation: Gradient.Horizontal
                    GradientStop { position: 0; color: "#00ffffff" }
                    GradientStop { position: .62; color: "#16000000" }
                    GradientStop { position: 1; color: "#d9000000" }
                }
            }
        }
    }

    Rectangle {
        anchors.fill: parent
        gradient: Gradient {
            orientation: Gradient.Vertical
            GradientStop { position: 0; color: "#08000000" }
            GradientStop { position: .66; color: "#16000000" }
            GradientStop { position: 1; color: "#b0050508" }
        }
    }
}
