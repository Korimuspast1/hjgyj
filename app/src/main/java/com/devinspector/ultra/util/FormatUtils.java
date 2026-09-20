package com.devinspector.ultra.util;

import java.util.Locale;

public class FormatUtils {

    public static String formatBytes(long bytes) {
        if (bytes <= 0) return "0 B";
        final String[] units = new String[]{"B", "KB", "MB", "GB", "TB"};
        int digitGroups = (int) (Math.log10(bytes) / Math.log10(1024));
        if (digitGroups >= units.length) digitGroups = units.length - 1;
        return String.format(Locale.US, "%.2f %s", bytes / Math.pow(1024, digitGroups), units[digitGroups]);
    }

    public static String formatBytesRounded(long bytes) {
        if (bytes <= 0) return "0 MB";
        double mb = bytes / (1024.0 * 1024.0);
        if (mb >= 1000) {
            return String.format(Locale.US, "%.1f GB", mb / 1024.0);
        }
        return String.format(Locale.US, "%.0f MB", mb);
    }

    public static String formatFrequency(int khz, String unit) {
        if (khz <= 0) return "0 MHz";
        if ("GHz".equalsIgnoreCase(unit)) {
            return String.format(Locale.US, "%.2f GHz", khz / 1000000.0);
        }
        return String.format(Locale.US, "%d MHz", khz / 1000);
    }

    public static String formatTemperature(float celsius, String unit) {
        if ("F".equalsIgnoreCase(unit)) {
            float f = (celsius * 9.0f / 5.0f) + 32.0f;
            return String.format(Locale.US, "%.1f °F", f);
        }
        return String.format(Locale.US, "%.1f °C", celsius);
    }

    public static String formatUptime(long uptimeMillis) {
        long seconds = uptimeMillis / 1000;
        long s = seconds % 60;
        long m = (seconds / 60) % 60;
        long h = (seconds / (60 * 60)) % 24;
        long d = seconds / (60 * 60 * 24);

        if (d > 0) {
            return String.format(Locale.US, "%dд %02dч %02dм %02dс", d, h, m, s);
        }
        return String.format(Locale.US, "%02dч %02dм %02dс", h, m, s);
    }

    public static String fallback(String val, String def) {
        if (val == null || val.trim().isEmpty() || "unknown".equalsIgnoreCase(val.trim())) {
            return def;
        }
        return val.trim();
    }
}
