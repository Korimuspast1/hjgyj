package com.devinspector.ultra.ui;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ClipDrawable;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import com.devinspector.ultra.data.SectionItem;

public class UiBuilder {

    public static int dp(Context context, int dp) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp, context.getResources().getDisplayMetrics());
    }

    public static LinearLayout createCard(Context context, ThemeManager tm) {
        LinearLayout card = new LinearLayout(context);
        card.setOrientation(LinearLayout.VERTICAL);

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(tm.colorCardBg);
        bg.setCornerRadius(dp(context, 10));
        bg.setStroke(dp(context, 1), tm.colorCardBorder);

        card.setBackground(bg);
        int pad = dp(context, 14);
        card.setPadding(pad, pad, pad, pad);

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, 0, dp(context, 10));
        card.setLayoutParams(lp);

        return card;
    }

    public static View createSectionHeader(Context context, String title, ThemeManager tm) {
        LinearLayout row = new LinearLayout(context);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, dp(context, 6), 0, dp(context, 10));

        // Monochrome indicator bar (solid silver/white)
        View bar = new View(context);
        GradientDrawable barBg = new GradientDrawable();
        barBg.setColor(tm.colorTextPrimary);
        barBg.setCornerRadius(dp(context, 1));
        bar.setBackground(barBg);
        LinearLayout.LayoutParams barLp = new LinearLayout.LayoutParams(dp(context, 3), dp(context, 16));
        barLp.setMargins(0, 0, dp(context, 10), 0);
        bar.setLayoutParams(barLp);
        row.addView(bar);

        TextView tv = new TextView(context);
        tv.setText(title);
        tv.setTextColor(tm.colorTextPrimary);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        tv.setTypeface(Typeface.DEFAULT_BOLD);
        row.addView(tv);

        return row;
    }

    public static View createItemRow(Context context, SectionItem item, ThemeManager tm) {
        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(0, dp(context, 5), 0, dp(context, 5));

        // Top line: label + badge
        LinearLayout topRow = new LinearLayout(context);
        topRow.setOrientation(LinearLayout.HORIZONTAL);
        topRow.setGravity(Gravity.CENTER_VERTICAL);

        TextView labelTv = new TextView(context);
        labelTv.setText(item.label);
        labelTv.setTextColor(tm.colorTextSecondary);
        labelTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        labelTv.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams labelLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
        topRow.addView(labelTv, labelLp);

        if (item.badge != null && !item.badge.isEmpty()) {
            TextView badgeTv = createBadgeView(context, item.badge, tm);
            topRow.addView(badgeTv);
        }
        layout.addView(topRow);

        // Value text
        TextView valTv = new TextView(context);
        valTv.setText(item.value);
        valTv.setTextColor(tm.colorTextPrimary);
        valTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        valTv.setPadding(0, dp(context, 2), 0, 0);
        layout.addView(valTv);

        // Monochrome progress bar if requested
        if (item.progressPercent >= 0) {
            ProgressBar pb = new ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal);
            pb.setMax(100);
            pb.setProgress(item.progressPercent);
            pb.setIndeterminate(false);

            // Monochrome custom drawable
            GradientDrawable track = new GradientDrawable();
            track.setColor(0xFF262626);
            track.setCornerRadius(dp(context, 3));

            GradientDrawable progress = new GradientDrawable();
            progress.setColor(0xFFD4D4D4);
            progress.setCornerRadius(dp(context, 3));
            ClipDrawable clip = new ClipDrawable(progress, Gravity.START, ClipDrawable.HORIZONTAL);

            LayerDrawable layers = new LayerDrawable(new android.graphics.drawable.Drawable[]{track, clip});
            layers.setId(0, android.R.id.background);
            layers.setId(1, android.R.id.progress);
            pb.setProgressDrawable(layers);

            LinearLayout.LayoutParams pbLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(context, 5));
            pbLp.setMargins(0, dp(context, 5), 0, 0);
            pb.setLayoutParams(pbLp);

            layout.addView(pb);
        }

        // Copy on click
        if (item.isCopyable) {
            layout.setClickable(true);
            layout.setFocusable(true);
            layout.setOnClickListener(v -> {
                ClipboardManager cm = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) {
                    ClipData clip = ClipData.newPlainText(item.label, item.value);
                    cm.setPrimaryClip(clip);
                    Toast.makeText(context, "Скопировано: " + item.label, Toast.LENGTH_SHORT).show();
                }
            });
        }

        return layout;
    }

    public static TextView createBadgeView(Context context, String text, ThemeManager tm) {
        TextView tv = new TextView(context);
        tv.setText(text);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        tv.setTypeface(Typeface.DEFAULT_BOLD);

        GradientDrawable gd = new GradientDrawable();
        gd.setColor(tm.colorBadgeBg);
        gd.setCornerRadius(dp(context, 4));
        gd.setStroke(dp(context, 1), tm.colorCardBorderBright);
        tv.setBackground(gd);
        tv.setTextColor(tm.colorBadgeText);

        int padH = dp(context, 6);
        int padV = dp(context, 2);
        tv.setPadding(padH, padV, padH, padV);

        return tv;
    }

    public static Button createButton(Context context, String text, int bgColor, int textColor, View.OnClickListener listener) {
        Button btn = new Button(context);
        btn.setText(text);
        btn.setTextColor(textColor);
        btn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        btn.setTypeface(Typeface.DEFAULT_BOLD);

        GradientDrawable gd = new GradientDrawable();
        gd.setColor(bgColor);
        gd.setCornerRadius(dp(context, 6));
        gd.setStroke(dp(context, 1), (bgColor == 0xFFFFFFFF) ? 0xFFFFFFFF : 0xFF383838);
        btn.setBackground(gd);

        int padH = dp(context, 12);
        int padV = dp(context, 8);
        btn.setPadding(padH, padV, padH, padV);
        btn.setOnClickListener(listener);

        return btn;
    }

    public static EditText createSearchBox(Context context, String hint, ThemeManager tm) {
        EditText et = new EditText(context);
        et.setHint(hint);
        et.setHintTextColor(tm.colorTextMuted);
        et.setTextColor(tm.colorTextPrimary);
        et.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        et.setSingleLine(true);

        GradientDrawable gd = new GradientDrawable();
        gd.setColor(tm.colorCardBg);
        gd.setCornerRadius(dp(context, 8));
        gd.setStroke(dp(context, 1), tm.colorCardBorderBright);
        et.setBackground(gd);

        int pad = dp(context, 10);
        et.setPadding(pad, pad, pad, pad);

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, 0, dp(context, 10));
        et.setLayoutParams(lp);

        return et;
    }
}
