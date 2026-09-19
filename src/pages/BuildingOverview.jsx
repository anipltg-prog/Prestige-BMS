
import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  Cpu,
  Download,
  Fan,
  FileJson,
  Gauge,
  Lightbulb,
  Lock,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  buildings,
  systemSummary,
  getFloorClientCount,
  getBuildingClientCount,
} from "../data/bmsData";
import prestigeLogo from "../assets/ser-removebg.png";
import { tempApi } from "../tempAdminApi";
import { USER_PERMISSIONS } from "../data/permissionOptions";
import {
  canAccessBuilding,
  canAccessFloor,
  hasPermission as accountHasPermission,
  isAdmin,
  isSuperAdmin,
  normalizeFloorId,
  resolveNearestAllowedParentRoute,
} from "../utils/accessControl";

const RATE_PER_KWH = 8.5;

const PERIOD_MULTIPLIERS = {
  hourly: 0.045,
  daily: 1,
  weekly: 7,
  monthly: 30,
};

const PERIOD_LABELS = {
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

const SYSTEMS = [
  {
    id: "ahu",
    title: "AHU / Chillers",
    icon: Fan,
    status: "Healthy",
    tone: "green",
    baseConsumption: 4860,
    currentLoad: 428,
    energyShare: 31,
    efficiency: 92,
    readings: [
      { label: "Running", value: `${systemSummary.ahu.running} Units` },
      { label: "Avg Temp", value: systemSummary.ahu.temperature },
      { label: "Humidity", value: systemSummary.ahu.humidity },
    ],
  },
  {
    id: "lighting",
    title: "LDB / Lighting",
    icon: Lightbulb,
    status: "Healthy",
    tone: "green",
    baseConsumption: 2940,
    currentLoad: 236,
    energyShare: 19,
    efficiency: 89,
    readings: [
      { label: "Active Zones", value: `${systemSummary.ldb.on}` },
      { label: "Inactive Zones", value: `${systemSummary.ldb.off}` },
      { label: "Load Factor", value: systemSummary.ldb.load },
    ],
  },
  {
    id: "ems",
    title: "EMS / Energy",
    icon: Gauge,
    status: "Healthy",
    tone: "green",
    baseConsumption: 2480,
    currentLoad: 198,
    energyShare: 16,
    efficiency: 98,
    readings: [
      { label: "Energy Used", value: systemSummary.ems.kwh },
      { label: "Demand", value: `${systemSummary.ems.kw ?? 1284} kW` },
      { label: "Power Factor", value: systemSummary.ems.pf },
    ],
  },
  {
    id: "electrical",
    title: "Electrical Distribution",
    icon: Activity,
    status: "Attention",
    tone: "amber",
    baseConsumption: 1710,
    currentLoad: 136,
    energyShare: 11,
    efficiency: 94,
    readings: [
      { label: "PCC Panels", value: "4 Online" },
      { label: "Busduct", value: "Healthy" },
      { label: "Breakers", value: "98% Closed" },
    ],
  },
  {
    id: "transformers",
    title: "Transformers",
    icon: Cpu,
    status: "Healthy",
    tone: "green",
    baseConsumption: 1240,
    currentLoad: 102,
    energyShare: 8,
    efficiency: 96,
    readings: [
      { label: "Running", value: "6 Units" },
      { label: "Oil Temp", value: "62°C" },
      { label: "Load", value: "74%" },
    ],
  },
  {
    id: "dg",
    title: "Diesel Generators",
    icon: Zap,
    status: "Standby",
    tone: "blue",
    baseConsumption: 760,
    currentLoad: 58,
    energyShare: 5,
    efficiency: 85,
    readings: [
      { label: "Running", value: "2 Units" },
      { label: "Fuel", value: "78%" },
      { label: "Load", value: "58%" },
    ],
  },
  {
    id: "water",
    title: "Water Management",
    icon: Activity,
    status: "Healthy",
    tone: "green",
    baseConsumption: 520,
    currentLoad: 42,
    energyShare: 3,
    efficiency: 91,
    readings: [
      { label: "UG Tank", value: "82%" },
      { label: "OH Tank", value: "76%" },
      { label: "Pumps", value: "3 Running" },
    ],
  },
  {
    id: "lifts",
    title: "Lifts",
    icon: Activity,
    status: "Healthy",
    tone: "green",
    baseConsumption: 470,
    currentLoad: 38,
    energyShare: 3,
    efficiency: 93,
    readings: [
      { label: "Online", value: "6 Units" },
      { label: "Running", value: "4 Units" },
      { label: "Faulted", value: "0" },
    ],
  },
  {
    id: "fire",
    title: "Fire Safety",
    icon: AlertTriangle,
    status: "Healthy",
    tone: "green",
    baseConsumption: 210,
    currentLoad: 18,
    energyShare: 1,
    efficiency: 99,
    readings: [
      { label: "Panel", value: "Online" },
      { label: "Alarms", value: "0" },
      { label: "Pressure", value: "7.2 bar" },
    ],
  },
  {
    id: "air",
    title: "Air Quality",
    icon: Fan,
    status: "Healthy",
    tone: "green",
    baseConsumption: 185,
    currentLoad: 14,
    energyShare: 1,
    efficiency: 95,
    readings: [
      { label: "CO₂", value: "620 ppm" },
      { label: "PM2.5", value: "18 µg/m³" },
      { label: "Quality", value: "Good" },
    ],
  },
  {
    id: "ups",
    title: "UPS",
    icon: Cpu,
    status: "Healthy",
    tone: "green",
    baseConsumption: 330,
    currentLoad: 26,
    energyShare: 2,
    efficiency: 97,
    readings: [
      { label: "Status", value: "Online" },
      { label: "Backup", value: "42 min" },
      { label: "Battery", value: "94%" },
    ],
  },
  {
    id: "tenant",
    title: "Tenant Zones",
    icon: Building2,
    status: "Healthy",
    tone: "green",
    baseConsumption: 295,
    currentLoad: 24,
    energyShare: 2,
    efficiency: 94,
    readings: [
      { label: "Clients", value: "40" },
      { label: "Occupied", value: "36" },
      { label: "Alerts", value: "0" },
    ],
  },
];

const HOURLY_PATTERN = [
  0.34, 0.31, 0.29, 0.28, 0.27, 0.31, 0.39, 0.51,
  0.63, 0.72, 0.78, 0.83, 0.88, 0.85, 0.81, 0.84,
  0.91, 0.98, 0.94, 0.86, 0.75, 0.62, 0.49, 0.39,
];

function StatusBadge({ tone, children }) {
  const toneClass = {
    green: "border-emerald-300 bg-emerald-50 text-emerald-700",
    amber: "border-amber-300 bg-amber-50 text-amber-700",
    blue: "border-blue-300 bg-[#EAF4F6] text-blue-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] ${toneClass[tone]}`}
    >
      <span
        className={`h-1.5 w-1.5 ${
          tone === "amber"
            ? "bg-amber-500"
            : tone === "blue"
              ? "bg-[#EAF4F6]0"
              : "bg-emerald-500"
        }`}
      />
      {children}
    </span>
  );
}

function SystemCard({ system, locked = false }) {
  const Icon = system.icon;

  const statusStyles = {
    green: {
      dot: "bg-[#31B878]",
      text: "text-emerald-200",
      border: "border-emerald-400/30",
      background: "bg-[#31B878]/10",
      line: "bg-[#31B878]",
    },
    amber: {
      dot: "bg-[#E6B92E]",
      text: "text-amber-200",
      border: "border-amber-400/30",
      background: "bg-[#E6B92E]/10",
      line: "bg-[#E6B92E]",
    },
    blue: {
      dot: "bg-[#55B7C4]",
      text: "text-[#8ED0DA]",
      border: "border-cyan-300/30",
      background: "bg-[#55B7C4]/10",
      line: "bg-[#55B7C4]",
    },
  };

  const status = locked
    ? {
        dot: "bg-slate-400",
        text: "text-slate-200",
        border: "border-slate-300/30",
        background: "bg-slate-300/10",
        line: "bg-slate-500",
      }
    : statusStyles[system.tone] ?? statusStyles.green;

  const primaryMetrics = [
    {
      label: "Current Load",
      value: locked ? "No Access" : system.currentLoad.toLocaleString("en-IN"),
      unit: locked ? "" : "kW",
      valueClass: "text-[#3A95AA]",
    },
    {
      label: "Consumption",
      value: locked ? "No Access" : system.baseConsumption.toLocaleString("en-IN"),
      unit: locked ? "" : "kWh",
      valueClass: "text-[#142B3A]",
    },
  ];

  return (
    <article className={`group relative flex h-full min-h-[255px] flex-col overflow-hidden rounded-[22px] border text-[#142B3A] shadow-[0_18px_42px_rgba(19,45,62,0.11),inset_0_1px_0_rgba(255,255,255,0.96)] backdrop-blur-xl transition-all duration-200 ${
      locked
        ? "border-slate-300/80 bg-[linear-gradient(145deg,rgba(245,247,248,0.95),rgba(226,232,235,0.92))] opacity-75"
        : "border-white/85 bg-[linear-gradient(145deg,rgba(255,255,255,0.97),rgba(239,245,248,0.93)_58%,rgba(226,236,240,0.9))] hover:-translate-y-1 hover:border-white hover:shadow-[0_26px_58px_rgba(19,45,62,0.16),inset_0_1px_0_rgba(255,255,255,1)]"
    }`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_0%,rgba(80,170,190,0.15),transparent_34%)]" />
      <div className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#7BC7D3,#3A91AA,#D4B76A)]" />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 px-5 pb-3.5 pt-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-cyan-300/25 bg-white/[0.08] text-[#3A95AA] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <Icon size={28} strokeWidth={2.1} />
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-black uppercase tracking-[0.065em] text-[#142B3A]">
                {system.title}
              </h3>

              <p className="mt-1.5 text-[8px] font-bold uppercase tracking-[0.13em] text-[#B9CFD7]/60">
                {locked ? "Hierarchy Only" : "Live Operational Data"}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.08em] ${status.border} ${status.background} ${status.text}`}
          >
            <span className={`h-1.5 w-1.5 ${status.dot}`} />
            {locked ? (
              <>
                <Lock size={11} />
                No Access
              </>
            ) : (
              system.status
            )}
          </span>
        </header>

        <div className="mx-5 grid grid-cols-2 gap-x-5 py-2">
          {primaryMetrics.map((metric) => (
            <div key={metric.label} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[8px] font-black uppercase tracking-[0.1em] text-[#758A93]">
                  {metric.label}
                </span>

                <span className="shrink-0 text-[8px] font-bold uppercase text-[#B9CFD7]/50">
                  {metric.unit}
                </span>
              </div>

              <p
                className={`mt-1.5 truncate text-[21px] font-black leading-none tracking-tight ${metric.valueClass}`}
              >
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mx-5 my-2 h-px bg-[#CCDDE2]" />

        <div className="flex flex-1 flex-col justify-center px-5 py-2">
          {locked ? (
            <div className="border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-100">
              Operational readings hidden
            </div>
          ) : (
            system.readings.slice(0, 3).map((reading) => (
              <div
                key={reading.label}
                className="flex min-h-[32px] items-center justify-between gap-4 py-1.5"
              >
                <span className="min-w-0 truncate text-[9px] font-bold uppercase tracking-[0.065em] text-[#667F89]">
                  {reading.label}
                </span>

                <span className="shrink-0 text-right text-[11px] font-black text-[#142B3A]">
                  {reading.value}
                </span>
              </div>
            ))
          )}
        </div>

        <footer className="px-5 pb-4 pt-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[8px] font-black uppercase tracking-[0.11em] text-[#B9CFD7]/55">
              Operational Efficiency
            </span>

            <span className="text-[10px] font-black text-[#3A95AA]">
              {locked ? "No Access" : `${system.efficiency}%`}
            </span>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-[#D9E5E9]">
            <div
              className={`h-full ${status.line}`}
              style={{ width: locked ? "0%" : `${system.efficiency}%` }}
            />
          </div>
        </footer>
      </div>
    </article>
  );
}

function ViewSelector({
  activeView,
  onChange,
  canViewAnalytics = false,
}) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-[#73AFC0] bg-white">
      <button
        type="button"
        onClick={() => onChange("monitoring")}
        className={`flex h-[36px] items-center gap-2 px-4 text-[9px] font-black uppercase tracking-[0.12em] transition ${
          activeView === "monitoring"
            ? "bg-[#102536] text-white"
            : "text-[#142B3A] hover:bg-[#EAF4F6]"
        }`}
      >
        <Building2 size={13} />
        Floors & Systems
      </button>

      <button
        type="button"
        onClick={() => {
          if (canViewAnalytics) {
            onChange("analytics");
          }
        }}
        disabled={!canViewAnalytics}
        title={
          canViewAnalytics
            ? "Open analytical view"
            : "Your account does not have report access"
        }
        className={`flex h-[36px] items-center gap-2 border-l border-[#73AFC0] px-4 text-[9px] font-black uppercase tracking-[0.12em] transition ${
          !canViewAnalytics
            ? "cursor-not-allowed bg-slate-100 text-slate-400"
            : activeView === "analytics"
              ? "bg-[#2B708B] text-white"
              : "text-[#2B708B] hover:bg-[#EAF4F6]"
        }`}
      >
        <BarChart3 size={13} />
        Analytic View
      </button>
    </div>
  );
}

function FloorMatrix({
  building,
  floors,
  currentUser,
  onLockedAccess,
}) {
  return (
    <aside className="grid grid-rows-[auto_auto_auto] overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(165deg,#102536_0%,#17384A_100%)] text-white shadow-[0_20px_46px_rgba(16,37,54,0.2)]">
      <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.05] px-4 py-3.5">
        <div>
          <p className="text-[7px] font-black uppercase tracking-[0.2em] text-[#3A95AA]">
            Floor Directory
          </p>

          <h3 className="mt-1 text-[14px] font-black uppercase tracking-wide">
            {building.floors} Levels · {getBuildingClientCount(building.id)} Clients
          </h3>
        </div>

        <div className="flex h-9 w-9 items-center justify-center border border-cyan-400/40 bg-[#2B708B] text-[#8ED0DA]">
          <Building2 size={17} />
        </div>
      </header>

      <div className="px-3 py-3">
        <div className="space-y-2">
          {floors.map((floor, index) => {
            const isCommonFloor =
              String(floor).toLowerCase() === "common";
            const hasAlert = !isCommonFloor && index === 2;
            const floorResourceId = normalizeFloorId(building.id, floor);
            const locked = !canAccessFloor(currentUser, floorResourceId);
            const clientCount = getFloorClientCount(building.id, floor);
            const Wrapper = locked ? "button" : Link;
            const wrapperProps = locked
              ? {
                  type: "button",
                  onClick: () => onLockedAccess?.(isCommonFloor ? "Common" : `Floor ${floor}`),
                }
              : {
                  to: `/building/${building.id}/floor/${floor}`,
                };

            return (
              <Wrapper
                key={floor}
                {...wrapperProps}
                className={`group flex h-[52px] w-full items-center justify-between border px-3 text-left text-white transition duration-200 ${
                  locked
                    ? "cursor-not-allowed border-slate-500/40 bg-[#10203F] opacity-75"
                    : "border-white/10 bg-white/[0.05] hover:border-cyan-300 hover:bg-white/[0.1]"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-10 shrink-0 items-center justify-center border border-cyan-400/30 bg-[#2B708B] text-[10px] font-black">
                    {isCommonFloor ? "C" : `${floor}F`}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[9px] font-black uppercase tracking-[0.06em]">
                      {isCommonFloor ? "Common" : `Floor ${floor}`}
                    </p>

                    <p className="mt-0.5 truncate text-[7px] text-[#B9CFD7]">
                      {locked
                        ? "Hierarchy only"
                        : `${clientCount} ${clientCount === 1 ? "Client" : "Clients"} · ${720 + index * 28} kWh`}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {locked ? (
                    <Lock size={12} className="text-[#D5A91F]" />
                  ) : (
                    <span
                      className={`h-1.5 w-1.5 ${
                        hasAlert ? "bg-[#E6B92E]" : "bg-[#31B878]"
                      }`}
                    />
                  )}

                  <span
                    className={`text-[7px] font-black uppercase tracking-[0.06em] ${
                      locked
                        ? "text-amber-200"
                        : hasAlert
                          ? "text-[#D5A91F]"
                          : "text-[#65C995]"
                    }`}
                  >
                    {locked ? "No Access" : hasAlert ? "Alert" : "Online"}
                  </span>
                </div>
              </Wrapper>
            );
          })}
        </div>
      </div>

      <footer className="grid grid-cols-2 border-t border-white/10 bg-black/10">
        <div className="border-r border-white/10 px-4 py-2.5">
          <p className="text-[7px] font-black uppercase tracking-[0.1em] text-[#8FB9C7]">
            Online Floors
          </p>
          <p className="mt-1 text-[13px] font-black text-white">
            {floors.filter((floor) =>
              canAccessFloor(currentUser, normalizeFloorId(building.id, floor))
            ).length}
          </p>
        </div>

        <div className="px-4 py-2.5">
          <p className="text-[7px] font-black uppercase tracking-[0.1em] text-[#8FB9C7]">
            Active Alerts
          </p>
          <p className="mt-1 text-[13px] font-black text-[#D5A91F]">
            Scoped
          </p>
        </div>
      </footer>
    </aside>
  );
}

