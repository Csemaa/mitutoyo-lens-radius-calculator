import { useMemo, useState } from 'react';
import useGauge from '../hooks/useGauge';
import { calculateRadius, calculateSagitta } from '../utils/calculators.ts';
import { Box, Container, Field, Heading, Input, InputGroup } from '@chakra-ui/react';
import { LuBell, LuDiameter } from 'react-icons/lu';
import GaugeChart from './GaugeChart.tsx';
import GaugeStatus from './GaugeStatus.tsx';

const GaugeContainer = () => {
	const [diameterValue, setDiameterValue] = useState<number>(0);
	const [etalonRadiusValue, setEtalonRadiusValue] = useState<number>(0);
	const [lensRadius, setLensRadius] = useState<number>(0);
	const { measuredSagittaDeviationInput, deviceStatus } = useGauge();

	const calculatedRadius = useMemo(() => {
		if (measuredSagittaDeviationInput !== null && diameterValue > 0 && etalonRadiusValue > 0) {
			const etalonSagitta = calculateSagitta(etalonRadiusValue, diameterValue);
			return calculateRadius(etalonSagitta - Number(measuredSagittaDeviationInput), diameterValue);
		}
	}, [measuredSagittaDeviationInput, diameterValue, etalonRadiusValue]);

	const sagittaDeviationInMicron = useMemo(() => {
		const etalonSagitta = calculateSagitta(etalonRadiusValue, diameterValue);
		const lensSagitta = calculateSagitta(lensRadius, diameterValue);
		return Math.abs(etalonSagitta - lensSagitta) * 1000;
	}, [etalonRadiusValue, lensRadius, diameterValue]);

	console.log('measuredSagittaDeviationInput:', (measuredSagittaDeviationInput ?? 0) * 1000);
	console.log('sagittaDeviationInMicron', sagittaDeviationInMicron)

	return (
		<>
			<Container
                p={12}
                bgColor={'bg.subtle'}
                borderRadius={'lg'}
                boxShadow={'md'}
                maxW={'1000px'}
                display={'flex'}
				justifyContent={'space-between'}
				flexDirection={{ base: 'column', lg: 'row' }}
				gap={{ base: 8, lg: 10 }}
				w={'100%'}
				overflow={'hidden'}
                >
				<Box display={'flex'} flexDirection={'column'} gap={6} flex={'1 1 420px'} minW={0}>
					<GaugeStatus status={deviceStatus} />
					<Field.Root>
						<Field.Label fontSize='md'>Bell</Field.Label>
						<InputGroup startAddon={<LuBell  />} endAddon='mm' bgColor={'whiteAlpha.900'}>
							<Input size={'lg'} type='number' step={0.01} onChange={(event) => setDiameterValue(Number(event.target.value.replace(',', '.')))} />
						</InputGroup>
					</Field.Root>
                    <Field.Root>
						<Field.Label fontSize='md'>Etalon radius {calculateSagitta(etalonRadiusValue, diameterValue).toFixed(4)}</Field.Label>
						<InputGroup startAddon={<LuDiameter />} endAddon='mm' bgColor={'whiteAlpha.900'}>
							<Input size={'lg'} type='number' step={0.0001} onChange={(event) => setEtalonRadiusValue(Number(event.target.value.replace(',', '.')))} />
						</InputGroup>
					</Field.Root>
                    <Field.Root>
						<Field.Label fontSize='md'>Lens radius {calculateSagitta(lensRadius, diameterValue).toFixed(4)}</Field.Label>
						<InputGroup startAddon={<LuDiameter />} endAddon='mm' bgColor={'whiteAlpha.900'}>
							<Input size={'lg'} type='number' step={0.0001} onChange={(event) => setLensRadius(Number(event.target.value.replace(',', '.')))} />
						</InputGroup>
					</Field.Root>
				</Box>
				<Box px={{ base: 0, md: 2 }} flex={'1 1 420px'} minW={0}>
                    <GaugeChart currentValue={measuredSagittaDeviationInput ?? 0} maxSagittaDeviation={sagittaDeviationInMicron} />
                    <Heading color={(measuredSagittaDeviationInput ?? 0) * 1000 <= sagittaDeviationInMicron ? 'green.500' : 'red.500'}>Max value: {sagittaDeviationInMicron?.toFixed(4) ?? ''} µm</Heading>
                    <Heading color={(calculatedRadius ?? 0) >= lensRadius ? 'green.500' : 'red.500'}>Current radius: {calculatedRadius?.toFixed(4) ?? ''} </Heading>
                </Box>
			</Container>
		</>
	);
};

export default GaugeContainer;
