export const buildings = [
  { id: "wing-a", name: "Sky 1", floors: 20 },
  { id: "wing-b", name: "Sky 2", floors: 20 },
];

export const buildingClients = {
  "wing-a": {
    buildingName: "Sky 1",
    floors: {
      "20": [],
      "19": ["Prestige Estates Projects", "MidWest Limited"],
      "18": ["TRST Global LLP"],
      "17": ["Qualminds Technologies", "Value Creed Consulting LLP", "Deepija Telecom"],
      "16": ["Win Information Technology", "AWFIS SPACE SOLUTIONS", "BDNT Labs"],
      "15": ["HTC Global Services", "BELL TECHNOLOGIX INDIA", "HTC Global Services - Phase 2"],
      "14": ["HTC Global Services", "Ativira Tech Solutions - Minfy Technologies"],
      "13": ["MetLife Services East Private Limited", "OSP India"],
      "12": ["MetLife Services East Private Limited"],
      "11": ["MetLife Services East Private Limited"],
      "10": ["Hexaware"],
      "9": ["Head Digital Works"],
      "8": ["Head Digital Works"],
      "7": ["Blackbaud", "Turvo"],
      "6": ["JLL"],
      "5": ["JLL"],
      "4": ["SKOOTR GLOBAL"],
      "3": ["Pravel Estates", "Pravel Infotech", "Jade Global Software", "Primesoft"],
      "2": ["IRay"],
      "1": [
        "Bhagiradha Chemicals & Industries",
        "Tredence",
        "Matvey Hospitality (Baardos)",
        "MAUVE MEALS (Foodx)",
        "BODYSCIENCE PILATES",
      ],
      common: ["HOTEL KAMAL PRIVATE LTD"],
    },
  },
  "wing-b": {
    buildingName: "Sky 2",
    floors: {
      "20": [],
      "19": ["SKOOTR GLOBAL"],
      "18": ["IVY Software Development Services"],
      "17": ["IVY Global Shared Services Private Limited"],
      "16": ["IVY Mobitech", "IVY Comptech"],
      "15": ["IVY Software Development Services Private Limited"],
      "14": ["Apollo", "ANSR"],
      "13": ["Freshworks"],
      "12": ["DANISCO INDIA PRIVATE LIMITED"],
      "11": ["DANISCO INDIA PRIVATE LIMITED"],
      "10": [],
      "9": ["LPL"],
      "8": ["LPL"],
      "7": ["LPL"],
      "6": ["LPL"],
      "5": ["LPL half part"],
      "4": ["WNS GLOBAL SERVICES"],
      "3": ["WNS GLOBAL SERVICES"],
      "2": ["2Gether"],
      "1": [
        "Awfis - Honeywell",
        "Allegro",
        "Matvey Hospitality (Baardos)",
        "IGNITE CANDLE BAR",
        "Calm Side Café",
        "Chai Bliss",
      ],
      common: [
        "Super Sports - Nextgen Sports",
        "K C Norhi (TIFFIN TRIBE)",
        "Vedhav Ventures - Madras Coffee",
        "Harleys",
      ],
    },
  },
};

export const getFloorClients = (buildingId, floor) => {
  const floorKey = String(floor);
  return buildingClients[String(buildingId)]?.floors?.[floorKey] ?? [];
};

export const getFloorClientCount = (buildingId, floor) =>
  getFloorClients(buildingId, floor).length;

export const getBuildingClientCount = (buildingId) => {
  const floors = buildingClients[String(buildingId)]?.floors ?? {};
  return Object.values(floors).reduce(
    (total, floorClients) =>
      total + (Array.isArray(floorClients) ? floorClients.length : 0),
    0
  );
};

export const clients = Array.from(
  new Set(
    Object.values(buildingClients).flatMap((building) =>
      Object.values(building.floors).flat()
    )
  )
);

export const systemSummary = {
  ahu: { title: "AHU / Chillers", running: 8, stopped: 1, temperature: "22°C", humidity: "48%" },
  ldb: { title: "LDB / Lighting", on: 120, off: 18, load: "68%" },
  ems: { title: "EMS / Energy", kwh: "12,430", kvah: "820", pf: "0.96", voltage: "415V", amps: "1240A" },
};

export const powerAssets = [
  { id: "ht", title: "HT Panel", subtitle: "33kV Incoming", status: "ON" },
  { id: "tf1", title: "Transformer 1", subtitle: "33kV / 433V", status: "Normal" },
  { id: "tf2", title: "Transformer 2", subtitle: "33kV / 433V", status: "Normal" },
  { id: "lt", title: "LT Kiosk", subtitle: "Outgoing Feeders", status: "ON" },
];
