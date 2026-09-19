

import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  Cpu,
  Fan,
  FileJson,
  Gauge,
  Lightbulb,
  MapPin,
  Power,
  RefreshCw,
  Thermometer,
  TrendingUp,
  Users,
  Wifi,
  Wind,
  Zap,
} from "lucide-react";
import { getFloorClients } from "../data/bmsData";
import prestigeLogo from "../assets/ser-removebg.png";
import { tempApi } from "../tempAdminApi";
import { USER_PERMISSIONS } from "../data/permissionOptions";
import {
  canAccessBuilding,
  canAccessFloor,
  canAccessZone,
  hasPermission as accountHasPermission,
  normalizeFloorId,
  resolveNearestAllowedParentRoute,
} from "../utils/accessControl";
import { getZoneForFloorRoute } from "../utils/bmsHierarchy";

const PERIODS = [
  { id: "hourly", label: "Hourly" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const COST_PER_KWH = 8.4;

const STATUS_STYLES = {
  healthy: {
    dot: "bg-emerald-400",
    text: "text-emerald-200",
    border: "border-emerald-400/30",
    background: "bg-emerald-400/10",
    progress: "bg-emerald-400",
  },
  warning: {
    dot: "bg-amber-400",
    text: "text-amber-200",
    border: "border-amber-400/30",
    background: "bg-amber-400/10",
    progress: "bg-amber-400",
  },
};

export default function ClientOverview() {
  const { buildingId = "", floorId = "1", clientId = "1" } = useParams();

  const [activeView, setActiveView] = useState("systems");

  const currentUser = tempApi.getCurrentAccount();
  const canViewReports = accountHasPermission(
    currentUser,
    USER_PERMISSIONS.ANALYTICS_VIEW
  );
  const canDownloadReports = accountHasPermission(
    currentUser,
    USER_PERMISSIONS.DATA_DOWNLOAD
  );
  const [period, setPeriod] = useState("daily");
  const [selectedSystem, setSelectedSystem] = useState("all");
  const [lastUpdated, setLastUpdated] = useState(new Date());

  if (!currentUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#D8E2E8] px-6 py-10">
        <div className="max-w-md border-2 border-red-400 bg-[#081F5C] p-8 text-center text-white">
          <h2 className="text-2xl font-black">
            User Session Required
          </h2>

          <p className="mt-2 text-xs text-blue-200">
            Please sign in with an active User account to open the client dashboard.
          </p>

          <button
            type="button"
            onClick={() => {
              tempApi.logout();
              window.location.href = "/auth";
            }}
            className="mt-6 inline-flex items-center gap-2 border border-cyan-400 bg-[linear-gradient(180deg,#24698F,#174D70)] px-6 py-2.5 text-sm font-black text-white hover:brightness-110"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Login
          </button>
        </div>
      </main>
    );
  }

  const isCommonFloor = String(floorId).toLowerCase() === "common";
  const floorKey = isCommonFloor
    ? "common"
    : String(Number(floorId) || 1);

  // Existing sample/analytics generators expect a number.
  // Common reuses Floor 1 only as the demo-data seed; routing/data stays "common".
  const floorNumber = isCommonFloor ? 1 : Number(floorKey);
  const clientNumber = Number(clientId) || 1;
  const floorClients = getFloorClients(buildingId, floorKey);

  const clientName =
    floorClients[clientNumber - 1] || `Client ${clientId}`;
  const normalizedFloorId = normalizeFloorId(buildingId, floorKey);
  const routeZone = getZoneForFloorRoute(
    buildingId,
    floorKey,
    String(clientNumber)
  );

  if (
    !canAccessBuilding(currentUser, buildingId) ||
    !canAccessFloor(currentUser, normalizedFloorId) ||
    !canAccessZone(currentUser, routeZone?.id)
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#D8E2E8] px-6 py-10">
        <div className="max-w-md border-2 border-amber-400 bg-[#081F5C] p-8 text-center text-white">
          <h2 className="text-2xl font-black">Access Denied</h2>
          <p className="mt-2 text-xs text-blue-200">
            This client is outside your assigned BMS scope.
          </p>
          <Link
            to={resolveNearestAllowedParentRoute(currentUser, { buildingId })}
            className="mt-6 inline-flex items-center gap-2 border border-cyan-400 bg-[linear-gradient(180deg,#24698F,#174D70)] px-6 py-2.5 text-sm font-black text-white hover:brightness-110"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to permitted scope
          </Link>
        </div>
      </main>
    );
  }

  const clientData = useMemo(
    () => getSampleClientRealtimeData(floorNumber, clientNumber),
    [floorNumber, clientNumber]
  );

  const consumptionData = useMemo(
    () => getConsumptionData(period, floorNumber, clientNumber),
    [period, floorNumber, clientNumber]
  );

  const buildingLabel = buildingId
    ? buildingId.replace(/[-_]/g, " ").toUpperCase()
    : "BUILDING";

  const hasAlert = clientData.alerts.count > 0;

  const systems = useMemo(
    () => [
      {
        id: "hvac",
        title: "AHU / HVAC",
        icon: Fan,
        status: clientData.hvac.ahu2 === "Running" ? "Healthy" : "Attention",
        tone: clientData.hvac.ahu2 === "Running" ? "healthy" : "warning",
        load: clientData.numeric.hvacLoad,
        consumption: clientData.numeric.hvacConsumption,
        efficiency: clientData.hvac.ahu2 === "Running" ? 94 : 82,
        metrics: [
          ["AHU-1", clientData.hvac.ahu1],
          ["AHU-2", clientData.hvac.ahu2],
          ["Supply Temperature", clientData.hvac.supplyTemp],
          ["Return Temperature", clientData.hvac.returnTemp],
          ["Humidity", clientData.hvac.humidity],
        ],
      },
      {
        id: "lighting",
        title: "Lighting",
        icon: Lightbulb,
        status: "Healthy",
        tone: "healthy",
        load: clientData.numeric.lightingLoad,
        consumption: clientData.numeric.lightingConsumption,
        efficiency: 91,
        metrics: [
          ["Zone A", clientData.lighting.zoneA],
          ["Zone B", clientData.lighting.zoneB],
          ["Zone C", clientData.lighting.zoneC],
          ["Lighting Load", clientData.lighting.load],
          ["Operating Mode", clientData.lighting.mode],
        ],
      },
      {
        id: "energy",
        title: "Energy Meter",
        icon: Gauge,
        status: hasAlert ? "Attention" : "Healthy",
        tone: hasAlert ? "warning" : "healthy",
        load: clientData.numeric.demand,
        consumption: clientData.numeric.energyConsumption,
        efficiency: hasAlert ? 88 : 98,
        metrics: [
          ["Energy Used", clientData.energy.kwh],
          ["Demand", clientData.energy.demand],
          ["Apparent Power", clientData.energy.kva],
          ["Power Factor", clientData.energy.pf],
          [
            "Voltage / Current",
            `${clientData.energy.voltage} / ${clientData.energy.current}`,
          ],
        ],
      },
  
   
    
    ],
    [clientData, hasAlert]
  );

  const operationalSystems = systems.filter(
    (system) => system.id !== "communication"
  );

  const totalLoad = operationalSystems.reduce(
    (total, system) => total + system.load,
    0
  );

  const totalConsumption = operationalSystems.reduce(
    (total, system) => total + system.consumption,
    0
  );

  const onlineSystems = operationalSystems.filter(
    (system) => system.status !== "Attention"
  ).length;

  return (
    <main
      className={`flex flex-col bg-[#D8E2E8] font-sans text-[#132131] ${
        activeView === "analytics"
          ? "min-h-[100dvh] overflow-x-hidden lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden"
          : "min-h-[100dvh] overflow-x-hidden"
      }`}
    >
      <DashboardHeader
        buildingId={buildingId}
        floorId={floorId}
        clientName={clientName}
        currentUser={currentUser}
      />

      <section
        className={`relative flex w-full flex-col overflow-hidden px-5 py-5 ${
          activeView === "analytics"
            ? "min-h-0 flex-1 overflow-y-auto lg:overflow-hidden"
            : "flex-1"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(255,255,255,0.98),transparent_28%),radial-gradient(circle_at_88%_10%,rgba(210,229,236,0.82),transparent_31%),radial-gradient(circle_at_50%_100%,rgba(174,198,212,0.68),transparent_42%),linear-gradient(135deg,#C9D6DE_0%,#F8FAFB_48%,#C7D5DD_100%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-45 bg-[linear-gradient(90deg,transparent_0%,rgba(92,113,119,0.10)_18%,transparent_31%,rgba(60,83,90,0.09)_52%,transparent_72%,rgba(94,119,112,0.10)_90%)]" />

        <div className="relative z-10 mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/80 bg-white/88 px-5 py-3 shadow-[0_18px_38px_rgba(15,36,56,0.10),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#2B6F8C]">
              {activeView === "systems"
                ? "Client Realtime Telemetry"
                : "Client Consumption Analytics"}
            </p>

            <h2 className="mt-0.5 truncate text-[15px] font-black uppercase tracking-wide text-[#081F5C]">
              {clientName} ·{" "}
              {activeView === "systems"
                ? "Systems Overview"
                : "Analytic Overview"}
            </h2>

            <p className="mt-0.5 truncate text-[8px] font-semibold text-slate-500">
              {currentUser.companyName || "Assigned Company"} ·{" "}
              {currentUser.accessType || "CLIENT"}:{" "}
              {currentUser.accessName || clientName}
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
            <ViewSelector
              activeView={activeView}
              onChange={setActiveView}
              canViewReports={canViewReports}
            />

            <span className="hidden items-center gap-2 text-[9px] font-black uppercase text-emerald-600 sm:flex">
              <span className="h-2 w-2 bg-emerald-500" />
              Online
            </span>
          </div>
        </div>

        <div className="relative z-10 min-h-0 flex-1">
        {activeView === "systems" ? (
          <ClientSystemsView
            clientName={clientName}
            buildingLabel={buildingLabel}
            floorId={floorId}
            clientId={clientId}
            clientData={clientData}
            hasAlert={hasAlert}
            systems={systems}
            totalLoad={totalLoad}
            totalConsumption={totalConsumption}
            onlineSystems={onlineSystems}
            operationalSystems={operationalSystems}
          />
        ) : (
          <ClientAnalyticsView
            clientName={clientName}
            buildingId={buildingId}
            floorId={floorId}
            clientId={clientId}
            clientData={clientData}
            systems={systems}
            period={period}
            setPeriod={setPeriod}
            selectedSystem={selectedSystem}
            setSelectedSystem={setSelectedSystem}
            consumptionData={consumptionData}
            lastUpdated={lastUpdated}
            onRefresh={() => setLastUpdated(new Date())}
            canDownloadReports={canDownloadReports}
          />
        )}
        </div>
      </section>

      <footer
        className={`border-t border-white/65 bg-white/72 px-5 py-2 shadow-[0_-8px_24px_rgba(15,36,56,0.05)] backdrop-blur-xl text-[9px] text-slate-500 ${
          activeView === "analytics" ? "shrink-0" : ""
        }`}
      >
        <div className="flex items-center justify-between font-semibold">
          <p>© 2026 Arcot Industries. Client monitoring overview.</p>

          <span className="flex items-center gap-2 text-emerald-600">
            <span className="h-2 w-2 bg-emerald-500" />
            Realtime Telemetry Active
          </span>
        </div>
      </footer>
    </main>
  );
}

function DashboardHeader({ buildingId, floorId, clientName, currentUser }) {
  return (
    <header className="sticky top-0 z-[1000] min-h-[72px] shrink-0 border-b border-[#D2B778]/70 bg-[linear-gradient(90deg,#071421_0%,#0A2034_48%,#0B2A42_100%)] px-3 py-3 text-white shadow-md sm:px-4">
      <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Link to="/dashboard" className="flex min-w-0 items-center no-underline">
          <div className="min-w-0">
            <h1 className="truncate text-[clamp(18px,2vw,26px)] font-semibold uppercase leading-none tracking-[0.16em] text-white">
              ARCOT
              <span className="ml-2 text-[#D8B56A]">IIoT 1.0</span>
            </h1>

            <span className="mt-1 hidden text-[8px] font-medium uppercase tracking-[0.3em] text-[#AFC4D8] sm:block">
              Industrial Internet of Things
            </span>
          </div>

          <div className="ml-4 hidden h-[50px] border-l border-[#385674] sm:block" />

          <img
            src={prestigeLogo}
            alt="Prestige Group"
            className="ml-4 hidden h-[52px] w-[102px] object-contain sm:block"
          />
        </Link>

        <div className="hidden max-w-[420px] flex-col items-center lg:flex">
          <span className="text-[8px] font-bold uppercase tracking-[0.28em] text-[#D8B56A]">
            Client Monitoring Console
          </span>

          <h2 className="mt-1 max-w-full truncate text-[16px] font-black uppercase tracking-[0.08em] text-white">
            {clientName}
          </h2>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
          <Link
            to={`/building/${buildingId}/floor/${floorId}`}
            className="inline-flex h-[44px] items-center justify-center gap-2 rounded-[8px] border border-[#6E97B5]/80 bg-[linear-gradient(180deg,#24698F,#174D70)] px-4 text-[9px] font-black uppercase tracking-[0.13em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_7px_16px_rgba(0,0,0,0.18)] transition hover:-translate-y-px hover:brightness-110 sm:min-w-[104px]"
          >
            <ArrowLeft size={13} />
            <span className="hidden sm:inline">Back</span>
          </Link>

          <div className="hidden h-[44px] min-w-[168px] rounded-[8px] border border-[#3B617A] bg-[linear-gradient(180deg,#0C2940,#091D30)] px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_6px_14px_rgba(0,0,0,0.14)] lg:block">
            <p className="max-w-[180px] truncate text-[9px] font-bold text-[#BBD5E5]">
              {currentUser?.name || "Dashboard User"}
            </p>

            <p className="max-w-[180px] truncate text-[7px] uppercase tracking-[0.08em] text-[#AFC4D8]">
              {currentUser?.designation || "USER"} ·{" "}
              {currentUser?.companyName || "Assigned Company"}
            </p>
          </div>

          <div className="hidden h-[44px] min-w-[164px] items-center justify-center gap-2 rounded-[8px] border border-[#3B617A] bg-[linear-gradient(180deg,#0C2940,#091D30)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_6px_14px_rgba(0,0,0,0.14)] md:flex">
            <span className="h-2 w-2 bg-emerald-400" />
            <span className="text-[9px] font-bold uppercase tracking-[0.13em]">
              Realtime Active
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              tempApi.logout();
              window.location.href = "/auth";
            }}
            className="h-[44px] rounded-[8px] border border-[#D08A83]/80 bg-[linear-gradient(180deg,#B75B55,#94413D)] px-4 text-[9px] font-black uppercase tracking-[0.13em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_7px_16px_rgba(101,0,0,0.20)] transition hover:-translate-y-px hover:brightness-110 sm:min-w-[104px]"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

function ViewSelector({
  activeView,
  onChange,
  canViewReports = false,
}) {
  return (
    <div className="flex overflow-hidden rounded-[10px] border border-[#8EA9B8] bg-white/90 shadow-[0_6px_14px_rgba(15,36,56,0.06)] backdrop-blur-xl">
      <button
        type="button"
        onClick={() => onChange("systems")}
        className={`flex h-[36px] items-center gap-2 px-4 text-[9px] font-black uppercase tracking-[0.1em] ${
          activeView === "systems"
            ? "bg-[#081F5C] text-white"
            : "text-[#081F5C] hover:bg-blue-50"
        }`}
      >
        <Cpu size={13} />
        Client Systems
      </button>

      <button
        type="button"
        onClick={() => {
          if (canViewReports) {
            onChange("analytics");
          }
        }}
        disabled={!canViewReports}
        title={
          canViewReports
            ? "Open analytical view"
            : "Your account does not have report access"
        }
        className={`flex h-[36px] items-center gap-2 border-l border-[#385674] px-4 text-[9px] font-black uppercase tracking-[0.1em] ${
          !canViewReports
            ? "cursor-not-allowed bg-slate-100 text-slate-400"
            : activeView === "analytics"
              ? "bg-[linear-gradient(180deg,#24698F,#174D70)] text-white"
              : "text-[#2B6F8C] hover:bg-blue-50"
        }`}
      >
        <BarChart3 size={13} />
        Analytic View
      </button>
    </div>
  );
}

function ClientSystemsView({
  clientName,
  buildingLabel,
  floorId,
  clientId,
  clientData,
  hasAlert,
  systems,
  totalLoad,
  totalConsumption,
  onlineSystems,
  operationalSystems,
}) {
  return (
    <>
      <section className="mb-2 grid gap-2 xl:grid-cols-[minmax(330px,0.78fr)_minmax(0,2.22fr)]">
        <ClientIdentityPanel
          clientName={clientName}
          buildingLabel={buildingLabel}
          floorId={floorId}
          clientId={clientId}
          clientData={clientData}
          hasAlert={hasAlert}
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryTile
            label="Current Demand"
            value={clientData.energy.demand}
            helper="Live electrical demand"
            icon={Zap}
          />

          <SummaryTile
            label="Today Consumption"
            value={clientData.energy.todayKwh}
            helper="Current operating day"
            icon={Activity}
          />

          <SummaryTile
            label="Systems Online"
            value={`${onlineSystems}/${operationalSystems.length}`}
            helper="Operational systems"
            icon={CheckCircle2}
          />

          <SummaryTile
            label="Active Alerts"
            value={`${clientData.alerts.count}`}
            helper={
              hasAlert ? "Operator attention required" : "No critical alarms"
            }
            icon={AlertTriangle}
            attention={hasAlert}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 xl:auto-rows-fr">
        {systems.map((system) => (
          <ClientSystemCard key={system.id} system={system} />
        ))}
      </section>
    </>
  );
}

function ClientIdentityPanel({
  clientName,
  buildingLabel,
  floorId,
  clientId,
  clientData,
  hasAlert,
}) {
  return (
    <article className="relative min-h-[130px] overflow-hidden rounded-[22px] border border-white/85 bg-[linear-gradient(145deg,rgba(255,255,255,0.97),rgba(237,243,246,0.93)_56%,rgba(224,234,239,0.90))] px-5 py-4 text-[#132131] shadow-[0_20px_44px_rgba(15,36,56,0.12),inset_0_1px_0_rgba(255,255,255,0.98)] backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#2B6F8C,#D8B56A)]" />
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[#9FBBC9]/20 blur-3xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.22em] text-[#2B6F8C]">
              Client Account
            </p>

            <h1 className="mt-1 line-clamp-1 text-[18px] font-black leading-tight text-[#132131]">
              {clientName}
            </h1>
          </div>

          <StatusBadge
            status={hasAlert ? "Attention" : "Healthy"}
            tone={hasAlert ? "warning" : "healthy"}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
          <IdentityReading
            icon={Building2}
            label="Building"
            value={buildingLabel}
          />
          <IdentityReading
            icon={MapPin}
            label="Floor"
            value={`Floor ${floorId}`}
          />
          <IdentityReading
            icon={Cpu}
            label="Block / Zone"
            value={`Zone ${clientId}`}
          />
          <IdentityReading
            icon={Users}
            label="Occupancy"
            value={clientData.comfort.occupancy}
          />
        </div>
      </div>
    </article>
  );
}

function IdentityReading({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-white/90 bg-white/80 text-[#2B6F8C] shadow-sm">
        <Icon size={12} />
      </div>

      <div className="min-w-0">
        <p className="text-[7px] font-black uppercase tracking-[0.12em] text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 truncate text-[9px] font-black text-[#132131]">
          {value}
        </p>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, helper, icon: Icon, attention = false }) {
  return (
    <article className="group flex min-h-[116px] items-center justify-between rounded-[20px] border border-white/85 bg-[linear-gradient(145deg,rgba(255,255,255,0.97),rgba(239,245,248,0.91))] px-4 py-3 shadow-[0_18px_38px_rgba(15,36,56,0.10),inset_0_1px_0_rgba(255,255,255,0.96)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(15,36,56,0.14)]">
      <div className="min-w-0">
        <p className="text-[7px] font-black uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>

        <p
          className={`mt-1 truncate text-[17px] font-black ${
            attention ? "text-amber-600" : "text-[#081F5C]"
          }`}
        >
          {value}
        </p>

        <p className="mt-0.5 truncate text-[7px] text-slate-400">
          {helper}
        </p>
      </div>

      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.96)] ${
          attention
            ? "border-amber-200 bg-amber-50 text-amber-600"
            : "border-blue-200 bg-blue-50 text-[#2B6F8C]"
        }`}
      >
        <Icon size={14} />
      </div>
    </article>
  );
}

