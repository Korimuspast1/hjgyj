package com.devinspector.ultra.data;

import android.bluetooth.BluetoothAdapter;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.nfc.NfcAdapter;
import android.os.Build;
import android.telephony.TelephonyManager;

import com.devinspector.ultra.util.FormatUtils;

import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;

public class NetworkCollector {

    public static List<SectionItem> collect(Context context) {
        List<SectionItem> items = new ArrayList<>();

        // 1. General Connectivity
        ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        String activeNet = "Отключено (Нет сети)";
        if (cm != null) {
            NetworkInfo activeInfo = cm.getActiveNetworkInfo();
            if (activeInfo != null && activeInfo.isConnected()) {
                activeNet = activeInfo.getTypeName() + " (" + activeInfo.getDetailedState() + ")";
            }
        }
        items.add(new SectionItem("Активное сетевое подключение", activeNet, "Network"));

        // 2. Wi-Fi
        WifiManager wm = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm != null && wm.isWifiEnabled()) {
            WifiInfo wi = wm.getConnectionInfo();
            if (wi != null && wi.getNetworkId() != -1) {
                String ssid = wi.getSSID();
                if (ssid != null && ssid.startsWith("\"") && ssid.endsWith("\"")) {
                    ssid = ssid.substring(1, ssid.length() - 1);
                }
                items.add(new SectionItem("Wi-Fi SSID (Имя сети)", FormatUtils.fallback(ssid, "<Скрыто>")));
                items.add(new SectionItem("Wi-Fi BSSID (Точка доступа)", FormatUtils.fallback(wi.getBSSID(), "N/A")));

                int rssi = wi.getRssi();
                int level = WifiManager.calculateSignalLevel(rssi, 100);
                items.add(new SectionItem("Уровень сигнала Wi-Fi", rssi + " dBm (" + level + "%)", level));

                int linkSpeed = wi.getLinkSpeed();
                items.add(new SectionItem("Скорость соединения", linkSpeed + " " + WifiInfo.LINK_SPEED_UNITS));

                int freq = wi.getFrequency();
                String band = freq >= 5925 ? "6 GHz (Wi-Fi 6E/7)" : (freq >= 4900 ? "5 GHz" : "2.4 GHz");
                items.add(new SectionItem("Частота канала", freq + " MHz (" + band + ")"));

                String mac = wi.getMacAddress();
                items.add(new SectionItem("MAC-адрес Wi-Fi", FormatUtils.fallback(mac, "N/A")));
            } else {
                items.add(new SectionItem("Статус Wi-Fi", "Включен (Не подключен к сети)"));
            }
        } else {
            items.add(new SectionItem("Статус Wi-Fi", "Выключен"));
        }

