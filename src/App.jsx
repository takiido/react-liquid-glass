import { useState } from 'react'
import LiquidGlass from "./LiquidGlass";
import background from "./assets/background.jpg";
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className='container'>
      <img className='background' src={background} alt="background" />
      <h1>Liquid Glass Effect</h1>
      <LiquidGlass width={300} height={200} />
    </div>
  )
}

export default App
