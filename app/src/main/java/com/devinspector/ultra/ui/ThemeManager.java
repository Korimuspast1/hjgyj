package com.devinspector.ultra.ui;

import android.content.Context;
import android.content.SharedPreferences;

public class ThemeManager {

    public static final int THEME_MONO_BLACK = 0;
    public static final int THEME_MONO_GRAPHITE = 1;
    public static final int THEME_MONO_STEEL = 2;

    private static final String PREF_NAME = "dev_inspector_settings";
    private static final String KEY_THEME = "theme_id";
    private static final String KEY_TEMP_UNIT = "temp_unit";
    private static final String KEY_FREQ_UNIT = "freq_unit";
    private static final String KEY_REFRESH_INTERVAL = "refresh_interval";
    private static final String KEY_DEEP_PROBING = "deep_probing";

    public final int themeId;
    public final int colorBackground;
    public final int colorCardBg;
    public final int colorCardBorder;
    public final int colorCardBorderBright;
    public final int colorTextPrimary;
    public final int colorTextSecondary;
    public final int colorTextMuted;
    public final int colorAccent;
    public final int colorButtonInactive;
    public final int colorBadgeBg;
    public final int colorBadgeText;

    public ThemeManager(int themeId) {
        this.themeId = themeId;
        switch (themeId) {
            case THEME_MONO_GRAPHITE:
                colorBackground = 0xFF121212;
                colorCardBg = 0xFF1E1E1E;
                colorCardBorder = 0xFF2E2E2E;
                colorCardBorderBright = 0xFF505050;
                colorTextPrimary = 0xFFFFFFFF;
                colorTextSecondary = 0xFFA0A0A0;
                colorTextMuted = 0xFF666666;
                colorAccent = 0xFFFFFFFF;
                colorButtonInactive = 0xFF2A2A2A;
                colorBadgeBg = 0xFF2A2A2A;
                colorBadgeText = 0xFFEEEEEE;
                break;
            case THEME_MONO_STEEL:
                colorBackground = 0xFF1A1A1E;
                colorCardBg = 0xFF25252A;
                colorCardBorder = 0xFF383842;
                colorCardBorderBright = 0xFF585864;
                colorTextPrimary = 0xFFF5F5F7;
                colorTextSecondary = 0xFFA5A5B0;
                colorTextMuted = 0xFF6C6C75;
                colorAccent = 0xFFFFFFFF;
                colorButtonInactive = 0xFF303036;
                colorBadgeBg = 0xFF32323A;
                colorBadgeText = 0xFFFFFFFF;
                break;
            case THEME_MONO_BLACK:
            default:
                colorBackground = 0xFF000000;
                colorCardBg = 0xFF111111;
                colorCardBorder = 0xFF242424;
                colorCardBorderBright = 0xFF444444;
                colorTextPrimary = 0xFFFFFFFF;
                colorTextSecondary = 0xFF9E9E9E;
                colorTextMuted = 0xFF555555;
                colorAccent = 0xFFFFFFFF;
                colorButtonInactive = 0xFF202020;
                colorBadgeBg = 0xFF222222;
                colorBadgeText = 0xFFE0E0E0;
                break;
        }
    }

    public static ThemeManager get(Context context) {
        SharedPreferences sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        int tid = sp.getInt(KEY_THEME, THEME_MONO_BLACK);
        return new ThemeManager(tid);
    }

    public static void setTheme(Context context, int themeId) {
        SharedPreferences sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        sp.edit().putInt(KEY_THEME, themeId).apply();
    }

    public static String getTempUnit(Context context) {
        SharedPreferences sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return sp.getString(KEY_TEMP_UNIT, "C");
    }

    public static void setTempUnit(Context context, String unit) {
        SharedPreferences sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        sp.edit().putString(KEY_TEMP_UNIT, unit).apply();
    }

    public static String getFreqUnit(Context context) {
        SharedPreferences sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return sp.getString(KEY_FREQ_UNIT, "MHz");
    }

    public static void setFreqUnit(Context context, String unit) {
        SharedPreferences sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        sp.edit().putString(KEY_FREQ_UNIT, unit).apply();
    }

    public static int getRefreshInterval(Context context) {
        SharedPreferences sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return sp.getInt(KEY_REFRESH_INTERVAL, 2000);
    }

    public static void setRefreshInterval(Context context, int ms) {
        SharedPreferences sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        sp.edit().putInt(KEY_REFRESH_INTERVAL, ms).apply();
    }

    public static boolean isDeepProbingEnabled(Context context) {
        SharedPreferences sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return sp.getBoolean(KEY_DEEP_PROBING, true);
    }

    public static void setDeepProbingEnabled(Context context, boolean enabled) {
        SharedPreferences sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        sp.edit().putBoolean(KEY_DEEP_PROBING, enabled).apply();
    }
}
