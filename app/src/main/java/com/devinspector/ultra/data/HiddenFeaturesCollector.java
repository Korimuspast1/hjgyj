package com.devinspector.ultra.data;

import android.content.Context;
import android.content.pm.FeatureInfo;
import android.content.pm.PackageManager;
import android.os.Build;

import com.devinspector.ultra.util.FormatUtils;
import com.devinspector.ultra.util.ReflectionUtils;
import com.devinspector.ultra.util.ShellUtils;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class HiddenFeaturesCollector {

    public static List<SectionItem> collect(Context context) {
        List<SectionItem> items = new ArrayList<>();

        // 1. Kernel Boot Command Line (/proc/cmdline)
        String cmdline = ShellUtils.readFile("/proc/cmdline");
        if (cmdline != null && !cmdline.isEmpty()) {
            items.add(new SectionItem("Kernel Boot Commandline", cmdline, "Raw Cmdline", -1, true, true));

            // Parse key parameters from cmdline
            String[] tokens = cmdline.split("\\s+");
            StringBuilder bootParams = new StringBuilder();
            for (String t : tokens) {
                if (t.startsWith("androidboot.") || t.startsWith("bootmode=") || t.startsWith("firmware_class.") || t.startsWith("printk.")) {
                    if (bootParams.length() > 0) bootParams.append("\n");
                    bootParams.append("• ").append(t);
                }
            }
            if (bootParams.length() > 0) {
                items.add(new SectionItem("Скрытые флаги загрузчика (Bootloader Flags)", bootParams.toString(), "Secret", -1, true, true));
            }
        } else {
            items.add(new SectionItem("Kernel Boot Commandline", "Ограничено SELinux на уровне ядра (доступно на Engineering/Root ядрах)", "SELinux", -1, true, false));
        }

        // 2. Secret & Undocumented System Properties
        addSecretProp(items, "Статус Verified Boot (AVB)", "ro.boot.verifiedbootstate", "AVB");
        addSecretProp(items, "Блокировка Flash-памяти", "ro.boot.flash.locked", "Bootloader");
        addSecretProp(items, "Состояние VBMeta", "ro.boot.vbmeta.device_state", "VBMeta");
        addSecretProp(items, "Активный слот A/B обновлений", "ro.boot.slot_suffix", "Partition");
        addSecretProp(items, "Режим загрузки устройства", "ro.bootmode", "Mode");
        addSecretProp(items, "Аппаратный SKU чипсета", "ro.boot.hardware.sku", "HW SKU");
        addSecretProp(items, "Ревизия кремния (Hardware Rev)", "ro.boot.hardware.revision", "HW Rev");
        addSecretProp(items, "Knox / Warranty Bit (Samsung)", "ro.boot.warranty_bit", "Knox");
        addSecretProp(items, "Статус отладки ядра (Debuggable)", "ro.debuggable", "Security");
        addSecretProp(items, "Безопасный режим (ro.secure)", "ro.secure", "Security");
        addSecretProp(items, "Авторизация ADB по ключам", "ro.adb.secure", "ADB");
        addSecretProp(items, "Шифрование данных пользователя", "ro.crypto.state", "Encryption");
        addSecretProp(items, "Тип алгоритма шифрования", "ro.crypto.type", "Encryption");
        addSecretProp(items, "Поддержка Project Treble", "ro.treble.enabled", "Treble");
        addSecretProp(items, "Бесшовные обновления (A/B updates)", "ro.build.ab_update", "Updates");
        addSecretProp(items, "Модульная система APEX", "ro.apex.updatable", "Apex");
        addSecretProp(items, "Разрешена разблокировка OEM", "ro.oem_unlock_supported", "OEM");
        addSecretProp(items, "Региональный код прошивки (CSC/Region)", "ro.csc.country_code", "Region");
        addSecretProp(items, "Внутренняя модификация устройства", "ro.product.mod_device", "OEM Mod");

        // 3. Registered System Binder Services (Reflection)
        String[] services = ReflectionUtils.getRegisteredServices();
        if (services != null && services.length > 0) {
            Arrays.sort(services);
            items.add(new SectionItem("Зарегистрированные системные IPC службы", services.length + " фоновых служб (Services)", "Binder", -1, true, false));

            List<String> vendorServices = new ArrayList<>();
            for (String s : services) {
                // Find vendor-specific or obscure services
                if (s.contains("sec") || s.contains("samsung") || s.contains("miui") || s.contains("xiaomi")
                        || s.contains("qcom") || s.contains("qti") || s.contains("mtk") || s.contains("oplus")
                        || s.contains("huawei") || s.contains("carrier") || s.contains("diag") || s.contains("factory")
                        || s.contains("engineermode") || s.contains("vendor") || s.contains("sensorhub")) {
                    vendorServices.add(s);
                }
            }
            if (!vendorServices.isEmpty()) {
                StringBuilder vsb = new StringBuilder();
                for (String vs : vendorServices) {
                    if (vsb.length() > 0) vsb.append("\n");
                    vsb.append("⚡ ").append(vs);
                }
                items.add(new SectionItem("Скрытые вендорные сервисы производителя (" + vendorServices.size() + ")", vsb.toString(), "Vendor IPC", -1, true, true));
            }
        }

        // 4. Kernel Cryptographic Subsystem (/proc/crypto)
        List<String> cryptoLines = ShellUtils.readFileLines("/proc/crypto");
        if (!cryptoLines.isEmpty()) {
            List<String> ciphers = new ArrayList<>();
            String curName = null;
            String curDriver = null;
            for (String l : cryptoLines) {
                if (l.startsWith("name")) {
                    curName = l.substring(l.indexOf(':') + 1).trim();
                } else if (l.startsWith("driver")) {
                    curDriver = l.substring(l.indexOf(':') + 1).trim();
                    if (curName != null) {
                        ciphers.add(curName + " (" + curDriver + ")");
                        curName = null;
                    }
                }
            }
            if (!ciphers.isEmpty()) {
                int showCount = Math.min(ciphers.size(), 20);
                StringBuilder csb = new StringBuilder();
                for (int i = 0; i < showCount; i++) {
                    if (csb.length() > 0) csb.append("\n");
                    csb.append("🔒 ").append(ciphers.get(i));
                }
                if (ciphers.size() > showCount) {
                    csb.append("\n... и ещё ").append(ciphers.size() - showCount).append(" аппаратных крипто-модулей");
                }
                items.add(new SectionItem("Аппаратные крипто-движки ядра (Kernel Crypto)", csb.toString(), ciphers.size() + " ciphers", -1, true, true));
            }
        }

        // 5. Undocumented & Vendor Features in PackageManager
        try {
            PackageManager pm = context.getPackageManager();
            FeatureInfo[] features = pm.getSystemAvailableFeatures();
            if (features != null && features.length > 0) {
                List<String> specialFeatures = new ArrayList<>();
                for (FeatureInfo fi : features) {
                    if (fi.name != null && !fi.name.startsWith("android.hardware.screen") && !fi.name.startsWith("android.hardware.faketouch")) {
                        if (fi.name.contains("vendor") || fi.name.contains("oem") || fi.name.contains("miui")
                                || fi.name.contains("google.android.feature") || fi.name.contains("sony")
                                || fi.name.contains("samsung") || fi.name.contains("qualcomm") || fi.name.contains("mediatek")) {
                            specialFeatures.add(fi.name);
                        }
                    }
                }
                if (!specialFeatures.isEmpty()) {
                    StringBuilder fsb = new StringBuilder();
                    for (String sf : specialFeatures) {
                        if (fsb.length() > 0) fsb.append("\n");
                        fsb.append("⚙️ ").append(sf);
                    }
                    items.add(new SectionItem("Скрытые аппаратные фичи вендора (" + specialFeatures.size() + ")", fsb.toString(), "Features", -1, true, true));
                }
            }
        } catch (Exception ignored) {
        }

        // 6. Secret Engineering Codes Directory
        String secretCodes =
                "• *#*#4636#*#* — Меню инженерного тестирования (Testing Menu)\n" +
                "• *#06# — Международный идентификатор IMEI и Serial\n" +
                "• *#*#225#*#* — Диагностика календаря и учетных записей\n" +
                "• *#*#426#*#* — Диагностика Google Play Services (FCM Push)\n" +
                "• *#*#759#*#* — RLZ Debug UI (Google Partner Interface)\n" +
                "• *#0*# — Samsung Hardware Diagnostic Menu\n" +
                "• *#*#6484#*#* — Xiaomi CIT Hardware Test Menu\n" +
                "• *#*#3646633#*#* — MediaTek EngineerMode\n" +
                "• *#899# — Oppo / Realme / OnePlus Engineer Mode\n" +
                "• *#9900# — Samsung SysDump Log & Dumpstate Viewer";
        items.add(new SectionItem("Секретные инженерные коды (Dialer Codes)", secretCodes, "Secret", -1, true, true));

        return items;
    }

    private static void addSecretProp(List<SectionItem> items, String title, String propKey, String badge) {
        String val = ReflectionUtils.getSystemProperty(propKey, "");
        if (val.isEmpty()) {
            val = ShellUtils.executeCommand("getprop " + propKey);
        }
        if (val != null && !val.trim().isEmpty()) {
            items.add(new SectionItem(title + " [" + propKey + "]", val.trim(), badge, -1, true, true));
        }
    }
}
