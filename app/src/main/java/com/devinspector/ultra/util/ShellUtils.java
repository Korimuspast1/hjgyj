package com.devinspector.ultra.util;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class ShellUtils {

    public static String readFile(String path) {
        File file = new File(path);
        if (!file.exists() || !file.canRead()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (sb.length() > 0) sb.append("\n");
                sb.append(line);
            }
            return sb.toString().trim();
        } catch (Exception e) {
            return null;
        }
    }

    public static List<String> readFileLines(String path) {
        File file = new File(path);
        if (!file.exists() || !file.canRead()) {
            return Collections.emptyList();
        }
        List<String> lines = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lines.add(line);
            }
        } catch (Exception ignored) {
        }
        return lines;
    }

    public static String executeCommand(String command) {
        try {
            Process process = Runtime.getRuntime().exec(command);
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                if (output.length() > 0) output.append("\n");
                output.append(line);
            }
            process.waitFor();
            return output.toString().trim();
        } catch (Exception e) {
            return null;
        }
    }

    public static List<String> executeCommandLines(String command) {
        List<String> list = new ArrayList<>();
        try {
            Process process = Runtime.getRuntime().exec(command);
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            while ((line = reader.readLine()) != null) {
                list.add(line);
            }
            process.waitFor();
        } catch (Exception ignored) {
        }
        return list;
    }

    public static boolean fileExists(String path) {
        try {
            return new File(path).exists();
        } catch (Exception e) {
            return false;
        }
    }
}
