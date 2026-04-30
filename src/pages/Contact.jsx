import { useState } from 'react'
import { Send } from 'lucide-react'

const budgetOptions = ['Under $10k', '$10k – $50k', '$50k – $150k', '$200k+']
const timelineOptions = ['ASAP', 'Within 3 months', '6+ months']

export default function Contact() {
  const [activeTab, setActiveTab] = useState('brand')
  const [selectedBudget, setSelectedBudget] = useState('')
  const [selectedTimeline, setSelectedTimeline] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
  }

  const tabClass = (tab) =>
    `text-[13px] uppercase tracking-[0.15em] pb-2 transition-colors ${
      activeTab === tab
        ? 'text-white border-b border-white'
        : 'text-neutral-500 hover:text-white'
    }`

  const pillClass = (selected, value) =>
    `px-4 py-2 text-sm transition-all duration-300 ${
      selected === value
        ? 'bg-white text-neutral-950 font-medium'
        : 'border border-white/15 text-neutral-500 hover:text-white hover:border-white/30'
    }`

  return (
    <main className="pt-16 md:pt-20">
      <div className="min-h-[calc(100vh-80px)] flex flex-col lg:flex-row">
        {/* Left — info */}
        <div className="lg:w-1/2 px-5 md:px-10 py-16 md:py-24 flex flex-col justify-center">
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Let's work<br />together.
          </h1>
          <p className="text-neutral-400 leading-relaxed max-w-md mb-10">
            Whether you're a brand, an agency, or an individual with an idea — tell us
            what you're envisioning and we'll handle the rest.
          </p>

          <div className="space-y-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500 mb-1">New Business</p>
              <a href="mailto:new@gasworksproduction.com" className="text-white hover:text-neutral-400 transition-colors">
                new@gasworksproduction.com
              </a>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500 mb-1">Agency Partnerships</p>
              <a href="mailto:partnerships@gasworksproduction.com" className="text-white hover:text-neutral-400 transition-colors">
                partnerships@gasworksproduction.com
              </a>
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div className="lg:w-1/2 bg-neutral-900/50 px-5 md:px-10 lg:px-16 py-16 md:py-24 flex flex-col justify-center">
          <div className="max-w-lg mx-auto lg:mx-0 w-full">
            <div className="flex gap-6 mb-10">
              <button onClick={() => setActiveTab('brand')} className={tabClass('brand')}>
                Brand
              </button>
              <button onClick={() => setActiveTab('agency')} className={tabClass('agency')}>
                Agency
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-2">Name</label>
                <input
                  type="text"
                  className="w-full bg-transparent border-b border-white/10 pb-3 text-white placeholder-neutral-600 focus:border-white/30 focus:outline-none transition-colors"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
                  {activeTab === 'agency' ? 'Agency' : 'Company'}
                </label>
                <input
                  type="text"
                  className="w-full bg-transparent border-b border-white/10 pb-3 text-white placeholder-neutral-600 focus:border-white/30 focus:outline-none transition-colors"
                  placeholder={activeTab === 'agency' ? 'Agency name' : 'Company name'}
                />
              </div>

              {activeTab === 'brand' && (
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-2">Location</label>
                  <input
                    type="text"
                    className="w-full bg-transparent border-b border-white/10 pb-3 text-white placeholder-neutral-600 focus:border-white/30 focus:outline-none transition-colors"
                    placeholder="City, Country"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-2">Email</label>
                <input
                  type="email"
                  className="w-full bg-transparent border-b border-white/10 pb-3 text-white placeholder-neutral-600 focus:border-white/30 focus:outline-none transition-colors"
                  placeholder="you@company.com"
                />
              </div>

              {activeTab === 'agency' && (
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
                    Phone <span className="normal-case tracking-normal text-neutral-600">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    className="w-full bg-transparent border-b border-white/10 pb-3 text-white placeholder-neutral-600 focus:border-white/30 focus:outline-none transition-colors"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              )}

              {activeTab === 'brand' && (
                <>
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-3">Budget</label>
                    <div className="flex flex-wrap gap-2">
                      {budgetOptions.map((opt) => (
                        <button key={opt} type="button" onClick={() => setSelectedBudget(opt)} className={pillClass(selectedBudget, opt)}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-3">Timeline</label>
                    <div className="flex flex-wrap gap-2">
                      {timelineOptions.map((opt) => (
                        <button key={opt} type="button" onClick={() => setSelectedTimeline(opt)} className={pillClass(selectedTimeline, opt)}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-2">Project Brief</label>
                <textarea
                  rows={4}
                  className="w-full bg-transparent border-b border-white/10 pb-3 text-white placeholder-neutral-600 focus:border-white/30 focus:outline-none transition-colors resize-none"
                  placeholder="Tell us about your project..."
                />
              </div>

              <button
                type="submit"
                className="group flex items-center gap-2 text-[13px] uppercase tracking-[0.15em] text-neutral-950 bg-white px-8 py-3.5 font-medium hover:bg-neutral-200 transition-colors mt-2"
              >
                Send Message
                <Send size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
