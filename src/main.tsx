import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root')

// Deliberately no StrictMode: its double-invoked effects would mount every
// rigid body twice per round, which the physics world would rather not see.
createRoot(container).render(<App />)