        // 3. IP Addresses
        List<String> ipv4List = new ArrayList<>();
        List<String> ipv6List = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            if (interfaces != null) {
                for (NetworkInterface nif : Collections.list(interfaces)) {
                    if (nif.isUp()) {
                        for (InetAddress addr : Collections.list(nif.getInetAddresses())) {
                            if (!addr.isLoopbackAddress()) {
                                if (addr instanceof Inet4Address) {
                                    ipv4List.add(nif.getName() + ": " + addr.getHostAddress());
                                } else if (addr instanceof Inet6Address) {
                                    String h = addr.getHostAddress();
                                    int pct = h.indexOf('%');
                                    if (pct > 0) h = h.substring(0, pct);
                                    ipv6List.add(nif.getName() + ": " + h);
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }

        if (!ipv4List.isEmpty()) {
            items.add(new SectionItem("Локальные IPv4 адреса", String.join("\n", ipv4List)));
        } else {
            items.add(new SectionItem("Локальный IPv4", "127.0.0.1 (Loopback)"));
        }
        if (!ipv6List.isEmpty()) {
            items.add(new SectionItem("Локальные IPv6 адреса", String.join("\n", ipv6List)));
        }

        // 4. Cellular / Mobile Telephony
        TelephonyManager tm = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
        if (tm != null) {
            String simOperatorName = tm.getSimOperatorName();
            String simOperatorCode = tm.getSimOperator();
            String netOperatorName = tm.getNetworkOperatorName();
            boolean isRoaming = tm.isNetworkRoaming();

            items.add(new SectionItem("Оператор SIM-карты", FormatUtils.fallback(simOperatorName, "Не обнаружено")));
            if (!simOperatorCode.isEmpty()) {
                items.add(new SectionItem("Код сети оператора (MCC+MNC)", simOperatorCode));
            }
            items.add(new SectionItem("Текущая сеть оператора", FormatUtils.fallback(netOperatorName, "N/A")));
            items.add(new SectionItem("Роуминг", isRoaming ? "ВКЛЮЧЕН (Роуминг)" : "Выключен (Домашняя сеть)"));

            String simStateStr;
            switch (tm.getSimState()) {
                case TelephonyManager.SIM_STATE_READY: simStateStr = "Готова к работе (Ready)"; break;
                case TelephonyManager.SIM_STATE_ABSENT: simStateStr = "Отсутствует (No SIM)"; break;
                case TelephonyManager.SIM_STATE_PIN_REQUIRED: simStateStr = "Требуется PIN"; break;
                case TelephonyManager.SIM_STATE_PUK_REQUIRED: simStateStr = "Требуется PUK"; break;
                case TelephonyManager.SIM_STATE_NETWORK_LOCKED: simStateStr = "Блокировка оператора"; break;
                default: simStateStr = "Неизвестно"; break;
            }
            items.add(new SectionItem("Состояние SIM-карты", simStateStr));

            int phoneType = tm.getPhoneType();
            String ptStr = (phoneType == TelephonyManager.PHONE_TYPE_GSM) ? "GSM / UMTS / LTE" : ((phoneType == TelephonyManager.PHONE_TYPE_CDMA) ? "CDMA" : "SIP/None");
            items.add(new SectionItem("Тип радиотелефонного модуля", ptStr));
        }

        // 5. Bluetooth
        try {
            BluetoothAdapter ba = BluetoothAdapter.getDefaultAdapter();
            if (ba != null) {
                boolean enabled = ba.isEnabled();
                items.add(new SectionItem("Bluetooth модуль", enabled ? "Включен (Активен)" : "Выключен", enabled ? "ON" : "OFF"));
                PackageManager pm = context.getPackageManager();
                boolean ble = pm.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE);
                items.add(new SectionItem("Bluetooth Low Energy (BLE)", ble ? "Поддерживается" : "Не поддерживается"));
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    items.add(new SectionItem("Bluetooth 5.0 LE 2M PHY", ba.isLe2MPhySupported() ? "Да" : "Нет"));
                    items.add(new SectionItem("Bluetooth 5.0 LE Coded PHY", ba.isLeCodedPhySupported() ? "Да" : "Нет"));
                    items.add(new SectionItem("Расширенная реклама BLE", ba.isLeExtendedAdvertisingSupported() ? "Да" : "Нет"));
                }
            } else {
                items.add(new SectionItem("Bluetooth модуль", "Аппаратно не поддерживается"));
            }
        } catch (Exception ignored) {
        }

        // 6. NFC
        try {
            NfcAdapter nfc = NfcAdapter.getDefaultAdapter(context);
            if (nfc != null) {
                items.add(new SectionItem("NFC модуль", nfc.isEnabled() ? "Включен (Готов к оплате)" : "Выключен в настройках", nfc.isEnabled() ? "ON" : "OFF"));
            } else {
                items.add(new SectionItem("NFC модуль", "Аппаратно отсутствует"));
            }
        } catch (Exception ignored) {
        }

        // 7. Other hardware communication features
        PackageManager pm = context.getPackageManager();
        boolean p2p = pm.hasSystemFeature(PackageManager.FEATURE_WIFI_DIRECT);
        items.add(new SectionItem("Wi-Fi Direct (P2P)", p2p ? "Поддерживается" : "Нет"));

        boolean uwb = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            uwb = pm.hasSystemFeature("android.hardware.uwb");
        }
        items.add(new SectionItem("Сверхширокополосная связь (UWB)", uwb ? "Поддерживается" : "Не поддерживается"));

        boolean ir = pm.hasSystemFeature(PackageManager.FEATURE_CONSUMER_IR);
        items.add(new SectionItem("Инфракрасный порт (IR Blaster)", ir ? "Присутствует (ИК-передатчик)" : "Отсутствует"));

        boolean usbHost = pm.hasSystemFeature(PackageManager.FEATURE_USB_HOST);
        items.add(new SectionItem("USB OTG / USB Host", usbHost ? "Поддерживается" : "Не поддерживается"));

        return items;
    }
}
