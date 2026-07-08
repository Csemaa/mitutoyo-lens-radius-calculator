import { useMemo, useState } from 'react';
import '../App.css';
import useGauge from '../hooks/useGauge';
import { calculateRadius, calculateSagitta } from '../utils/calculators.ts';

const GaugeContainer = () => {
	const [diameterValue, setDiameterValue] = useState<number>(0);
	const [etalonRadiusValue, setEtalonRadiusValue] = useState<number>(0);
	const [lensRadiusValue, setLensRadiusValue] = useState<number>(0);
	const { measuredSagittaDeviationInput, deviceStatus } = useGauge();

	const calculatedRadius = useMemo(() => {
		if (measuredSagittaDeviationInput !== null && diameterValue > 0 && etalonRadiusValue > 0) {
			const etalonSagitta = calculateSagitta(etalonRadiusValue, diameterValue);
			return calculateRadius(etalonSagitta - Number(measuredSagittaDeviationInput), diameterValue);
		}
	}, [measuredSagittaDeviationInput, diameterValue, etalonRadiusValue]);

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
					<input type='text' placeholder='mm' value={measuredSagittaDeviationInput ?? ''} />
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
};

export default GaugeContainer;
