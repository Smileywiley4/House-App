import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Send, CheckCircle, Globe, Users, Briefcase, ChevronDown, X } from 'lucide-react'

const roles = [
  'Director',
  'Director of Photography',
  'Producer',
  'Line Producer',
  'Production Manager',
  'Assistant Director',
  'Gaffer',
  'Key Grip',
  'Sound Mixer',
  'Boom Operator',
  'Editor',
  'Colorist',
  'VFX Artist',
  'Motion Designer',
  'Sound Designer',
  'Composer',
  'Makeup Artist',
  'Wardrobe Stylist',
  'Set Designer',
  'Production Assistant',
  'Drone Operator',
  'Steadicam Operator',
  'DIT',
  'Script Supervisor',
  'Location Scout',
  'Casting Director',
  'Stunt Coordinator',
  'Other',
]

const experienceLevels = [
  '0–2 years',
  '3–5 years',
  '6–10 years',
  '10–15 years',
  '15+ years',
]

const availabilityOptions = [
  'Full-time availability',
  'Part-time / project-based',
  'Weekends only',
  'Currently booked — available in 1–3 months',
  'Currently booked — available in 3+ months',
]

const highlights = [
  {
    icon: Globe,
    title: 'Worldwide Network',
    description: 'Join a global roster of vetted production professionals deployed on shoots across every continent.',
  },
  {
    icon: Briefcase,
    title: 'Premium Projects',
    description: 'Get matched to commercial, marketing, and advertising productions for top-tier brands and agencies.',
  },
  {
    icon: Users,
    title: 'Community',
    description: 'Connect with fellow contractors, share resources, and grow your career alongside the best in the business.',
  },
]

function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return [ref, inView]
}

