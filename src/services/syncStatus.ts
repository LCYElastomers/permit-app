import { plantLinkLabel, type PlantLink } from "../lib/connectivity";
import type { SyncRequest } from "./syncCoordinator";
import type { LocalSyncState } from "./localStore";

export interface SyncProgress {
  index: number;
  total: number;
}

export interface SyncPresentation {
  plant: string;
  primary: string;
  secondary: string;
  detail: string;
  notice: string | null;
}

export const OFFLINE_SYNC_NOTICE = "Plant Link is offline.";

export const STORED_ON_DEVICE_NOTICE = "Your changes are safely stored on this device.";

export const DELAYED_SYNC_NOTICE =
  "Your work is saved locally. Permit Control will retry when the plant connection becomes available.";

export function syncNowNotice(result: SyncRequest): string | null {
  if (result.started || result.reason === "busy") return null;
  if (result.reason === "plant-link") return OFFLINE_SYNC_NOTICE;
  return "Local permit data is unavailable.";
}

export function describeSync(input: {
  link: PlantLink;
  storage: "checking" | "available" | "failed";
  pending: number;
  syncState: LocalSyncState | null;
  progress: SyncProgress | null;
}): SyncPresentation {
  const plant = plantLinkLabel(input.link);
  const pendingLabel = `${input.pending} ${input.pending === 1 ? "CHANGE" : "CHANGES"} PENDING`;
  if (input.storage === "failed") {
    return { plant, primary: "LOCAL DATA", secondary: "UNAVAILABLE", detail: "", notice: null };
  }
  if (input.storage !== "available") {
    return { plant, primary: "LOCAL DATA", secondary: "CHECKING", detail: "", notice: null };
  }
  if (input.link === "checking") {
    return {
      plant,
      primary: input.pending > 0 ? pendingLabel : "LOCAL DATA",
      secondary: input.pending > 0 ? "" : "AVAILABLE",
      detail: "",
      notice: null,
    };
  }
  if (input.syncState === "SYNCING") {
    const fraction = input.progress ? `${input.progress.index} OF ${input.progress.total}` : pendingLabel;
    return { plant, primary: "SYNCING", secondary: fraction, detail: "", notice: null };
  }
  if (input.syncState === "BACKOFF") {
    return { plant, primary: "SYNC DELAYED", secondary: pendingLabel, detail: "", notice: DELAYED_SYNC_NOTICE };
  }
  if (input.syncState === "REQUIRES_ATTENTION") {
    return {
      plant,
      primary: "NEEDS ATTENTION",
      secondary: pendingLabel,
      detail: "",
      notice: "A saved change needs attention before it can synchronize.",
    };
  }
  if (input.link === "ready" && input.pending === 0) {
    return { plant, primary: "SYNCHRONIZED", secondary: "0 CHANGES PENDING", detail: "", notice: null };
  }
  return {
    plant,
    primary: "LOCAL DATA",
    secondary: "AVAILABLE",
    detail: pendingLabel,
    notice: input.link === "unreachable" && input.pending > 0 ? STORED_ON_DEVICE_NOTICE : null,
  };
}

export function describePermitSave(
  form: { id: string; permitNumber: string | null; lifecycleStatus?: string | null; outboxStatus?: string },
  link: PlantLink,
): string {
  if (!form.id) return "";
  if (!form.permitNumber) {
    const submitted = form.lifecycleStatus === "PENDING_REVIEW";
    const place = submitted ? "PENDING REVIEW · SAVED LOCALLY" : "LOCAL DRAFT · SAVED LOCALLY";
    if (form.outboxStatus === "ATTENTION") return `${place} · NEEDS ATTENTION`;
    if (link === "unreachable") return `${place} · PLANT LINK OFFLINE`;
    return `${place} · PENDING SYNC`;
  }
  if (form.lifecycleStatus === "PENDING_REVIEW") return "SYNCHRONIZED · SUBMITTED FOR REVIEW";
  return "SYNCHRONIZED";
}
