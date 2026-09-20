package com.devinspector.ultra.data;

public class SectionItem {
    public final String label;
    public final String value;
    public final String badge;
    public final int progressPercent; // -1 if not a progress row
    public final boolean isHidden;
    public final boolean isCopyable;

    public SectionItem(String label, String value) {
        this(label, value, null, -1, false, true);
    }

    public SectionItem(String label, String value, String badge) {
        this(label, value, badge, -1, false, true);
    }

    public SectionItem(String label, String value, int progressPercent) {
        this(label, value, null, progressPercent, false, true);
    }

    public SectionItem(String label, String value, String badge, int progressPercent, boolean isHidden, boolean isCopyable) {
        this.label = label;
        this.value = value;
        this.badge = badge;
        this.progressPercent = progressPercent;
        this.isHidden = isHidden;
        this.isCopyable = isCopyable;
    }
}
