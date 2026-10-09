package com.jobprep.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.RemoteViews;

abstract class JobPrepWidgetProvider extends AppWidgetProvider {
    protected abstract String title();
    protected abstract String subtitle();
    protected abstract String actionLabel();
    protected abstract String destination();
    protected abstract String actionName();

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id);
    }

    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        update(context, manager, id);
    }

    private void update(Context context, AppWidgetManager manager, int id) {
        Bundle options = manager.getAppWidgetOptions(id);
        int width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
        int height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT);
        int layout = width < 180 || height < 120 ? R.layout.widget_jobprep_compact : R.layout.widget_jobprep_card;
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);
        views.setTextViewText(R.id.widget_title, title());
        views.setTextViewText(R.id.widget_subtitle, subtitle());
        views.setTextViewText(R.id.widget_action, actionLabel());

        Intent intent = new Intent(context, MainActivity.class)
                .setAction(actionName())
                .putExtra(MainActivity.EXTRA_WIDGET_DESTINATION, destination());
        PendingIntent pendingIntent = PendingIntent.getActivity(context, actionName().hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
        views.setOnClickPendingIntent(R.id.widget_action, pendingIntent);
        manager.updateAppWidget(id, views);
    }
}
