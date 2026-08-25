import { getActiveCampaignId } from '../../utils/campaignScope.js';

export const BULK_AGENT_RELEASE_EVENT = 'tw:bulk-agent-release-reservations';

const releaseQueueKey = (campaignId) => (
  `tw_bulk_agent_release_queue:${campaignId || 'none'}`
);

const normalizeReservation = (reservation) => {
  const planId = String(reservation?.planId || '');
  const mediaId = String(reservation?.mediaId || reservation?.sourceMediaId || '');
  return planId && mediaId ? { planId, mediaId } : null;
};

const reservationKey = ({ planId, mediaId }) => `${planId}:${mediaId}`;

export const collectAgentReservations = (rows, slots = ['video1', 'video2', 'audio']) => {
  const seen = new Set();
  const reservations = [];
  (Array.isArray(rows) ? rows : [rows]).forEach((row) => {
    slots.forEach((slot) => {
      const reservation = normalizeReservation(row?.agentReservations?.[slot]);
      if (!reservation) return;
      const key = reservationKey(reservation);
      if (seen.has(key)) return;
      seen.add(key);
      reservations.push(reservation);
    });
  });
  return reservations;
};

export const filterUnreferencedAgentReservations = (reservations, remainingRows) => {
  const referenced = new Set(
    collectAgentReservations(remainingRows).map(reservationKey),
  );
  const seen = new Set();
  return (reservations || []).flatMap((candidate) => {
    const reservation = normalizeReservation(candidate);
    if (!reservation) return [];
    const key = reservationKey(reservation);
    if (referenced.has(key) || seen.has(key)) return [];
    seen.add(key);
    return [reservation];
  });
};

export const groupAgentReservations = (reservations) => {
  const grouped = new Map();
  (reservations || []).forEach((candidate) => {
    const reservation = normalizeReservation(candidate);
    if (!reservation) return;
    const mediaIds = grouped.get(reservation.planId) || new Set();
    mediaIds.add(reservation.mediaId);
    grouped.set(reservation.planId, mediaIds);
  });
  return Array.from(grouped, ([planId, mediaIds]) => ({
    planId,
    sourceMediaIds: Array.from(mediaIds),
  }));
};

export const readQueuedAgentReservationReleases = (
  campaignId = getActiveCampaignId(),
) => {
  try {
    const stored = JSON.parse(localStorage.getItem(releaseQueueKey(campaignId)) || '[]');
    return Array.isArray(stored) ? stored.flatMap((entry) => (
      (entry?.sourceMediaIds || []).map((mediaId) => ({
        planId: String(entry?.planId || ''),
        mediaId: String(mediaId || ''),
      }))
    )).filter((entry) => entry.planId && entry.mediaId) : [];
  } catch {
    return [];
  }
};

const writeQueuedAgentReservationReleases = (campaignId, reservations) => {
  const grouped = groupAgentReservations(reservations);
  try {
    if (grouped.length > 0) {
      localStorage.setItem(releaseQueueKey(campaignId), JSON.stringify(grouped));
    } else {
      localStorage.removeItem(releaseQueueKey(campaignId));
    }
  } catch {
    // The event below still gives the active composer an immediate release attempt.
  }
  return grouped;
};

export const queueAgentReservationReleases = (
  reservations,
  campaignId = getActiveCampaignId(),
) => {
  const queued = readQueuedAgentReservationReleases(campaignId);
  const grouped = writeQueuedAgentReservationReleases(
    campaignId,
    [...queued, ...(reservations || [])],
  );
  if (grouped.length > 0) {
    window.dispatchEvent(new CustomEvent(BULK_AGENT_RELEASE_EVENT, {
      detail: { campaignId, releases: grouped },
    }));
  }
};

export const markAgentReservationReleaseComplete = (
  planId,
  sourceMediaIds,
  campaignId = getActiveCampaignId(),
) => {
  const released = new Set((sourceMediaIds || []).map(String));
  const remaining = readQueuedAgentReservationReleases(campaignId).filter((entry) => (
    entry.planId !== String(planId) || !released.has(entry.mediaId)
  ));
  writeQueuedAgentReservationReleases(campaignId, remaining);
};

export const clearAgentReservationMetadata = (row, slots = ['video1', 'video2', 'audio']) => {
  if (!row?.agentReservations) return row;
  const nextReservations = { ...row.agentReservations };
  slots.forEach((slot) => delete nextReservations[slot]);
  return {
    ...row,
    agentReservations: Object.keys(nextReservations).length > 0 ? nextReservations : undefined,
  };
};
