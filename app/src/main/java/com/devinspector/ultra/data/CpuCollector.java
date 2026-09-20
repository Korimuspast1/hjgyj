package com.devinspector.ultra.data;

import android.os.Build;
import android.os.Process;

import com.devinspector.ultra.util.FormatUtils;
import com.devinspector.ultra.util.ReflectionUtils;
import com.devinspector.ultra.util.ShellUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class CpuCollector {

    public static List<SectionItem> collect(String freqUnit) {
        List<SectionItem> items = new ArrayList<>();

        int cores = Runtime.getRuntime().availableProcessors();
        String hardware = Build.HARDWARE;
        String socModel = ReflectionUtils.getSystemProperty("ro.soc.model", "");
        if (socModel.isEmpty()) {
            socModel = ReflectionUtils.getSystemProperty("ro.board.platform", hardware);
        }

        items.add(new SectionItem("Процессор / SoC", socModel, Build.BOARD));
        items.add(new SectionItem("Архитектура ядер", System.getProperty("os.arch", "Unknown"), Process.is64Bit() ? "64-bit" : "32-bit"));
        items.add(new SectionItem("Основной ABI", Build.SUPPORTED_ABIS[0]));

        StringBuilder abis = new StringBuilder();
        for (String a : Build.SUPPORTED_ABIS) {
            if (abis.length() > 0) abis.append(", ");
            abis.append(a);
        }
        items.add(new SectionItem("Все поддерживаемые ABI", abis.toString()));
        items.add(new SectionItem("Количество активных ядер", cores + " Cores"));

        // Per-core frequencies
        for (int i = 0; i < cores; i++) {
            String curPath = "/sys/devices/system/cpu/cpu" + i + "/cpufreq/scaling_cur_freq";
            String minPath = "/sys/devices/system/cpu/cpu" + i + "/cpufreq/scaling_min_freq";
            String maxPath = "/sys/devices/system/cpu/cpu" + i + "/cpufreq/scaling_max_freq";
            String govPath = "/sys/devices/system/cpu/cpu" + i + "/cpufreq/scaling_governor";

            String curStr = ShellUtils.readFile(curPath);
            if (curStr == null) {
                curStr = ShellUtils.readFile("/sys/devices/system/cpu/cpu" + i + "/cpufreq/cpuinfo_cur_freq");
            }
            String minStr = ShellUtils.readFile(minPath);
            String maxStr = ShellUtils.readFile(maxPath);
            String gov = ShellUtils.readFile(govPath);

            int cur = parseInt(curStr, 0);
            int min = parseInt(minStr, 0);
            int max = parseInt(maxStr, 0);

            int percent = 0;
            if (max > min && cur >= min) {
                percent = (int) (((long) (cur - min) * 100) / (max - min));
            } else if (cur > 0 && max > 0) {
                percent = (int) (((long) cur * 100) / max);
            }
            if (percent > 100) percent = 100;

            String label = "Ядро #" + i;
            String val;
            if (cur > 0) {
                val = FormatUtils.formatFrequency(cur, freqUnit);
                if (max > 0) {
                    val += " (мин: " + FormatUtils.formatFrequency(min, freqUnit) + ", макс: " + FormatUtils.formatFrequency(max, freqUnit) + ")";
                }
            } else {
                val = "Спящий режим (Offline/Deep Sleep)";
            }

            String badge = (gov != null && !gov.isEmpty()) ? gov : (cur > 0 ? "Active" : "Sleep");
            items.add(new SectionItem(label, val, badge, cur > 0 ? percent : -1, false, true));
        }

        // Governor of core 0
        String globalGov = ShellUtils.readFile("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor");
        if (globalGov != null && !globalGov.isEmpty()) {
            items.add(new SectionItem("CPU Governor", globalGov));
        }

        // Parse /proc/cpuinfo
        Map<String, String> cpuInfo = parseCpuInfo();
        if (cpuInfo.containsKey("Processor")) {
            items.add(new SectionItem("CPU Name (proc)", cpuInfo.get("Processor")));
        }
        if (cpuInfo.containsKey("Features")) {
            items.add(new SectionItem("Инструкции (Features)", cpuInfo.get("Features")));
        }
        if (cpuInfo.containsKey("CPU implementer")) {
            items.add(new SectionItem("CPU Implementer", cpuInfo.get("CPU implementer")));
        }
        if (cpuInfo.containsKey("CPU architecture")) {
            items.add(new SectionItem("Версия архитектуры", cpuInfo.get("CPU architecture")));
        }
        if (cpuInfo.containsKey("CPU variant")) {
            items.add(new SectionItem("CPU Variant", cpuInfo.get("CPU variant")));
        }
        if (cpuInfo.containsKey("CPU part")) {
            items.add(new SectionItem("CPU Part Number", cpuInfo.get("CPU part")));
        }
        if (cpuInfo.containsKey("CPU revision")) {
            items.add(new SectionItem("CPU Revision", cpuInfo.get("CPU revision")));
        }
        if (cpuInfo.containsKey("BogoMIPS")) {
            items.add(new SectionItem("BogoMIPS", cpuInfo.get("BogoMIPS")));
        }

        return items;
    }

    private static int parseInt(String str, int def) {
        if (str == null) return def;
        try {
            return Integer.parseInt(str.trim());
        } catch (Exception e) {
            return def;
        }
    }

    private static Map<String, String> parseCpuInfo() {
        Map<String, String> map = new HashMap<>();
        List<String> lines = ShellUtils.readFileLines("/proc/cpuinfo");
        for (String line : lines) {
            int colon = line.indexOf(':');
            if (colon > 0) {
                String key = line.substring(0, colon).trim();
                String val = line.substring(colon + 1).trim();
                if (!map.containsKey(key)) {
                    map.put(key, val);
                }
            }
        }
        return map;
    }
}