function ClientSystemCard({ system }) {
  const Icon = system.icon;
  const style = STATUS_STYLES[system.tone] ?? STATUS_STYLES.healthy;

  return (
    <article className="group relative flex h-full min-h-[300px] flex-col overflow-hidden rounded-[24px] border border-white/85 bg-[linear-gradient(145deg,rgba(255,255,255,0.97),rgba(239,244,247,0.93)_55%,rgba(224,234,239,0.90))] text-[#132131] shadow-[0_22px_50px_rgba(15,36,56,0.13),0_4px_12px_rgba(15,36,56,0.07),inset_0_1px_0_rgba(255,255,255,0.97)] backdrop-blur-[24px] transition-all duration-200 hover:-translate-y-[4px] hover:border-white hover:shadow-[0_30px_65px_rgba(15,36,56,0.18),0_10px_24px_rgba(15,36,56,0.09),inset_0_1px_0_rgba(255,255,255,1)]">
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[#9FBBC9]/18 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#2B6F8C,#D8B56A)]" />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 px-5 pb-3.5 pt-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[15px] border border-white/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(226,235,240,0.82))] text-[#2B6F8C] shadow-[0_10px_24px_rgba(28,52,70,0.10),inset_0_1px_0_rgba(255,255,255,0.98)]">
              <Icon size={28} strokeWidth={2.1} />
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-black uppercase tracking-[0.055em] text-[#132131]">
                {system.title}
              </h3>

              <p className="mt-1.5 text-[8px] font-bold uppercase tracking-[0.13em] text-slate-400">
                Client Operational Data
              </p>
            </div>
          </div>

          <StatusBadge status={system.status} tone={system.tone} />
        </header>

        <div className="mx-5 grid grid-cols-2 gap-x-5 py-2">
          <PrimaryMetric
            label={system.loadLabel ?? "Current Load"}
            value={system.load}
            unit={system.loadUnit ?? "kW"}
            highlight
          />

          <PrimaryMetric
            label={system.consumptionLabel ?? "Consumption"}
            value={system.consumption}
            unit={system.consumptionUnit ?? "kWh"}
          />
        </div>

        <div className="mx-5 my-2 h-px bg-[#DCE6EB]" />

        <div className="flex flex-1 flex-col justify-center px-5 py-1">
          {system.metrics.map(([label, value]) => (
            <SystemReading key={label} label={label} value={value} />
          ))}
        </div>

        <footer className="px-5 pb-4 pt-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[8px] font-black uppercase tracking-[0.11em] text-slate-500">
              Operational Efficiency
            </span>

            <span className="text-[10px] font-black text-[#D8B56A]">
              {system.efficiency}%
            </span>
          </div>

          <div className="h-1.5 overflow-hidden bg-[#DCE6EB]">
            <div
              className={`h-full ${style.progress}`}
              style={{ width: `${system.efficiency}%` }}
            />
          </div>
        </footer>
      </div>
    </article>
  );
}

function StatusBadge({ status, tone }) {
  const style = STATUS_STYLES[tone] ?? STATUS_STYLES.healthy;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 text-[7px] font-black uppercase tracking-[0.07em] ${style.border} ${style.background} ${style.text}`}
    >
      <span className={`h-1.5 w-1.5 ${style.dot}`} />
      {status}
    </span>
  );
}

function PrimaryMetric({ label, value, unit, highlight = false }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[8px] font-black uppercase tracking-[0.1em] text-slate-500">
          {label}
        </span>

        {unit ? (
          <span className="shrink-0 text-[8px] font-bold uppercase text-slate-400">
            {unit}
          </span>
        ) : null}
      </div>

      <p
        className={`mt-1.5 truncate text-[21px] font-black leading-none tracking-tight ${
          highlight ? "text-[#2B6F8C]" : "text-[#132131]"
        }`}
      >
        {Number(value).toLocaleString("en-IN")}
      </p>
    </div>
  );
}

function SystemReading({ label, value }) {
  return (
    <div className="flex min-h-[31px] items-center justify-between gap-4 py-1.5">
      <span className="min-w-0 truncate text-[8px] font-bold uppercase tracking-[0.065em] text-slate-500">
        {label}
      </span>

      <span className="shrink-0 text-right text-[10px] font-black text-[#132131]">
        {value}
      </span>
    </div>
  );
}

function ClientAnalyticsView({
  clientName,
  buildingId,
  floorId,
  clientId,
  clientData,
  systems,
  period,
  setPeriod,
  selectedSystem,
  setSelectedSystem,
  consumptionData,
  lastUpdated,
  onRefresh,
  canDownloadReports = false,
}) {
  const selectedSystems = useMemo(
    () =>
      selectedSystem === "all"
        ? systems.filter((system) => system.id !== "communication")
        : systems.filter((system) => system.id === selectedSystem),
    [selectedSystem, systems]
  );

  const selectedConsumption = useMemo(() => {
    if (selectedSystem === "all") {
      return consumptionData;
    }

    const system = systems.find((item) => item.id === selectedSystem);
    const totalSystemConsumption =
      system?.consumption ?? clientData.numeric.energyConsumption;

    const baseTotal = consumptionData.reduce(
      (total, point) => total + point.consumption,
      0
    );

    return consumptionData.map((point) => ({
      ...point,
      consumption:
        baseTotal > 0
          ? Number(
              ((point.consumption / baseTotal) * totalSystemConsumption).toFixed(
                2
              )
            )
          : 0,
      cost:
        baseTotal > 0
          ? Number(
              (
                (point.consumption / baseTotal) *
                totalSystemConsumption *
                COST_PER_KWH
              ).toFixed(2)
            )
          : 0,
    }));
  }, [clientData.numeric.energyConsumption, consumptionData, selectedSystem, systems]);

  const analytics = useMemo(
    () => calculateAnalytics(selectedConsumption),
    [selectedConsumption]
  );

  const maxSystemConsumption = Math.max(
    ...selectedSystems.map((system) => system.consumption),
    1
  );

  const selectedLabel =
    selectedSystem === "all"
      ? "All Client Systems"
      : systems.find((system) => system.id === selectedSystem)?.title ??
        "All Client Systems";

  const downloadFile = (content, type, filename) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const safeName = clientName
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase();

  const downloadCsv = () => {
    if (!canDownloadReports) return;

    const exportSystems = systems.filter(
      (system) => system.id !== "communication"
    );

    const systemRows = exportSystems.map((system) => {
      const estimatedCharge = system.consumption * COST_PER_KWH;

      return [
        system.title,
        system.consumption.toFixed(2),
        estimatedCharge.toFixed(2),
      ];
    });

    const totalConsumption = exportSystems.reduce(
      (sum, system) => sum + system.consumption,
      0
    );

    const totalCharge = exportSystems.reduce(
      (sum, system) => sum + system.consumption * COST_PER_KWH,
      0
    );

    const rows = [
      ["CLIENT DETAILS"],
      ["Client Name", clientName],
      ["Building", buildingId],
      ["Floor", floorId],
      ["Client / Zone", clientId],
      [],
      ["System Name", "Consumption (kWh)", "Charge (INR)"],
      ...systemRows,
      [],
      ["TOTAL CONSUMPTION", totalConsumption.toFixed(2), "kWh"],
      ["TOTAL CHARGE", totalCharge.toFixed(2), "INR"],
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    downloadFile(
      csv,
      "text/csv;charset=utf-8;",
      `${safeName}-client-consumption-and-charges.csv`
    );
  };

  const downloadJson = () => {
    if (!canDownloadReports) return;

    downloadFile(
      JSON.stringify(
        {
          buildingId,
          floorId,
          clientId,
          clientName,
          selectedSystem: selectedLabel,
          period,
          generatedAt: new Date().toISOString(),
          clientSummary: {
            demand: clientData.energy.demand,
            todayConsumption: clientData.energy.todayKwh,
            monthlyConsumption: clientData.energy.monthKwh,
            estimatedCost: clientData.energy.estimatedCost,
            occupancy: clientData.comfort.occupancy,
            alerts: clientData.alerts.count,
          },
          analytics: {
            ...analytics,
            totalChargeAllSystems: systems
              .filter((system) => system.id !== "communication")
              .reduce(
                (sum, system) =>
                  sum + system.consumption * COST_PER_KWH,
                0
              ),
          },
          systems: selectedSystems,
          trend: selectedConsumption,
        },
        null,
        2
      ),
      "application/json;charset=utf-8;",
      `${safeName}-${selectedSystem}-${period}.json`
    );
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-white/85 bg-white/88 px-4 py-3 shadow-[0_18px_38px_rgba(15,36,56,0.10),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#2B6F8C]">
              Client Analysis
            </p>

            <h3 className="mt-0.5 text-[13px] font-black uppercase text-[#081F5C]">
              Usage, Demand & Charges
            </h3>
          </div>

          <div className="flex overflow-hidden rounded-[10px] border border-[#8EA9B8] bg-white/90 shadow-sm">
            {PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={`h-[32px] border-r border-[#7395AA] px-3 text-[8px] font-black uppercase last:border-r-0 ${
                  period === item.id
                    ? "bg-[linear-gradient(180deg,#24698F,#174D70)] text-white"
                    : "bg-white text-[#2B6F8C]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <select
            value={selectedSystem}
            onChange={(event) => setSelectedSystem(event.target.value)}
            className="h-[36px] w-full min-w-0 rounded-[10px] border border-[#9FB4C0] bg-white/95 px-3 text-[9px] font-black text-[#132131] shadow-sm outline-none sm:w-auto sm:min-w-[180px]"
          >
            <option value="all">All Client Systems</option>
            {systems
              .filter((system) => system.id !== "communication")
              .map((system) => (
                <option key={system.id} value={system.id}>
                  {system.title}
                </option>
              ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!canDownloadReports}
            title={
              canDownloadReports
                ? "Download CSV report"
                : "Download permission is not assigned"
            }
            className={`inline-flex h-[32px] items-center gap-2 px-3 text-[8px] font-black uppercase ${
              canDownloadReports
                ? "bg-[linear-gradient(180deg,#24698F,#174D70)] text-white"
                : "cursor-not-allowed bg-slate-200 text-slate-400"
            }`}
          >
            <ArrowDownToLine size={12} />
            CSV
          </button>

          <button
            type="button"
            onClick={downloadJson}
            disabled={!canDownloadReports}
            title={
              canDownloadReports
                ? "Download JSON report"
                : "Download permission is not assigned"
            }
            className={`inline-flex h-[32px] items-center gap-2 border px-3 text-[8px] font-black uppercase ${
              canDownloadReports
                ? "border-[#7395AA] text-[#2B6F8C]"
                : "cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400"
            }`}
          >
            <FileJson size={12} />
            JSON
          </button>

          <button
            type="button"
            onClick={onRefresh}
            title={`Last refreshed: ${lastUpdated.toLocaleTimeString()}`}
            className="flex h-[32px] w-[32px] items-center justify-center border border-slate-300 text-slate-600"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <AnalyticsTile
          label="Current Demand"
          value={clientData.energy.demand}
          helper={selectedLabel}
          icon={Zap}
        />

        <AnalyticsTile
          label="Period Usage"
          value={`${analytics.total.toLocaleString("en-IN", {
            maximumFractionDigits: 1,
          })} kWh`}
          helper={PERIODS.find((item) => item.id === period)?.label}
          icon={Gauge}
        />

        <AnalyticsTile
          label="Peak Demand"
          value={`${analytics.peakDemand.toFixed(1)} kW`}
          helper="Highest recorded demand"
          icon={TrendingUp}
        />

        <AnalyticsTile
          label="Estimated Charge"
          value={`₹${analytics.totalCost.toLocaleString("en-IN", {
            maximumFractionDigits: 0,
          })}`}
          helper={`₹${COST_PER_KWH.toFixed(2)} per kWh`}
          icon={Activity}
        />

        <AnalyticsTile
          label="Client Environment"
          value={clientData.comfort.aqi}
          helper={`${clientData.comfort.co2} · ${clientData.comfort.pm25}`}
          icon={Wind}
          attention={clientData.comfort.aqi !== "Good"}
        />
      </div>

      <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.85fr)]">
        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[20px] border border-white/85 bg-white/88 shadow-[0_18px_38px_rgba(15,36,56,0.10),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.1em] text-[#081F5C]">
                Client Usage Trend
              </h3>

              <p className="mt-0.5 text-[7px] font-bold uppercase text-slate-400">
                {selectedLabel} ·{" "}
                {PERIODS.find((item) => item.id === period)?.label}
              </p>
            </div>

            <span className="border border-blue-200 bg-blue-50 px-2 py-1 text-[7px] font-black uppercase text-[#2B6F8C]">
              {clientName}
            </span>
          </div>

          <div className="min-h-0 bg-[linear-gradient(180deg,rgba(247,250,251,0.96),rgba(231,239,243,0.90))] p-2">
            <ConsumptionChart data={selectedConsumption} />
          </div>
        </section>

        <div className="grid min-h-0 grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3">
          <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[20px] border border-white/85 bg-white/88 shadow-[0_18px_38px_rgba(15,36,56,0.10),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.1em] text-[#081F5C]">
                System Consumption
              </h3>

              <span className="text-[7px] font-black uppercase text-slate-400">
                Client Distribution
              </span>
            </div>

            <div className="min-h-0 overflow-y-auto p-3">
              <div className="space-y-3">
                {selectedSystems.map((system) => (
                  <div key={system.id}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-[8px]">
                      <span className="truncate font-bold text-[#081F5C]">
                        {system.title}
                      </span>

                      <span className="shrink-0 font-black text-[#2B6F8C]">
                        {system.consumption.toLocaleString("en-IN")} kWh
                      </span>
                    </div>

                    <div className="h-2 bg-slate-100">
                      <div
                        className="h-full bg-[linear-gradient(180deg,#24698F,#174D70)]"
                        style={{
                          width: `${Math.max(
                            4,
                            (system.consumption / maxSystemConsumption) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[20px] border border-white/85 bg-white/88 shadow-[0_18px_38px_rgba(15,36,56,0.10),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.1em] text-[#081F5C]">
                Period Summary
              </h3>

              <span className="text-[7px] font-black uppercase text-[#2B6F8C]">
                {selectedLabel}
              </span>
            </div>

            <div className="min-h-0 overflow-y-auto p-3">
              <div className="space-y-2">
                <SummaryRow
                  label="Total Usage"
                  value={`${analytics.total.toLocaleString("en-IN", {
                    maximumFractionDigits: 1,
                  })} kWh`}
                />
                <SummaryRow
                  label="Average Usage"
                  value={`${analytics.average.toLocaleString("en-IN", {
                    maximumFractionDigits: 1,
                  })} kWh`}
                />
                <SummaryRow
                  label="Peak Demand"
                  value={`${analytics.peakDemand.toFixed(1)} kW`}
                />
                <SummaryRow
                  label="Power Factor"
                  value={clientData.energy.pf}
                />
                <SummaryRow
                  label="Occupancy"
                  value={clientData.comfort.occupancy}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 bg-[#081F5C] text-white">
              <div className="px-3 py-2">
                <p className="text-[7px] font-black uppercase text-blue-200">
                  Total Energy
                </p>
                <p className="mt-0.5 text-[11px] font-black">
                  {analytics.total.toLocaleString("en-IN", {
                    maximumFractionDigits: 1,
                  })}{" "}
                  kWh
                </p>
              </div>

              <div className="px-3 py-2">
                <p className="text-[7px] font-black uppercase text-blue-200">
                  Estimated Charge
                </p>
                <p className="mt-0.5 text-[11px] font-black text-[#D8B56A]">
                  ₹{analytics.totalCost.toLocaleString("en-IN", {
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function AnalyticsTile({
  label,
  value,
  helper,
  icon: Icon,
  attention = false,
}) {
  return (
    <div className="flex min-h-[82px] items-center justify-between rounded-[18px] border border-white/85 bg-[linear-gradient(145deg,rgba(255,255,255,0.97),rgba(239,245,248,0.91))] px-4 py-3 shadow-[0_16px_34px_rgba(15,36,56,0.09),inset_0_1px_0_rgba(255,255,255,0.95)]">
      <div className="min-w-0">
        <p className="text-[7px] font-black uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>

        <p
          className={`mt-1 truncate text-[17px] font-black ${
            attention ? "text-amber-600" : "text-[#081F5C]"
          }`}
        >
          {value}
        </p>

        <p className="mt-0.5 truncate text-[7px] text-slate-400">
          {helper}
        </p>
      </div>

      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.96)] ${
          attention
            ? "border-amber-200 bg-amber-50 text-amber-600"
            : "border-blue-200 bg-blue-50 text-[#2B6F8C]"
        }`}
      >
        <Icon size={14} />
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-slate-100 bg-[#F8FAFD] px-3 py-2">
      <span className="text-[8px] font-bold text-slate-500">{label}</span>
      <span className="text-right text-[9px] font-black text-[#081F5C]">
        {value}
      </span>
    </div>
  );
}

function ConsumptionChart({ data }) {
  const width = 920;
  const height = 330;
  const padding = { top: 22, right: 22, bottom: 45, left: 55 };

  const maxValue = Math.max(
    ...data.flatMap((item) => [item.consumption, item.demand]),
    1
  );

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const step = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth;

  const scaleY = (value) =>
    padding.top + plotHeight - (value / maxValue) * plotHeight;

  const consumptionPoints = data
    .map(
      (item, index) =>
        `${padding.left + index * step},${scaleY(item.consumption)}`
    )
    .join(" ");

  const demandPoints = data
    .map(
      (item, index) =>
        `${padding.left + index * step},${scaleY(item.demand)}`
    )
    .join(" ");

  const areaPath = [
    `M ${padding.left},${padding.top + plotHeight}`,
    ...data.map(
      (item, index) =>
        `L ${padding.left + index * step},${scaleY(item.consumption)}`
    ),
    `L ${padding.left + (data.length - 1) * step},${
      padding.top + plotHeight
    }`,
    "Z",
  ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      role="img"
      aria-label="Client energy consumption and demand chart"
    >
      <defs>
        <linearGradient id="clientConsumptionArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2B6F8C" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#2B6F8C" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {[0, 1, 2, 3, 4].map((index) => {
        const y = padding.top + (plotHeight / 4) * index;
        const value = maxValue - (maxValue / 4) * index;

        return (
          <g key={index}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="#CBD5E1"
              strokeWidth="1"
              strokeDasharray="4 5"
            />

            <text
              x={padding.left - 10}
              y={y + 3}
              textAnchor="end"
              fontSize="9"
              fill="#64748B"
              fontWeight="700"
            >
              {value.toFixed(0)}
            </text>
          </g>
        );
      })}

      <path d={areaPath} fill="url(#clientConsumptionArea)" />

      <polyline
        points={consumptionPoints}
        fill="none"
        stroke="#2B6F8C"
        strokeWidth="3.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      <polyline
        points={demandPoints}
        fill="none"
        stroke="#D8B56A"
        strokeWidth="2.5"
        strokeDasharray="7 6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {data.map((item, index) => {
        const x = padding.left + index * step;
        const showLabel =
          data.length <= 12 ||
          index === 0 ||
          index === data.length - 1 ||
          index % Math.ceil(data.length / 8) === 0;

        return (
          <g key={`${item.label}-${index}`}>
            <circle
              cx={x}
              cy={scaleY(item.consumption)}
              r="3.5"
              fill="#FFFFFF"
              stroke="#2B6F8C"
              strokeWidth="2"
            >
              <title>
                {`${item.label}: ${item.consumption.toLocaleString(
                  "en-IN"
                )} kWh`}
              </title>
            </circle>

            <circle
              cx={x}
              cy={scaleY(item.demand)}
              r="2.8"
              fill="#D8B56A"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            >
              <title>{`${item.label}: ${item.demand} kW`}</title>
            </circle>

            {showLabel ? (
              <text
                x={x}
                y={height - 14}
                textAnchor="middle"
                fontSize="8"
                fill="#64748B"
                fontWeight="700"
              >
                {item.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function calculateAnalytics(data) {
  const total = data.reduce((sum, item) => sum + item.consumption, 0);
  const totalCost = data.reduce((sum, item) => sum + item.cost, 0);
  const peakDemand = Math.max(...data.map((item) => item.demand), 0);

  return {
    total,
    totalCost,
    peakDemand,
    average: data.length ? total / data.length : 0,
  };
}

function getConsumptionData(period, floorNumber, clientNumber) {
  const seed = floorNumber * 17 + clientNumber * 11;

  const labels = {
    hourly: [
      "00:00",
      "02:00",
      "04:00",
      "06:00",
      "08:00",
      "10:00",
      "12:00",
      "14:00",
      "16:00",
      "18:00",
      "20:00",
      "22:00",
    ],
    daily: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    weekly: ["W1", "W2", "W3", "W4", "W5"],
    monthly: [
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
  };

  const periodMultiplier = {
    hourly: 1,
    daily: 18,
    weekly: 95,
    monthly: 410,
  };

  return labels[period].map((label, index) => {
    const wave = Math.sin((index + seed) * 0.72) * 8;
    const trend = index * 1.65;
    const base = 34 + (seed % 13);
    const multiplier = periodMultiplier[period];

    const consumption = Math.max(
      10,
      (base + wave + trend + ((index * seed) % 7)) * multiplier
    );

    const demand = Math.max(
      8,
      base * 0.72 + wave * 0.35 + ((index + seed) % 6)
    );

    return {
      label,
      consumption: Number(consumption.toFixed(2)),
      demand: Number(demand.toFixed(2)),
      cost: Number((consumption * COST_PER_KWH).toFixed(2)),
    };
  });
}

function getSampleClientRealtimeData(floorNumber, clientNumber) {
  const seed = floorNumber * 10 + clientNumber;
  const hasAlert = seed % 6 === 0;

  const demand = 32 + seed * 2;
  const kva = Math.round(demand / 0.92);
  const current = 65 + seed * 3;
  const todayKwh = 420 + seed * 18;
  const monthKwh = 9650 + seed * 210;
  const peakDemand = demand + 14 + (seed % 8);
  const estimatedCost = monthKwh * COST_PER_KWH;

  return {
    numeric: {
      demand,
      energyConsumption: 1200 + seed * 85,
      hvacLoad: Math.round(demand * 0.38),
      hvacConsumption: 420 + seed * 22,
      lightingLoad: Math.round(demand * 0.22),
      lightingConsumption: 260 + seed * 16,
      comfortLoad: Math.max(4, Math.round(demand * 0.12)),
      comfortConsumption: 125 + seed * 8,
      powerLoad: Math.round(demand * 0.28),
      powerConsumption: 330 + seed * 18,
    },
    hvac: {
      ahu1: "Running",
      ahu2: hasAlert ? "Check" : "Running",
      supplyTemp: `${20 + (seed % 4)}°C`,
      returnTemp: `${23 + (seed % 4)}°C`,
      humidity: `${45 + (seed % 10)}%`,
    },
    lighting: {
      zoneA: "ON",
      zoneB: "ON",
      zoneC: seed % 3 === 0 ? "OFF" : "ON",
      load: `${45 + (seed % 20)}%`,
      mode: "Auto",
    },
    energy: {
      kwh: `${1200 + seed * 85} kWh`,
      todayKwh: `${todayKwh.toLocaleString("en-IN")} kWh`,
      monthKwh: `${monthKwh.toLocaleString("en-IN")} kWh`,
      demand: `${demand} kW`,
      peakDemand: `${peakDemand} kW`,
      estimatedCost: `₹${estimatedCost.toLocaleString("en-IN", {
        maximumFractionDigits: 0,
      })}`,
      kva: `${kva} kVA`,
      pf: hasAlert ? "0.94" : "0.98",
      voltage: `${415 + (seed % 5)} V`,
      current: `${current} A`,
    },
    comfort: {
      roomTemp: `${22 + (seed % 4)}°C`,
      co2: `${560 + seed * 7} ppm`,
      pm25: `${10 + (seed % 12)} μg/m³`,
      aqi: hasAlert ? "Moderate" : "Good",
      occupancy: `${18 + (seed % 12)} Persons`,
    },
    power: {
      frequency: "50 Hz",
      voltageStatus: hasAlert ? "Low" : "Normal",
      loadStatus: hasAlert ? "High Load" : "Normal",
      faultAlarm: hasAlert ? "Load Warning" : "None",
      communication: "Online",
    },
    communication: {
      meterLink: "Online",
      controllerLink: "Online",
      lastUpdate: "2 sec ago",
    },
    alerts: {
      count: hasAlert ? 1 : 0,
      health: hasAlert ? "Warning" : "Normal",
    },
  };
}
