import { Box } from '@chakra-ui/react';
import GaugeContainer from './components/GaugeContainer';

function App() {
	return (
		<Box minH="100vh" w="100%" display="flex" justifyContent="center" alignItems="center" p={{ base: 4, md: 6 }}>
			<GaugeContainer />
		</Box>
	);
}

export default App;
