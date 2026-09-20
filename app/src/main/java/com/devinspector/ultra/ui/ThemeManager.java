package com.devinspector.ultra.ui;

import android.content.Context;
import android.content.SharedPreferences;

public class ThemeManager {

    public static final int THEME_CYBER = 0;
    public static final int THEME_AMOLED = 1;
    public static final int THEME_SLATE = 2;

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
    public final int colorTextPrimary;
    public final int colorTextSecondary;
    public final int colorAccent;
    public final int colorSuccess;
    public final int colorWarning;
    public final int colorDanger;

    public ThemeManager(int themeId) {
        this.themeId = themeId;
        switch (themeId) {
            case THEME_AMOLED:
                colorBackground = 0xFF000000;
                colorCardBg = 0xFF0D0D0D;
                colorCardBorder = 0xFF1F1F1F;
                colorTextPrimary = 0xFFFFFFFF;
                colorTextSecondary = 0xFF9E9E9E;
                colorAccent = 0xFF00E5FF;
                colorSuccess = 0xFF00E676;
                colorWarning = 0xFFFFD600;
                colorDanger = 0xFFFF1744;
                break;
            case THEME_SLATE:
                colorBackground = 0xFF181825;
                colorCardBg = 0xFF1E1E2E;
                colorCardBorder = 0xFF313244;
                colorTextPrimary = 0xFFCDD6F4;
                colorTextSecondary = 0xFFA6ADC8;
                colorAccent = 0xFFCBA6F7;
                colorSuccess = 0xFFA6E3A1;
                colorWarning = 0xFFF9E2AF;
                colorDanger = 0xFFF38BA8;
                break;
            case THEME_CYBER:
            default:
                colorBackground = 0xFF0B0F14;
                colorCardBg = 0xFF151B23;
                colorCardBorder = 0xFF212B36;
                colorTextPrimary = 0xFFE6EDF3;
                colorTextSecondary = 0xFF8B949E;
                colorAccent = 0xFF58A6FF;
                colorSuccess = 0xFF3FB950;
                colorWarning = 0xFFD29922;
                colorDanger = 0xFFF85149;
                break;
        }
    }

    public static ThemeManager get(Context context) {
        SharedPreferences sp = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        int tid = sp.getInt(KEY_THEME, THEME_CYBER);
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
