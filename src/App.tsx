import { useState } from 'react'

// This import will be rewritten on client builds into a stub that calls /locid
import helloServer from '../locid/hello.server'

export default function App() {
  const [result, setResult] = useState<string | null>(null)

  const handleClick = async () => {
    const res = await helloServer({ name: 'Dave' })
    setResult(res.message)
  }

  return (
    <div>
      <h1>Locid PoC</h1>
      <button onClick={handleClick}>Call server action</button>
      {result && <p>{result}</p>}
    </div>
  )
}
