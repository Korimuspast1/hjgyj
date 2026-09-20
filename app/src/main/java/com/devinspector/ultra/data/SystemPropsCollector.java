package com.devinspector.ultra.data;

import com.devinspector.ultra.util.ShellUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

public class SystemPropsCollector {

    public static class PropEntry {
        public final String key;
        public final String value;

        public PropEntry(String key, String value) {
            this.key = key;
            this.value = value;
        }
    }

    private static List<PropEntry> cachedProps = null;

    public static synchronized List<PropEntry> getAllProps(boolean forceRefresh) {
        if (cachedProps != null && !forceRefresh) {
            return cachedProps;
        }

        List<PropEntry> list = new ArrayList<>();
        List<String> lines = ShellUtils.executeCommandLines("getprop");
        for (String line : lines) {
            // Line format: [key]: [value]
            int firstOpen = line.indexOf('[');
            int firstClose = line.indexOf(']');
            if (firstOpen >= 0 && firstClose > firstOpen) {
                String key = line.substring(firstOpen + 1, firstClose).trim();
                int secondOpen = line.indexOf('[', firstClose + 1);
                int secondClose = line.lastIndexOf(']');
                String val = "";
                if (secondOpen >= 0 && secondClose > secondOpen) {
                    val = line.substring(secondOpen + 1, secondClose).trim();
                }
                list.add(new PropEntry(key, val));
            }
        }

        // Fallback if getprop command returned empty
        if (list.isEmpty()) {
            String[] common = {
                    "ro.build.version.release", "ro.build.version.sdk", "ro.product.model",
                    "ro.product.brand", "ro.product.manufacturer", "ro.board.platform",
                    "ro.boot.verifiedbootstate", "ro.boot.flash.locked", "ro.crypto.state",
                    "ro.debuggable", "ro.secure"
            };
            for (String k : common) {
                String v = ShellUtils.executeCommand("getprop " + k);
                if (v != null && !v.isEmpty()) {
                    list.add(new PropEntry(k, v));
                }
            }
        }

        list.sort(Comparator.comparing(a -> a.key));
        cachedProps = list;
        return list;
    }

    public static List<SectionItem> filter(String query, String category) {
        List<PropEntry> all = getAllProps(false);
        List<SectionItem> results = new ArrayList<>();

        String qLower = query != null ? query.toLowerCase().trim() : "";

        for (PropEntry p : all) {
            // Category check
            if (category != null && !category.isEmpty() && !"Все".equals(category)) {
                if ("Android".equals(category) && !(p.key.startsWith("ro.build.") || p.key.startsWith("ro.product."))) {
                    continue;
                } else if ("Загрузка".equals(category) && !p.key.startsWith("ro.boot")) {
                    continue;
                } else if ("Вендор".equals(category) && !(p.key.contains("vendor") || p.key.startsWith("ro.hardware") || p.key.startsWith("ro.soc"))) {
                    continue;
                } else if ("Безопасность".equals(category) && !(p.key.contains("sec") || p.key.contains("crypto") || p.key.contains("debug"))) {
                    continue;
                } else if ("Сеть".equals(category) && !(p.key.startsWith("net.") || p.key.startsWith("gsm.") || p.key.startsWith("telephony.") || p.key.startsWith("ril."))) {
                    continue;
                }
            }

            // Query check
            if (!qLower.isEmpty()) {
                if (!p.key.toLowerCase().contains(qLower) && !p.value.toLowerCase().contains(qLower)) {
                    continue;
                }
            }

            results.add(new SectionItem(p.key, p.value, "getprop", -1, false, true));
        }

        return results;
    }
}
