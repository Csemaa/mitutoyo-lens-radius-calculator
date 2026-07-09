import { useMemo, useState } from 'react';
import useGauge from '../hooks/useGauge';
import { calculateRadius, calculateSagitta } from '../utils/calculators.ts';
import { Box, Container, Field, Heading, HStack, Input, InputGroup, RadioGroup, Text } from '@chakra-ui/react';
import { LuBell, LuDiameter } from 'react-icons/lu';
import GaugeChart from './GaugeChart.tsx';
import GaugeStatus from './GaugeStatus.tsx';
import { useTranslation } from 'react-i18next';

type LensType =  'minus' | 'plus'

const GaugeContainer = () => {
	const { t } = useTranslation();
	const [diameterValue, setDiameterValue] = useState<number>(0);
	const [etalonRadiusValue, setEtalonRadiusValue] = useState<number>(0);
	const [lensRadius, setLensRadius] = useState<number>(0);
	const { measuredSagittaDeviationInput, deviceStatus } = useGauge();
	const [lensType, setLensType] = useState<LensType>('plus');

	const calculatedRadius = useMemo(() => {
		if (measuredSagittaDeviationInput !== null && diameterValue > 0 && etalonRadiusValue > 0) {
			const etalonSagitta = calculateSagitta(etalonRadiusValue, diameterValue);
			return calculateRadius(etalonSagitta - Number(measuredSagittaDeviationInput), diameterValue, lensType);
		}
	}, [measuredSagittaDeviationInput, diameterValue, etalonRadiusValue, lensType]);

	const sagittaDeviationInMicron = useMemo(() => {
		const etalonSagitta = calculateSagitta(etalonRadiusValue, diameterValue);
		const lensSagitta = calculateSagitta(lensRadius, diameterValue);
		console.log('etalonSagitta:', etalonSagitta, 'lensSagitta:', lensSagitta);
		return Math.abs(etalonSagitta - lensSagitta) * 1000;
	}, [etalonRadiusValue, lensRadius, diameterValue]);

	const measuredDeviationInMicron = useMemo(() => (measuredSagittaDeviationInput ?? 0) * 1000, [measuredSagittaDeviationInput]);
	const isWithinTolerance = measuredDeviationInMicron <= sagittaDeviationInMicron;

	const formatMicron = (value: number) => (Number.isFinite(value) ? `${value.toFixed(2)} µm` : '--');
	const formatRadius = (value?: number) => (value !== undefined && Number.isFinite(value) ? `${value.toFixed(4)} mm` : '--');

	return (
		<>
			<Container
                p={12}
                bgColor={'bg.muted'}
                borderRadius={'lg'}
                boxShadow={'md'}
                maxW={'1100px'}
                display={'flex'}
				justifyContent={'space-between'}
				flexDirection={{ base: 'column', lg: 'row' }}
				gap={{ base: 8, lg: 10 }}
				w={'100%'}
				overflow={'hidden'}
                >
				<Box
					display={'flex'}
					flexDirection={'column'}
					gap={2}
					flex={'1 1 300px'}
					minW={0}
					p={8}
					bgColor={'whiteAlpha.900'}
					borderRadius={'lg'}
					borderWidth={'1px'}
					borderColor={'border.subtle'}
					>
					<Heading mb={4} size={'3xl'} color={'teal.600'}>{t('Radius Calculator')}</Heading>
					<Box display={'flex'} flexDirection={'column'} gap={6} >
						 <Field.Root>
							<Field.Label fontSize='md' color={'teal.fg'}>{t('Bell')}</Field.Label>
							<InputGroup startAddon={<LuBell  />} endAddon='mm' bgColor={'bg.subtle'}>
								<Input size={'lg'} type='number' step={0.01} onChange={(event) => setDiameterValue(Number(event.target.value.replace(',', '.')))} />
							</InputGroup>
						</Field.Root>
						<RadioGroup.Root defaultValue="plus"  colorPalette="teal" variant="solid">
							 <Field.Root>
							<HStack gap="6">
								<Field.Label fontSize='md' color={'teal.fg'}>{t('Lens type')}: </Field.Label>
								<RadioGroup.Item value={'plus'} onClick={() => setLensType('plus')}>
									<RadioGroup.ItemHiddenInput />
									<RadioGroup.ItemIndicator />
									<RadioGroup.ItemText>{'+'}</RadioGroup.ItemText>
								</RadioGroup.Item>
								<RadioGroup.Item value={'minus'} onClick={() => setLensType('minus')}>
									<RadioGroup.ItemHiddenInput />
									<RadioGroup.ItemIndicator />
									<RadioGroup.ItemText>{'-'}</RadioGroup.ItemText>
								</RadioGroup.Item>
							</HStack>
							</Field.Root>
							</RadioGroup.Root>
						<Field.Root>
							<Field.Label fontSize='md' color={'teal.fg'}>{t('Etalon radius')}</Field.Label>
							<InputGroup startAddon={<LuDiameter />} endAddon='mm' bgColor={'bg.subtle'}>
								<Input size={'lg'} type='number' step={0.0001} onChange={(event) => setEtalonRadiusValue(Number(event.target.value.replace(',', '.')))} />
							</InputGroup>
						</Field.Root>
						<Field.Root>
							<Field.Label fontSize='md' color={'teal.fg'}>{t('Lens radius')}</Field.Label>
							<InputGroup startAddon={<LuDiameter />} endAddon='mm' bgColor={'bg.subtle'}>
								<Input size={'lg'} type='number' step={0.0001} onChange={(event) => setLensRadius(Number(event.target.value.replace(',', '.')))} />
							</InputGroup>
						</Field.Root>
					</Box>
				</Box>
				<Box px={{ base: 0, md: 2 }} flex={'1 1 420px'} minW={0}>
					<Box
						p={2}
						bgColor={'whiteAlpha.700'}
						borderRadius={'lg'}
						borderWidth={'1px'}
						borderColor={'border.subtle'}
						mb={4}
						>
						<Box ms={4} mt={1}>
							<GaugeStatus status={deviceStatus} />
						</Box>
                    	<GaugeChart currentValue={measuredSagittaDeviationInput ?? 0} maxSagittaDeviation={sagittaDeviationInMicron} />
					</Box>
                    <Box
						p={4}
						borderRadius={'md'}
						bg={'whiteAlpha.700'}
						borderWidth={'1px'}
						borderColor={'border.subtle'}>
						<Heading size={'sm'} mb={3}>{t('Measurement summary')}</Heading>
						<Box display={'grid'} gridTemplateColumns={'1fr auto'} columnGap={4} rowGap={2} alignItems={'center'}>
							<Text color={'fg.muted'}>{t('Current deviation')}</Text>
							<Heading size={'md'} color={isWithinTolerance ? 'fg.success' : 'fg.error'}>{formatMicron(measuredDeviationInMicron)}</Heading>

							<Text color={'fg.muted'}>{t('Max allowed deviation')}</Text>
							<Text fontWeight={'semibold'}>{formatMicron(sagittaDeviationInMicron)}</Text>

							<Text color={'fg.muted'}>{t('Current radius')}</Text>
							<Text fontWeight={'semibold'}>{formatRadius(calculatedRadius)}</Text>
						</Box>
					</Box>
                </Box>
			</Container>
		</>
	);
};

export default GaugeContainer;
