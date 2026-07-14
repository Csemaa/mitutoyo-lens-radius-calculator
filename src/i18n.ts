import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {},
  hu: {
    translation: {
      'Bell': 'Harang',
      'Radius Calculator': 'Rádiusz kalkulátor',
      'Etalon radius': 'Etalon rádiusz',
      'Lens radius': 'Lencse rádiusz',
      'Measurement summary': 'Összegzés',
      'Current deviation': 'Jelenlegi eltérés',
      'Max allowed deviation': 'Maximálisan megengedett eltérés',
      'Current radius': 'Jelenlegi rádiusz',
      'Device not connected': 'Eszköz nincs csatlakoztatva',
      'Device connected on COM3': 'Eszköz csatlakoztatva a COM3 porton',
      'Reader error: Serial port closed': 'Olvasás hiba:',
      'Waiting for device values...': 'Várakozás az eszköz értékeire...',
      'Error: Cannot reach reader service': 'Hiba: Nem lehet elérni a szervert.',
      'Online': 'Elérhető',
      'Offline': 'Inaktív',
      'Lens type': 'Lencse típusa',
    },
  },
   de: {
    translation: {
      'Bell': 'Glocke',
      'Radius Calculator': 'Radiusrechner',
      'Etalon radius': 'Etalonradius',
      'Lens radius': 'Linsenradius',
      'Current deviation': 'Aktuelle Abweichung',
      'Max allowed deviation': 'Maximal zulässige Abweichung',
      'Current radius': 'Aktueller Radius',
      'Device not connected': 'Gerät nicht verbunden',
      'Device connected on COM3': 'Gerät verbunden an COM3',
      'Reader error: Serial port closed': 'Lesefehler:',
      'Waiting for device values...': 'Warten auf Gerätewerte...',
      'Error: Cannot reach reader service': 'Fehler: Lesedienst nicht erreichbar',
      'Lens type': 'Linsentyp',
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: import.meta.env.VITE_DEFAULT_LNG || 'hu',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
