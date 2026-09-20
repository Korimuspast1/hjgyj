package com.devinspector.ultra.data;

import android.content.Context;
import android.os.Build;
import android.os.PowerManager;

import com.devinspector.ultra.util.FormatUtils;
import com.devinspector.ultra.util.ShellUtils;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class ThermalCollector {

    public static List<SectionItem> collect(Context context, String tempUnit) {
        List<SectionItem> items = new ArrayList<>();

        // 1. Android Thermal Throttling API (API 29+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                int status = pm.getCurrentThermalStatus();
                String statusStr;
                String badge;
                switch (status) {
                    case PowerManager.THERMAL_STATUS_NONE:
                        statusStr = "Нормальная (Без троттлинга)";
                        badge = "OK";
                        break;
                    case PowerManager.THERMAL_STATUS_LIGHT:
                        statusStr = "Легкий нагрев (Минимальное ограничение)";
                        badge = "Light";
                        break;
                    case PowerManager.THERMAL_STATUS_MODERATE:
                        statusStr = "Умеренный троттлинг (Снижение частот)";
                        badge = "Warn";
                        break;
                    case PowerManager.THERMAL_STATUS_SEVERE:
                        statusStr = "Сильный троттлинг (Агрессивное охлаждение)";
                        badge = "Hot";
                        break;
                    case PowerManager.THERMAL_STATUS_CRITICAL:
                        statusStr = "Критический перегрев!";
                        badge = "Danger";
                        break;
                    case PowerManager.THERMAL_STATUS_EMERGENCY:
                        statusStr = "Аварийное состояние!";
                        badge = "Danger";
                        break;
                    case PowerManager.THERMAL_STATUS_SHUTDOWN:
                        statusStr = "Угроза отключения от перегрева!";
                        badge = "Critical";
                        break;
                    default:
                        statusStr = "Не определено";
                        badge = "Unknown";
                        break;
                }
                items.add(new SectionItem("Статус троттлинга системы", statusStr, badge));
            }
        }

        // 2. Scan /sys/class/thermal/thermal_zone*
        File thermalDir = new File("/sys/class/thermal");
        File[] zones = thermalDir.listFiles((dir, name) -> name.startsWith("thermal_zone"));
        if (zones != null && zones.length > 0) {
            for (File z : zones) {
                String type = ShellUtils.readFile(new File(z, "type").getAbsolutePath());
                String tempStr = ShellUtils.readFile(new File(z, "temp").getAbsolutePath());
                if (type != null && tempStr != null) {
                    try {
                        long raw = Long.parseLong(tempStr.trim());
                        float c = raw > 1000 ? raw / 1000.0f : (raw > 200 ? raw / 10.0f : raw);
                        if (c > -30 && c < 150) {
                            String formatted = FormatUtils.formatTemperature(c, tempUnit);
                            String badge = c > 70 ? "Горячо" : (c > 50 ? "Тепло" : "Норма");
                            items.add(new SectionItem(type + " (" + z.getName() + ")", formatted, badge));
                        }
                    } catch (Exception ignored) {
                    }
                }
            }
        } else {
            items.add(new SectionItem("Термальные зоны sysfs", "Прямой доступ ограничен политиками SELinux"));
        }

        return items;
    }
}
