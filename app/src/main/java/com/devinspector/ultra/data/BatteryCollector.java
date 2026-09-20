package com.devinspector.ultra.data;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Build;

import com.devinspector.ultra.util.FormatUtils;
import com.devinspector.ultra.util.ReflectionUtils;
import com.devinspector.ultra.util.ShellUtils;

import java.util.ArrayList;
import java.util.List;

public class BatteryCollector {

    public static List<SectionItem> collect(Context context, String tempUnit) {
        List<SectionItem> items = new ArrayList<>();

        Intent intent = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (intent == null) {
            items.add(new SectionItem("Статус", "Не удалось прочитать данные батареи"));
            return items;
        }

        // 1. Level & Status
        int level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
        int status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        int pct = (level >= 0 && scale > 0) ? (level * 100 / scale) : 0;

        String statusStr;
        switch (status) {
            case BatteryManager.BATTERY_STATUS_CHARGING:
                statusStr = "Заряжается";
                break;
            case BatteryManager.BATTERY_STATUS_DISCHARGING:
                statusStr = "Разряжается";
                break;
            case BatteryManager.BATTERY_STATUS_FULL:
                statusStr = "Полный заряд (100%)";
                break;
            case BatteryManager.BATTERY_STATUS_NOT_CHARGING:
                statusStr = "Не заряжается (Подключено)";
                break;
            default:
                statusStr = "Неизвестно";
                break;
        }
        items.add(new SectionItem("Уровень заряда", pct + "%", pct));
        items.add(new SectionItem("Текущее состояние", statusStr));

        // 2. Power source
        int plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1);
        String sourceStr;
        switch (plugged) {
            case BatteryManager.BATTERY_PLUGGED_AC:
                sourceStr = "Сетевое ЗУ (Сеть 220V / AC)";
                break;
            case BatteryManager.BATTERY_PLUGGED_USB:
                sourceStr = "USB порт (ПК / Ноутбук)";
                break;
            case BatteryManager.BATTERY_PLUGGED_WIRELESS:
                sourceStr = "Беспроводная зарядка (Qi Wireless)";
                break;
            default:
                sourceStr = "Работает от аккумулятора (Не подключен)";
                break;
        }
        items.add(new SectionItem("Источник питания", sourceStr));

        // 3. Health
        int health = intent.getIntExtra(BatteryManager.EXTRA_HEALTH, -1);
        String healthStr;
        switch (health) {
            case BatteryManager.BATTERY_HEALTH_GOOD:
                healthStr = "Отличное (Good)";
                break;
            case BatteryManager.BATTERY_HEALTH_OVERHEAT:
                healthStr = "Перегрев (Overheat)";
                break;
            case BatteryManager.BATTERY_HEALTH_DEAD:
                healthStr = "Неисправен (Dead)";
                break;
            case BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE:
                healthStr = "Перенапряжение (Over Voltage)";
                break;
            case BatteryManager.BATTERY_HEALTH_COLD:
                healthStr = "Переохлаждение (Cold)";
                break;
            default:
                healthStr = "Нормальное";
                break;
        }
        items.add(new SectionItem("Состояние здоровья батареи", healthStr, health == BatteryManager.BATTERY_HEALTH_GOOD ? "OK" : "Warn"));

        // 4. Temperature
        int tempTenths = intent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1);
        float tempC = tempTenths > 0 ? (tempTenths / 10.0f) : -1.0f;
        if (tempC < 0) {
            String sysTemp = ShellUtils.readFile("/sys/class/power_supply/battery/temp");
            if (sysTemp != null) {
                try {
                    tempC = Float.parseFloat(sysTemp.trim()) / 10.0f;
                } catch (Exception ignored) {
                }
            }
        }
        if (tempC > 0) {
            items.add(new SectionItem("Температура аккумулятора", FormatUtils.formatTemperature(tempC, tempUnit)));
        }

        // 5. Voltage
        int voltageMv = intent.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1);
        if (voltageMv <= 0) {
            String sysVolt = ShellUtils.readFile("/sys/class/power_supply/battery/voltage_now");
            if (sysVolt != null) {
                try {
                    int v = Integer.parseInt(sysVolt.trim());
                    voltageMv = v > 100000 ? v / 1000 : v;
                } catch (Exception ignored) {
                }
            }
        }
        if (voltageMv > 0) {
            float volts = voltageMv / 1000.0f;
            items.add(new SectionItem("Напряжение", voltageMv + " mV (" + String.format("%.2f", volts) + " V)"));
        }

        // 6. Technology
        String tech = intent.getStringExtra(BatteryManager.EXTRA_TECHNOLOGY);
        if (tech == null || tech.isEmpty()) {
            tech = ShellUtils.readFile("/sys/class/power_supply/battery/technology");
        }
        items.add(new SectionItem("Технология ячеек", FormatUtils.fallback(tech, "Li-ion")));

        // 7. Capacity (mAh)
        double cap = ReflectionUtils.getBatteryCapacityMah(context);
        if (cap <= 0) {
            String capStr = ShellUtils.readFile("/sys/class/power_supply/battery/charge_full_design");
            if (capStr == null) {
                capStr = ShellUtils.readFile("/sys/class/power_supply/battery/charge_full");
            }
            if (capStr != null) {
                try {
                    long c = Long.parseLong(capStr.trim());
                    cap = c > 100000 ? (c / 1000.0) : c;
                } catch (Exception ignored) {
                }
            }
        }
        if (cap > 0) {
            items.add(new SectionItem("Номинальная ёмкость (Design Capacity)", Math.round(cap) + " mAh"));
        }

        // 8. Real-time Current (mA)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            BatteryManager bm = (BatteryManager) context.getSystemService(Context.BATTERY_SERVICE);
            if (bm != null) {
                long currentNowUa = bm.getLongProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW);
                if (currentNowUa != Long.MIN_VALUE && currentNowUa != 0) {
                    long curMa = currentNowUa / 1000;
                    items.add(new SectionItem("Мгновенный ток (Amperage)", curMa + " mA"));
                }
                long chargeCounter = bm.getLongProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER);
                if (chargeCounter > 0) {
                    items.add(new SectionItem("Счётчик накопленного заряда", (chargeCounter / 1000) + " mAh"));
                }
            }
        }

        return items;
    }
}
