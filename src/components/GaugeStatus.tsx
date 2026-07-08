import { Status } from '@chakra-ui/react';

interface Props {
    status: string;
}

const GaugeStatus = ({status}: Props) => {
  const isActive = status.includes('connected')
  return (
    <Status.Root colorPalette={isActive ? "green" : "red"}>
        <Status.Indicator />
        {isActive ? 'Online' : 'Offline'} - {status}
    </Status.Root>
  )
}

export default GaugeStatus