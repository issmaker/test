pragma Singleton
import QtQuick

QtObject {
    property bool lightMode: false
    readonly property color canvas: lightMode ? "#eef2f8" : "#050204"
    readonly property color surface: lightMode ? "#e9ffffff" : "#110a10"
    readonly property color surfaceRaised: lightMode ? "#dbe5f0" : "#1a101a"
    readonly property color surfaceHover: lightMode ? "#cad9e8" : "#261525"
    readonly property color stroke: lightMode ? "#1f173761" : "#20ffffff"
    readonly property color strokeStrong: lightMode ? "#38173761" : "#34ffffff"
    readonly property color contentPrimary: lightMode ? "#15274c" : "#f7f2f6"
    readonly property color contentSecondary: lightMode ? "#526789" : "#b9adb7"
    readonly property color contentTertiary: lightMode ? "#8292ad" : "#7f707c"
    readonly property color teal: "#ff3f93"
    readonly property color amber: "#ff74b2"
    readonly property color danger: "#ee6b71"
    readonly property int radiusSmall: 9
    readonly property int radiusMedium: 13
    readonly property int radiusLarge: 18
}
