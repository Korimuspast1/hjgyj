package com.devinspector.ultra.data;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Environment;
import android.os.StatFs;

import com.devinspector.ultra.util.FormatUtils;
import com.devinspector.ultra.util.ShellUtils;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MemoryCollector {

    public static List<SectionItem> collect(Context context) {
        List<SectionItem> items = new ArrayList<>();

        // 1. RAM via ActivityManager
        ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (am != null) {
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            am.getMemoryInfo(mi);

            long total = mi.totalMem;
            long free = mi.availMem;
            long used = total - free;
            int pct = total > 0 ? (int) ((used * 100) / total) : 0;

            items.add(new SectionItem("Общая оперативная память", FormatUtils.formatBytes(total)));
            items.add(new SectionItem("Занято RAM", FormatUtils.formatBytes(used) + " (" + pct + "%)", pct));
            items.add(new SectionItem("Свободно RAM", FormatUtils.formatBytes(free)));
            items.add(new SectionItem("Порог Low-Memory Killer", FormatUtils.formatBytes(mi.threshold)));
            items.add(new SectionItem("Состояние нехватки памяти", mi.lowMemory ? "КРИТИЧЕСКИ МАЛО ПАМЯТИ" : "Штатное (Достаточно)", mi.lowMemory ? "Danger" : "OK"));

            // Memory class
            int memClass = am.getMemoryClass();
            int largeMemClass = am.getLargeMemoryClass();
            items.add(new SectionItem("Лимит кучи приложения (Heap)", memClass + " MB (Large: " + largeMemClass + " MB)"));
        }

        // 2. Deep /proc/meminfo
        Map<String, Long> meminfo = parseMemInfo();
        if (meminfo.containsKey("MemAvailable")) {
            items.add(new SectionItem("Доступно системе (MemAvailable)", FormatUtils.formatBytes(meminfo.get("MemAvailable") * 1024)));
        }
        if (meminfo.containsKey("Buffers")) {
            items.add(new SectionItem("Буферы ввода-вывода (Buffers)", FormatUtils.formatBytes(meminfo.get("Buffers") * 1024)));
        }
        if (meminfo.containsKey("Cached")) {
            items.add(new SectionItem("Файловый кэш (Cached)", FormatUtils.formatBytes(meminfo.get("Cached") * 1024)));
        }
        if (meminfo.containsKey("SwapTotal") && meminfo.get("SwapTotal") > 0) {
            long swapTot = meminfo.get("SwapTotal") * 1024;
            long swapFree = (meminfo.containsKey("SwapFree") ? meminfo.get("SwapFree") : 0) * 1024;
            long swapUsed = swapTot - swapFree;
            int swapPct = (int) ((swapUsed * 100) / swapTot);
            items.add(new SectionItem("ZRAM / Своп файл (Общий)", FormatUtils.formatBytes(swapTot)));
            items.add(new SectionItem("ZRAM Занято", FormatUtils.formatBytes(swapUsed) + " (" + swapPct + "%)", swapPct));
            items.add(new SectionItem("ZRAM Свободно", FormatUtils.formatBytes(swapFree)));
        }
        if (meminfo.containsKey("Active")) {
            items.add(new SectionItem("Активная память (Active)", FormatUtils.formatBytes(meminfo.get("Active") * 1024)));
        }
        if (meminfo.containsKey("Inactive")) {
            items.add(new SectionItem("Неактивная память (Inactive)", FormatUtils.formatBytes(meminfo.get("Inactive") * 1024)));
        }
        if (meminfo.containsKey("Dirty")) {
            items.add(new SectionItem("Грязные страницы (Dirty)", FormatUtils.formatBytes(meminfo.get("Dirty") * 1024)));
        }

        // 3. Storage
        addPartitionStats(items, "Внутренний накопитель (/data)", Environment.getDataDirectory());
        addPartitionStats(items, "Системный раздел (/system)", Environment.getRootDirectory());

        File ext = Environment.getExternalStorageDirectory();
        if (ext != null && ext.exists()) {
            addPartitionStats(items, "Внешнее хранилище (/sdcard)", ext);
        }

        return items;
    }

    private static void addPartitionStats(List<SectionItem> items, String title, File dir) {
        try {
            StatFs stat = new StatFs(dir.getPath());
            long blockSize = stat.getBlockSizeLong();
            long total = stat.getBlockCountLong() * blockSize;
            long free = stat.getAvailableBlocksLong() * blockSize;
            long used = total - free;
            int pct = total > 0 ? (int) ((used * 100) / total) : 0;

            String val = FormatUtils.formatBytes(used) + " / " + FormatUtils.formatBytes(total) + " (" + pct + "%)";
            items.add(new SectionItem(title, val, pct));
            items.add(new SectionItem(title + " [Свободно]", FormatUtils.formatBytes(free)));
        } catch (Exception ignored) {
        }
    }

    private static Map<String, Long> parseMemInfo() {
        Map<String, Long> map = new HashMap<>();
        List<String> lines = ShellUtils.readFileLines("/proc/meminfo");
        for (String line : lines) {
            String[] parts = line.split(":");
            if (parts.length >= 2) {
                String key = parts[0].trim();
                String valStr = parts[1].trim().replace("kB", "").trim();
                try {
                    map.put(key, Long.parseLong(valStr));
                } catch (Exception ignored) {
                }
            }
        }
        return map;
    }
}
