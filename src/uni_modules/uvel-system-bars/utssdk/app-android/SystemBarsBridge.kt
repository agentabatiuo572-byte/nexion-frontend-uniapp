package uts.sdk.modules.uvelSystemBars

import android.graphics.Color
import android.os.Build
import android.view.View
import android.view.WindowInsets
import io.dcloud.uts.UTSAndroid
import kotlin.math.roundToInt

// The page runs to the bottom edge of the screen under a transparent navigation bar, so the
// gesture handle or the three buttons sit over the page instead of on a coloured strip.
object SystemBarsBridge {
    @Suppress("DEPRECATION")
    fun navigationBar(dark: Boolean) {
        val activity = UTSAndroid.getUniActivity() ?: return
        activity.runOnUiThread {
            val window = activity.window
            // Dark navigation icons need Android 8; older versions keep an opaque dark bar below the page.
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                window.navigationBarColor = Color.parseColor("#0A0A0A")
                return@runOnUiThread
            }
            // Keep the status-bar flags the runtime sets for the theme.
            val decor = window.decorView
            val flags = decor.systemUiVisibility or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            decor.systemUiVisibility = if (dark) flags and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
                else flags or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            window.navigationBarColor = Color.TRANSPARENT
            // Otherwise three-button navigation gets a translucent scrim, a strip again.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) window.isNavigationBarContrastEnforced = false
        }
    }

    // Height in dp (CSS px) of the three-button navigation the page runs under. The gesture
    // handle is not tappable, so it reports 0; so does Android 7 and older, where the page
    // stays above the bar.
    @Suppress("DEPRECATION")
    fun buttonsInset(): Int {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return 0
        val activity = UTSAndroid.getUniActivity() ?: return 0
        val insets = activity.window.decorView.rootWindowInsets ?: return 0
        val px = when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ->
                insets.getInsetsIgnoringVisibility(WindowInsets.Type.tappableElement()).bottom
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> insets.tappableElementInsets.bottom
            // Android 8 and 9 have no system gesture navigation: a bar there is buttons.
            else -> insets.stableInsetBottom
        }
        return (px / activity.resources.displayMetrics.density).roundToInt()
    }
}
