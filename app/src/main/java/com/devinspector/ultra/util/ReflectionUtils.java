package com.devinspector.ultra.util;

import android.content.Context;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;

public class ReflectionUtils {

    public static String getSystemProperty(String key, String defaultValue) {
        try {
            Class<?> c = Class.forName("android.os.SystemProperties");
            Method get = c.getMethod("get", String.class, String.class);
            return (String) get.invoke(null, key, defaultValue);
        } catch (Exception e) {
            return defaultValue;
        }
    }

    public static String[] getRegisteredServices() {
        try {
            Class<?> sm = Class.forName("android.os.ServiceManager");
            Method listServices = sm.getMethod("listServices");
            return (String[]) listServices.invoke(null);
        } catch (Exception e) {
            return new String[0];
        }
    }

    public static double getBatteryCapacityMah(Context context) {
        try {
            Class<?> powerProfileClass = Class.forName("com.android.internal.os.PowerProfile");
            Constructor<?> constructor = powerProfileClass.getConstructor(Context.class);
            Object powerProfile = constructor.newInstance(context);
            Method getBatteryCapacity = powerProfileClass.getMethod("getBatteryCapacity");
            return (Double) getBatteryCapacity.invoke(powerProfile);
        } catch (Exception e) {
            return -1.0;
        }
    }
}
