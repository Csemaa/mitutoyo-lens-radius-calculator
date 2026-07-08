import type { GaugeResponse } from '../entities/GaugeResponse';
import { useEffect, useState } from 'react';

const MEASUREMENT_ENDPOINT = 'http://127.0.0.1:8000/measurement';

const useGauge = () => {
	const [measuredSagittaDeviationInput, setMeasuredSagittaDeviationInput] = useState<number | null>(null);
	const [deviceStatus, setDeviceStatus] = useState<string>('Device reader not connected');

	useEffect(() => {
		let cancelled = false;

		const pollMeasurement = async () => {
			try {
				const response = await fetch(MEASUREMENT_ENDPOINT);
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}

				const payload = (await response.json()) as GaugeResponse;
				if (cancelled) {
					return;
				}

				if (payload.connected && typeof payload.value === 'number' && Number.isFinite(payload.value)) {
					setMeasuredSagittaDeviationInput(Number(payload.value));
					setDeviceStatus('Mitutoyo connected on COM3');
				} else if (payload.error) {
					setDeviceStatus(`Reader error: ${payload.error}`);
				} else {
					setDeviceStatus('Waiting for device values...');
				}
			} catch {
				if (!cancelled) {
					setDeviceStatus('Cannot reach reader service. Start npm run serial');
				}
			}
		};

		void pollMeasurement();
		const interval = window.setInterval(() => {
			void pollMeasurement();
		}, 300);

		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, []);

	return {
		measuredSagittaDeviationInput,
		deviceStatus,
	};
};

export default useGauge;