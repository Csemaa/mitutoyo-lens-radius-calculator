export interface GaugeResponse {
	connected: boolean;
	value: number | null;
	error: string | null;
};