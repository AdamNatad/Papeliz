package com.papeliz.mobile

import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.LayerDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    keepPapelizPageClearOfSystemBars()
  }

  // Android draws every app under the status bar and the gesture bar. Until the page lays itself out
  // around them, the web view sits between them, and it shrinks above the keyboard while one is open.
  // The status bar's strip takes Papeliz's blue top bar color with light icons; the gesture bar's
  // strip takes the page's light ground.
  private fun keepPapelizPageClearOfSystemBars() {
    val papelizContentView = findViewById<View>(android.R.id.content)
    val systemBarStripsBackground = LayerDrawable(arrayOf(ColorDrawable(PAPELIZ_PAGE_GROUND_COLOR), ColorDrawable(PAPELIZ_TOP_BAR_BLUE)))
    systemBarStripsBackground.setLayerGravity(1, Gravity.TOP or Gravity.FILL_HORIZONTAL)
    papelizContentView.background = systemBarStripsBackground

    ViewCompat.setOnApplyWindowInsetsListener(papelizContentView) { insetView, windowInsets ->
      val systemBarInsets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      val keyboardInsets = windowInsets.getInsets(WindowInsetsCompat.Type.ime())
      insetView.setPadding(systemBarInsets.left, systemBarInsets.top, systemBarInsets.right, maxOf(systemBarInsets.bottom, keyboardInsets.bottom))
      systemBarStripsBackground.setLayerHeight(1, systemBarInsets.top)
      WindowInsetsCompat.CONSUMED
    }

    WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = false
  }

  private companion object {
    // The web app's light theme: its top bar blue and its surface (app/web/src/papeliz-webapp.css).
    val PAPELIZ_TOP_BAR_BLUE = Color.parseColor("#0064D4")
    val PAPELIZ_PAGE_GROUND_COLOR = Color.parseColor("#FFFFFF")
  }
}
