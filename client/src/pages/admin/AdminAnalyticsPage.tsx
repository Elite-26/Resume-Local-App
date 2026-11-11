import { useEffect, useMemo, useState } from 'react';
import { api, type Analytics } from '../../lib/api';

const SERIES_COLORS = [
  '#2f6b55',
  '#c45c26',
  '#3d8f70',
  '#5c6f67',
  '#1a3d32',
  '#a85a2a',
  '#4a7c6f',
  '#8b4513',
];

function ApplicationTrackChart({
  days,
  series,
}: {
  days: string[];
  series: Analytics['applicationTracks']['series'];
}) {
  const width = 720;
  const height = 320;
  const pad = { top: 20, right: 20, bottom: 44, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxY = Math.max(
    1,
    ...series.flatMap((s) => s.values),
  );

  const xAt = (i: number) =>
    pad.left + (days.length <= 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
  const yAt = (v: number) => pad.top + innerH - (v / maxY) * innerH;

  const yTicks = useMemo(() => {
    const steps = Math.min(5, maxY);
    const ticks: number[] = [];
    for (let i = 0; i <= steps; i++) {
      ticks.push(Math.round((maxY / steps) * i));
    }
    return [...new Set(ticks)];
  }, [maxY]);

  const xLabelIndexes = useMemo(() => {
    if (days.length <= 8) return days.map((_, i) => i);
    const step = Math.ceil(days.length / 7);
    const idxs = [0];
    for (let i = step; i < days.length - 1; i += step) idxs.push(i);
    idxs.push(days.length - 1);
    return [...new Set(idxs)];
  }, [days]);

  if (series.length === 0) {
    return <p className="text-sm text-muted">No profiles yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[320px] sm:min-w-[480px] h-auto"
          role="img"
          aria-label="Applications by profile over date"
        >
          {/* Grid + axes */}
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke="currentColor"
                className="text-black/10 dark:text-white/10"
                strokeWidth={1}
              />
              <text
                x={pad.left - 8}
                y={yAt(t) + 4}
                textAnchor="end"
                className="fill-muted"
                fontSize={10}
              >
                {t}
              </text>
            </g>
          ))}
          <line
            x1={pad.left}
            x2={pad.left}
            y1={pad.top}
            y2={height - pad.bottom}
            stroke="currentColor"
            className="text-black/20 dark:text-white/20"
          />
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={height - pad.bottom}
            y2={height - pad.bottom}
            stroke="currentColor"
            className="text-black/20 dark:text-white/20"
          />

          {xLabelIndexes.map((i) => (
            <text
              key={days[i]}
              x={xAt(i)}
              y={height - pad.bottom + 16}
              textAnchor="middle"
              className="fill-muted"
              fontSize={9}
            >
              {days[i]}
            </text>
          ))}

          {/* Series lines + points */}
          {series.map((s, si) => {
            const color = SERIES_COLORS[si % SERIES_COLORS.length];
            const points = s.values
              .map((v, i) => `${xAt(i)},${yAt(v)}`)
              .join(' ');
            return (
              <g key={s.profileId}>
                <polyline
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={points}
                />
                {s.values.map((v, i) => (
                  <circle
                    key={`${s.profileId}-${i}`}
                    cx={xAt(i)}
                    cy={yAt(v)}
                    r={v > 0 ? 3.5 : 2}
                    fill={color}
                    opacity={v > 0 ? 1 : 0.35}
                  >
                    <title>
                      {s.profileName}: {days[i]} — {v} application
                      {v === 1 ? '' : 's'}
                    </title>
                  </circle>
                ))}
              </g>
            );
          })}

          <text
            x={pad.left}
            y={14}
            className="fill-muted"
            fontSize={10}
          >
            Applications
          </text>
          <text
            x={width / 2}
            y={height - 6}
            textAnchor="middle"
            className="fill-muted"
            fontSize={10}
          >
            Date
          </text>
        </svg>
      </div>

      <div className="flex flex-wrap gap-3">
        {series.map((s, si) => (
          <div key={s.profileId} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ background: SERIES_COLORS[si % SERIES_COLORS.length] }}
            />
            <span>{s.profileName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .adminAnalytics()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <p className="text-sm text-ember bg-ember/10 rounded-xl px-3 py-2">{error}</p>;
  }
  if (!data) return <p className="text-muted">Loading dashboard…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-lead">
          Profiles, users, assignments, and application tracks.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Profiles</p>
          <p className="font-display text-3xl mt-2">{data.totalProfiles}</p>
        </div>
        <div className="surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Users</p>
          <p className="font-display text-3xl mt-2">{data.totalUsers}</p>
          <p className="text-xs text-muted mt-1">Admins not included</p>
        </div>
      </div>

      <section className="surface p-4 sm:p-6 space-y-4">
        <h2 className="font-display text-lg sm:text-xl">Assigned profiles by user</h2>
        {data.assignmentsByUser.length === 0 ? (
          <p className="text-sm text-muted">No users yet.</p>
        ) : (
          <div className="space-y-3">
            {data.assignmentsByUser.map((u) => (
              <div
                key={u.userId}
                className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-black/5 dark:border-white/10 pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-[10rem]">
                  <p className="font-medium text-sm">{u.userName}</p>
                  <p className="text-xs text-muted">{u.userEmail}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {u.profiles.length === 0 ? (
                    <span className="text-sm text-muted">No profiles assigned</span>
                  ) : (
                    u.profiles.map((name) => (
                      <span
                        key={`${u.userId}-${name}`}
                        className="inline-flex rounded-md bg-sage/15 text-sage px-2 py-0.5 text-xs font-medium"
                      >
                        {name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="surface p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg sm:text-xl">Application tracks by profile</h2>
          <p className="text-xs text-muted mt-1">
            Date (X) × applications (Y) for each profile — last 30 days.
          </p>
        </div>
        <ApplicationTrackChart
          days={data.applicationTracks.days}
          series={data.applicationTracks.series}
        />
      </section>
    </div>
  );
}
