package com.devinspector.ultra.data;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.WindowManager;

import com.devinspector.ultra.util.FormatUtils;
import com.devinspector.ultra.util.ReflectionUtils;
import com.devinspector.ultra.util.ShellUtils;

import java.util.ArrayList;
import java.util.List;

public class OverviewCollector {

    public static List<SectionItem> collect(Context context) {
        List<SectionItem> items = new ArrayList<>();

        // 1. Device identity
        String manufacturer = Build.MANUFACTURER;
        String model = Build.MODEL;
        String brand = Build.BRAND;
        String device = Build.DEVICE;
        String product = Build.PRODUCT;
        items.add(new SectionItem("Устройство", manufacturer + " " + model, brand));
        items.add(new SectionItem("Кодовое имя (Board / Device)", Build.BOARD + " / " + device));

        // 2. Processor
        String hardware = Build.HARDWARE;
        String socModel = ReflectionUtils.getSystemProperty("ro.soc.model", "");
        if (socModel.isEmpty()) {
            socModel = ReflectionUtils.getSystemProperty("ro.board.platform", hardware);
        }
        int cores = Runtime.getRuntime().availableProcessors();
        items.add(new SectionItem("Процессор / Платформа", socModel + " (" + cores + " ядер)", Build.SUPPORTED_ABIS[0]));

        // 3. Android Version
        String release = Build.VERSION.RELEASE;
        int sdk = Build.VERSION.SDK_INT;
        String securityPatch = "";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            securityPatch = Build.VERSION.SECURITY_PATCH;
        }
        items.add(new SectionItem("Версия Android", "Android " + release + " (API " + sdk + ")", "Патч: " + (securityPatch.isEmpty() ? "N/A" : securityPatch)));

        // 4. Memory (RAM)
        ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        if (am != null) {
            am.getMemoryInfo(mi);
            long totalRam = mi.totalMem;
            long freeRam = mi.availMem;
            long usedRam = totalRam - freeRam;
            int ramPercent = totalRam > 0 ? (int) ((usedRam * 100) / totalRam) : 0;
            String ramStr = FormatUtils.formatBytes(usedRam) + " / " + FormatUtils.formatBytes(totalRam) + " (" + ramPercent + "%)";
            items.add(new SectionItem("Оперативная память (RAM)", ramStr, ramPercent));
        }

        // 5. Storage (Internal)
        try {
            StatFs stat = new StatFs(Environment.getDataDirectory().getPath());
            long blockSize = stat.getBlockSizeLong();
            long totalBlocks = stat.getBlockCountLong();
            long availBlocks = stat.getAvailableBlocksLong();
            long totalSpace = totalBlocks * blockSize;
            long freeSpace = availBlocks * blockSize;
            long usedSpace = totalSpace - freeSpace;
            int storagePercent = totalSpace > 0 ? (int) ((usedSpace * 100) / totalSpace) : 0;
            String storageStr = FormatUtils.formatBytes(usedSpace) + " / " + FormatUtils.formatBytes(totalSpace) + " (" + storagePercent + "%)";
            items.add(new SectionItem("Внутренний накопитель (Flash)", storageStr, storagePercent));
        } catch (Exception ignored) {
        }

        // 6. Battery
        try {
            Intent batteryIntent = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (batteryIntent != null) {
                int level = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                int scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                int status = batteryIntent.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                int pct = (level >= 0 && scale > 0) ? (level * 100 / scale) : 0;

                String statusStr = "Разряжается";
                if (status == BatteryManager.BATTERY_STATUS_CHARGING) {
                    statusStr = "Заряжается";
                } else if (status == BatteryManager.BATTERY_STATUS_FULL) {
                    statusStr = "Заряжен 100%";
                }
                items.add(new SectionItem("Батарея", pct + "% (" + statusStr + ")", pct));
            }
        } catch (Exception ignored) {
        }

        // 7. Display
        WindowManager wm = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        if (wm != null) {
            Display display = wm.getDefaultDisplay();
            DisplayMetrics dm = new DisplayMetrics();
            display.getRealMetrics(dm);
            float refreshRate = display.getRefreshRate();
            items.add(new SectionItem("Экран", dm.widthPixels + " x " + dm.heightPixels + " px @ " + Math.round(refreshRate) + " Гц", dm.densityDpi + " DPI"));
        }

        // 8. Root & SELinux status
        boolean isRooted = checkRootStatus();
        String selinux = getSELinuxStatus();
        items.add(new SectionItem("Статус Root-прав", isRooted ? "ОБНАРУЖЕН ROOT (SuperSU / Magisk / su)" : "Официальная прошивка (No Root)", isRooted ? "Внимание" : "Безопасно"));
        items.add(new SectionItem("Режим SELinux", selinux, "Enforcing".equalsIgnoreCase(selinux) ? "Защищен" : "Ослаблен"));

        // 9. Uptime
        long uptime = SystemClock.elapsedRealtime();
        items.add(new SectionItem("Время работы (Uptime)", FormatUtils.formatUptime(uptime)));

        return items;
    }

    private static boolean checkRootStatus() {
        String[] paths = {
            "/system/bin/su", "/system/xbin/su", "/sbin/su",
            "/vendor/bin/su", "/data/local/bin/su", "/data/local/xbin/su",
            "/system/sd/xbin/su", "/system/bin/failsafe/su", "/data/local/su"
        };
        for (String p : paths) {
            if (ShellUtils.fileExists(p)) return true;
        }
        String tags = Build.TAGS;
        if (tags != null && tags.contains("test-keys")) return true;
        return false;
    }

    private static String getSELinuxStatus() {
        String out = ShellUtils.executeCommand("getenforce");
        if (out != null && !out.isEmpty()) return out;
        String val = ShellUtils.readFile("/sys/fs/selinux/enforce");
        if ("1".equals(val)) return "Enforcing";
        if ("0".equals(val)) return "Permissive";
        return "Unknown";
    }
}
