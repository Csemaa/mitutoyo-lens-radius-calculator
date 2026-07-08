import { Status, Text } from '@chakra-ui/react';

interface Props {
    status: string;
}

const GaugeStatus = ({status}: Props) => {
  const isActive = status.includes('connected')
  return (
    <Status.Root colorPalette={isActive ? "green" : "red"}>
        <Status.Indicator />
        {isActive ? 'Online' : 'Offline'} - <Text color='fg.subtle'>{status}</Text>
    </Status.Root>
  )
}

export default GaugeStatus