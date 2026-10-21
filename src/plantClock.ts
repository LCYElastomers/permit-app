import { useEffect, useState } from "react";

const originMs = Date.now();

export interface PlantClock {
  date: string;
  hm: string;
  hms: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function plantClock(): PlantClock {
  const elapsed = Math.floor((Date.now() - originMs) / 1000);
  const total = 13 * 3600 + 28 * 60 + elapsed;
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return {
    date: "WED 21 OCT 2026",
    hm: `${pad(h)}:${pad(m)}`,
    hms: `${pad(h)}:${pad(m)}:${pad(s)}`,
  };
}

export function usePlantClock(): PlantClock {
  const [clock, setClock] = useState(() => plantClock());

  useEffect(() => {
    const id = window.setInterval(() => setClock(plantClock()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return clock;
}
