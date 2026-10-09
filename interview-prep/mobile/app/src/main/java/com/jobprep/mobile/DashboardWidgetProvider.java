package com.jobprep.mobile;

public final class DashboardWidgetProvider extends JobPrepWidgetProvider {
    @Override protected String title() { return "Dashboard"; }
    @Override protected String subtitle() { return "Your interview prep at a glance"; }
    @Override protected String actionLabel() { return "Open dashboard"; }
    @Override protected String destination() { return "/dashboard"; }
    @Override protected String actionName() { return "com.jobprep.mobile.OPEN_DASHBOARD_WIDGET"; }
}
