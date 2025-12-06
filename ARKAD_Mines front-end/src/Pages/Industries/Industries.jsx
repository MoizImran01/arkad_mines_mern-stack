"use client";

import { useState, useEffect, useRef } from "react";
import "./Industries.css";
import { 
  Building2, 
  Home, 
  Landmark, 
  Sparkles, 
  TrendingUp, 
  Globe2, 
  Mountain,
  Layers,
  Award,
  Hammer,
  ChevronDown
} from "lucide-react";

export default function Industries() {
  const [activeSection, setActiveSection] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState({});
  const statsRef = useRef(null);
  const [counters, setCounters] = useState({ market: 0, countries: 0, years: 0, types: 0 });

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Intersection Observer for animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible((prev) => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.2 }
    );

    document.querySelectorAll(".animate-on-scroll").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Counter animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          animateCounters();
        }
      },
      { threshold: 0.5 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const animateCounters = () => {
    const targets = { market: 60, countries: 150, years: 4000, types: 200 };
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      setCounters({
        market: Math.round((targets.market / steps) * step),
        countries: Math.round((targets.countries / steps) * step),
        years: Math.round((targets.years / steps) * step),
        types: Math.round((targets.types / steps) * step),
      });
      if (step >= steps) clearInterval(timer);
    }, interval);
  };

  const industries = [
    {
      icon: <Building2 size={48} />,
      title: "Commercial Construction",
      description: "Premium granite facades, lobbies, and flooring for corporate buildings, hotels, and shopping centers.",
      applications: ["Building Facades", "Reception Areas", "Elevator Lobbies", "Conference Rooms"],
      image: "🏢"
    },
    {
      icon: <Home size={48} />,
      title: "Residential Architecture",
      description: "Elegant countertops, flooring, and decorative elements that transform homes into masterpieces.",
      applications: ["Kitchen Countertops", "Bathroom Vanities", "Flooring", "Staircases"],
      image: "🏠"
    },
    {
      icon: <Landmark size={48} />,
      title: "Monuments & Memorials",
      description: "Timeless granite monuments that honor history and stand for generations to come.",
      applications: ["Memorial Stones", "Statues", "Historical Markers", "Cemetery Monuments"],
      image: "🏛️"
    },
    {
      icon: <Sparkles size={48} />,
      title: "Interior Design",
      description: "Luxurious granite accents that add sophistication to any interior space.",
      applications: ["Feature Walls", "Fireplaces", "Bar Tops", "Window Sills"],
      image: "✨"
    }
  ];

  const graniteTypes = [
    { name: "Black Galaxy", origin: "India", color: "#1a1a2e", sparkle: true },
    { name: "Absolute Black", origin: "Zimbabwe", color: "#0d0d0d", sparkle: false },
    { name: "Kashmir White", origin: "India", color: "#f5f5f5", sparkle: true },
    { name: "Blue Pearl", origin: "Norway", color: "#2c3e50", sparkle: true },
    { name: "Baltic Brown", origin: "Finland", color: "#8b4513", sparkle: false },
    { name: "Giallo Ornamental", origin: "Brazil", color: "#daa520", sparkle: true },
  ];

  const timeline = [
    { year: "3000 BCE", event: "Ancient Egyptians begin quarrying granite for pyramids and obelisks", structure: "pyramid" },
    { year: "2500 BCE", event: "The Great Pyramid of Giza incorporates massive granite blocks", structure: "greatPyramid" },
    { year: "500 BCE", event: "Greeks use granite for temples and sculptures", structure: "greekTemple" },
    { year: "100 CE", event: "Romans perfect granite cutting techniques for monuments", structure: "romanColumn" },
    { year: "1800s", event: "Industrial revolution enables mass granite production", structure: "factory" },
    { year: "Modern Era", event: "Advanced technology allows precise cuts and finishes", structure: "skyscraper" },
  ];

  return (
    <div className="industries-page">
      {/* Hero Section with 3D Floating Cubes */}
      <section className="industries-hero">
        <div className="hero-background">
          <div className="floating-cube cube-1" style={{ transform: `translateY(${scrollY * 0.1}px) rotateX(${scrollY * 0.05}deg) rotateY(${scrollY * 0.08}deg)` }}></div>
          <div className="floating-cube cube-2" style={{ transform: `translateY(${scrollY * -0.15}px) rotateX(${scrollY * -0.03}deg) rotateY(${scrollY * 0.1}deg)` }}></div>
          <div className="floating-cube cube-3" style={{ transform: `translateY(${scrollY * 0.08}px) rotateX(${scrollY * 0.07}deg) rotateY(${scrollY * -0.05}deg)` }}></div>
          <div className="floating-cube cube-4" style={{ transform: `translateY(${scrollY * -0.12}px) rotateX(${scrollY * -0.08}deg) rotateY(${scrollY * 0.03}deg)` }}></div>
          <div className="floating-cube cube-5" style={{ transform: `translateY(${scrollY * 0.2}px) rotateX(${scrollY * 0.04}deg) rotateY(${scrollY * -0.07}deg)` }}></div>
        </div>
        
        <div className="hero-content">
          <div className="hero-badge">
            <Mountain size={20} />
            <span>The Foundation of Modern Architecture</span>
          </div>
          <h1 className="hero-title">
            <span className="title-line">The Granite</span>
            <span className="title-line gradient-text">Industry</span>
          </h1>
          <p className="hero-subtitle">
            Discover the timeless elegance and unmatched durability of granite — 
            the stone that has shaped civilizations for millennia.
          </p>
          <div className="hero-cta">
            <button className="primary-btn">
              Explore Our Catalog
              <span className="btn-arrow">→</span>
            </button>
            <button className="secondary-btn">
              <span className="play-icon">▶</span>
              Watch Our Process
            </button>
          </div>
        </div>

        <div className="scroll-indicator">
          <ChevronDown size={32} className="bounce" />
        </div>
      </section>

      {/* Global Statistics */}
      <section className="stats-section" ref={statsRef}>
        <div className="stats-container">
          <div className="stat-card">
            <div className="stat-icon">
              <TrendingUp size={32} />
            </div>
            <div className="stat-value">${counters.market}B+</div>
            <div className="stat-label">Global Market Value</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <Globe2 size={32} />
            </div>
            <div className="stat-value">{counters.countries}+</div>
            <div className="stat-label">Countries Export Granite</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <Layers size={32} />
            </div>
            <div className="stat-value">{counters.years}+</div>
            <div className="stat-label">Years of Human Use</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <Award size={32} />
            </div>
            <div className="stat-value">{counters.types}+</div>
            <div className="stat-label">Unique Varieties</div>
          </div>
        </div>
      </section>

      {/* What is Granite Section */}
      <section className="about-granite-section animate-on-scroll" id="about-granite">
        <div className={`section-content ${isVisible["about-granite"] ? "visible" : ""}`}>
          <div className="text-content">
            <h2 className="section-title">
              <span className="title-accent">What is</span>
              <span className="title-main">Granite?</span>
            </h2>
            <p className="section-text">
              Granite is a coarse-grained igneous rock composed primarily of quartz, feldspar, and mica. 
              Formed deep within the Earth's crust over millions of years under intense heat and pressure, 
              granite is one of the hardest and most durable natural stones available.
            </p>
            <div className="granite-properties">
              <div className="property">
                <Hammer size={24} />
                <div>
                  <h4>Exceptional Hardness</h4>
                  <p>Ranks 6-7 on Mohs hardness scale</p>
                </div>
              </div>
              <div className="property">
                <Sparkles size={24} />
                <div>
                  <h4>Natural Beauty</h4>
                  <p>Unique patterns in every slab</p>
                </div>
              </div>
              <div className="property">
                <Award size={24} />
                <div>
                  <h4>Longevity</h4>
                  <p>Lasts centuries with minimal care</p>
                </div>
              </div>
            </div>
          </div>
          <div className="visual-content">
            <div className="granite-3d-showcase">
              <div className="rotating-stone">
                <div className="stone-face front"></div>
                <div className="stone-face back"></div>
                <div className="stone-face right"></div>
                <div className="stone-face left"></div>
                <div className="stone-face top"></div>
                <div className="stone-face bottom"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industry Applications */}
      <section className="applications-section">
        <div className="section-header">
          <h2>Industry Applications</h2>
          <p>Granite's versatility makes it indispensable across multiple sectors</p>
        </div>
        
        <div className="industries-grid">
          {industries.map((industry, index) => (
            <div 
              key={index} 
              className={`industry-card ${activeSection === index ? "active" : ""}`}
              onMouseEnter={() => setActiveSection(index)}
            >
              <div className="card-glow"></div>
              <div className="card-content">
                <div className="card-icon">{industry.icon}</div>
                <h3>{industry.title}</h3>
                <p>{industry.description}</p>
                <div className="applications-list">
                  {industry.applications.map((app, i) => (
                    <span key={i} className="application-tag">{app}</span>
                  ))}
                </div>
              </div>
              <div className="card-background">
                <span className="bg-emoji">{industry.image}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Granite Types Showcase */}
      <section className="granite-types-section">
        <div className="section-header">
          <h2>World-Renowned Granite Varieties</h2>
          <p>Each variety tells a unique geological story millions of years in the making</p>
        </div>
        
        <div className="granite-carousel">
          {graniteTypes.map((granite, index) => (
            <div 
              key={index} 
              className="granite-sample"
              style={{ 
                "--delay": `${index * 0.1}s`,
                "--granite-color": granite.color 
              }}
            >
              <div className={`sample-stone ${granite.sparkle ? "sparkle" : ""}`}>
                <div className="stone-texture"></div>
                {granite.sparkle && (
                  <div className="sparkle-overlay">
                    <span className="sparkle-dot"></span>
                    <span className="sparkle-dot"></span>
                    <span className="sparkle-dot"></span>
                    <span className="sparkle-dot"></span>
                    <span className="sparkle-dot"></span>
                  </div>
                )}
              </div>
              <div className="sample-info">
                <h4>{granite.name}</h4>
                <p>Origin: {granite.origin}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Historical Timeline */}
      <section className="timeline-section animate-on-scroll" id="timeline">
        <div className="section-header">
          <h2>A Legacy Carved in Stone</h2>
          <p>From ancient pyramids to modern skyscrapers — granite's journey through history</p>
        </div>
        
        <div className={`timeline-with-structures ${isVisible["timeline"] ? "visible" : ""}`}>
          {timeline.map((item, index) => (
            <div 
              key={index} 
              className={`timeline-item-enhanced ${index % 2 === 0 ? 'left' : 'right'}`}
              style={{ "--item-delay": `${index * 0.2}s` }}
            >
              {/* 3D Structure */}
              <div className="structure-container">
                <div className={`structure-3d ${item.structure}`}>
                  {item.structure === 'pyramid' && (
                    <div className="pyramid"></div>
                  )}
                  {item.structure === 'greatPyramid' && (
                    <div className="great-pyramid"></div>
                  )}
                  {item.structure === 'greekTemple' && (
                    <div className="greek-temple">
                      <div className="temple-roof"></div>
                      <div className="temple-pediment"></div>
                      <div className="temple-columns">
                        <div className="column"></div>
                        <div className="column"></div>
                        <div className="column"></div>
                        <div className="column"></div>
                      </div>
                      <div className="temple-base"></div>
                    </div>
                  )}
                  {item.structure === 'romanColumn' && (
                    <div className="roman-column">
                      <div className="column-capital"></div>
                      <div className="column-shaft"></div>
                      <div className="column-base"></div>
                    </div>
                  )}
                  {item.structure === 'factory' && (
                    <div className="factory">
                      <div className="factory-building"></div>
                      <div className="factory-chimney">
                        <div className="smoke"></div>
                        <div className="smoke delay"></div>
                      </div>
                      <div className="factory-windows">
                        <div className="window"></div>
                        <div className="window"></div>
                        <div className="window"></div>
                      </div>
                    </div>
                  )}
                  {item.structure === 'skyscraper' && (
                    <div className="skyscraper">
                      <div className="building-top"></div>
                      <div className="building-body">
                        <div className="glass-panel"></div>
                        <div className="glass-panel"></div>
                        <div className="glass-panel"></div>
                        <div className="glass-panel"></div>
                      </div>
                      <div className="building-base"></div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Timeline Content */}
              <div className="timeline-connector">
                <div className="connector-line"></div>
                <div className="connector-dot"></div>
              </div>
              
              <div className="timeline-content-enhanced">
                <span className="timeline-year">{item.year}</span>
                <p className="timeline-event">{item.event}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why Granite Section */}
      <section className="why-granite-section">
        <div className="why-container">
          <div className="why-visual">
            <div className="comparison-slider">
              <div className="comparison-item granite">
                <span>Granite</span>
                <div className="bar-container">
                  <div className="durability-bar" style={{ width: "95%" }} data-value="95%"></div>
                </div>
              </div>
              <div className="comparison-item marble">
                <span>Marble</span>
                <div className="bar-container">
                  <div className="durability-bar" style={{ width: "70%" }} data-value="70%"></div>
                </div>
              </div>
              <div className="comparison-item quartz">
                <span>Quartz</span>
                <div className="bar-container">
                  <div className="durability-bar" style={{ width: "85%" }} data-value="85%"></div>
                </div>
              </div>
              <div className="comparison-item laminate">
                <span>Laminate</span>
                <div className="bar-container">
                  <div className="durability-bar" style={{ width: "40%" }} data-value="40%"></div>
                </div>
              </div>
              <div className="rating-info">
                <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>⭐ Based on hardness, heat & scratch resistance</span>
              </div>
            </div>
          </div>
          
          <div className="why-content">
            <h2>Why Choose Granite?</h2>
            <ul className="benefits-list">
              <li>
                <span className="benefit-icon">🛡️</span>
                <div>
                  <h4>Unmatched Durability</h4>
                  <p>Resistant to scratches, heat, and daily wear</p>
                </div>
              </li>
              <li>
                <span className="benefit-icon">💎</span>
                <div>
                  <h4>Unique Aesthetics</h4>
                  <p>No two slabs are ever identical — nature's artwork</p>
                </div>
              </li>
              <li>
                <span className="benefit-icon">📈</span>
                <div>
                  <h4>Increases Property Value</h4>
                  <p>Premium material that boosts real estate worth</p>
                </div>
              </li>
              <li>
                <span className="benefit-icon">🌿</span>
                <div>
                  <h4>Eco-Friendly</h4>
                  <p>100% natural with minimal processing required</p>
                </div>
              </li>
              <li>
                <span className="benefit-icon">⏰</span>
                <div>
                  <h4>Low Maintenance</h4>
                  <p>Simple sealing keeps it pristine for decades</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="cta-section">
        <div className="cta-background">
          <div className="cta-pattern"></div>
        </div>
        <div className="cta-content">
          <h2>Ready to Transform Your Space?</h2>
          <p>Explore our premium collection of Pakistani granite and discover the perfect stone for your project.</p>
          <div className="cta-buttons">
            <button className="cta-primary">View Our Catalog</button>
            <button className="cta-secondary">Request a Quote</button>
          </div>
        </div>
      </section>
    </div>
  );
}