function SelectField({ label, options, placeholder, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs tracking-[0.15em] uppercase text-neutral-500 mb-2">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-transparent border-b border-white/15 pb-3 text-left focus:border-white/40 focus:outline-none transition-colors"
      >
        <span className={value ? 'text-white' : 'text-neutral-600'}>{value || placeholder}</span>
        <ChevronDown size={16} className={`text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-neutral-900 border border-white/10 rounded-lg shadow-2xl">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                value === opt
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MultiSelectField({ label, options, placeholder, selected, onChange, exclude }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const filtered = exclude ? options.filter((o) => o !== exclude) : options

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggle = (opt) => {
    onChange(
      selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt]
    )
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs tracking-[0.15em] uppercase text-neutral-500 mb-2">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-transparent border-b border-white/15 pb-3 text-left focus:border-white/40 focus:outline-none transition-colors"
      >
        <span className={selected.length ? 'text-white' : 'text-neutral-600'}>
          {selected.length ? `${selected.length} selected` : placeholder}
        </span>
        <ChevronDown size={16} className={`text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selected.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-full text-neutral-300"
            >
              {item}
              <button type="button" onClick={() => toggle(item)} className="hover:text-white transition-colors">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-neutral-900 border border-white/10 rounded-lg shadow-2xl">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${
                selected.includes(opt)
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {opt}
              {selected.includes(opt) && (
                <span className="text-xs text-neutral-500">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Contractors() {
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: '',
    country: '',
    role: '',
    additionalRoles: [],
    experience: '',
    portfolioUrl: '',
    reelUrl: '',
    equipment: '',
    availability: '',
    bio: '',
    referral: '',
  })

  const [sectionRef, inView] = useInView(0.1)

  const update = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e?.target?.value ?? e }))

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (submitted) {
    return (
      <main className="pt-28 pb-24">
        <div className="section-padding">
          <div className="max-w-2xl mx-auto text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 mb-8">
              <CheckCircle size={40} className="text-green-400" />
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Application Received
            </h1>
            <p className="text-neutral-400 text-lg leading-relaxed mb-4">
              Thank you for applying to join the Gasworks worldwide contractors network.
              We review every submission carefully.
            </p>
            <p className="text-neutral-500 leading-relaxed mb-10">
              If your profile is a fit for upcoming productions, our team will reach out directly.
              In the meantime, keep your reel and portfolio current.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-medium bg-white text-neutral-950 rounded-full hover:bg-neutral-200 transition-all duration-300"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="pt-28 pb-24">
      <div className="section-padding">
        {/* Hero */}
        <div className="max-w-3xl mb-20">
          <p className="text-xs tracking-[0.3em] uppercase text-neutral-500 mb-4">
            Join Our Network
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight">
            <span className="text-white">WORLDWIDE</span>
            <br />
            <span className="text-gradient">CONTRACTORS</span>
          </h1>
          <p className="mt-6 text-neutral-400 text-lg leading-relaxed max-w-xl">
            We're building a global roster of the best production talent in the industry.
            Fill out the questionnaire below to be considered for upcoming projects worldwide.
          </p>
        </div>

        {/* Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
          {highlights.map((item, i) => (
            <div
              key={item.title}
              className="p-8 rounded-xl border border-white/5 bg-white/[0.02]"
              style={{
                animation: `fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 100}ms forwards`,
                opacity: 0,
              }}
            >
              <item.icon size={24} className="text-neutral-500 mb-4" strokeWidth={1.5} />
              <h3 className="font-display text-lg font-bold tracking-tight mb-2">{item.title}</h3>
              <p className="text-neutral-500 text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>

        {/* Questionnaire */}
        <div ref={sectionRef} className="max-w-3xl mx-auto">
          <div className="mb-12">
            <p className="text-xs tracking-[0.3em] uppercase text-neutral-500 mb-4">
              Contractor Questionnaire
            </p>
            <h2
              className={`font-display text-3xl md:text-5xl font-bold tracking-tight ${
                inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 200ms' }}
            >
              Tell Us About <span className="text-gradient">Yourself</span>
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Personal Information */}
            <div>
              <h3 className="text-xs tracking-[0.2em] uppercase text-neutral-400 font-semibold mb-6 pb-2 border-b border-white/5">
                Personal Information
              </h3>
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs tracking-[0.15em] uppercase text-neutral-500 mb-2">
                      Full Name *
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.fullName}
                      onChange={update('fullName')}
                      className="w-full bg-transparent border-b border-white/15 pb-3 text-white placeholder-neutral-600 focus:border-white/40 focus:outline-none transition-colors"
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-[0.15em] uppercase text-neutral-500 mb-2">
                      Email *
                    </label>
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={update('email')}
                      className="w-full bg-transparent border-b border-white/15 pb-3 text-white placeholder-neutral-600 focus:border-white/40 focus:outline-none transition-colors"
                      placeholder="you@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs tracking-[0.15em] uppercase text-neutral-500 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={update('phone')}
                    className="w-full bg-transparent border-b border-white/15 pb-3 text-white placeholder-neutral-600 focus:border-white/40 focus:outline-none transition-colors"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs tracking-[0.15em] uppercase text-neutral-500 mb-2">
                      City *
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.city}
                      onChange={update('city')}
                      className="w-full bg-transparent border-b border-white/15 pb-3 text-white placeholder-neutral-600 focus:border-white/40 focus:outline-none transition-colors"
                      placeholder="Los Angeles"
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-[0.15em] uppercase text-neutral-500 mb-2">
                      Country *
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.country}
                      onChange={update('country')}
                      className="w-full bg-transparent border-b border-white/15 pb-3 text-white placeholder-neutral-600 focus:border-white/40 focus:outline-none transition-colors"
                      placeholder="United States"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Details */}
            <div>
              <h3 className="text-xs tracking-[0.2em] uppercase text-neutral-400 font-semibold mb-6 pb-2 border-b border-white/5">
                Professional Details
              </h3>
              <div className="space-y-5">
                <SelectField
                  label="Primary Role / Specialty *"
                  options={roles}
                  placeholder="Select your role"
                  value={formData.role}
                  onChange={(val) => setFormData((prev) => ({ ...prev, role: val }))}
                />

                <MultiSelectField
                  label="Additional Roles"
                  options={roles}
                  placeholder="Select any other roles you can fill"
                  selected={formData.additionalRoles}
                  onChange={(val) => setFormData((prev) => ({ ...prev, additionalRoles: val }))}
                  exclude={formData.role}
                />

                <SelectField
                  label="Years of Experience *"
                  options={experienceLevels}
                  placeholder="Select experience level"
                  value={formData.experience}
                  onChange={(val) => setFormData((prev) => ({ ...prev, experience: val }))}
                />

                <div>
                  <label className="block text-xs tracking-[0.15em] uppercase text-neutral-500 mb-2">
                    Portfolio / Website URL
                  </label>
                  <input
                    type="url"
                    value={formData.portfolioUrl}
                    onChange={update('portfolioUrl')}
                    className="w-full bg-transparent border-b border-white/15 pb-3 text-white placeholder-neutral-600 focus:border-white/40 focus:outline-none transition-colors"
                    placeholder="https://yourportfolio.com"
                  />
                </div>

                <div>
                  <label className="block text-xs tracking-[0.15em] uppercase text-neutral-500 mb-2">
                    Reel / Demo URL
                  </label>
                  <input
                    type="url"
                    value={formData.reelUrl}
                    onChange={update('reelUrl')}
                    className="w-full bg-transparent border-b border-white/15 pb-3 text-white placeholder-neutral-600 focus:border-white/40 focus:outline-none transition-colors"
                    placeholder="https://vimeo.com/yourreel"
                  />
                </div>
              </div>
            </div>

            {/* Equipment & Availability */}
            <div>
              <h3 className="text-xs tracking-[0.2em] uppercase text-neutral-400 font-semibold mb-6 pb-2 border-b border-white/5">
                Equipment &amp; Availability
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs tracking-[0.15em] uppercase text-neutral-500 mb-2">
                    Equipment You Own
                  </label>
                  <textarea
                    rows={3}
                    value={formData.equipment}
                    onChange={update('equipment')}
                    className="w-full bg-transparent border-b border-white/15 pb-3 text-white placeholder-neutral-600 focus:border-white/40 focus:outline-none transition-colors resize-none"
                    placeholder="e.g. RED Komodo, Aputure 600d, DJI Ronin 4D, Sound Devices MixPre..."
                  />
                </div>

                <SelectField
                  label="Availability"
                  options={availabilityOptions}
                  placeholder="Select your availability"
                  value={formData.availability}
                  onChange={(val) => setFormData((prev) => ({ ...prev, availability: val }))}
                />
              </div>
            </div>

            {/* About You */}
            <div>
              <h3 className="text-xs tracking-[0.2em] uppercase text-neutral-400 font-semibold mb-6 pb-2 border-b border-white/5">
                About You
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs tracking-[0.15em] uppercase text-neutral-500 mb-2">
                    Short Bio *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.bio}
                    onChange={update('bio')}
                    className="w-full bg-transparent border-b border-white/15 pb-3 text-white placeholder-neutral-600 focus:border-white/40 focus:outline-none transition-colors resize-none"
                    placeholder="Tell us about your background, notable projects, and what makes you great at what you do..."
                  />
                </div>

                <div>
                  <label className="block text-xs tracking-[0.15em] uppercase text-neutral-500 mb-2">
                    How Did You Hear About Us?
                  </label>
                  <input
                    type="text"
                    value={formData.referral}
                    onChange={update('referral')}
                    className="w-full bg-transparent border-b border-white/15 pb-3 text-white placeholder-neutral-600 focus:border-white/40 focus:outline-none transition-colors"
                    placeholder="Referral, social media, industry event..."
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="group flex items-center gap-2 px-8 py-4 text-sm font-medium bg-white text-neutral-950 rounded-full hover:bg-neutral-200 transition-all duration-300"
              >
                Submit Application
                <Send size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
              <p className="mt-4 text-xs text-neutral-600">
                By submitting, you agree to be added to our worldwide contractors database.
                We'll only contact you regarding relevant production opportunities.
              </p>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
