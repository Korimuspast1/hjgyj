package com.devinspector.ultra;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import com.devinspector.ultra.data.BatteryCollector;
import com.devinspector.ultra.data.CameraCollector;
import com.devinspector.ultra.data.CodecsDrmCollector;
import com.devinspector.ultra.data.CpuCollector;
import com.devinspector.ultra.data.DisplayCollector;
import com.devinspector.ultra.data.HiddenFeaturesCollector;
import com.devinspector.ultra.data.MemoryCollector;
import com.devinspector.ultra.data.NetworkCollector;
import com.devinspector.ultra.data.OverviewCollector;
import com.devinspector.ultra.data.ReportExporter;
import com.devinspector.ultra.data.SectionItem;
import com.devinspector.ultra.data.SensorCollector;
import com.devinspector.ultra.data.SystemPropsCollector;
import com.devinspector.ultra.data.ThermalCollector;
import com.devinspector.ultra.ui.ThemeManager;
import com.devinspector.ultra.ui.UiBuilder;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity implements SensorEventListener {

    private ThemeManager tm;
    private int currentTab = 0;
    private final Handler refreshHandler = new Handler(Looper.getMainLooper());
    private Runnable refreshRunnable;

    private LinearLayout rootLayout;
    private LinearLayout tabContainer;
    private LinearLayout contentContainer;
    private ScrollView scrollView;

    // Search query and category for Props tab
    private String propsQuery = "";
    private String propsCategory = "Все";

    // Live Sensor monitoring
    private SensorManager sensorManager;
    private Sensor activeSensor;
    private TextView liveSensorValuesTv;

    private static final String[] TABS = {
            "📊 Обзор",
            "⚡ CPU",
            "💾 Память",
            "🔋 Батарея",
            "📱 Экран",
            "📡 Сеть",
            "🧭 Датчики",
            "📷 Камеры",
            "🌡️ Термал",
            "🎬 Кодеки",
            "🕵️ Скрытые",
            "📋 Свойства",
            "⚙️ Настройки"
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        tm = ThemeManager.get(this);
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);

        buildUi();
        selectTab(0);
        setupAutoRefresh();
    }

    private void buildUi() {
        rootLayout = new LinearLayout(this);
        rootLayout.setOrientation(LinearLayout.VERTICAL);
        rootLayout.setBackgroundColor(tm.colorBackground);

        // 1. Header Toolbar
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setBackgroundColor(tm.colorCardBg);
        int hPad = UiBuilder.dp(this, 16);
        int vPad = UiBuilder.dp(this, 12);
        header.setPadding(hPad, vPad, hPad, vPad);

        // App title
        LinearLayout titleCol = new LinearLayout(this);
        titleCol.setOrientation(LinearLayout.VERTICAL);

        TextView titleTv = new TextView(this);
        titleTv.setText("DEVINSPECTOR ULTRA");
        titleTv.setTextColor(tm.colorAccent);
        titleTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        titleTv.setTypeface(Typeface.DEFAULT_BOLD);
        titleCol.addView(titleTv);

        TextView subTv = new TextView(this);
        subTv.setText("Deep Hardware & Secret Specs");
        subTv.setTextColor(tm.colorTextSecondary);
        subTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        titleCol.addView(subTv);

        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
        header.addView(titleCol, titleLp);

        // Export Button
        Button exportBtn = UiBuilder.createButton(this, "Отчёт", 0x2258A6FF, tm.colorAccent, v -> {
            String report = ReportExporter.generateFullReport(this, ThemeManager.getTempUnit(this), ThemeManager.getFreqUnit(this));
            ReportExporter.shareReport(this, report);
        });
        LinearLayout.LayoutParams exportLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        exportLp.setMargins(0, 0, UiBuilder.dp(this, 8), 0);
        header.addView(exportBtn, exportLp);

        // Refresh Button
        Button refreshBtn = UiBuilder.createButton(this, "🔄", 0x2258A6FF, tm.colorAccent, v -> {
            refreshCurrentTab();
            Toast.makeText(this, "Данные обновлены", Toast.LENGTH_SHORT).show();
        });
        header.addView(refreshBtn);

        rootLayout.addView(header);

        // 2. Horizontal Tab Bar
        HorizontalScrollView tabScroll = new HorizontalScrollView(this);
        tabScroll.setHorizontalScrollBarEnabled(false);
        tabScroll.setBackgroundColor(tm.colorCardBg);
        tabScroll.setPadding(UiBuilder.dp(this, 8), UiBuilder.dp(this, 4), UiBuilder.dp(this, 8), UiBuilder.dp(this, 6));

        tabContainer = new LinearLayout(this);
        tabContainer.setOrientation(LinearLayout.HORIZONTAL);
        tabScroll.addView(tabContainer);

        for (int i = 0; i < TABS.length; i++) {
            final int index = i;
            TextView tabTv = new TextView(this);
            tabTv.setText(TABS[i]);
            tabTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
            tabTv.setTypeface(Typeface.DEFAULT_BOLD);
            int padX = UiBuilder.dp(this, 12);
            int padY = UiBuilder.dp(this, 7);
            tabTv.setPadding(padX, padY, padX, padY);

            LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            tlp.setMargins(UiBuilder.dp(this, 4), 0, UiBuilder.dp(this, 4), 0);
            tabTv.setLayoutParams(tlp);

            tabTv.setOnClickListener(v -> selectTab(index));
            tabContainer.addView(tabTv);
        }

        rootLayout.addView(tabScroll);

        // 3. Scrollable Content Container
        scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);

        contentContainer = new LinearLayout(this);
        contentContainer.setOrientation(LinearLayout.VERTICAL);
        int cPad = UiBuilder.dp(this, 14);
        contentContainer.setPadding(cPad, cPad, cPad, UiBuilder.dp(this, 32));
        scrollView.addView(contentContainer);

        rootLayout.addView(scrollView);
        setContentView(rootLayout);
    }

    private void selectTab(int index) {
        currentTab = index;

        // Unregister active live sensor if moving away from Sensors tab
        if (activeSensor != null && currentTab != 6) {
            sensorManager.unregisterListener(this);
            activeSensor = null;
        }

        // Highlight selected tab
        for (int i = 0; i < tabContainer.getChildCount(); i++) {
            TextView t = (TextView) tabContainer.getChildAt(i);
            if (i == index) {
                GradientDrawable activeBg = new GradientDrawable();
                activeBg.setColor(tm.colorAccent);
                activeBg.setCornerRadius(UiBuilder.dp(this, 8));
                t.setBackground(activeBg);
                t.setTextColor(tm.colorBackground == 0xFF000000 ? 0xFF000000 : 0xFFFFFFFF);
            } else {
                t.setBackground(null);
                t.setTextColor(tm.colorTextSecondary);
            }
        }

        renderContent();
    }

    private void refreshCurrentTab() {
        if (currentTab == 11) {
            // Force reload props cache
            SystemPropsCollector.getAllProps(true);
        }
        renderContent();
    }

    private void renderContent() {
        contentContainer.removeAllViews();
        String tempUnit = ThemeManager.getTempUnit(this);
        String freqUnit = ThemeManager.getFreqUnit(this);

        switch (currentTab) {
            case 0:
                renderSection("Общий обзор системы", OverviewCollector.collect(this));
                break;
            case 1:
                renderSection("Процессор & Вычислительные ядра", CpuCollector.collect(freqUnit));
                break;
            case 2:
                renderSection("Оперативная память и Накопители", MemoryCollector.collect(this));
                break;
            case 3:
                renderSection("Аккумулятор & Система питания", BatteryCollector.collect(this, tempUnit));
                break;
            case 4:
                renderSection("Экран, Разрешение & Графика", DisplayCollector.collect(this));
                break;
            case 5:
                renderSection("Сетевые подключения & Связь", NetworkCollector.collect(this));
                break;
            case 6:
                renderSensorsTab();
                break;
            case 7:
                renderSection("Аппаратные модули камер", CameraCollector.collect(this));
                break;
            case 8:
                renderSection("Термальные зоны & Нагрев", ThermalCollector.collect(this, tempUnit));
                break;
            case 9:
                renderSection("Мультимедиа кодеки & Widevine DRM", CodecsDrmCollector.collect());
                break;
            case 10:
                renderSection("Скрытые & Недокументированные функции", HiddenFeaturesCollector.collect(this));
                break;
            case 11:
                renderPropsTab();
                break;
            case 12:
                renderSettingsTab();
                break;
        }
    }

    private void renderSection(String title, List<SectionItem> items) {
        contentContainer.addView(UiBuilder.createSectionHeader(this, title, tm));

        LinearLayout card = UiBuilder.createCard(this, tm);
        for (int i = 0; i < items.size(); i++) {
            card.addView(UiBuilder.createItemRow(this, items.get(i), tm));
            if (i < items.size() - 1) {
                // Divider
                View div = new View(this);
                div.setBackgroundColor(tm.colorCardBorder);
                LinearLayout.LayoutParams dlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, UiBuilder.dp(this, 1));
                dlp.setMargins(0, UiBuilder.dp(this, 4), 0, UiBuilder.dp(this, 4));
                div.setLayoutParams(dlp);
                card.addView(div);
            }
        }
        contentContainer.addView(card);
    }

    private void renderSensorsTab() {
        contentContainer.addView(UiBuilder.createSectionHeader(this, "Аппаратные датчики и Live монитор", tm));

        // Live Sensor Card
        LinearLayout liveCard = UiBuilder.createCard(this, tm);
        TextView liveTitle = new TextView(this);
        liveTitle.setText("Интерактивный Live-монитор датчика");
        liveTitle.setTextColor(tm.colorAccent);
        liveTitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        liveTitle.setTypeface(Typeface.DEFAULT_BOLD);
        liveCard.addView(liveTitle);

        List<Sensor> allSensors = sensorManager.getSensorList(Sensor.TYPE_ALL);
        List<String> sensorNames = new ArrayList<>();
        sensorNames.add("Выберите датчик для живого мониторинга...");
        for (Sensor s : allSensors) {
            sensorNames.add(s.getName() + " (" + SensorCollector.getSensorTypeName(s.getType()) + ")");
        }

        Spinner spinner = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, sensorNames);
        spinner.setAdapter(adapter);
        spinner.setBackgroundColor(tm.colorCardBg);

        liveSensorValuesTv = new TextView(this);
        liveSensorValuesTv.setText("Выберите сенсор выше для отображения данных в реальном времени.");
        liveSensorValuesTv.setTextColor(tm.colorTextPrimary);
        liveSensorValuesTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        liveSensorValuesTv.setPadding(0, UiBuilder.dp(this, 8), 0, 0);

        spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (position > 0 && position - 1 < allSensors.size()) {
                    if (activeSensor != null) {
                        sensorManager.unregisterListener(MainActivity.this);
                    }
                    activeSensor = allSensors.get(position - 1);
                    sensorManager.registerListener(MainActivity.this, activeSensor, SensorManager.SENSOR_DELAY_UI);
                    liveSensorValuesTv.setText("Подключение к датчику: " + activeSensor.getName() + "...");
                }
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {
            }
        });

        liveCard.addView(spinner);
        liveCard.addView(liveSensorValuesTv);
        contentContainer.addView(liveCard);

        // List all sensors
        renderSection("Полный список сенсоров", SensorCollector.collect(this));
    }

    private void renderPropsTab() {
        contentContainer.addView(UiBuilder.createSectionHeader(this, "Все системные свойства (getprop)", tm));

        // Search Box
        EditText searchEt = UiBuilder.createSearchBox(this, "Поиск по ключу или значению...", tm);
        searchEt.setText(propsQuery);
        searchEt.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                propsQuery = s.toString();
                updatePropsList();
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });
        contentContainer.addView(searchEt);

        // Category filter chips
        HorizontalScrollView chipScroll = new HorizontalScrollView(this);
        chipScroll.setHorizontalScrollBarEnabled(false);
        LinearLayout chipContainer = new LinearLayout(this);
        chipContainer.setOrientation(LinearLayout.HORIZONTAL);
        chipScroll.addView(chipContainer);

        String[] categories = {"Все", "Android", "Загрузка", "Вендор", "Безопасность", "Сеть"};
        for (String cat : categories) {
            TextView chip = new TextView(this);
            chip.setText(cat);
            chip.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            chip.setTypeface(Typeface.DEFAULT_BOLD);
            int px = UiBuilder.dp(this, 12);
            int py = UiBuilder.dp(this, 6);
            chip.setPadding(px, py, px, py);

            GradientDrawable cd = new GradientDrawable();
            boolean isSelected = cat.equals(propsCategory);
            cd.setColor(isSelected ? tm.colorAccent : tm.colorCardBg);
            cd.setCornerRadius(UiBuilder.dp(this, 8));
            cd.setStroke(UiBuilder.dp(this, 1), tm.colorCardBorder);
            chip.setBackground(cd);
            chip.setTextColor(isSelected ? (tm.colorBackground == 0xFF000000 ? 0xFF000000 : 0xFFFFFFFF) : tm.colorTextPrimary);

            LinearLayout.LayoutParams clp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            clp.setMargins(0, 0, UiBuilder.dp(this, 8), UiBuilder.dp(this, 10));
            chip.setLayoutParams(clp);

            chip.setOnClickListener(v -> {
                propsCategory = cat;
                renderContent();
            });
            chipContainer.addView(chip);
        }
        contentContainer.addView(chipScroll);

        // Properties Card
        List<SectionItem> items = SystemPropsCollector.filter(propsQuery, propsCategory);
        TextView countTv = new TextView(this);
        countTv.setText("Найдено параметров: " + items.size());
        countTv.setTextColor(tm.colorTextSecondary);
        countTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        countTv.setPadding(0, 0, 0, UiBuilder.dp(this, 6));
        contentContainer.addView(countTv);

        LinearLayout card = UiBuilder.createCard(this, tm);
        int maxShow = Math.min(items.size(), 150); // Show up to 150 matching properties
        for (int i = 0; i < maxShow; i++) {
            card.addView(UiBuilder.createItemRow(this, items.get(i), tm));
            if (i < maxShow - 1) {
                View div = new View(this);
                div.setBackgroundColor(tm.colorCardBorder);
                LinearLayout.LayoutParams dlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, UiBuilder.dp(this, 1));
                dlp.setMargins(0, UiBuilder.dp(this, 4), 0, UiBuilder.dp(this, 4));
                div.setLayoutParams(dlp);
                card.addView(div);
            }
        }
        if (items.size() > maxShow) {
            TextView moreTv = new TextView(this);
            moreTv.setText("... ещё " + (items.size() - maxShow) + " свойств (уточните поиск)");
            moreTv.setTextColor(tm.colorAccent);
            moreTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            moreTv.setPadding(0, UiBuilder.dp(this, 8), 0, 0);
            card.addView(moreTv);
        }
        contentContainer.addView(card);
    }

    private void updatePropsList() {
        if (currentTab == 11) {
            renderContent();
        }
    }

    private void renderSettingsTab() {
        contentContainer.addView(UiBuilder.createSectionHeader(this, "Настройки приложения & Экспорт", tm));

        LinearLayout card = UiBuilder.createCard(this, tm);

        // 1. Theme Selector
        TextView themeLabel = new TextView(this);
        themeLabel.setText("Тема интерфейса:");
        themeLabel.setTextColor(tm.colorTextPrimary);
        themeLabel.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(themeLabel);

        LinearLayout themeRow = new LinearLayout(this);
        themeRow.setOrientation(LinearLayout.HORIZONTAL);
        themeRow.setPadding(0, UiBuilder.dp(this, 6), 0, UiBuilder.dp(this, 14));

        String[] themeNames = {"Cyber Dark", "AMOLED Black", "Slate Night"};
        for (int i = 0; i < 3; i++) {
            final int tid = i;
            Button tb = UiBuilder.createButton(this, themeNames[i], (tm.themeId == tid) ? tm.colorAccent : tm.colorCardBorder, (tm.themeId == tid) ? (tm.colorBackground == 0xFF000000 ? 0xFF000000 : 0xFFFFFFFF) : tm.colorTextPrimary, v -> {
                ThemeManager.setTheme(this, tid);
                tm = new ThemeManager(tid);
                recreate();
            });
            LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
            tlp.setMargins(UiBuilder.dp(this, 2), 0, UiBuilder.dp(this, 2), 0);
            themeRow.addView(tb, tlp);
        }
        card.addView(themeRow);

        // 2. Temperature Unit
        TextView tempLabel = new TextView(this);
        tempLabel.setText("Единицы температуры:");
        tempLabel.setTextColor(tm.colorTextPrimary);
        tempLabel.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(tempLabel);

        LinearLayout tempRow = new LinearLayout(this);
        tempRow.setOrientation(LinearLayout.HORIZONTAL);
        tempRow.setPadding(0, UiBuilder.dp(this, 6), 0, UiBuilder.dp(this, 14));

        String curTemp = ThemeManager.getTempUnit(this);
        Button btnC = UiBuilder.createButton(this, "Цельсий (°C)", "C".equals(curTemp) ? tm.colorAccent : tm.colorCardBorder, "C".equals(curTemp) ? 0xFFFFFFFF : tm.colorTextPrimary, v -> {
            ThemeManager.setTempUnit(this, "C");
            renderContent();
        });
        Button btnF = UiBuilder.createButton(this, "Фаренгейт (°F)", "F".equals(curTemp) ? tm.colorAccent : tm.colorCardBorder, "F".equals(curTemp) ? 0xFFFFFFFF : tm.colorTextPrimary, v -> {
            ThemeManager.setTempUnit(this, "F");
            renderContent();
        });
        LinearLayout.LayoutParams btnLp1 = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
        btnLp1.setMargins(0, 0, UiBuilder.dp(this, 4), 0);
        tempRow.addView(btnC, btnLp1);
        LinearLayout.LayoutParams btnLp2 = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
        btnLp2.setMargins(UiBuilder.dp(this, 4), 0, 0, 0);
        tempRow.addView(btnF, btnLp2);
        card.addView(tempRow);

        // 3. CPU Frequency Unit
        TextView freqLabel = new TextView(this);
        freqLabel.setText("Единицы частоты процессора:");
        freqLabel.setTextColor(tm.colorTextPrimary);
        freqLabel.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(freqLabel);

        LinearLayout freqRow = new LinearLayout(this);
        freqRow.setOrientation(LinearLayout.HORIZONTAL);
        freqRow.setPadding(0, UiBuilder.dp(this, 6), 0, UiBuilder.dp(this, 14));

        String curFreq = ThemeManager.getFreqUnit(this);
        Button btnMhz = UiBuilder.createButton(this, "МГц (MHz)", "MHz".equals(curFreq) ? tm.colorAccent : tm.colorCardBorder, "MHz".equals(curFreq) ? 0xFFFFFFFF : tm.colorTextPrimary, v -> {
            ThemeManager.setFreqUnit(this, "MHz");
            renderContent();
        });
        Button btnGhz = UiBuilder.createButton(this, "ГГц (GHz)", "GHz".equals(curFreq) ? tm.colorAccent : tm.colorCardBorder, "GHz".equals(curFreq) ? 0xFFFFFFFF : tm.colorTextPrimary, v -> {
            ThemeManager.setFreqUnit(this, "GHz");
            renderContent();
        });
        freqRow.addView(btnMhz, btnLp1);
        freqRow.addView(btnGhz, btnLp2);
        card.addView(freqRow);

        // 4. Auto-Refresh Interval
        TextView refreshLabel = new TextView(this);
        refreshLabel.setText("Интервал авто-обновления графиков:");
        refreshLabel.setTextColor(tm.colorTextPrimary);
        refreshLabel.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(refreshLabel);

        LinearLayout refRow = new LinearLayout(this);
        refRow.setOrientation(LinearLayout.HORIZONTAL);
        refRow.setPadding(0, UiBuilder.dp(this, 6), 0, UiBuilder.dp(this, 14));

        int curInterval = ThemeManager.getRefreshInterval(this);
        int[] intervals = {1000, 2000, 5000, 0};
        String[] intervalLabels = {"1 сек", "2 сек", "5 сек", "Выкл"};
        for (int i = 0; i < 4; i++) {
            final int iv = intervals[i];
            Button b = UiBuilder.createButton(this, intervalLabels[i], curInterval == iv ? tm.colorAccent : tm.colorCardBorder, curInterval == iv ? 0xFFFFFFFF : tm.colorTextPrimary, v -> {
                ThemeManager.setRefreshInterval(this, iv);
                setupAutoRefresh();
                renderContent();
            });
            LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
            blp.setMargins(UiBuilder.dp(this, 2), 0, UiBuilder.dp(this, 2), 0);
            refRow.addView(b, blp);
        }
        card.addView(refRow);

        // 5. Deep Probing Mode Toggle
        LinearLayout deepRow = new LinearLayout(this);
        deepRow.setOrientation(LinearLayout.HORIZONTAL);
        deepRow.setGravity(Gravity.CENTER_VERTICAL);
        deepRow.setPadding(0, 0, 0, UiBuilder.dp(this, 14));

        TextView deepTv = new TextView(this);
        deepTv.setText("Глубокий анализ скрытых сервисов и рефлексии");
        deepTv.setTextColor(tm.colorTextPrimary);
        deepTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        LinearLayout.LayoutParams dLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
        deepRow.addView(deepTv, dLp);

        Switch deepSwitch = new Switch(this);
        deepSwitch.setChecked(ThemeManager.isDeepProbingEnabled(this));
        deepSwitch.setOnCheckedChangeListener((buttonView, isChecked) -> {
            ThemeManager.setDeepProbingEnabled(this, isChecked);
            Toast.makeText(this, isChecked ? "Глубокий анализ включен" : "Обычный режим", Toast.LENGTH_SHORT).show();
        });
        deepRow.addView(deepSwitch);
        card.addView(deepRow);

        contentContainer.addView(card);

        // 6. Export Actions Card
        LinearLayout exportCard = UiBuilder.createCard(this, tm);
        TextView expTitle = new TextView(this);
        expTitle.setText("Экспорт полного аудита устройства");
        expTitle.setTextColor(tm.colorAccent);
        expTitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        expTitle.setTypeface(Typeface.DEFAULT_BOLD);
        exportCard.addView(expTitle);

        TextView expDesc = new TextView(this);
        expDesc.setText("Генерирует исчерпывающий отчёт со всеми характеристиками, скрытыми свойствами и параметрами оборудования.");
        expDesc.setTextColor(tm.colorTextSecondary);
        expDesc.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        expDesc.setPadding(0, UiBuilder.dp(this, 4), 0, UiBuilder.dp(this, 12));
        exportCard.addView(expDesc);

        Button copyReportBtn = UiBuilder.createButton(this, "📋 Скопировать отчёт в буфер обмена", tm.colorAccent, tm.colorBackground == 0xFF000000 ? 0xFF000000 : 0xFFFFFFFF, v -> {
            String rep = ReportExporter.generateFullReport(this, ThemeManager.getTempUnit(this), ThemeManager.getFreqUnit(this));
            ReportExporter.copyToClipboard(this, rep);
        });
        LinearLayout.LayoutParams crLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        crLp.setMargins(0, 0, 0, UiBuilder.dp(this, 8));
        exportCard.addView(copyReportBtn, crLp);

        Button shareReportBtn = UiBuilder.createButton(this, "📤 Поделиться отчётом (Telegram / Заметки)", 0x2258A6FF, tm.colorAccent, v -> {
            String rep = ReportExporter.generateFullReport(this, ThemeManager.getTempUnit(this), ThemeManager.getFreqUnit(this));
            ReportExporter.shareReport(this, rep);
        });
        exportCard.addView(shareReportBtn, crLp);

        contentContainer.addView(exportCard);

        // 7. About App Card
        LinearLayout aboutCard = UiBuilder.createCard(this, tm);
        TextView aboutTitle = new TextView(this);
        aboutTitle.setText("О приложении DevInspector Ultra");
        aboutTitle.setTextColor(tm.colorAccent);
        aboutTitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        aboutTitle.setTypeface(Typeface.DEFAULT_BOLD);
        aboutCard.addView(aboutTitle);

        String info =
                "• Версия: 1.0.0 Pro Deep\n" +
                "• Компактный размер: < 150 КБ (без раздутых библиотек)\n" +
                "• Прямой доступ: чтение ядра Linux (/proc, /sys), системных свойств getprop и закрытых IPC сервисов\n" +
                "• Полная конфиденциальность: не требует интернета, не собирает аналитику\n" +
                "• Лицензия: MIT Open Source";
        TextView infoTv = new TextView(this);
        infoTv.setText(info);
        infoTv.setTextColor(tm.colorTextPrimary);
        infoTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        infoTv.setPadding(0, UiBuilder.dp(this, 6), 0, 0);
        aboutCard.addView(infoTv);

        contentContainer.addView(aboutCard);
    }

    private void setupAutoRefresh() {
        refreshHandler.removeCallbacksAndMessages(null);
        int interval = ThemeManager.getRefreshInterval(this);
        if (interval > 0) {
            refreshRunnable = new Runnable() {
                @Override
                public void run() {
                    // Only auto-refresh if on live monitoring tabs: Overview, CPU, Memory, Battery, Thermal
                    if (currentTab == 0 || currentTab == 1 || currentTab == 2 || currentTab == 3 || currentTab == 8) {
                        renderContent();
                    }
                    refreshHandler.postDelayed(this, interval);
                }
            };
            refreshHandler.postDelayed(refreshRunnable, interval);
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (liveSensorValuesTv != null && activeSensor != null) {
            float[] vals = event.values;
            StringBuilder sb = new StringBuilder();
            sb.append("Датчик: ").append(activeSensor.getName()).append("\n");
            sb.append("Точность (Accuracy): ").append(event.accuracy).append("\n");

            if (vals.length == 1) {
                sb.append("Значение: ").append(String.format(Locale.US, "%.3f", vals[0]));
            } else if (vals.length >= 3) {
                sb.append("X: ").append(String.format(Locale.US, "%.4f", vals[0])).append("\n");
                sb.append("Y: ").append(String.format(Locale.US, "%.4f", vals[1])).append("\n");
                sb.append("Z: ").append(String.format(Locale.US, "%.4f", vals[2]));
                if (vals.length > 3) {
                    sb.append("\nДоп: ").append(String.format(Locale.US, "%.4f", vals[3]));
                }
            }
            liveSensorValuesTv.setText(sb.toString());
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    @Override
    protected void onResume() {
        super.onResume();
        setupAutoRefresh();
        if (activeSensor != null && currentTab == 6) {
            sensorManager.registerListener(this, activeSensor, SensorManager.SENSOR_DELAY_UI);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        refreshHandler.removeCallbacksAndMessages(null);
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
    }
}
