package com.devinspector.ultra.data;

import android.app.ActivityManager;
import android.content.Context;
import android.content.pm.ConfigurationInfo;
import android.os.Build;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.Surface;
import android.view.WindowManager;

import com.devinspector.ultra.util.ReflectionUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class DisplayCollector {

    public static List<SectionItem> collect(Context context) {
        List<SectionItem> items = new ArrayList<>();

        WindowManager wm = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        if (wm == null) {
            items.add(new SectionItem("Статус", "Не удалось получить диспетчер окон"));
            return items;
        }

        Display display = wm.getDefaultDisplay();

        // 1. Real vs Usable Metrics
        DisplayMetrics realMetrics = new DisplayMetrics();
        display.getRealMetrics(realMetrics);

        DisplayMetrics usableMetrics = new DisplayMetrics();
        display.getMetrics(usableMetrics);

        int w = realMetrics.widthPixels;
        int h = realMetrics.heightPixels;

        items.add(new SectionItem("Физическое разрешение", w + " x " + h + " px"));
        items.add(new SectionItem("Рабочая область приложения", usableMetrics.widthPixels + " x " + usableMetrics.heightPixels + " px"));

        // 2. Aspect Ratio
        int maxDim = Math.max(w, h);
        int minDim = Math.min(w, h);
        float ratio = (float) maxDim / (float) minDim;
        items.add(new SectionItem("Соотношение сторон", String.format(Locale.US, "%.2f:1", ratio)));

        // 3. Physical Size (inches)
        float xdpi = realMetrics.xdpi;
        float ydpi = realMetrics.ydpi;
        if (xdpi > 0 && ydpi > 0) {
            double widthInches = w / xdpi;
            double heightInches = h / ydpi;
            double diagonalInches = Math.sqrt(Math.pow(widthInches, 2) + Math.pow(heightInches, 2));
            items.add(new SectionItem("Диагональ экрана (Расчётная)", String.format(Locale.US, "%.2f\"", diagonalInches)));
            items.add(new SectionItem("Плотность точек (xdpi x ydpi)", Math.round(xdpi) + " x " + Math.round(ydpi) + " DPI"));
        }

        // 4. Density
        int dpi = realMetrics.densityDpi;
        String densityCat = getDensityCategory(dpi);
        items.add(new SectionItem("Плотность экрана (DPI)", dpi + " DPI (" + densityCat + ")", densityCat));
        items.add(new SectionItem("Коэффициент масштабирования (Scale)", realMetrics.density + "x"));

        // 5. Refresh rate & Modes
        float refreshRate = display.getRefreshRate();
        items.add(new SectionItem("Частота обновления экрана", String.format(Locale.US, "%.1f Гц", refreshRate)));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Display.Mode[] modes = display.getSupportedModes();
            if (modes != null && modes.length > 0) {
                StringBuilder sb = new StringBuilder();
                for (Display.Mode m : modes) {
                    if (sb.length() > 0) sb.append(", ");
                    sb.append(m.getPhysicalWidth()).append("x").append(m.getPhysicalHeight()).append("@").append(Math.round(m.getRefreshRate())).append("Hz");
                }
                items.add(new SectionItem("Поддерживаемые режимы экрана", sb.toString()));
            }
        }

        // 6. Orientation
        int rotation = display.getRotation();
        String rotStr;
        switch (rotation) {
            case Surface.ROTATION_0: rotStr = "0° (Портретная)"; break;
            case Surface.ROTATION_90: rotStr = "90° (Альбомная)"; break;
            case Surface.ROTATION_180: rotStr = "180° (Обратная портретная)"; break;
            case Surface.ROTATION_270: rotStr = "270° (Обратная альбомная)"; break;
            default: rotStr = "Неизвестно"; break;
        }
        items.add(new SectionItem("Ориентация дисплея", rotStr));

        // 7. HDR & Wide Color Gamut
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            boolean isWide = display.isWideColorGamut();
            items.add(new SectionItem("Широкий цветовой охват (Wide Color Gamut)", isWide ? "Поддерживается (DCI-P3 / BT.2020)" : "Не поддерживается (sRGB)", isWide ? "True" : "False"));
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            Display.HdrCapabilities hdr = display.getHdrCapabilities();
            if (hdr != null) {
                int[] types = hdr.getSupportedHdrTypes();
                if (types != null && types.length > 0) {
                    List<String> hdrList = new ArrayList<>();
                    for (int t : types) {
                        switch (t) {
                            case Display.HdrCapabilities.HDR_TYPE_DOLBY_VISION: hdrList.add("Dolby Vision"); break;
                            case Display.HdrCapabilities.HDR_TYPE_HDR10: hdrList.add("HDR10"); break;
                            case Display.HdrCapabilities.HDR_TYPE_HLG: hdrList.add("HLG"); break;
                            case 4: hdrList.add("HDR10+"); break;
                            default: hdrList.add("HDR Type " + t); break;
                        }
                    }
                    items.add(new SectionItem("Поддержка HDR контента", String.join(", ", hdrList), "HDR"));
                } else {
                    items.add(new SectionItem("Поддержка HDR контента", "SDR (Стандартный динамический диапазон)"));
                }
            }
        }

        // 8. GPU & OpenGL
        ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (am != null) {
            ConfigurationInfo info = am.getDeviceConfigurationInfo();
            if (info != null) {
                items.add(new SectionItem("Версия OpenGL ES", info.getGlEsVersion()));
            }
        }

        String gpuVendor = ReflectionUtils.getSystemProperty("ro.hardware.egl", "");
        if (gpuVendor.isEmpty()) {
            gpuVendor = ReflectionUtils.getSystemProperty("ro.hardware.vulkan", "");
        }
        if (!gpuVendor.isEmpty()) {
            items.add(new SectionItem("Драйвер графического ускорения", gpuVendor));
        }

        return items;
    }

    private static String getDensityCategory(int dpi) {
        if (dpi <= 120) return "ldpi";
        if (dpi <= 160) return "mdpi";
        if (dpi <= 240) return "hdpi";
        if (dpi <= 320) return "xhdpi";
        if (dpi <= 480) return "xxhdpi";
        if (dpi <= 640) return "xxxhdpi";
        return "ultra-high-dpi";
    }
}
