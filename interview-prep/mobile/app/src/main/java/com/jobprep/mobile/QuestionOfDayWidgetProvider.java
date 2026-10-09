package com.jobprep.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class QuestionOfDayWidgetProvider extends AppWidgetProvider {
    private static final String PREFS = "question_of_day_widget";
    private static final String CACHE = "questions";
    private static final String STATUS = "status";
    private static final String ACTION_PREVIOUS = "com.jobprep.mobile.QUESTION_PREVIOUS";
    private static final String ACTION_NEXT = "com.jobprep.mobile.QUESTION_NEXT";
    private static final String ACTION_REFRESH = "com.jobprep.mobile.QUESTION_REFRESH";
    private static final String EXTRA_ID = AppWidgetManager.EXTRA_APPWIDGET_ID;
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null || ids.length == 0) return;
        for (int id : ids) render(context, manager, id, "Loading today's questions…");
        PendingResult pending = goAsync();
        EXECUTOR.execute(() -> {
            try {
                JSONArray questions = fetchQuestions(context);
                preferences(context).edit().putString(CACHE, questions.toString()).remove(STATUS).apply();
            } catch (Exception error) {
                // Keep the last successful list visible if the network is temporarily unavailable.
                preferences(context).edit().putString(STATUS, safeMessage(error)).apply();
            } finally {
                AppWidgetManager currentManager = AppWidgetManager.getInstance(context);
                for (int id : ids) render(context, currentManager, id, null);
                pending.finish();
            }
        });
    }

    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        render(context, manager, id, null);
    }

    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        int id = intent.getIntExtra(EXTRA_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (ACTION_PREVIOUS.equals(action) || ACTION_NEXT.equals(action)) {
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID) move(context, manager, id, ACTION_NEXT.equals(action) ? 1 : -1);
            return;
        }
        if (ACTION_REFRESH.equals(action)) {
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID) onUpdate(context, manager, new int[]{id});
            return;
        }
        super.onReceive(context, intent);
    }

    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, QuestionOfDayWidgetProvider.class));
        if (ids.length == 0) return;
        Intent update = new Intent(context, QuestionOfDayWidgetProvider.class)
                .setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(update);
    }

    private static JSONArray fetchQuestions(Context context) throws Exception {
        String cookie = CookieManager.getInstance().getCookie(BuildConfig.WEB_ORIGIN);
        if (cookie == null || cookie.trim().isEmpty()) throw new IOException("Sign in to JobPrep to load today's questions.");
        HttpURLConnection connection = (HttpURLConnection) new URL(BuildConfig.WEB_ORIGIN + "/api/sessions/today").openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(3500);
        connection.setReadTimeout(4500);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Cookie", cookie);
        connection.setRequestProperty("User-Agent", "JobPrep-Android-Widget/1.1");
        try {
            int code = connection.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) {
                if (code == HttpURLConnection.HTTP_UNAUTHORIZED || code == HttpURLConnection.HTTP_FORBIDDEN)
                    throw new IOException("Sign in to JobPrep to load today's questions.");
                throw new IOException("Open JobPrep and refresh to load today's questions.");
            }
            JSONObject response = new JSONObject(readLimited(connection.getInputStream()));
            JSONObject data = response.optJSONObject("data");
            JSONArray sections = data == null ? null : data.optJSONArray("sections");
            JSONArray questions = new JSONArray();
            if (sections != null) {
                for (int i = 0; i < sections.length(); i++) {
                    JSONObject section = sections.optJSONObject(i);
                    JSONArray sectionQuestions = section == null ? null : section.optJSONArray("questions");
                    if (sectionQuestions == null) continue;
                    for (int j = 0; j < sectionQuestions.length(); j++) {
                        JSONObject q = sectionQuestions.optJSONObject(j);
                        if (q == null) continue;
                        String text = q.optString("question", "").trim();
                        String id = q.optString("id", "").trim();
                        if (text.isEmpty() || id.isEmpty()) continue;
                        JSONObject item = new JSONObject();
                        item.put("id", id);
                        item.put("question", text);
                        item.put("topic", firstNonEmpty(q.optString("topic", ""), section.optString("title", "Today's questions")));
                        item.put("status", q.optString("status", "pending"));
                        item.put("order", q.optInt("order", questions.length()));
                        questions.put(item);
                    }
                }
            }
            if (questions.length() == 0) throw new IOException("Today's questions are still being prepared. Open JobPrep, then refresh.");
            return questions;
        } finally {
            connection.disconnect();
        }
    }

    private static String readLimited(InputStream input) throws IOException {
        try (InputStream stream = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int total = 0;
            int count;
            while ((count = stream.read(buffer)) != -1) {
                total += count;
                if (total > 1_000_000) throw new IOException("Today's question list is too large to show.");
                output.write(buffer, 0, count);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private static String firstNonEmpty(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private static String safeMessage(Exception error) {
        String message = error.getMessage();
        return message == null || message.trim().isEmpty() ? "Open JobPrep and refresh to load today's questions." : message;
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static void move(Context context, AppWidgetManager manager, int id, int amount) {
        SharedPreferences prefs = preferences(context);
        JSONArray questions;
        try { questions = new JSONArray(prefs.getString(CACHE, "[]")); }
        catch (Exception ignored) { questions = new JSONArray(); }
        int count = questions.length();
        if (count > 0) {
            int index = prefs.getInt("index_" + id, 0);
            index = (index + amount + count) % count;
            prefs.edit().putInt("index_" + id, index).apply();
        }
        render(context, manager, id, null);
    }

    private static void render(Context context, AppWidgetManager manager, int id, String loadingText) {
        Bundle options = manager.getAppWidgetOptions(id);
        int width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
        int height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT);
        int layout = width < 220 || height < 140 ? R.layout.widget_question_compact : R.layout.widget_question_card;
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);
        SharedPreferences prefs = preferences(context);
        JSONArray questions;
        try { questions = new JSONArray(prefs.getString(CACHE, "[]")); }
        catch (Exception ignored) { questions = new JSONArray(); }

        JSONObject selected = null;
        int count = questions.length();
        int index = count == 0 ? 0 : Math.floorMod(prefs.getInt("index_" + id, 0), count);
        if (count > 0) {
            try { selected = questions.getJSONObject(index); } catch (Exception ignored) { }
        }
        String topic = selected == null ? "TODAY'S QUESTIONS" : selected.optString("topic", "Today's questions");
        String question = loadingText != null ? loadingText : selected == null
                ? prefs.getString(STATUS, "Open JobPrep and refresh to load today's questions.")
                : selected.optString("question", "Open JobPrep to continue.");
        views.setTextViewText(R.id.question_topic, topic);
        views.setTextViewText(R.id.question_position, count == 0 ? "—" : (index + 1) + " / " + count);
        views.setTextViewText(R.id.question_text, question);
        views.setTextViewText(R.id.question_previous, "‹  Previous");
        views.setTextViewText(R.id.question_next, "Next  ›");
        views.setTextViewText(R.id.question_refresh, "↻");

        String questionId = selected == null ? "" : selected.optString("id", "");
        Intent open = new Intent(context, MainActivity.class)
                .setAction("com.jobprep.mobile.OPEN_QUESTION_WIDGET_" + id + "_" + questionId)
                .putExtra(MainActivity.EXTRA_WIDGET_DESTINATION, "/sessions/today")
                .putExtra(MainActivity.EXTRA_WIDGET_QUESTION_ID, questionId);
        PendingIntent openIntent = PendingIntent.getActivity(context, id * 37 + (questionId.hashCode() & 0x7fff), open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, openIntent);
        views.setOnClickPendingIntent(R.id.question_text, openIntent);
        views.setOnClickPendingIntent(R.id.question_previous, broadcast(context, id, ACTION_PREVIOUS));
        views.setOnClickPendingIntent(R.id.question_next, broadcast(context, id, ACTION_NEXT));
        views.setOnClickPendingIntent(R.id.question_refresh, broadcast(context, id, ACTION_REFRESH));
        manager.updateAppWidget(id, views);
    }

    private static PendingIntent broadcast(Context context, int id, String action) {
        Intent intent = new Intent(context, QuestionOfDayWidgetProvider.class).setAction(action).putExtra(EXTRA_ID, id);
        return PendingIntent.getBroadcast(context, id * 31 + action.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
