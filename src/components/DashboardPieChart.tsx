"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  DASHBOARD_CHART_METRIC_COLORS,
  DASHBOARD_CHART_METRIC_LABELS,
  type DashboardChartMetric,
} from "@/lib/constants";
import type { DashboardStats } from "@/lib/types";

type DashboardPieChartProps = {
  stats: DashboardStats;
  metrics: DashboardChartMetric[];
  canConfigure?: boolean;
};

type ChartEntry = {
  key: DashboardChartMetric;
  label: string;
  color: string;
  value: number;
  percentage: number;
};

const CHART_SIZE = 220;
const CHART_CENTER = CHART_SIZE / 2;
const CHART_RADIUS = 74;
const CHART_CIRCUMFERENCE = 2 * Math.PI * CHART_RADIUS;
const SEGMENT_GAP = 8;

export function DashboardPieChart({ stats, metrics, canConfigure = false }: DashboardPieChartProps) {
  const allEntries = useMemo<ChartEntry[]>(() => {
    const baseEntries = metrics.map((metric) => ({
      key: metric,
      label: DASHBOARD_CHART_METRIC_LABELS[metric],
      color: DASHBOARD_CHART_METRIC_COLORS[metric],
      value: stats[metric],
      percentage: 0,
    }));

    const total = baseEntries.reduce((sum, entry) => sum + entry.value, 0);

    return baseEntries.map((entry) => ({
      ...entry,
      percentage: total > 0 ? (entry.value / total) * 100 : 0,
    }));
  }, [metrics, stats]);

  const entries = allEntries.filter((entry) => entry.value > 0);
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  const [hoveredMetric, setHoveredMetric] = useState<DashboardChartMetric | null>(null);

  const activeEntry = entries.find((entry) => entry.key === hoveredMetric) ?? entries[0] ?? null;

  let cumulativeLength = 0;

  return (
    <div className="card dashboard-chart-card">
      <div className="page-header">
        <div>
          <h3>תרשים מצב מבחנים</h3>
          <p>
            מעבר עכבר מעל חתיכה מציג את הנתון, הכמות והאחוז שלו מתוך המדדים שמוצגים כרגע. מדדים שערכם 0 לא מוצגים
            בתרשים.
          </p>
        </div>
        {canConfigure ? (
          <Link className="button button-secondary" href="/settings">
            התאמת התרשים
          </Link>
        ) : null}
      </div>

      <div className="dashboard-chart-layout">
        <div className="dashboard-chart-visual">
          <div className="dashboard-chart-shell">
            <svg
              className="dashboard-chart-svg"
              viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
              role="img"
              aria-label="תרשים עוגה של מצב המבחנים"
            >
              <defs>
                <filter id="dashboard-chart-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="rgba(16, 32, 51, 0.18)" />
                </filter>
              </defs>
              <circle
                cx={CHART_CENTER}
                cy={CHART_CENTER}
                r={CHART_RADIUS}
                fill="none"
                stroke="rgba(16, 32, 51, 0.08)"
                strokeWidth="30"
              />
              {entries.map((entry) => {
                const rawLength = total > 0 ? (entry.value / total) * CHART_CIRCUMFERENCE : 0;
                const dashLength =
                  entries.length > 1 && rawLength > SEGMENT_GAP ? rawLength - SEGMENT_GAP : rawLength;
                const isActive = activeEntry?.key === entry.key;
                const dashOffset = -cumulativeLength;

                cumulativeLength += rawLength;

                return (
                  <circle
                    key={entry.key}
                    className={`dashboard-chart-segment${isActive ? " is-active" : ""}`}
                    cx={CHART_CENTER}
                    cy={CHART_CENTER}
                    r={CHART_RADIUS}
                    fill="none"
                    stroke={entry.color}
                    strokeWidth={isActive ? 36 : 30}
                    strokeLinecap="round"
                    strokeDasharray={`${Math.max(dashLength, 0)} ${CHART_CIRCUMFERENCE}`}
                    strokeDashoffset={dashOffset}
                    transform={`rotate(-90 ${CHART_CENTER} ${CHART_CENTER})`}
                    filter={isActive ? "url(#dashboard-chart-glow)" : undefined}
                    tabIndex={0}
                    onMouseEnter={() => setHoveredMetric(entry.key)}
                    onMouseLeave={() => setHoveredMetric(null)}
                    onFocus={() => setHoveredMetric(entry.key)}
                    onBlur={() => setHoveredMetric(null)}
                  >
                    <title>{`${entry.label}: ${entry.value}`}</title>
                  </circle>
                );
              })}
            </svg>

            <div className="dashboard-chart-center">
              <span>{activeEntry?.label ?? "אין נתונים"}</span>
              <strong>{activeEntry?.value ?? 0}</strong>
              <small>
                {activeEntry
                  ? `${Math.round(activeEntry.percentage)}% מתוך סך הנתונים המוצגים`
                  : "עדיין אין נתונים להצגה"}
              </small>
            </div>
          </div>

          <div className="dashboard-chart-hover-card">
            <span className="dashboard-chart-hover-label">
              {activeEntry?.label ?? "טרם נבחר מדד"}
            </span>
            <strong>{activeEntry?.value ?? 0}</strong>
            <small>
              {activeEntry
                ? `${activeEntry.percentage.toFixed(1)}% מתוך ${total} פריטים שמוצגים בתרשים`
                : "התרשים יתעדכן ברגע שיוזנו מבחנים"}
            </small>
          </div>
        </div>

        <div className="dashboard-chart-legend">
          {entries.map((entry) => {
            const isActive = activeEntry?.key === entry.key;

            return (
              <button
                key={entry.key}
                type="button"
                className={`dashboard-chart-legend-item${isActive ? " is-active" : ""}`}
                onMouseEnter={() => setHoveredMetric(entry.key)}
                onMouseLeave={() => setHoveredMetric(null)}
                onFocus={() => setHoveredMetric(entry.key)}
                onBlur={() => setHoveredMetric(null)}
              >
                <span className="dashboard-chart-legend-meta">
                  <span
                    className="dashboard-chart-legend-swatch"
                    style={{ backgroundColor: entry.color }}
                    aria-hidden="true"
                  />
                  <span className="dashboard-chart-legend-text">
                    <strong>{entry.label}</strong>
                    <small>{entry.percentage.toFixed(1)}% מתוך המדדים המוצגים</small>
                  </span>
                </span>
                <span className="dashboard-chart-legend-value">{entry.value}</span>
              </button>
            );
          })}
          {entries.length === 0 ? <div className="muted">כרגע אין מדדים עם ערך גדול מאפס להצגה בתרשים.</div> : null}
        </div>
      </div>
    </div>
  );
}
