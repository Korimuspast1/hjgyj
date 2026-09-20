package com.devinspector.ultra.data;

import android.content.Context;
import android.graphics.Rect;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.util.SizeF;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class CameraCollector {

    public static List<SectionItem> collect(Context context) {
        List<SectionItem> items = new ArrayList<>();

        CameraManager cm = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
        if (cm == null) {
            items.add(new SectionItem("Статус", "Камера недоступна"));
            return items;
        }

        try {
            String[] ids = cm.getCameraIdList();
            items.add(new SectionItem("Всего обнаружено модулей камер", ids.length + " шт.", "Camera"));

            for (String id : ids) {
                CameraCharacteristics chars = cm.getCameraCharacteristics(id);
                Integer facing = chars.get(CameraCharacteristics.LENS_FACING);
                String facingStr = "Неизвестно";
                if (facing != null) {
                    if (facing == CameraCharacteristics.LENS_FACING_BACK) facingStr = "Основная (Тыловая / Back)";
                    else if (facing == CameraCharacteristics.LENS_FACING_FRONT) facingStr = "Фронтальная (Селфи / Front)";
                    else if (facing == CameraCharacteristics.LENS_FACING_EXTERNAL) facingStr = "Внешняя (External USB)";
                }

                Rect activeArray = chars.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE);
                android.util.Size pixelArray = chars.get(CameraCharacteristics.SENSOR_INFO_PIXEL_ARRAY_SIZE);

                double megapixels = 0;
                String resStr = "N/A";
                int w = 0, h = 0;
                if (pixelArray != null) {
                    w = pixelArray.getWidth();
                    h = pixelArray.getHeight();
                } else if (activeArray != null) {
                    w = activeArray.width();
                    h = activeArray.height();
                }

                if (w > 0 && h > 0) {
                    megapixels = (w * (double) h) / 1000000.0;
                    resStr = String.format(Locale.US, "%.1f MP (%d x %d)", megapixels, w, h);
                }

                float[] focalLengths = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS);
                String focalStr = "N/A";
                if (focalLengths != null && focalLengths.length > 0) {
                    StringBuilder fsb = new StringBuilder();
                    for (float f : focalLengths) {
                        if (fsb.length() > 0) fsb.append(", ");
                        fsb.append(String.format(Locale.US, "%.2f mm", f));
                    }
                    focalStr = fsb.toString();
                }

                float[] apertures = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_APERTURES);
                String apStr = "N/A";
                if (apertures != null && apertures.length > 0) {
                    StringBuilder asb = new StringBuilder();
                    for (float a : apertures) {
                        if (asb.length() > 0) asb.append(", ");
                        asb.append(String.format(Locale.US, "f/%.2f", a));
                    }
                    apStr = asb.toString();
                }

                Boolean flash = chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                Integer hwLevel = chars.get(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL);
                String hwLevelStr = "LEGACY";
                if (hwLevel != null) {
                    switch (hwLevel) {
                        case CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LIMITED: hwLevelStr = "LIMITED"; break;
                        case CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_FULL: hwLevelStr = "FULL"; break;
                        case CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_3: hwLevelStr = "LEVEL_3 (Pro RAW/YUV)"; break;
                        default: hwLevelStr = "LEGACY"; break;
                    }
                }

                SizeF sensorSize = chars.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE);
                String sensorSizeStr = (sensorSize != null) ? String.format(Locale.US, "%.2f x %.2f mm", sensorSize.getWidth(), sensorSize.getHeight()) : "N/A";

                StringBuilder desc = new StringBuilder();
                desc.append("Направление: ").append(facingStr).append("\n");
                desc.append("Разрешение сенсора: ").append(resStr).append("\n");
                desc.append("Фокусное расстояние: ").append(focalStr).append("\n");
                desc.append("Диафрагма (Aperture): ").append(apStr).append("\n");
                desc.append("Физический размер матрицы: ").append(sensorSizeStr).append("\n");
                desc.append("Вспышка: ").append(Boolean.TRUE.equals(flash) ? "Присутствует" : "Отсутствует").append("\n");
                desc.append("Уровень Camera2 API: ").append(hwLevelStr);

                items.add(new SectionItem("Камера ID [" + id + "]", desc.toString(), String.format(Locale.US, "%.1f MP", megapixels)));
            }
        } catch (Exception e) {
            items.add(new SectionItem("Ошибка чтения камер", e.getMessage() != null ? e.getMessage() : "Exception"));
        }

        return items;
    }
}
