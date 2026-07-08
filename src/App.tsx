import { useEffect, useMemo, useState } from 'react';
import './App.css';

const MEASUREMENT_ENDPOINT = 'http://127.0.0.1:8000/measurement';

type MeasurementResponse = {
	connected: boolean;
	value: number | null;
	error: string | null;
};

function App() {
	const calculateRadius = (sagitta: number, diameter: number) => {
		return sagitta / 2 + Math.pow(diameter, 2) / (8 * sagitta);
	};

	const calculateSagitta = (radius: number, diameter: number) => {
		const halfChord = diameter / 2;
		return radius - Math.sqrt(Math.pow(radius, 2) - Math.pow(halfChord, 2));
	};

	const [diameterValue, setDiameterValue] = useState<number>(0);
	const [etalonRadiusValue, setEtalonRadiusValue] = useState<number>(0);
	const [lensRadiusValue, setLensRadiusValue] = useState<number>(0);
	const [measuredSagittaDeviationValue, setMeasuredSagittaDeviationValue] = useState<number>(0);
	const [measuredSagittaDeviationInput, setMeasuredSagittaDeviationInput] = useState<string>('');
	const [deviceStatus, setDeviceStatus] = useState<string>('Device reader not connected');

	useEffect(() => {
		let cancelled = false;

		const pollMeasurement = async () => {
			try {
				const response = await fetch(MEASUREMENT_ENDPOINT);
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}

				const payload = (await response.json()) as MeasurementResponse;
				if (cancelled) {
					return;
				}

				if (payload.connected && typeof payload.value === 'number' && Number.isFinite(payload.value)) {
					setMeasuredSagittaDeviationValue(payload.value);
					setMeasuredSagittaDeviationInput(String(payload.value));
					setDeviceStatus('Mitutoyo connected on COM3');
				} else if (payload.error) {
					setDeviceStatus(`Reader error: ${payload.error}`);
				} else {
					setDeviceStatus('Waiting for device values...');
				}
			} catch {
				if (!cancelled) {
					setDeviceStatus('Cannot reach reader service. Start app.py --serve');
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

	const calculatedRadius = useMemo(() => {
		if (Number.isFinite(measuredSagittaDeviationValue) && diameterValue > 0 && etalonRadiusValue > 0) {
			const etalonSagitta = calculateSagitta(etalonRadiusValue, diameterValue);
			return calculateRadius(etalonSagitta - measuredSagittaDeviationValue, diameterValue);
		}
	}, [measuredSagittaDeviationValue, diameterValue, etalonRadiusValue]);

	const sagittaDeviationInMicron = useMemo(() => {
		const etalonSagitta = calculateSagitta(etalonRadiusValue, diameterValue);
		const lensSagitta = calculateSagitta(lensRadiusValue, diameterValue);
		return Math.abs(etalonSagitta - lensSagitta) * 1000;
	}, [etalonRadiusValue, lensRadiusValue, diameterValue]);

	return (
		<>
			<div className='app'>
				<div className='base-inputs'>
					<label>Mért rádiusz eltérés</label>
					<input
						type='text'
						placeholder='mm'
						value={measuredSagittaDeviationInput}
						onChange={(event) => {
							const rawValue = event.target.value;
							setMeasuredSagittaDeviationInput(rawValue);
							const parsed = Number(rawValue.replace(',', '.'));
							if (Number.isFinite(parsed)) {
								setMeasuredSagittaDeviationValue(parsed);
							}
						}}
					/>
					<p>{deviceStatus}</p>
					<label>Harang</label>
					<input type='text' placeholder='mm' onChange={(event) => setDiameterValue(Number(event.target.value.replace(',', '.')))} />
				</div>
				<div>
					<p>Etalon rádiusz</p>
					<input type='text' onChange={(event) => setEtalonRadiusValue(Number(event.target.value.replace(',', '.')))} />
					<p>Etalon sagitta: {calculateSagitta(etalonRadiusValue, diameterValue)}</p>
					<p>Lencse rádiusz</p>
					<input type='text' onChange={(event) => setLensRadiusValue(Number(event.target.value.replace(',', '.')))} />
					<p>Lencse sagitta: {calculateSagitta(lensRadiusValue, diameterValue)}</p>
				</div>
				<p>Maximum sagitta deviation from etalon: {sagittaDeviationInMicron} µm</p>
				<p>Jelenlegi rádiusz: {calculatedRadius} mm</p>
			</div>
		</>
	);
}

export default App;
