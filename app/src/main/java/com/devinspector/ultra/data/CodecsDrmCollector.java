package com.devinspector.ultra.data;

import android.media.MediaCodecInfo;
import android.media.MediaCodecList;
import android.media.MediaDrm;
import android.os.Build;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class CodecsDrmCollector {

    public static List<SectionItem> collect() {
        List<SectionItem> items = new ArrayList<>();

        // 1. Widevine DRM
        try {
            UUID widevineUuid = new UUID(0xEDEF8BA979D64ACEL, 0xA3C827DCD51D21EDL);
            if (MediaDrm.isCryptoSchemeSupported(widevineUuid)) {
                MediaDrm drm = new MediaDrm(widevineUuid);
                String vendor = drm.getPropertyString(MediaDrm.PROPERTY_VENDOR);
                String version = drm.getPropertyString(MediaDrm.PROPERTY_VERSION);
                String desc = drm.getPropertyString(MediaDrm.PROPERTY_DESCRIPTION);
                String secLevel = "";
                try {
                    secLevel = drm.getPropertyString("securityLevel");
                } catch (Exception ignored) {
                }
                String sysId = "";
                try {
                    sysId = drm.getPropertyString("systemId");
                } catch (Exception ignored) {
                }

                items.add(new SectionItem("Widevine DRM Провайдер", vendor + " (" + desc + ")", "DRM"));
                items.add(new SectionItem("Версия Widevine CDM", version));
                items.add(new SectionItem("Уровень безопасности (Security Level)", secLevel.isEmpty() ? "L3" : secLevel, "L1".equalsIgnoreCase(secLevel) ? "Full HD / 4K" : "SD Quality"));
                if (!sysId.isEmpty()) {
                    items.add(new SectionItem("System ID", sysId));
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    drm.close();
                } else {
                    drm.release();
                }
            } else {
                items.add(new SectionItem("Widevine DRM", "Не поддерживается аппаратно"));
            }
        } catch (Exception e) {
            items.add(new SectionItem("Widevine DRM", "Ошибка запроса: " + e.getMessage()));
        }

        // 2. Hardware Video Codecs
        try {
            MediaCodecList mcl = new MediaCodecList(MediaCodecList.REGULAR_CODECS);
            MediaCodecInfo[] infos = mcl.getCodecInfos();

            List<String> hwDecoders = new ArrayList<>();
            List<String> hwEncoders = new ArrayList<>();
            List<String> swCodecs = new ArrayList<>();

            for (MediaCodecInfo mci : infos) {
                String name = mci.getName();
                boolean isHw = false;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    isHw = mci.isHardwareAccelerated();
                } else {
                    isHw = !name.startsWith("OMX.google.") && !name.startsWith("c2.android.");
                }

                if (isHw) {
                    if (mci.isEncoder()) {
                        hwEncoders.add(name);
                    } else {
                        hwDecoders.add(name);
                    }
                } else {
                    swCodecs.add(name);
                }
            }

            items.add(new SectionItem("Аппаратные декодеры (Hardware)", hwDecoders.size() + " шт.", "HW Dec"));
            for (String dec : hwDecoders) {
                items.add(new SectionItem("HW Декодер", dec, "HW"));
            }

            items.add(new SectionItem("Аппаратные энкодеры (Hardware)", hwEncoders.size() + " шт.", "HW Enc"));
            for (String enc : hwEncoders) {
                items.add(new SectionItem("HW Энкодер", enc, "HW"));
            }

            items.add(new SectionItem("Программные кодеки (Software)", swCodecs.size() + " шт.", "SW"));
        } catch (Exception e) {
            items.add(new SectionItem("Ошибка чтения кодеков", e.getMessage() != null ? e.getMessage() : "Exception"));
        }

        return items;
    }
}
