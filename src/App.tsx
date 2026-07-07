import { useMemo, useState } from 'react'
import './App.css'

function App() {
  const calculateRadius = (saggita: number, diameter: number) => {
    return (saggita / 2) + (Math.pow(diameter ,2) / (8 * saggita))
  }

  const calculateSaggita = (radius: number, diameter: number) => {
    const halfChord = diameter / 2
    return radius - Math.sqrt(Math.pow(radius, 2) - Math.pow(halfChord, 2))
  }

  const [saggitaValue, setSaggitaValue] = useState<number>(0)
  const [diameterValue, setDiameterValue] = useState<number>(0)
  const [goldenSampleRadiusValue, setGoldenSampleRadiusValue] = useState<number>(0)

  const calculatedSaggita = useMemo(() => {
    return calculateSaggita(goldenSampleRadiusValue, diameterValue)
  }, [goldenSampleRadiusValue, diameterValue, saggitaValue])

    const calculatedRadius = useMemo(() => {
    return calculateRadius(saggitaValue + calculatedSaggita, diameterValue)
  }, [saggitaValue, diameterValue, calculatedSaggita])

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '50px' }}>
        <h3>Radius Calculator</h3>
        <p>Measured sagitta (mm)</p>
        <input style={{height: '24px'}} type="text" onChange={(event) => setSaggitaValue(Number((event.target.value).replace(',', '.')))} />
        <div className="" style={{ display: 'flex',gap: '10px', marginTop: '20px' }}>
          <p>Harang (mm)</p>
          <input style={{height: '24px'}} type="text" onChange={(event) => setDiameterValue(Number((event.target.value).replace(',', '.')))} />
          <p>Etalon radiusz</p>
          <input style={{height: '24px'}} type="text" onChange={(event) => setGoldenSampleRadiusValue(Number((event.target.value).replace(',', '.')))} />
        </div>
        <p style={{ marginTop: '40px', color: '#00FF00'}}>Calculated Radius: {calculatedRadius}</p>
      </div>
    </>
  )
}

export default App
