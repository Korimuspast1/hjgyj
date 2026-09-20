package com.devinspector.ultra.data;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class SensorCollector {

    public static List<SectionItem> collect(Context context) {
        List<SectionItem> items = new ArrayList<>();

        SensorManager sm = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        if (sm == null) {
            items.add(new SectionItem("Статус", "Датчики недоступны"));
            return items;
        }

        List<Sensor> list = sm.getSensorList(Sensor.TYPE_ALL);
        items.add(new SectionItem("Всего обнаружено аппаратных датчиков", list.size() + " шт.", "Sensors"));

        for (int i = 0; i < list.size(); i++) {
            Sensor s = list.get(i);
            String typeName = getSensorTypeName(s.getType());
            String vendor = s.getVendor();
            float power = s.getPower();
            float range = s.getMaximumRange();
            float res = s.getResolution();
            int minDelay = s.getMinDelay();

            StringBuilder desc = new StringBuilder();
            desc.append("Тип: ").append(typeName).append("\n");
            desc.append("Производитель: ").append(vendor).append(" (v").append(s.getVersion()).append(")\n");
            desc.append("Потребление: ").append(String.format(Locale.US, "%.2f mA", power)).append("\n");
            desc.append("Диапазон: ").append(String.format(Locale.US, "%.2f", range)).append(" | Разрешение: ").append(String.format(Locale.US, "%.6f", res)).append("\n");
            desc.append("Задержка (Min Delay): ").append(minDelay).append(" µs");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                desc.append(" | Wake-Up: ").append(s.isWakeUpSensor());
            }

            items.add(new SectionItem(s.getName(), desc.toString(), typeName));
        }

        return items;
    }

    public static String getSensorTypeName(int type) {
        switch (type) {
            case Sensor.TYPE_ACCELEROMETER: return "Акселерометр (Accelerometer)";
            case Sensor.TYPE_MAGNETIC_FIELD: return "Магнитометр (Magnetic Field)";
            case Sensor.TYPE_ORIENTATION: return "Ориентация (Orientation)";
            case Sensor.TYPE_GYROSCOPE: return "Гироскоп (Gyroscope)";
            case Sensor.TYPE_LIGHT: return "Датчик освещения (Ambient Light)";
            case Sensor.TYPE_PRESSURE: return "Барометр / Давление (Pressure)";
            case Sensor.TYPE_TEMPERATURE: return "Температура (Temperature)";
            case Sensor.TYPE_PROXIMITY: return "Датчик приближения (Proximity)";
            case Sensor.TYPE_GRAVITY: return "Гравитация (Gravity)";
            case Sensor.TYPE_LINEAR_ACCELERATION: return "Линейное ускорение (Linear Accel)";
            case Sensor.TYPE_ROTATION_VECTOR: return "Вектор вращения (Rotation Vector)";
            case Sensor.TYPE_RELATIVE_HUMIDITY: return "Влажность воздуха (Relative Humidity)";
            case Sensor.TYPE_AMBIENT_TEMPERATURE: return "Внешняя температура (Ambient Temp)";
            case Sensor.TYPE_MAGNETIC_FIELD_UNCALIBRATED: return "Магнитометр (Uncalibrated)";
            case Sensor.TYPE_GAME_ROTATION_VECTOR: return "Игровой вектор вращения";
            case Sensor.TYPE_GYROSCOPE_UNCALIBRATED: return "Гироскоп (Uncalibrated)";
            case Sensor.TYPE_SIGNIFICANT_MOTION: return "Детектор движения";
            case Sensor.TYPE_STEP_DETECTOR: return "Детектор шага (Step Detector)";
            case Sensor.TYPE_STEP_COUNTER: return "Счётчик шагов (Step Counter)";
            case Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR: return "Геомагнитный вектор вращения";
            case Sensor.TYPE_HEART_RATE: return "Пульсометр (Heart Rate)";
            default: return "Аппаратный датчик (" + type + ")";
        }
    }
}
