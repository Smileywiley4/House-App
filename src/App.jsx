import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Work from './pages/Work'
import About from './pages/About'
import Contact from './pages/Contact'
import Contractors from './pages/Contractors'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-neutral-950 text-white">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/work" element={<Work />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/contractors" element={<Contractors />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  )
}

export default App
