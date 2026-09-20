package com.devinspector.ultra.data;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.Toast;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class ReportExporter {

    public static String generateFullReport(Context context, String tempUnit, String freqUnit) {
        StringBuilder sb = new StringBuilder();
        String dateStr = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date());

        sb.append("=====================================================\n");
        sb.append("   DEVINSPECTOR ULTRA — ПОЛНЫЙ АУДИТ УСТРОЙСТВА      \n");
        sb.append("=====================================================\n");
        sb.append("Дата отчёта: ").append(dateStr).append("\n");
        sb.append("Устройство: ").append(Build.MANUFACTURER).append(" ").append(Build.MODEL).append(" (").append(Build.PRODUCT).append(")\n");
        sb.append("Android: ").append(Build.VERSION.RELEASE).append(" (API ").append(Build.VERSION.SDK_INT).append(")\n\n");

        appendSection(sb, "1. ОБЩИЙ ОБЗОР", OverviewCollector.collect(context));
        appendSection(sb, "2. ПРОЦЕССОР И ЧИПСЕТ", CpuCollector.collect(freqUnit));
        appendSection(sb, "3. ПАМЯТЬ И НАКОПИТЕЛЬ", MemoryCollector.collect(context));
        appendSection(sb, "4. АККУМУЛЯТОР И ПИТАНИЕ", BatteryCollector.collect(context, tempUnit));
        appendSection(sb, "5. ДИСПЛЕЙ И ГРАФИКА", DisplayCollector.collect(context));
        appendSection(sb, "6. СЕТЬ И БЕСПРОВОДНАЯ СВЯЗЬ", NetworkCollector.collect(context));
        appendSection(sb, "7. АППАРАТНЫЕ ДАТЧИКИ", SensorCollector.collect(context));
        appendSection(sb, "8. МОДУЛИ КАМЕР", CameraCollector.collect(context));
        appendSection(sb, "9. ТЕМПЕРАТУРНЫЕ ЗОНЫ", ThermalCollector.collect(context, tempUnit));
        appendSection(sb, "10. МУЛЬТИМЕДИА, КОДЕКИ И DRM", CodecsDrmCollector.collect());
        appendSection(sb, "11. СКРЫТЫЕ И ВЕНДОРНЫЕ ФУНКЦИИ", HiddenFeaturesCollector.collect(context));

        sb.append("=====================================================\n");
        sb.append("Сгенерировано приложением DevInspector Ultra\n");
        sb.append("https://github.com/Korimuspast1/hjgyj\n");
        sb.append("=====================================================\n");

        return sb.toString();
    }

    private static void appendSection(StringBuilder sb, String title, List<SectionItem> items) {
        sb.append("--- [ ").append(title).append(" ] ---\n");
        for (SectionItem item : items) {
            sb.append("• ").append(item.label).append(": ").append(item.value);
            if (item.badge != null && !item.badge.isEmpty()) {
                sb.append(" [").append(item.badge).append("]");
            }
            sb.append("\n");
        }
        sb.append("\n");
    }

    public static void copyToClipboard(Context context, String text) {
        ClipboardManager cm = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm != null) {
            ClipData clip = ClipData.newPlainText("DevInspector Report", text);
            cm.setPrimaryClip(clip);
            Toast.makeText(context, "Отчёт скопирован в буфер обмена!", Toast.LENGTH_SHORT).show();
        }
    }

    public static void shareReport(Context context, String text) {
        Intent sendIntent = new Intent();
        sendIntent.setAction(Intent.ACTION_SEND);
        sendIntent.putExtra(Intent.EXTRA_TEXT, text);
        sendIntent.putExtra(Intent.EXTRA_SUBJECT, "Полный аудит устройства: " + Build.MODEL);
        sendIntent.setType("text/plain");

        Intent shareIntent = Intent.createChooser(sendIntent, "Поделиться отчётом устройства");
        shareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(shareIntent);
    }
}
