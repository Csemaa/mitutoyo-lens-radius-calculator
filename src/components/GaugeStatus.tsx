import { Status, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

interface Props {
    status: string;
}

const GaugeStatus = ({status}: Props) => {
  const { t } = useTranslation();
  const isActive = status.includes('connected')
  return (
    <Status.Root colorPalette={isActive ? "green" : "red"}>
        <Status.Indicator />
        {isActive ? t('Online') : t('Offline')} - <Text color='fg.subtle'>{t(status)}</Text>
    </Status.Root>
  )
}

export default GaugeStatus