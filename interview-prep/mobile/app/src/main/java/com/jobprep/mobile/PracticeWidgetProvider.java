package com.jobprep.mobile;

public final class PracticeWidgetProvider extends JobPrepWidgetProvider {
    @Override protected String title() { return "Practice"; }
    @Override protected String subtitle() { return "Pick up today's interview questions"; }
    @Override protected String actionLabel() { return "Start practice"; }
    @Override protected String destination() { return "/sessions/today"; }
    @Override protected String actionName() { return "com.jobprep.mobile.OPEN_PRACTICE_WIDGET"; }
}