function PeriodSelector({ period, onPeriodChange }) {
  return (
    <div className="flex flex-wrap overflow-hidden rounded-xl border border-[#73AFC0] bg-white">
      {["hourly", "daily", "weekly", "monthly", "custom"].map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onPeriodChange(item)}
          className={`h-[34px] border-r border-[#73AFC0] px-4 text-[8px] font-black uppercase tracking-[0.1em] last:border-r-0 ${
            period === item
              ? "bg-[#2B708B] text-white"
              : "bg-white text-[#2B708B] hover:bg-[#EAF4F6]"
          }`}
        >
          {PERIOD_LABELS[item]}
        </button>
      ))}
    </div>
  );
}

function SummaryCard({ label, value, helper, icon: Icon }) {
  return (
    <div className="rounded-[18px] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(239,245,248,0.92))] shadow-[0_16px_38px_rgba(20,45,62,0.09),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-[23px] font-black tracking-tight text-[#142B3A]">
            {value}
          </p>
          <p className="mt-1 text-[9px] text-slate-500">{helper}</p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center border border-[#BCD6DD] bg-[#F2F7FC] text-[#2B708B]">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function TrendChart({ values, labels }) {
  const width = 1200;
  const height = 420;
  const left = 62;
  const right = 1170;
  const top = 28;
  const bottom = 350;
  const max = Math.max(...values, 1);

  const points = values.map((value, index) => {
    const x =
      left +
      (index / Math.max(values.length - 1, 1)) *
        (right - left);
    const y = bottom - (value / max) * (bottom - top);
    return { x, y, value, index };
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
      {[0, 1, 2, 3, 4].map((line) => {
        const y = top + line * ((bottom - top) / 4);

        return (
          <line
            key={line}
            x1={left}
            x2={right}
            y1={y}
            y2={y}
            stroke="rgba(8,31,92,0.12)"
            strokeDasharray="4 4"
          />
        );
      })}

      <polyline
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke="#004AAD"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.map((point) => (
        <g key={point.index}>
          <circle cx={point.x} cy={point.y} r="3.5" fill="#00B8E6">
            <title>{`${labels[point.index]} — ${point.value.toLocaleString(
              "en-IN"
            )} kWh`}</title>
          </circle>

          {(values.length <= 12 || point.index % 3 === 0) && (
            <text
              x={point.x}
              y="392"
              textAnchor="middle"
              fontSize="9"
              fill="#64748B"
            >
              {labels[point.index]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function getCustomDayCount(startDate, endDate) {
  if (!startDate || !endDate) return 1;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1;
  }

  const difference = end.getTime() - start.getTime();

  if (difference < 0) return 1;

  return Math.floor(difference / 86400000) + 1;
}

function AnalyticsView({ building, canDownloadReports = false }) {
  const [period, setPeriod] = useState("daily");
  const [selectedSystem, setSelectedSystem] = useState("all");
  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate] = useState("2026-07-31");
  const [appliedStartDate, setAppliedStartDate] = useState("2026-07-01");
  const [appliedEndDate, setAppliedEndDate] = useState("2026-07-31");
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const customDays = useMemo(
    () => getCustomDayCount(appliedStartDate, appliedEndDate),
    [appliedStartDate, appliedEndDate]
  );

  const multiplier =
    period === "custom"
      ? customDays
      : PERIOD_MULTIPLIERS[period];

  const rows = useMemo(() => {
    const sourceSystems =
      selectedSystem === "all"
        ? SYSTEMS
        : SYSTEMS.filter((system) => system.id === selectedSystem);

    return sourceSystems.map((system) => {
      const consumedEnergy = Number(
        (system.baseConsumption * multiplier).toFixed(2)
      );

      const charge = Number(
        (consumedEnergy * RATE_PER_KWH).toFixed(2)
      );

      return {
        ...system,
        consumedEnergy,
        charge,
      };
    });
  }, [multiplier, selectedSystem]);

  const summary = useMemo(() => {
    const totalConsumption = rows.reduce(
      (total, system) => total + system.consumedEnergy,
      0
    );

    const totalCharges = rows.reduce(
      (total, system) => total + system.charge,
      0
    );

    return {
      totalConsumption,
      totalCharges,
    };
  }, [rows]);

  const maxConsumption = Math.max(
    ...rows.map((system) => system.consumedEnergy),
    1
  );

  const chartData = useMemo(() => {
    const activeSystems =
      selectedSystem === "all"
        ? SYSTEMS
        : SYSTEMS.filter((system) => system.id === selectedSystem);

    const totalDaily = activeSystems.reduce(
      (sum, system) => sum + system.baseConsumption,
      0
    );

    if (period === "hourly") {

      return {
        labels: HOURLY_PATTERN.map((_, index) =>
          `${String(index).padStart(2, "0")}h`
        ),
        values: HOURLY_PATTERN.map((weight) =>
          Number((totalDaily * weight * 0.055).toFixed(2))
        ),
      };
    }

    if (period === "daily") {
      const factors = [0.96, 1, 1.018, 0.995, 1.042, 0.943, 0.909];
      return {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        values: factors.map((factor) =>
          Number((totalDaily * factor).toFixed(2))
        ),
      };
    }

    if (period === "weekly") {
      const factors = [6.94, 7.11, 7.35, 7.52];
      return {
        labels: ["W1", "W2", "W3", "W4"],
        values: factors.map((factor) =>
          Number((totalDaily * factor).toFixed(2))
        ),
      };
    }

    if (period === "monthly") {
      const factors = [
        27.7, 26.65, 28.31, 28.59, 29.61, 30.04,
        30.53, 30.29, 29.18, 28.78, 28.43, 27.95,
      ];

      return {
        labels: [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ],
        values: factors.map((factor) =>
          Number((totalDaily * factor).toFixed(2))
        ),
      };
    }

    const days = Math.min(customDays, 12);

    return {
      labels: Array.from({ length: days }, (_, index) => `D${index + 1}`),
      values: Array.from(
        { length: days },
        (_, index) =>
          Number(
            (
              totalDaily *
              (0.95 + index * 0.018 + (index % 3) * 0.021)
            ).toFixed(2)
          )
      ),
    };
  }, [period, customDays, selectedSystem]);

  const trendInsights = useMemo(() => {
    const values = chartData.values;
    const total = values.reduce((sum, value) => sum + value, 0);
    const peakValue = Math.max(...values);
    const lowestValue = Math.min(...values);
    const peakIndex = values.indexOf(peakValue);
    const lowestIndex = values.indexOf(lowestValue);
    const averageValue = values.length ? total / values.length : 0;

    return {
      peakValue,
      peakLabel: chartData.labels[peakIndex] ?? "-",
      lowestValue,
      lowestLabel: chartData.labels[lowestIndex] ?? "-",
      averageValue,
      estimatedCharge: summary.totalCharges,
    };
  }, [chartData, summary.totalCharges]);

  const selectedSystemLabel =
    selectedSystem === "all"
      ? "All Systems"
      : SYSTEMS.find((system) => system.id === selectedSystem)?.title ??
        "All Systems";

  const periodDescription =
    period === "custom"
      ? `${appliedStartDate} to ${appliedEndDate}`
      : PERIOD_LABELS[period];

  const downloadFile = (content, type, filename) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    if (!canDownloadReports) return;

    const rowsForCsv = [
      [
        "System Name",
        "Period",
        "Consumed Energy (kWh)",
        "Rate per kWh (INR)",
        "Total Charge (INR)",
      ],
      ...rows.map((system) => [
        system.title,
        periodDescription,
        system.consumedEnergy,
        RATE_PER_KWH,
        system.charge,
      ]),
      [
        "TOTAL",
        periodDescription,
        summary.totalConsumption,
        "",
        summary.totalCharges,
      ],
    ];

    const csv = rowsForCsv
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    downloadFile(
      csv,
      "text/csv;charset=utf-8;",
      `${building.id}-${selectedSystem}-${period}-consumption-charges.csv`
    );
  };

  const downloadJson = () => {
    if (!canDownloadReports) return;

    const payload = {
      generatedAt: new Date().toISOString(),
      period: periodDescription,
      selectedSystem: selectedSystemLabel,
      electricityRatePerKwhInr: RATE_PER_KWH,
      totals: {
        consumedEnergyKwh: summary.totalConsumption,
        totalChargesInr: summary.totalCharges,
      },
      systems: rows.map((system) => ({
        systemName: system.title,
        consumedEnergyKwh: system.consumedEnergy,
        ratePerKwhInr: RATE_PER_KWH,
        totalChargeInr: system.charge,
      })),
    };

    downloadFile(
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8;",
      `${building.id}-${selectedSystem}-${period}-consumption-charges.json`
    );
  };

  const applyCustomRange = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setPeriod("custom");
    setLastUpdated(new Date());
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 overflow-hidden">
      <div className="rounded-[18px] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.97),rgba(239,245,248,0.93))] shadow-[0_16px_38px_rgba(20,45,62,0.09),inset_0_1px_0_rgba(255,255,255,0.96)] backdrop-blur-xl px-3 py-2.5 shadow-[0_8px_22px_rgba(8,31,92,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="border-r border-slate-200 pr-3">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#2B708B]">
                System Analysis
              </p>
              <h2 className="mt-0.5 text-[13px] font-black uppercase tracking-wide text-[#142B3A]">
                Consumption & Charges
              </h2>
            </div>

            <PeriodSelector period={period} onPeriodChange={setPeriod} />

            <div className="border-l border-slate-200 pl-3">
              <label className="block">
                <span className="mb-1 block text-[7px] font-black uppercase tracking-[0.1em] text-slate-500">
                  System
                </span>
                <select
                  value={selectedSystem}
                  onChange={(event) => setSelectedSystem(event.target.value)}
                  className="h-[32px] w-full min-w-0 rounded-lg border border-[#73AFC0] bg-white px-2 text-[9px] font-black text-[#142B3A] outline-none sm:w-auto sm:min-w-[180px]"
                >
                  <option value="all">All Systems</option>
                  {SYSTEMS.map((system) => (
                    <option key={system.id} value={system.id}>
                      {system.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {period === "custom" && (
              <div className="flex items-end gap-2 border-l border-slate-200 pl-3">
                <label>
                  <span className="mb-1 block text-[7px] font-black uppercase text-slate-500">From</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="h-[32px] rounded-lg border border-slate-300 px-2 text-[9px] text-[#142B3A]"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-[7px] font-black uppercase text-slate-500">To</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="h-[32px] rounded-lg border border-slate-300 px-2 text-[9px] text-[#142B3A]"
                  />
                </label>
                <button
                  type="button"
                  onClick={applyCustomRange}
                  className="inline-flex h-[32px] items-center gap-2 rounded-lg bg-[linear-gradient(135deg,#2B708B,#245E75)] px-3 text-[8px] font-black uppercase text-white"
                >
                  <CalendarDays size={12} />
                  Apply
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadCsv}
              disabled={!canDownloadReports}
              className={`inline-flex h-[32px] items-center gap-2 px-3 text-[8px] font-black uppercase ${
                canDownloadReports
                  ? "bg-[#2B708B] text-white"
                  : "cursor-not-allowed bg-slate-200 text-slate-400"
              }`}
            >
              <Download size={12} /> CSV
            </button>
            <button
              type="button"
              onClick={downloadJson}
              disabled={!canDownloadReports}
              className={`inline-flex h-[32px] items-center gap-2 border px-3 text-[8px] font-black uppercase ${
                canDownloadReports
                  ? "border-[#73AFC0] text-[#2B708B]"
                  : "cursor-not-allowed border-slate-300 text-slate-400"
              }`}
            >
              <FileJson size={12} /> JSON
            </button>
            <button type="button" onClick={() => setLastUpdated(new Date())} className="flex h-[32px] w-[32px] items-center justify-center border border-slate-300 text-slate-600">
              <RefreshCw size={12} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ["Selected Period", PERIOD_LABELS[period], selectedSystemLabel, CalendarDays],
          ["Total Consumption", `${summary.totalConsumption.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kWh`, "Selected-period usage", Zap],
          ["Rate per kWh", `₹${RATE_PER_KWH.toFixed(2)}`, "Electricity tariff", Gauge],
          ["Total Charges", `₹${summary.totalCharges.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`, "Final amount", TrendingUp],
        ].map(([label, value, helper, Icon]) => (
          <div key={label} className="flex min-h-[74px] items-center justify-between rounded-[18px] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.97),rgba(239,245,248,0.93))] shadow-[0_16px_38px_rgba(20,45,62,0.09),inset_0_1px_0_rgba(255,255,255,0.96)] backdrop-blur-xl px-4 py-3 shadow-[0_8px_18px_rgba(8,31,92,0.04)]">
            <div className="min-w-0">
              <p className="text-[7px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
              <p className="mt-1 truncate text-[17px] font-black text-[#142B3A]">{value}</p>
              <p className="mt-0.5 truncate text-[7px] text-slate-400">{helper}</p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#BCD6DD] bg-[#EAF4F6] text-[#2B708B]">
              <Icon size={14} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)]">
        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[18px] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.97),rgba(239,245,248,0.93))] shadow-[0_16px_38px_rgba(20,45,62,0.09),inset_0_1px_0_rgba(255,255,255,0.96)] backdrop-blur-xl shadow-[0_10px_24px_rgba(8,31,92,0.05)]">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.1em] text-[#142B3A]">Usage Trend</h3>
              <p className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-slate-400">
                {selectedSystemLabel} · {periodDescription}
              </p>
            </div>
            <span className="border border-[#BCD6DD] bg-[#EAF4F6] px-2.5 py-1 text-[7px] font-black uppercase text-[#2B708B]">
              Total {summary.totalConsumption.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kWh
            </span>
          </div>

          <div className="min-h-0 bg-[#F1F6F8] p-2">
            <TrendChart values={chartData.values} labels={chartData.labels} />
          </div>

          <div className="grid grid-cols-4 border-t border-slate-200 bg-white">
            {[
              ["Peak", `${trendInsights.peakValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kWh`, trendInsights.peakLabel],
              ["Average", `${trendInsights.averageValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kWh`, "Period Avg"],
              ["Lowest", `${trendInsights.lowestValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kWh`, trendInsights.lowestLabel],
              ["Charge", `₹${trendInsights.estimatedCharge.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`, "Estimated"],
            ].map(([label, value, note], index) => (
              <div key={label} className={`px-3 py-2.5 ${index < 3 ? "border-r border-slate-200" : ""}`}>
                <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">{label}</p>
                <p className="mt-1 truncate text-[12px] font-black text-[#142B3A]">{value}</p>
                <p className="mt-0.5 text-[7px] font-bold uppercase text-[#2B708B]">{note}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid min-h-0 grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3">
          <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[18px] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.97),rgba(239,245,248,0.93))] shadow-[0_16px_38px_rgba(20,45,62,0.09),inset_0_1px_0_rgba(255,255,255,0.96)] backdrop-blur-xl shadow-[0_10px_24px_rgba(8,31,92,0.05)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.1em] text-[#142B3A]">System Usage</h3>
              <span className="max-w-[180px] truncate text-[7px] font-black uppercase text-slate-400">
                {selectedSystemLabel}
              </span>
            </div>
            <div className="min-h-0 overflow-y-auto p-3">
              <div className="space-y-2.5">
                {rows.map((system) => (
                  <div key={system.id}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-[8px]">
                      <span className="truncate font-bold text-[#142B3A]">{system.title}</span>
                      <span className="shrink-0 font-black text-[#2B708B]">
                        {system.consumedEnergy.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kWh
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100">
                      <div className="h-full bg-[#2B708B]" style={{ width: `${Math.max(3, (system.consumedEnergy / maxConsumption) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[18px] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.97),rgba(239,245,248,0.93))] shadow-[0_16px_38px_rgba(20,45,62,0.09),inset_0_1px_0_rgba(255,255,255,0.96)] backdrop-blur-xl shadow-[0_10px_24px_rgba(8,31,92,0.05)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.1em] text-[#142B3A]">System Charges</h3>
              <span className="text-[7px] font-black uppercase text-[#2B708B]">{periodDescription}</span>
            </div>

            <div className="space-y-2 p-3 lg:hidden">
              {rows.map((system) => (
                <article
                  key={system.id}
                  className="w-full border border-slate-200 bg-[#F1F6F8] p-3 text-[10px] text-slate-600"
                >
                  <h4 className="break-words text-xs font-black uppercase text-[#142B3A]">
                    {system.title}
                  </h4>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-[7px] font-black uppercase text-slate-500">
                        Energy
                      </dt>
                      <dd className="mt-1 font-bold text-[#142B3A]">
                        {system.consumedEnergy.toLocaleString("en-IN")} kWh
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[7px] font-black uppercase text-slate-500">
                        Rate
                      </dt>
                      <dd className="mt-1 font-bold text-[#142B3A]">
                        ₹{RATE_PER_KWH.toFixed(2)}/kWh
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[7px] font-black uppercase text-slate-500">
                        Charge
                      </dt>
                      <dd className="mt-1 font-black text-[#2B708B]">
                        ₹{system.charge.toLocaleString("en-IN")}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <div className="hidden min-h-0 overflow-y-auto lg:block">
              <table className="w-full min-w-[520px] border-collapse">
                <thead className="sticky top-0 z-10 bg-[#F1F6F8]">
                  <tr>
                    {["System", "Energy", "Rate", "Charge"].map((heading) => (
                      <th key={heading} className="border-b border-slate-200 px-3 py-2 text-left text-[7px] font-black uppercase tracking-[0.08em] text-slate-500">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((system) => (
                    <tr key={system.id} className="border-b border-slate-100">
                      <td className="px-3 py-1.5 text-[8px] font-bold text-[#142B3A]">{system.title}</td>
                      <td className="px-3 py-1.5 text-[8px] font-black text-[#2B708B]">{system.consumedEnergy.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-1.5 text-[8px] text-slate-500">₹{RATE_PER_KWH.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-[8px] font-black text-[#142B3A]">₹{system.charge.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 bg-[#102536] text-white">
              <div className="border-r border-white/10 px-3 py-2">
                <p className="text-[7px] font-black uppercase text-[#B9CFD7]">Total Energy</p>
                <p className="mt-0.5 text-[11px] font-black">{summary.totalConsumption.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kWh</p>
              </div>
              <div className="px-3 py-2">
                <p className="text-[7px] font-black uppercase text-[#B9CFD7]">Total Charge</p>
                <p className="mt-0.5 text-[11px] font-black text-[#3A95AA]">₹{summary.totalCharges.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function BuildingOverview() {
  const { buildingId } = useParams();
  const [activeView, setActiveView] = useState("monitoring");
  const [accessMessage, setAccessMessage] = useState("");

  const currentUser = tempApi.getCurrentAccount();
  const canViewAnalytics = accountHasPermission(
    currentUser,
    USER_PERMISSIONS.ANALYTICS_VIEW
  );

  const showLockedMessage = (resourceName) => {
    setAccessMessage(`${resourceName} is visible in the site hierarchy, but operational access is not assigned to your account.`);
    window.setTimeout(() => setAccessMessage(""), 3200);
  };

  const building = buildings.find(
    (item) => String(item.id) === String(buildingId)
  );

  if (!currentUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#E8EFF3] px-6 py-10">
        <div className="max-w-md border-2 border-red-400 bg-[#102536] p-8 text-center text-white">
          <h2 className="text-2xl font-black">
            User Session Required
          </h2>

          <p className="mt-2 text-xs text-[#B9CFD7]">
            Please sign in with an active User account to open the building dashboard.
          </p>

          <button
            type="button"
            onClick={() => {
              tempApi.logout();
              window.location.href = "/auth";
            }}
            className="mt-6 inline-flex items-center gap-2 border border-[#5FB2C2]/70 bg-[linear-gradient(135deg,#2F7FA0,#245F7D)] shadow-[0_8px_18px_rgba(36,95,125,0.24)] px-6 py-2.5 text-sm font-black text-white hover:bg-[#1F5C74]"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Login
          </button>
        </div>
      </main>
    );
  }

  if (building && !canAccessBuilding(currentUser, building.id)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#E8EFF3] px-6 py-10">
        <div className="max-w-md border-2 border-amber-400 bg-[#102536] p-8 text-center text-white">
          <h2 className="text-2xl font-black">Access Denied</h2>
          <p className="mt-2 text-xs text-[#B9CFD7]">
            This building is outside your assigned BMS scope.
          </p>
          <Link
            to={resolveNearestAllowedParentRoute(currentUser, { buildingId })}
            className="mt-6 inline-flex items-center gap-2 border border-blue-400 bg-[#2B708B] px-6 py-2.5 text-sm font-black text-white hover:bg-[#1F5C74]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to permitted scope
          </Link>
        </div>
      </main>
    );
  }

  if (!building) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#E8EFF3] px-6 py-10">
        <div className="max-w-md border-2 border-[#73AFC0] bg-[#102536] p-8 text-center text-white">
          <h2 className="text-2xl font-black">
            Building Console Offline
          </h2>

          <p className="mt-2 text-xs text-[#B9CFD7]">
            Requested building identifier is not registered.
          </p>

          <Link
            to="/dashboard"
            className="mt-6 inline-flex items-center gap-2 border border-blue-400 bg-[#2B708B] px-6 py-2.5 text-sm font-black text-white hover:bg-[#1F5C74]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Command Center
          </Link>
        </div>
      </main>
    );
  }

  const floors = [
    ...Array.from(
      { length: building.floors },
      (_, index) => building.floors - index
    ),
    "common",
  ];
  const hasBuildingSystemScope =
    isSuperAdmin(currentUser) ||
    isAdmin(currentUser) ||
    canAccessBuilding(currentUser, building.id);

  return (
    <main
      className={`flex flex-col bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),transparent_28%),radial-gradient(circle_at_top_right,rgba(86,172,190,0.12),transparent_26%),linear-gradient(145deg,#EAF1F4_0%,#DDE8EC_55%,#D3E1E6_100%)] font-sans text-[#142B3A] ${
        activeView === "analytics"
          ? "min-h-[100dvh] overflow-x-hidden lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden"
          : "min-h-[100dvh] overflow-x-hidden"
      }`}
    >
      {accessMessage && (
        <div className="fixed right-5 top-24 z-[1200] max-w-sm border border-amber-300 bg-[#102536] px-4 py-3 text-sm font-semibold text-white shadow-2xl">
          <div className="flex items-start gap-2">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#D5A91F]" />
            <span>{accessMessage}</span>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-[1000] min-h-[72px] shrink-0 border-b border-white/10 bg-[linear-gradient(110deg,#0B1724_0%,#102536_52%,#163243_100%)] shadow-[0_12px_34px_rgba(12,29,43,0.22)] backdrop-blur-xl px-3 py-3 text-white sm:px-4">
        <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Link to="/dashboard" className="flex items-center no-underline">
            <div>
              <h1 className="text-[22px] font-semibold uppercase leading-none tracking-[0.18em] text-white sm:text-[26px]">
                ARCOT
                <span className="ml-2 text-[#67E8F9]">IIoT 1.0</span>
              </h1>

              <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.35em] text-[#8FB9C7]">
                Industrial Internet of Things
              </span>
            </div>

            <div className="ml-5 hidden h-[54px] border-l border-[#73AFC0] sm:block" />

            <img
              src={prestigeLogo}
              alt="Prestige Group"
              className="ml-5 hidden h-[52px] w-[100px] object-contain sm:block"
            />
          </Link>

          <div className="grid w-full grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
            <Link
              to="/dashboard"
              replace
              className="flex h-[32px] items-center justify-center border border-[#5FB2C2]/70 bg-[linear-gradient(135deg,#2F7FA0,#245F7D)] shadow-[0_8px_18px_rgba(36,95,125,0.24)] px-4 text-[10px] font-black uppercase tracking-[0.15em] text-white hover:bg-[#2A6F8D] sm:min-w-[92px]"
            >
              Back
            </Link>

            <div className="hidden border border-white/10 bg-white/[0.06] backdrop-blur-md px-3 py-1.5 lg:block">
              <p className="max-w-[190px] truncate text-[9px] font-bold text-[#8ED0DA]">
                {currentUser.name}
              </p>
              <p className="max-w-[190px] truncate text-[7px] uppercase tracking-[0.08em] text-[#8FB9C7]">
                {currentUser.designation || "USER"} ·{" "}
                {currentUser.companyName || building.name}
              </p>
            </div>

            <div className="hidden items-center gap-2 border border-white/10 bg-white/[0.06] backdrop-blur-md px-3 py-1.5 md:flex">
              <span className="h-2 w-2 bg-[#31B878]" />

              <span className="text-[10px] font-bold tracking-[0.15em]">
                BLE Connected
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                tempApi.logout();
                window.location.href = "/auth";
              }}
              className="h-[32px] border border-[#D99A9A] bg-[linear-gradient(135deg,#C97578,#B85E62)] shadow-[0_8px_18px_rgba(184,94,98,0.2)] px-4 text-[10px] font-black uppercase tracking-[0.15em] text-white hover:bg-[#A94E53] sm:min-w-[92px]"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <section
        className={`flex w-full flex-col px-4 py-3 ${
          activeView === "analytics"
            ? "min-h-0 flex-1 overflow-y-auto lg:overflow-hidden"
            : "flex-none"
        }`}
      >
        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(239,245,248,0.92))] shadow-[0_16px_38px_rgba(20,45,62,0.09),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl px-4 py-2 shadow-[0_8px_20px_rgba(8,31,92,0.04)]">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#2B708B]">
              {activeView === "monitoring"
                ? "Live Building Telemetry"
                : "Consumption Analytics"}
            </p>

            <h2 className="mt-0.5 text-[15px] font-black uppercase tracking-wide text-[#142B3A]">
              {building.name}{" "}
              {activeView === "monitoring"
                ? "Monitoring"
                : "System Charges"}
            </h2>

            <p className="mt-0.5 text-[8px] font-semibold text-slate-500">
              {currentUser.companyName || "Assigned Company"} ·{" "}
              {currentUser.accessType || "BUILDING"}:{" "}
              {currentUser.accessName || building.name}
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
            <ViewSelector
              activeView={activeView}
              onChange={setActiveView}
              canViewAnalytics={canViewAnalytics}
            />

            <span className="flex items-center gap-2 text-[9px] font-black uppercase text-[#259661]">
              <span className="h-2 w-2 bg-emerald-500" />
              Online
            </span>
          </div>
        </div>

        <div
          className={
            activeView === "analytics"
              ? "min-h-0 flex-1 overflow-y-auto lg:overflow-hidden"
              : "w-full"
          }
        >
          {activeView === "monitoring" ? (
            <div className="grid items-start gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
              <FloorMatrix
                building={building}
                floors={floors}
                currentUser={currentUser}
                onLockedAccess={showLockedMessage}
              />

              <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {SYSTEMS.map((system) => (
                  <SystemCard
                    key={system.id}
                    system={system}
                    locked={!hasBuildingSystemScope}
                  />
                ))}
              </section>
            </div>
          ) : (
            <AnalyticsView
              building={building}
              canDownloadReports={accountHasPermission(
                currentUser,
                USER_PERMISSIONS.DATA_DOWNLOAD
              )}
            />
          )}
        </div>
      </section>

      <footer
        className={`border-t border-slate-300 bg-white px-5 py-2 text-[9px] text-slate-500 ${
          activeView === "analytics" ? "shrink-0" : ""
        }`}
      >
        <div className="flex items-center justify-between font-semibold">
          <p>© 2026 Arcot Industries. All systems operational.</p>

          <span className="flex items-center gap-2 text-[#259661]">
            <span className="h-2 w-2 bg-emerald-500" />
            Telemetry Online
          </span>
        </div>
      </footer>
    </main>
  );
}
