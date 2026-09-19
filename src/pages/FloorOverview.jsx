
import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  Download,
  Fan,
  FileJson,
  Gauge,
  Lightbulb,
  Lock,
  RefreshCw,
  TrendingUp,
  Users,
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
  isAdmin,
  isSuperAdmin,
  normalizeFloorId,
  resolveNearestAllowedParentRoute,
} from "../utils/accessControl";
import { getZonesForFloor } from "../utils/bmsHierarchy";

const FLOOR_RATE_PER_KWH = 8.5;

const FLOOR_PERIODS = {
  hourly: { label: "Hourly", multiplier: 0.045 },
  daily: { label: "Daily", multiplier: 1 },
  weekly: { label: "Weekly", multiplier: 7 },
  monthly: { label: "Monthly", multiplier: 30 },
};

const SYSTEM_STYLES = {
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
  standby: {
    dot: "bg-cyan-300",
    text: "text-cyan-200",
    border: "border-cyan-300/30",
    background: "bg-cyan-300/10",
    progress: "bg-cyan-300",
  },
};

export default function FloorOverview() {
  const { buildingId, floorId } = useParams();
  const [activeView, setActiveView] = useState("monitoring");
  const [accessMessage, setAccessMessage] = useState("");

  const currentUser = tempApi.getCurrentAccount();
  const canViewReports = accountHasPermission(
    currentUser,
    USER_PERMISSIONS.ANALYTICS_VIEW
  );

  const showLockedMessage = (resourceName) => {
    setAccessMessage(`${resourceName} is visible in the site hierarchy, but operational access is not assigned to your account.`);
    window.setTimeout(() => setAccessMessage(""), 3200);
  };

  if (!currentUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#EEF3F8] px-6 py-10">
        <div className="max-w-md border-2 border-red-400 bg-[#081F5C] p-8 text-center text-white">
          <h2 className="text-2xl font-black">
            User Session Required
          </h2>

          <p className="mt-2 text-xs text-blue-200">
            Please sign in with an active User account to open the floor dashboard.
          </p>

          <button
            type="button"
            onClick={() => {
              tempApi.logout();
              window.location.href = "/auth";
            }}
            className="mt-6 inline-flex items-center gap-2 border border-cyan-400 bg-[#004AAD] px-6 py-2.5 text-sm font-black text-white hover:bg-[#003B8A]"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Login
          </button>
        </div>
      </main>
    );
  }

  const isCommonFloor = String(floorId).toLowerCase() === "common";
  const floorKey = isCommonFloor ? "common" : String(floorId);
  // Keep the existing demo/realtime calculations numeric without changing the UI.
  const floorNumber = isCommonFloor ? 1 : Number(floorId);
  const normalizedFloorId = normalizeFloorId(buildingId, floorKey);

  if (
    !canAccessBuilding(currentUser, buildingId) ||
    !canAccessFloor(currentUser, normalizedFloorId)
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#EEF3F8] px-6 py-10">
        <div className="max-w-md border-2 border-amber-400 bg-[#081F5C] p-8 text-center text-white">
          <h2 className="text-2xl font-black">Access Denied</h2>
          <p className="mt-2 text-xs text-blue-200">
            This floor is outside your assigned BMS scope.
          </p>
          <Link
            to={resolveNearestAllowedParentRoute(currentUser, { buildingId })}
            className="mt-6 inline-flex items-center gap-2 border border-cyan-400 bg-[#004AAD] px-6 py-2.5 text-sm font-black text-white hover:bg-[#003B8A]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to permitted scope
          </Link>
        </div>
      </main>
    );
  }

  const floorZones = getZonesForFloor(normalizedFloorId);
  const configuredFloorClients = getFloorClients(buildingId, floorKey);

  const floorClientRecords = configuredFloorClients.map((clientName, index) => {
    const zone = floorZones[index] ?? {
      id: `${normalizedFloorId}-zone-${index + 1}`,
      routeId: String(index + 1),
      zoneLabel: `Zone ${index + 1}`,
      zoneName: clientName,
      clientName,
      name: clientName,
    };

    return {
      name: clientName,
      routeId: zone.routeId ?? String(index + 1),
      zone,
      locked:
        floorZones[index] != null
          ? !canAccessZone(currentUser, zone.id)
          : false,
    };
  });
  const floorClients = floorClientRecords
    .filter((client) => !client.locked)
    .map((client) => client.name);
  const floorData = getSampleFloorRealtimeData(floorNumber);
  const accessibleZoneCount = floorClientRecords.filter(
    (client) => !client.locked
  ).length;
  const totalZoneCount = Math.max(floorClientRecords.length, 1);
  const zoneAccessFactor =
    isSuperAdmin(currentUser) || accessibleZoneCount === totalZoneCount
      ? 1
      : accessibleZoneCount / totalZoneCount;
  const scaleZoneValue = (value) =>
    Math.max(0, Math.round(Number(value || 0) * zoneAccessFactor));
  const scopedFloorData = {
    ...floorData,
    ahu: {
      ...floorData.ahu,
      running: scaleZoneValue(floorData.ahu.running),
      stopped: scaleZoneValue(floorData.ahu.stopped),
    },
    lighting: {
      ...floorData.lighting,
      inactiveZones: scaleZoneValue(floorData.lighting.inactiveZones),
    },
    tenants: {
      ...floorData.tenants,
      occupied: scaleZoneValue(floorData.tenants.occupied),
      available: scaleZoneValue(floorData.tenants.available),
    },
    alerts: {
      ...floorData.alerts,
      count: scaleZoneValue(floorData.alerts.count),
    },
    zones: floorClientRecords
      .filter((client) => !client.locked)
      .map((client) => {
        const zoneIndex = Math.max(0, Number(client.routeId) - 1);
        return floorData.zones[zoneIndex];
      })
      .filter(Boolean),
  };
  const hasFloorSystemScope =
    isSuperAdmin(currentUser) ||
    isAdmin(currentUser) ||
    canAccessFloor(currentUser, normalizedFloorId);

  const floorMonitoring = [
    {
      id: "ahu",
      title: "AHU",
      icon: Fan,
      status: scopedFloorData.ahu.stopped > 0 ? "Attention" : "Healthy",
      tone: scopedFloorData.ahu.stopped > 0 ? "warning" : "healthy",
      currentLoad: scaleZoneValue(Math.round((150 + floorNumber * 6) * 0.38)),
      consumption: scaleZoneValue(940 + floorNumber * 34),
      efficiency: scopedFloorData.ahu.stopped > 0 ? 86 : 94,
      metrics: [
        ["Running AHUs", `${scopedFloorData.ahu.running} Units`],
        ["Stopped AHUs", `${scopedFloorData.ahu.stopped}`],
        ["Average Temperature", scopedFloorData.ahu.temperature],
        ["Humidity", scopedFloorData.ahu.humidity],
      ],
    },
 
    {
      id: "energy",
      title: "EMS",
      icon: Gauge,
      status: "Healthy",
      tone: "healthy",
      currentLoad: scaleZoneValue(150 + floorNumber * 6),
      consumption: scaleZoneValue(2200 + floorNumber * 95),
      efficiency: 98,
      metrics: [
        ["Demand", scopedFloorData.energy.demand],
        ["Power Factor", scopedFloorData.energy.pf],
        ["Voltage", scopedFloorData.energy.voltage],
        ["Current", scopedFloorData.energy.current],
      ],
    },
  
   
     {
      id: "Lighting",
      title: "LIGHTING",
      icon: Fan,
      status: scopedFloorData.ahu.stopped > 0 ? "Attention" : "Healthy",
      tone: scopedFloorData.ahu.stopped > 0 ? "warning" : "healthy",
      currentLoad: scaleZoneValue(Math.round((150 + floorNumber * 6) * 0.38)),
      consumption: scaleZoneValue(940 + floorNumber * 34),
      efficiency: scopedFloorData.ahu.stopped > 0 ? 86 : 94,
      metrics: [
        ["Running AHUs", `${scopedFloorData.ahu.running} Units`],
        ["Stopped AHUs", `${scopedFloorData.ahu.stopped}`],
        ["Average Temperature", scopedFloorData.ahu.temperature],
        ["Humidity", scopedFloorData.ahu.humidity],
      ],
    },
  ];

  const totalFloorConsumption = floorMonitoring
    .filter((system) => system.id !== "alerts")
    .reduce((total, system) => total + system.consumption, 0);

  const totalFloorLoad = floorMonitoring
    .filter((system) => system.id !== "alerts")
    .reduce((total, system) => total + system.currentLoad, 0);

  const operationalSystems = floorMonitoring.filter(
    (system) => system.id !== "alerts"
  );

  const activeSystems = operationalSystems.filter(
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
      {accessMessage && (
        <div className="fixed right-5 top-24 z-[1200] max-w-sm rounded-lg border border-amber-300 bg-white/95 px-4 py-3 text-sm font-semibold text-[#17212B] shadow-2xl backdrop-blur-xl">
          <div className="flex items-start gap-2">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>{accessMessage}</span>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-[1000] min-h-[72px] shrink-0 border-b border-[#D2B778]/70 bg-[linear-gradient(90deg,#071421_0%,#0A2034_48%,#0B2A42_100%)] px-5 py-3 text-white shadow-[0_10px_30px_rgba(2,20,38,0.24)]">
        <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Link to="/dashboard" className="flex min-w-0 items-center no-underline">
            <div className="min-w-0">
              <h1 className="truncate text-[22px] font-semibold uppercase leading-none tracking-[0.18em] text-white sm:text-[26px]">
                ARCOT
                <span className="ml-2 text-[#D8B56A]">IIoT 1.0</span>
              </h1>

              <span className="mt-1 block truncate text-[9px] font-medium uppercase tracking-[0.35em] text-[#AFC4D8]">
                Industrial Internet of Things
              </span>
            </div>

            <div className="ml-5 hidden h-[54px] border-l border-[#385674] sm:block" />

            <img
              src={prestigeLogo}
              alt="Prestige Group"
              className="ml-5 hidden h-[52px] w-[100px] object-contain sm:block"
            />
          </Link>

          <div className="hidden flex-col items-center lg:flex">
            <span className="text-[8px] font-bold uppercase tracking-[0.28em] text-cyan-300">
              Floor Monitoring Console
            </span>

            <h2 className="mt-1 text-[17px] font-black uppercase tracking-[0.08em] text-white">
              {buildingId?.toUpperCase()} • {isCommonFloor ? "Common" : `Floor ${floorId}`}
            </h2>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
            <Link
              to={`/building/${buildingId}`}
              className="flex h-[44px] items-center justify-center rounded-[8px] border border-[#6E97B5]/80 bg-[linear-gradient(180deg,#24698F,#174D70)] px-5 text-[10px] font-black uppercase tracking-[0.13em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_7px_16px_rgba(0,0,0,0.18)] transition hover:-translate-y-px hover:brightness-110 sm:min-w-[110px]"
            >
              Back
            </Link>

            <div className="hidden h-[44px] min-w-[168px] rounded-[8px] border border-[#3B617A] bg-[linear-gradient(180deg,#0C2940,#091D30)] px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_6px_14px_rgba(0,0,0,0.14)] lg:block">
              <p className="max-w-[190px] truncate text-[9px] font-bold text-cyan-200">
                {currentUser.name}
              </p>

              <p className="max-w-[190px] truncate text-[7px] uppercase tracking-[0.08em] text-[#AFC4D8]">
                {currentUser.designation || "USER"} ·{" "}
                {currentUser.companyName || "Assigned Company"}
              </p>
            </div>

            <div className="hidden h-[44px] min-w-[168px] items-center justify-center gap-2 rounded-[8px] border border-[#3B617A] bg-[linear-gradient(180deg,#0C2940,#091D30)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_6px_14px_rgba(0,0,0,0.14)] md:flex">
              <span className="h-2 w-2 bg-emerald-400" />
              <span className="text-[10px] font-bold tracking-[0.15em]">
                Realtime Active
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                tempApi.logout();
                window.location.href = "/auth";
              }}
              className="h-[44px] rounded-[8px] border border-[#D08A83]/80 bg-[linear-gradient(180deg,#B75B55,#94413D)] px-5 text-[10px] font-black uppercase tracking-[0.13em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_7px_16px_rgba(101,0,0,0.20)] transition hover:-translate-y-px hover:brightness-110 sm:min-w-[110px]"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

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
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#004AAD]">
              {activeView === "monitoring"
                ? "Floor Realtime Telemetry"
                : "Floor Consumption Analytics"}
            </p>

            <h2 className="mt-0.5 text-[15px] font-black uppercase tracking-wide text-[#081F5C]">
              Floor {floorId}{" "}
              {activeView === "monitoring"
                ? "Monitoring Overview"
                : "Analytic Overview"}
            </h2>

            <p className="mt-0.5 text-[8px] font-semibold text-slate-500">
              {currentUser.companyName || "Assigned Company"} ·{" "}
              {currentUser.accessType || "FLOOR"}:{" "}
              {currentUser.accessName || `Floor ${floorId}`}
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
            <FloorViewSelector
              activeView={activeView}
              onChange={setActiveView}
              canViewReports={canViewReports}
            />

            <span className="flex items-center gap-2 text-[9px] font-black uppercase text-emerald-600">
              <span className="h-2 w-2 bg-emerald-500" />
              Online
            </span>
          </div>
        </div>

        <div className="relative z-10 min-h-0 flex-1">
        {activeView === "monitoring" ? (
          <>
            <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <SummaryTile
                label="Floor Load"
                value={`${totalFloorLoad.toLocaleString("en-IN")} kW`}
                helper="Current connected demand"
                icon={Zap}
              />

              <SummaryTile
                label="Consumption"
                value={`${totalFloorConsumption.toLocaleString("en-IN")} kWh`}
                helper="Current monitoring period"
                icon={Gauge}
              />

              <SummaryTile
                label="Systems Online"
                value={`${activeSystems}/${operationalSystems.length}`}
                helper="Operational systems online"
                icon={Activity}
              />

              <SummaryTile
                label="Active Alerts"
                value={`${scopedFloorData.alerts.count}`}
                helper={
                  scopedFloorData.alerts.count > 0
                    ? "Requires operator attention"
                    : "No critical alarms"
                }
                icon={AlertTriangle}
                attention={scopedFloorData.alerts.count > 0}
              />
            </div>

            <section className="mb-4 overflow-hidden rounded-[24px] border border-white/75 bg-white/52 text-[#132131] shadow-[0_20px_44px_rgba(15,36,56,0.11),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-xl">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C8D5DC]/75 bg-[linear-gradient(90deg,#0A2034,#0B2A42)] px-5 py-4 text-white">
                <div>
                 

                  <h3 className="mt-1 text-[13px] font-black uppercase tracking-wide">
                    {isCommonFloor ? "Common" : `Floor ${floorId}`} Client Details
                  </h3>
                </div>

                <span className="inline-flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.1em] text-blue-100">
                  <Users size={14} className="text-cyan-300" />
                  {floorClientRecords.length} Total Clients
                </span>
              </header>

              <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4">
                {floorClientRecords.length === 0 ? (
                  <div className="col-span-full rounded-[18px] border border-slate-200 bg-white/80 px-5 py-8 text-center">
                    <p className="text-[12px] font-black uppercase tracking-[0.1em] text-[#081F5C]">
                      Vacant Floor
                    </p>
                    <p className="mt-2 text-[9px] text-slate-500">
                      No clients are configured for Sky {buildingId === "wing-a" ? "1" : "2"} Floor {floorId}.
                    </p>
                  </div>
                ) : floorClientRecords.map((client) => {
                  const zoneIndex = Math.max(0, Number(client.routeId) - 1);
                  const zone = floorData.zones[zoneIndex] ?? floorData.zones[0];
                  const warning = !client.locked && zone.health === "Warning";
                  const Wrapper = client.locked ? "button" : Link;
                  const wrapperProps = client.locked
                    ? {
                        type: "button",
                        "aria-disabled": true,
                        onClick: () => showLockedMessage(client.name),
                      }
                    : {
                        to: `/building/${buildingId}/floor/${floorId}/client/${client.routeId}`,
                      };

                  return (
                    <Wrapper
                      key={client.zone.id || `${buildingId}-${floorId}-${client.routeId}`}
                      {...wrapperProps}
                      className={`group relative flex min-h-[158px] w-full flex-col justify-between overflow-hidden rounded-[20px] border px-5 py-4 text-left transition duration-200 ${
                        client.locked
                          ? "cursor-not-allowed border-slate-300/70 bg-slate-100/75 text-slate-500 opacity-75"
                          : "border-white/85 bg-[linear-gradient(145deg,rgba(255,255,255,0.97),rgba(235,242,246,0.92))] text-[#132131] shadow-[0_16px_34px_rgba(15,36,56,0.10),inset_0_1px_0_rgba(255,255,255,0.98)] hover:-translate-y-1 hover:border-white hover:shadow-[0_24px_48px_rgba(15,36,56,0.15)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-[16px] font-black uppercase leading-tight tracking-[0.045em] text-[#132131]">
                            {client.name}
                          </p>

                          <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[#2B6F8C]">
                            {client.zone.zoneLabel || `Zone ${client.routeId}`}
                          </p>
                        </div>

                        <span
                          className={`inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.06em] ${
                            client.locked
                              ? "border-amber-300/40 bg-amber-300/10 text-amber-200"
                              : warning
                              ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                              : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                          }`}
                        >
                          {client.locked ? (
                            <Lock size={11} />
                          ) : (
                            <span
                              className={`h-1.5 w-1.5 ${
                                warning ? "bg-amber-400" : "bg-emerald-400"
                              }`}
                            />
                          )}
                          {client.locked ? "No Access" : zone.health}
                        </span>
                      </div>

                      <div className="mt-4 space-y-2">
                        {client.locked ? (
                          <div className="border border-amber-300/25 bg-amber-300/10 px-3 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-100">
                            Operational readings hidden
                          </div>
                        ) : (
                          <>
                            <ClientReading label="Power Load" value={zone.load} />
                            <ClientReading label="AHU Status" value={zone.ahu} />
                            <ClientReading label="Lighting" value={zone.lighting} />
                          </>
                        )}
                      </div>
                    </Wrapper>
                  );
                })}
              </div>
            </section>

            <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 xl:auto-rows-fr">
              {floorMonitoring.map((system) => (
                <FloorSystemCard
                  key={system.id}
                  system={system}
                  locked={!hasFloorSystemScope}
                />
              ))}
            </section>
          </>
        ) : (
          <FloorAnalyticsView
            floorId={floorId}
            buildingId={buildingId}
            systems={floorMonitoring}
            floorClients={floorClients}
            floorData={scopedFloorData}
            canDownloadReports={accountHasPermission(
              currentUser,
              USER_PERMISSIONS.DATA_DOWNLOAD
            )}
          />
        )}
        </div>
      </section>

      <footer className="border-t border-white/60 bg-white/72 px-5 py-2 text-[9px] text-slate-500 shadow-[0_-8px_24px_rgba(15,36,56,0.05)] backdrop-blur-xl">
        <div className="flex items-center justify-between font-semibold">
          <p>© 2026 Arcot Industries. All systems operational.</p>

          <span className="flex items-center gap-2 text-emerald-600">
            <span className="h-2 w-2 bg-emerald-500" />
            {isCommonFloor ? "Common" : `Floor ${floorId}`} Feeders Connected
          </span>
        </div>
      </footer>
    </main>
  );
}


function FloorViewSelector({
  activeView,
  onChange,
  canViewReports = false,
}) {
  return (
    <div className="flex overflow-hidden rounded-[10px] border border-[#8EA9B8] bg-white/90 shadow-[0_6px_14px_rgba(15,36,56,0.06)] backdrop-blur-xl">
      <button
        type="button"
        onClick={() => onChange("monitoring")}
        className={`flex h-[36px] items-center gap-2 px-4 text-[9px] font-black uppercase tracking-[0.1em] ${
          activeView === "monitoring"
            ? "bg-[#081F5C] text-white"
            : "text-[#081F5C] hover:bg-blue-50"
        }`}
      >
        <Building2 size={13} />
        Floor Systems
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
              ? "bg-[#004AAD] text-white"
              : "text-[#004AAD] hover:bg-blue-50"
        }`}
      >
        <BarChart3 size={13} />
        Analytic View
      </button>
    </div>
  );
}

function FloorAnalyticsView({
  floorId,
  buildingId,
  systems,
  floorClients,
  floorData,
  canDownloadReports = false,
}) {
  const [period, setPeriod] = useState("daily");
  const [selectedSystem, setSelectedSystem] = useState("all");
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const multiplier = FLOOR_PERIODS[period].multiplier;

  const rows = useMemo(() => {
    const source =
      selectedSystem === "all"
        ? systems.filter((system) => system.id !== "alerts")
        : systems.filter((system) => system.id === selectedSystem);

    return source.map((system) => {
      const consumedEnergy = Number(
        (system.consumption * multiplier).toFixed(2)
      );
      const charge = Number(
        (consumedEnergy * FLOOR_RATE_PER_KWH).toFixed(2)
      );

      return { ...system, consumedEnergy, charge };
    });
  }, [multiplier, selectedSystem, systems]);

  const summary = useMemo(() => {
    const consumption = rows.reduce(
      (total, row) => total + row.consumedEnergy,
      0
    );
    const charges = rows.reduce(
      (total, row) => total + row.charge,
      0
    );
    const load = rows.reduce(
      (total, row) => total + row.currentLoad,
      0
    );

    return { consumption, charges, load };
  }, [rows]);

  const chartData = useMemo(() => {
    const totalDaily = rows.reduce(
      (total, row) => total + row.consumption,
      0
    );

    const configs = {
      hourly: {
        labels: ["00h", "03h", "06h", "09h", "12h", "15h", "18h", "21h"],
        factors: [0.22, 0.19, 0.28, 0.62, 0.84, 0.91, 0.76, 0.41],
      },
      daily: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        factors: [0.94, 0.98, 1.04, 1.01, 1.08, 0.84, 0.78],
      },
      weekly: {
        labels: ["W1", "W2", "W3", "W4"],
        factors: [6.8, 7.1, 7.35, 7.56],
      },
      monthly: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
        factors: [27.4, 26.9, 28.5, 29.2, 30.1, 29.8, 30.4, 30.7],
      },
    };

    const config = configs[period];

    return {
      labels: config.labels,
      values: config.factors.map((factor) =>
        Number((totalDaily * factor).toFixed(2))
      ),
    };
  }, [period, rows]);

  const maxUsage = Math.max(
    ...rows.map((row) => row.consumedEnergy),
    1
  );

  const selectedLabel =
    selectedSystem === "all"
      ? "All Floor Systems"
      : systems.find((system) => system.id === selectedSystem)?.title ??
        "All Floor Systems";

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

  const downloadCsv = () => {
    if (!canDownloadReports) return;

    const content = [
      ["System", "Period", "Energy (kWh)", "Rate (INR)", "Charge (INR)"],
      ...rows.map((row) => [
        row.title,
        FLOOR_PERIODS[period].label,
        row.consumedEnergy,
        FLOOR_RATE_PER_KWH,
        row.charge,
      ]),
    ]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    downloadFile(
      content,
      "text/csv;charset=utf-8;",
      `${buildingId}-floor-${floorId}-${selectedSystem}-${period}.csv`
    );
  };

  const downloadJson = () => {
    if (!canDownloadReports) return;

    downloadFile(
      JSON.stringify(
        {
          buildingId,
          floorId,
          period: FLOOR_PERIODS[period].label,
          selectedSystem: selectedLabel,
          generatedAt: new Date().toISOString(),
          totalClients: floorClients.length,
          clientNames: floorClients,
          airQuality: floorData.air,
          alerts: floorData.alerts,
          totals: summary,
          systems: rows,
        },
        null,
        2
      ),
      "application/json;charset=utf-8;",
      `${buildingId}-floor-${floorId}-${selectedSystem}-${period}.json`
    );
  };

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:grid lg:h-full lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-white/80 bg-white/88 px-4 py-3 shadow-[0_18px_38px_rgba(15,36,56,0.10),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#004AAD]">
              Floor Analysis
            </p>
            <h3 className="mt-0.5 text-[13px] font-black uppercase text-[#081F5C]">
              Usage, Load & Charges
            </h3>
          </div>

          <div className="flex overflow-hidden rounded-[10px] border border-[#8EA9B8] bg-white/90 shadow-[0_6px_14px_rgba(15,36,56,0.06)]">
            {Object.entries(FLOOR_PERIODS).map(([key, item]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={`h-[32px] border-r border-[#004AAD] px-3 text-[8px] font-black uppercase last:border-r-0 ${
                  period === key
                    ? "bg-[#004AAD] text-white"
                    : "bg-white text-[#004AAD]"
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
            <option value="all">All Floor Systems</option>
            {systems
              .filter((system) => system.id !== "alerts")
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
                ? "bg-[#004AAD] text-white"
                : "cursor-not-allowed bg-slate-200 text-slate-400"
            }`}
          >
            <Download size={12} />
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
                ? "border-[#004AAD] text-[#004AAD]"
                : "cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400"
            }`}
          >
            <FileJson size={12} />
            JSON
          </button>

          <button
            type="button"
            onClick={() => setLastUpdated(new Date())}
            title={lastUpdated.toLocaleTimeString()}
            className="flex h-[32px] w-[32px] items-center justify-center border border-slate-300 text-slate-600"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AnalyticsTile
          label="Floor Load"
          value={`${summary.load.toLocaleString("en-IN")} kW`}
          helper={selectedLabel}
          icon={Zap}
        />

        <AnalyticsTile
          label="Consumption"
          value={`${summary.consumption.toLocaleString("en-IN", {
            maximumFractionDigits: 2,
          })} kWh`}
          helper={FLOOR_PERIODS[period].label}
          icon={Gauge}
        />

        <AnalyticsTile
          label="Estimated Charge"
          value={`₹${summary.charges.toLocaleString("en-IN", {
            maximumFractionDigits: 2,
          })}`}
          helper={`₹${FLOOR_RATE_PER_KWH.toFixed(2)} per kWh`}
          icon={TrendingUp}
        />

        <AnalyticsTile
          label="Total Clients"
          value={`${floorClients.length}`}
          helper="Configured floor clients"
          icon={Users}
        />

        <AnalyticsTile
          label="Floor Environment"
          value={floorData.air.status}
          helper={`${floorData.air.co2} · ${floorData.air.pm25}`}
          icon={Wind}
          attention={floorData.air.status !== "Healthy"}
        />
      </div>

      <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.85fr)]">
        <section className="grid min-h-[320px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[20px] border border-white/80 bg-white/88 shadow-[0_18px_38px_rgba(15,36,56,0.10),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl lg:min-h-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.1em] text-[#081F5C]">
                Floor Usage Trend
              </h3>
              <p className="mt-0.5 text-[7px] font-bold uppercase text-slate-400">
                {selectedLabel} · {FLOOR_PERIODS[period].label}
              </p>
            </div>

            <span className="border border-blue-200 bg-blue-50 px-2 py-1 text-[7px] font-black uppercase text-[#004AAD]">
              Floor {floorId}
            </span>
          </div>

          <div className="min-h-0 bg-[linear-gradient(180deg,rgba(247,250,251,0.96),rgba(231,239,243,0.90))] p-2">
            <FloorTrendChart
              values={chartData.values}
              labels={chartData.labels}
            />
          </div>
        </section>

        <div className="grid min-h-0 gap-3 lg:grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="grid min-h-[260px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[20px] border border-white/80 bg-white/88 shadow-[0_18px_38px_rgba(15,36,56,0.10),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl lg:min-h-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.1em] text-[#081F5C]">
                System Consumption
              </h3>
              <span className="text-[7px] font-black uppercase text-slate-400">
                {selectedLabel}
              </span>
            </div>

            <div className="min-h-0 overflow-y-auto p-3">
              <div className="space-y-3">
                {rows.map((row) => (
                  <div key={row.id}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-[8px]">
                      <span className="truncate font-bold text-[#081F5C]">
                        {row.title}
                      </span>
                      <span className="shrink-0 font-black text-[#004AAD]">
                        {row.consumedEnergy.toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        kWh
                      </span>
                    </div>

                    <div className="h-2 bg-slate-100">
                      <div
                        className="h-full bg-[#004AAD]"
                        style={{
                          width: `${Math.max(
                            4,
                            (row.consumedEnergy / maxUsage) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid min-h-[260px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[20px] border border-white/80 bg-white/88 shadow-[0_18px_38px_rgba(15,36,56,0.10),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl lg:min-h-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.1em] text-[#081F5C]">
                System Charges
              </h3>
              <span className="text-[7px] font-black uppercase text-[#004AAD]">
                {FLOOR_PERIODS[period].label}
              </span>
            </div>

            <div className="space-y-2 p-3 lg:hidden">
              {rows.map((system) => (
                <article
                  key={system.id}
                  className="w-full border border-slate-200 bg-[linear-gradient(180deg,rgba(247,250,251,0.96),rgba(231,239,243,0.90))] p-3 text-[10px] text-slate-600"
                >
                  <h4 className="break-words text-xs font-black uppercase text-[#081F5C]">
                    {system.title}
                  </h4>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-[7px] font-black uppercase text-slate-500">
                        Energy
                      </dt>
                      <dd className="mt-1 font-bold text-[#081F5C]">
                        {system.consumedEnergy.toLocaleString("en-IN")} kWh
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[7px] font-black uppercase text-slate-500">
                        Rate
                      </dt>
                      <dd className="mt-1 font-bold text-[#081F5C]">
                        ₹{FLOOR_RATE_PER_KWH.toFixed(2)}/kWh
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[7px] font-black uppercase text-slate-500">
                        Charge
                      </dt>
                      <dd className="mt-1 font-black text-[#004AAD]">
                        ₹{system.charge.toLocaleString("en-IN")}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <div className="hidden min-h-0 overflow-y-auto lg:block">
              <table className="w-full min-w-[460px] border-collapse">
                <thead className="sticky top-0 bg-[linear-gradient(180deg,rgba(247,250,251,0.96),rgba(231,239,243,0.90))]">
                  <tr>
                    {["System", "Energy", "Rate", "Charge"].map((heading) => (
                      <th
                        key={heading}
                        className="border-b border-slate-200 px-3 py-2 text-left text-[7px] font-black uppercase text-slate-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-3 py-1.5 text-[8px] font-bold text-[#081F5C]">
                        {row.title}
                      </td>
                      <td className="px-3 py-1.5 text-[8px] font-black text-[#004AAD]">
                        {row.consumedEnergy.toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-1.5 text-[8px] text-slate-500">
                        ₹{FLOOR_RATE_PER_KWH.toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5 text-[8px] font-black text-[#081F5C]">
                        ₹{row.charge.toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 bg-[#081F5C] text-white">
              <div className="px-3 py-2">
                <p className="text-[7px] font-black uppercase text-blue-200">
                  Total Energy
                </p>
                <p className="mt-0.5 text-[11px] font-black">
                  {summary.consumption.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  kWh
                </p>
              </div>

              <div className="px-3 py-2">
                <p className="text-[7px] font-black uppercase text-blue-200">
                  Total Charge
                </p>
                <p className="mt-0.5 text-[11px] font-black text-cyan-300">
                  ₹{summary.charges.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
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
    <div className="flex min-h-[82px] items-center justify-between rounded-[18px] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(239,245,248,0.90))] px-4 py-3 shadow-[0_16px_34px_rgba(15,36,56,0.09),inset_0_1px_0_rgba(255,255,255,0.95)]">
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
        className={`flex h-8 w-8 shrink-0 items-center justify-center border ${
          attention
            ? "border-amber-200 bg-amber-50 text-amber-600"
            : "border-blue-200 bg-blue-50 text-[#004AAD]"
        }`}
      >
        <Icon size={14} />
      </div>
    </div>
  );
}

function FloorTrendChart({ values, labels }) {
  const width = 1100;
  const height = 420;
  const left = 55;
  const right = 1060;
  const top = 28;
  const bottom = 350;
  const max = Math.max(...values, 1);

  const points = values.map((value, index) => ({
    x:
      left +
      (index / Math.max(values.length - 1, 1)) *
        (right - left),
    y: bottom - (value / max) * (bottom - top),
    value,
    index,
  }));

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
        stroke="#2B6F8C"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.map((point) => (
        <g key={point.index}>
          <circle cx={point.x} cy={point.y} r="4" fill="#D8B56A">
            <title>
              {`${labels[point.index]} — ${point.value.toLocaleString(
                "en-IN"
              )} kWh`}
            </title>
          </circle>

          <text
            x={point.x}
            y="392"
            textAnchor="middle"
            fontSize="9"
            fill="#64748B"
          >
            {labels[point.index]}
          </text>
        </g>
      ))}
    </svg>
  );
}

function ClientReading({ label, value }) {
  return (
    <div className="flex min-h-[24px] items-center justify-between gap-4">
      <span className="min-w-0 truncate text-[8px] font-bold uppercase tracking-[0.07em] text-slate-500">
        {label}
      </span>

      <span className="shrink-0 text-right text-[10px] font-black text-[#132131]">
        {value}
      </span>
    </div>
  );
}

function SummaryTile({ label, value, helper, icon: Icon, attention = false }) {
  return (
    <div className="group flex min-h-[92px] items-center justify-between rounded-[20px] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(239,245,248,0.90))] px-5 py-4 shadow-[0_18px_38px_rgba(15,36,56,0.10),inset_0_1px_0_rgba(255,255,255,0.96)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(15,36,56,0.14)]">
      <div className="min-w-0">
        <p className="text-[7px] font-black uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>

        <p
          className={`mt-1 truncate text-[18px] font-black ${
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
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] ${
          attention
            ? "border-amber-200 bg-amber-50 text-amber-600"
            : "border-blue-200 bg-blue-50 text-[#004AAD]"
        }`}
      >
        <Icon size={16} />
      </div>
    </div>
  );
}

function FloorSystemCard({ system, locked = false }) {
  const Icon = system.icon;
  const style = locked
    ? {
        dot: "bg-slate-400",
        text: "text-slate-200",
        border: "border-slate-300/30",
        background: "bg-slate-300/10",
        progress: "bg-slate-500",
      }
    : SYSTEM_STYLES[system.tone] ?? SYSTEM_STYLES.healthy;

  const loadLabel = system.metricLabels?.load ?? "Current Load";
  const consumptionLabel =
    system.metricLabels?.consumption ?? "Consumption";
  const loadUnit = system.metricLabels?.loadUnit ?? "kW";
  const consumptionUnit =
    system.metricLabels?.consumptionUnit ?? "kWh";

  return (
    <article className={`group relative flex h-full min-h-[285px] flex-col overflow-hidden rounded-[24px] border text-[#132131] transition-all duration-200 ${
      locked
        ? "border-slate-300/70 bg-slate-100/80 opacity-75"
        : "border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(242,246,248,0.91)_55%,rgba(226,235,240,0.88))] shadow-[0_22px_50px_rgba(15,36,56,0.13),0_4px_12px_rgba(15,36,56,0.07),inset_0_1px_0_rgba(255,255,255,0.96)] backdrop-blur-[24px] hover:-translate-y-[4px] hover:border-white hover:shadow-[0_30px_65px_rgba(15,36,56,0.18),0_10px_24px_rgba(15,36,56,0.09),inset_0_1px_0_rgba(255,255,255,1)]"
    }`}>
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[#9FBBC9]/18 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#2B6F8C,#D8B56A)]" />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 px-5 pb-3.5 pt-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[15px] border border-white/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(226,235,240,0.78))] text-[#2B6F8C] shadow-[0_10px_24px_rgba(28,52,70,0.10),inset_0_1px_0_rgba(255,255,255,0.98)]">
              <Icon size={28} strokeWidth={2.1} />
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-[14px] font-black uppercase tracking-[0.06em] text-[#132131]">
                {system.title}
              </h3>

              <p className="mt-1.5 text-[8px] font-bold uppercase tracking-[0.13em] text-slate-400">
                {locked ? "Hierarchy Only" : "Floor Operational Data"}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 text-[7px] font-black uppercase tracking-[0.08em] ${style.border} ${style.background} ${style.text}`}
          >
            {locked ? (
              <>
                <Lock size={11} />
                No Access
              </>
            ) : (
              <>
                <span className={`h-1.5 w-1.5 ${style.dot}`} />
                {system.status}
              </>
            )}
          </span>
        </header>

        <div className="mx-5 grid grid-cols-2 gap-x-5 py-2">
          {locked ? (
            <LockedMetric label={loadLabel} />
          ) : (
            <PrimaryMetric
              label={loadLabel}
              value={system.currentLoad}
              unit={loadUnit}
              highlight
            />
          )}

          {locked ? (
            <LockedMetric label={consumptionLabel} />
          ) : (
            <PrimaryMetric
              label={consumptionLabel}
              value={system.consumption}
              unit={consumptionUnit}
            />
          )}
        </div>

        <div className="mx-5 my-2 h-px bg-[#DCE6EB]" />

        <div className="flex flex-1 flex-col justify-center px-5 py-2">
          {locked ? (
            <div className="border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-100">
              Operational readings hidden
            </div>
          ) : (
            system.metrics.map(([label, value]) => (
              <CompactReading key={label} label={label} value={value} />
            ))
          )}
        </div>

        <footer className="px-5 pb-4 pt-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[8px] font-black uppercase tracking-[0.11em] text-slate-500">
              Operational Efficiency
            </span>

            <span className="text-[10px] font-black text-[#2B6F8C]">
              {locked ? "No Access" : `${system.efficiency}%`}
            </span>
          </div>

          <div className="h-1.5 overflow-hidden bg-[#DCE6EB]">
            <div
              className={`h-full ${style.progress}`}
              style={{ width: locked ? "0%" : `${system.efficiency}%` }}
            />
          </div>
        </footer>
      </div>
    </article>
  );
}

function LockedMetric({ label }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[8px] font-black uppercase tracking-[0.1em] text-slate-500">
          {label}
        </span>
      </div>

      <p className="mt-1.5 truncate text-[16px] font-black uppercase leading-none text-amber-100">
        No Access
      </p>
    </div>
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

function CompactReading({ label, value }) {
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

function getSampleFloorRealtimeData(floorNumber) {
  const safeFloorNumber = Number.isFinite(floorNumber) ? floorNumber : 1;
  const baseLoad = 150 + safeFloorNumber * 6;
  const hasAlert = safeFloorNumber % 5 === 0;

  return {
    ahu: {
      running: 2 + (safeFloorNumber % 3),
      stopped: hasAlert ? 1 : 0,
      temperature: `${22 + (safeFloorNumber % 4)}°C`,
      humidity: `${45 + (safeFloorNumber % 8)}%`,
    },
    lighting: {
      activeZones: 14 + (safeFloorNumber % 5),
      inactiveZones: safeFloorNumber % 3,
      load: `${18 + safeFloorNumber} kW`,
      status: "ON",
    },
    energy: {
      kwh: `${2200 + safeFloorNumber * 95} kWh`,
      demand: `${baseLoad} kW`,
      pf: hasAlert ? "0.96" : "0.98",
      voltage: `${430 + (safeFloorNumber % 5)}V`,
      current: `${190 + safeFloorNumber * 4}A`,
    },
    air: {
      co2: `${540 + safeFloorNumber * 8} ppm`,
      pm25: `${10 + (safeFloorNumber % 10)} μg/m³`,
      status: hasAlert ? "Moderate" : "Healthy",
    },
    tenants: {
      occupied: 4,
      available: 0,
      status: hasAlert ? "Attention" : "Healthy",
    },
    alerts: {
      count: hasAlert ? 1 : 0,
      communication: "Online",
      health: hasAlert ? "Warning" : "Normal",
      lastUpdate: "2 sec ago",
    },
    zones: [
      {
        ahu: "Running",
        lighting: "ON",
        load: `${Math.round(baseLoad * 0.24)} kW`,
        health: "Healthy",
      },
      {
        ahu: "Running",
        lighting: "ON",
        load: `${Math.round(baseLoad * 0.26)} kW`,
        health: "Healthy",
      },
      {
        ahu: hasAlert ? "Check" : "Running",
        lighting: "ON",
        load: `${Math.round(baseLoad * 0.25)} kW`,
        health: hasAlert ? "Warning" : "Healthy",
      },
      {
        ahu: "Running",
        lighting: "ON",
        load: `${Math.round(baseLoad * 0.25)} kW`,
        health: "Healthy",
      },
    ],
  };
}
