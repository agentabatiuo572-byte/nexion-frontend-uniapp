package uts.sdk.modules.uvelSystemBars

import android.graphics.Color
import android.os.Build
import android.view.View
import io.dcloud.uts.UTSAndroid

// Android paints the navigation bar under the gesture handle black by default.
// Paint it with the page floor (--v5-bg in src/styles/tokens.css) so the page
// runs to the screen edge, with handle and buttons in the contrasting tone.
object SystemBarsBridge {
    @Suppress("DEPRECATION")
    fun navigationBar(dark: Boolean) {
        val activity = UTSAndroid.getUniActivity() ?: return
        activity.runOnUiThread {
            val window = activity.window
            // Dark navigation icons need Android 8; older versions keep the dark floor.
            val light = !dark && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Keep the status-bar flags the runtime sets for the theme.
                val decor = window.decorView
                val flags = decor.systemUiVisibility
                decor.systemUiVisibility = if (light) flags or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                    else flags and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
            }
            window.navigationBarColor = Color.parseColor(if (light) "#F4F1E9" else "#0A0A0A")
        }
    }
}
