export interface GaugeResponse {
	mode?: 'serial' | 'hid';
	port?: string;
	connected: boolean;
	value: number | null;
	error: string | null;
};