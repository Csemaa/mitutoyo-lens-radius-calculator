import { Chart, useChart } from '@chakra-ui/charts';
import { Label, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts';

type ChartPoint = {
	name: string;
	value: number;
	color: string;
};

interface Props {
	currentValue: number;
	maxSagittaDeviation: number;
}

const GaugeChart = ({ currentValue, maxSagittaDeviation }: Props) => {
	const safeMaxDeviation = Number.isFinite(maxSagittaDeviation) && maxSagittaDeviation > 0 ? maxSagittaDeviation : 1;
	const currentDeviation = Math.max(0, currentValue * 1000);
	const clampedDeviation = Math.min(currentDeviation, safeMaxDeviation);

	const chart = useChart<ChartPoint>({
			data: [
				{ name: 'current', value: clampedDeviation, color: 'red.solid' },
				{ name: 'max', value: safeMaxDeviation - clampedDeviation, color: 'green.solid' },
			],
		});

	return (
		<Chart.Root width='100%' maxW='420px' mx='auto' overflow='hidden' chart={chart} h={{ base: '220px', md: '260px' }}>
			<ResponsiveContainer width='100%' height='100%'>
				<PieChart>
					<Tooltip cursor={false} animationDuration={100} content={<Chart.Tooltip hideLabel />} />
					<Pie
						cx='50%'
						cy='60%'
						innerRadius='60%'
						outerRadius='95%'
						isAnimationActive={true}
						data={chart.data}
						dataKey={chart.key('value')}
						nameKey='name'
						startAngle={180}
						endAngle={0}
						shape={(props) => {
							const point = props.payload as ChartPoint;
							return <Sector {...props} fill={chart.color(point.color)} />;
						}}
					/>
					<Label
						content={({ viewBox }) => (
						<Chart.RadialText
							viewBox={viewBox}
							title={(currentValue ?? 0).toFixed(3)}
							description="mm"
						/>
						)}
					/>
				</PieChart>
			</ResponsiveContainer>
		</Chart.Root>
	);
};

export default GaugeChart;
