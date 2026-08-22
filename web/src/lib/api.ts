import { API_BASE_URL, IS_SAMPLE_MODE } from '../config';
import * as sampleEngine from './queryEngine';
import type {
  QueryParams,
  RoasByCampaignRow,
  RoasByChannelRow,
  RollingRoasRow,
  RouteEnvelope,
  UnderperformerRow,
  WowEfficiencyRow,
} from '../types';

async function fetchRoute<T>(route: string, params: QueryParams): Promise<RouteEnvelope<T>> {
  const qs = new URLSearchParams({ start_date: params.startDate, end_date: params.endDate });
  if (params.channel) qs.set('channel', params.channel);
  const res = await fetch(`${API_BASE_URL}${route}?${qs.toString()}`);
  if (!res.ok) throw new Error(`${route} responded ${res.status}`);
  return res.json();
}

export function getRoasByChannel(params: QueryParams): Promise<RouteEnvelope<RoasByChannelRow>> {
  if (IS_SAMPLE_MODE) return Promise.resolve(sampleEngine.roasByChannel(params.startDate, params.endDate, params.channel));
  return fetchRoute<RoasByChannelRow>('/roas-by-channel', params);
}

export function getRoasByCampaign(params: QueryParams): Promise<RouteEnvelope<RoasByCampaignRow>> {
  if (IS_SAMPLE_MODE) return Promise.resolve(sampleEngine.roasByCampaign(params.startDate, params.endDate, params.channel));
  return fetchRoute<RoasByCampaignRow>('/roas-by-campaign', params);
}

export function getUnderperformers(params: QueryParams): Promise<RouteEnvelope<UnderperformerRow>> {
  if (IS_SAMPLE_MODE) return Promise.resolve(sampleEngine.underperformersLoose(params.startDate, params.endDate, params.channel));
  return fetchRoute<UnderperformerRow>('/underperformers', params);
}

export function getRollingRoas(params: QueryParams): Promise<RouteEnvelope<RollingRoasRow>> {
  if (IS_SAMPLE_MODE) return Promise.resolve(sampleEngine.rollingRoas(params.startDate, params.endDate, params.channel));
  return fetchRoute<RollingRoasRow>('/rolling-roas', params);
}

export function getWowEfficiency(params: QueryParams): Promise<RouteEnvelope<WowEfficiencyRow>> {
  if (IS_SAMPLE_MODE) return Promise.resolve(sampleEngine.wowEfficiency(params.startDate, params.endDate, params.channel));
  return fetchRoute<WowEfficiencyRow>('/wow-efficiency', params);
}
