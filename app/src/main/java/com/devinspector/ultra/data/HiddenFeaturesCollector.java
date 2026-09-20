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
            items.add(new SectionItem("Командная строка загрузки ядра (/proc/cmdline)", cmdline, "Cmdline", -1, true, true));

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
                items.add(new SectionItem("Параметры загрузчика (Bootloader Flags)", bootParams.toString(), "Boot", -1, true, true));
            }
        } else {
            items.add(new SectionItem("Командная строка загрузки ядра", "Доступ ограничен политикой SELinux ядра (требуются права root/eng build)", "SELinux", -1, true, false));
        }

        // 2. Secret & Undocumented System Properties
        addSecretProp(items, "Статус Verified Boot (AVB)", "ro.boot.verifiedbootstate", "AVB");
        addSecretProp(items, "Блокировка загрузчика (Flash Lock)", "ro.boot.flash.locked", "Bootloader");
        addSecretProp(items, "Состояние структуры VBMeta", "ro.boot.vbmeta.device_state", "VBMeta");
        addSecretProp(items, "Активный слот разделов A/B", "ro.boot.slot_suffix", "Partition");
        addSecretProp(items, "Режим загрузки (Boot Mode)", "ro.bootmode", "Mode");
        addSecretProp(items, "Аппаратный SKU чипсета", "ro.boot.hardware.sku", "HW SKU");
        addSecretProp(items, "Ревизия кремния (Hardware Rev)", "ro.boot.hardware.revision", "HW Rev");
        addSecretProp(items, "Warranty Bit / Knox", "ro.boot.warranty_bit", "Knox");
        addSecretProp(items, "Режим отладки ядра (Debuggable)", "ro.debuggable", "Security");
        addSecretProp(items, "Безопасный режим (ro.secure)", "ro.secure", "Security");
        addSecretProp(items, "Авторизация ADB по ключам", "ro.adb.secure", "ADB");
        addSecretProp(items, "Шифрование данных пользователя", "ro.crypto.state", "Encryption");
        addSecretProp(items, "Тип алгоритма шифрования", "ro.crypto.type", "Encryption");
        addSecretProp(items, "Поддержка архитектуры Treble", "ro.treble.enabled", "Treble");
        addSecretProp(items, "Бесшовные обновления (A/B updates)", "ro.build.ab_update", "Updates");
        addSecretProp(items, "Модульная подсистема APEX", "ro.apex.updatable", "Apex");
        addSecretProp(items, "Поддержка разблокировки OEM", "ro.oem_unlock_supported", "OEM");
        addSecretProp(items, "Региональный идентификатор (CSC/Region)", "ro.csc.country_code", "Region");
        addSecretProp(items, "Модификация платформы вендором", "ro.product.mod_device", "OEM Mod");

        // 3. Registered System Binder Services (Reflection)
        String[] services = ReflectionUtils.getRegisteredServices();
        if (services != null && services.length > 0) {
            Arrays.sort(services);
            items.add(new SectionItem("Зарегистрированные системные службы IPC", services.length + " служб (Binder Services)", "Binder", -1, true, false));

            List<String> vendorServices = new ArrayList<>();
            for (String s : services) {
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
                    vsb.append("• ").append(vs);
                }
                items.add(new SectionItem("Вендорные IPC службы (" + vendorServices.size() + ")", vsb.toString(), "Vendor IPC", -1, true, true));
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
                    csb.append("• ").append(ciphers.get(i));
                }
                if (ciphers.size() > showCount) {
                    csb.append("\n... и ещё ").append(ciphers.size() - showCount).append(" крипто-модулей");
                }
                items.add(new SectionItem("Аппаратные крипто-модули ядра (/proc/crypto)", csb.toString(), ciphers.size() + " ciphers", -1, true, true));
            }
        }

        // 5. Vendor Features in PackageManager
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
                        fsb.append("• ").append(sf);
                    }
                    items.add(new SectionItem("Аппаратные компоненты вендора (" + specialFeatures.size() + ")", fsb.toString(), "Features", -1, true, true));
                }
            }
        } catch (Exception ignored) {
        }

        // 6. Engineering Codes Directory
        String secretCodes =
                "• *#*#4636#*#* — Меню инженерного тестирования (Testing Menu)\n" +
                "• *#06# — Идентификатор оборудования (IMEI / Serial)\n" +
                "• *#*#225#*#* — Диагностика календаря и аккаунтов\n" +
                "• *#*#426#*#* — Диагностика сервисов FCM (Google Play Services)\n" +
                "• *#*#759#*#* — Диагностика RLZ (Google Partner Interface)\n" +
                "• *#0*# — Диагностическое меню аппаратных тестов (Samsung)\n" +
                "• *#*#6484#*#* — Инженерное меню CIT (Xiaomi / Poco / Redmi)\n" +
                "• *#*#3646633#*#* — Инженерный режим EngineerMode (MediaTek)\n" +
                "• *#899# — Инженерный режим EngineerMode (Oppo / Realme / OnePlus)\n" +
                "• *#9900# — Системный дамп логов SysDump (Samsung)";
        items.add(new SectionItem("Инженерные сервисные коды", secretCodes, "Codes", -1, true, true));

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
