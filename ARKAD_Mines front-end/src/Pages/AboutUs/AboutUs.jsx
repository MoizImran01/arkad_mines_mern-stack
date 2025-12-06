"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import "./AboutUs.css";
import { Link } from "react-router-dom";

export default function AboutUs() {
  const [hoveredId, setHoveredId] = useState(null);
  const [isVisible, setIsVisible] = useState({});
  const [counters, setCounters] = useState({ years: 0, clients: 0, varieties: 0 });
  const statsRef = useRef(null);

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

    document.querySelectorAll(".animate-section").forEach((el) => {
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
    const targets = { years: 15, clients: 500, varieties: 12 };
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      setCounters({
        years: Math.round((targets.years / steps) * step),
        clients: Math.round((targets.clients / steps) * step),
        varieties: Math.round((targets.varieties / steps) * step),
      });
      if (step >= steps) clearInterval(timer);
    }, interval);
  };

  const facilities = [
    {
      title: "Advanced Cutting Equipment",
      description:
        "State-of-the-art precision cutting machines imported from Europe. Our equipment ensures perfect edges and dimensions for every stone slab.",
      icon: "⚙️",
      color: "#3b82f6"
    },
    {
      title: "Quality Polishing",
      description:
        "Multi-stage polishing process delivers mirror-like finishes. Premium abrasives and skilled craftsmen ensure the highest quality output.",
      icon: "✨",
      color: "#f59e0b"
    },
    {
      title: "Wholesale & Distribution",
      description:
        "Direct supply to shops and wholesalers across Pakistan. Competitive pricing with reliable delivery and excellent customer support.",
      icon: "📦",
      color: "#10b981"
    },
  ];

  const granites = [
    { id: 1, name: "Chatral", color1: "#8B7355", color2: "#A0522D" },
    { id: 2, name: "White Cheeta", color1: "#F5F5F5", color2: "#D3D3D3" },
    { id: 3, name: "White Pradeso", color1: "#FFFAF0", color2: "#F5DEB3" },
    { id: 4, name: "Golden Tiger", color1: "#DAA520", color2: "#B8860B" },
    { id: 5, name: "Grey Imperial", color1: "#708090", color2: "#2F4F4F" },
    { id: 6, name: "White Fantasy", color1: "#FFFFF0", color2: "#E6E6FA" },
    { id: 7, name: "Sado Pink", color1: "#FFB6C1", color2: "#DB7093" },
    { id: 8, name: "Jebrana", color1: "#8B4513", color2: "#A0522D" },
    { id: 9, name: "Grey Black", color1: "#2F2F2F", color2: "#1a1a1a" },
    { id: 10, name: "Sado Grey", color1: "#696969", color2: "#808080" },
    { id: 11, name: "Premium Black", color1: "#0d0d0d", color2: "#1a1a1a" },
    { id: 12, name: "Sunset Beige", color1: "#F5DEB3", color2: "#DEB887" },
  ];

  const values = [
    { icon: "🎯", title: "Precision", desc: "Every cut is measured to perfection" },
    { icon: "💎", title: "Quality", desc: "Only the finest granite materials" },
    { icon: "🤝", title: "Trust", desc: "Building lasting relationships" },
    { icon: "🚀", title: "Innovation", desc: "Leading with latest technology" },
  ];

  return (
    <div className="about-page">
      {/* Floating Sparkles Background */}
      <div className="sparkles-container">
        {[...Array(20)].map((_, i) => (
          <div 
            key={i} 
            className="sparkle" 
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      {/* Hero Section */}
      <section className="about-hero">
        <div className="hero-background-shapes">
          <div className="floating-stone stone-1"></div>
          <div className="floating-stone stone-2"></div>
          <div className="floating-stone stone-3"></div>
          <div className="geometric-pattern"></div>
        </div>
        
        <div className="hero-container">
          <div className="hero-badge">
            <span className="badge-icon">🏔️</span>
            <span>Since 2009</span>
          </div>
          
          <h1 className="hero-title">
            <span className="title-line">Premium Granite</span>
            <span className="title-line highlight">Processing Excellence</span>
          </h1>
          
          <p className="hero-description">
            Located in Peshawar, our state-of-the-art granite factory specializes in stone cutting and processing
            services. We serve wholesalers and shops with the highest quality finished products, offering a diverse
            range of premium granite varieties.
          </p>

          <div className="hero-cta">
            <Link to="/contact" className="cta-primary">
              Contact Us
              <span className="cta-arrow">→</span>
            </Link>
            <Link to="/products" className="cta-secondary">
              View Products
            </Link>
          </div>
        </div>

        {/* 3D Rotating Stone */}
        <div className="hero-3d-element">
          <div className="rotating-cube">
            <div className="cube-face front"></div>
            <div className="cube-face back"></div>
            <div className="cube-face right"></div>
            <div className="cube-face left"></div>
            <div className="cube-face top"></div>
            <div className="cube-face bottom"></div>
          </div>
        </div>
      </section>

      {/* Animated Stats Section */}
      <section className="stats-section" ref={statsRef}>
        <div className="stats-container">
          <div className="stat-card">
            <div className="stat-icon-wrapper">
              <span className="stat-emoji">📅</span>
              <div className="stat-glow"></div>
            </div>
            <div className="stat-number">{counters.years}+</div>
            <p className="stat-label">Years Experience</p>
            <div className="stat-bar">
              <div className="stat-bar-fill" style={{ width: '100%' }}></div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon-wrapper">
              <span className="stat-emoji">👥</span>
              <div className="stat-glow"></div>
            </div>
            <div className="stat-number">{counters.clients}+</div>
            <p className="stat-label">Happy Clients</p>
            <div className="stat-bar">
              <div className="stat-bar-fill" style={{ width: '85%' }}></div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon-wrapper">
              <span className="stat-emoji">🪨</span>
              <div className="stat-glow"></div>
            </div>
            <div className="stat-number">{counters.varieties}+</div>
            <p className="stat-label">Stone Varieties</p>
            <div className="stat-bar">
              <div className="stat-bar-fill" style={{ width: '75%' }}></div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Values Section */}
      <section className="values-section animate-section" id="values">
        <div className={`values-container ${isVisible["values"] ? "visible" : ""}`}>
          <h2 className="section-title">
            <span className="title-decoration">✦</span>
            Our Core Values
            <span className="title-decoration">✦</span>
          </h2>
          <div className="values-grid">
            {values.map((value, index) => (
              <div 
                key={index} 
                className="value-card"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <div className="value-icon">{value.icon}</div>
                <h3>{value.title}</h3>
                <p>{value.desc}</p>
                <div className="value-shine"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Facilities Section */}
      <section className="facilities-section animate-section" id="facilities">
        <div className={`facilities-container ${isVisible["facilities"] ? "visible" : ""}`}>
          <h2 className="section-title">Our Facilities & Services</h2>
          <p className="section-description">
            We combine cutting-edge technology with expert craftsmanship to deliver premium granite products for your
            projects.
          </p>

          <div className="facilities-grid">
            {facilities.map((facility, index) => (
              <div 
                key={index} 
                className="facility-card"
                style={{ 
                  animationDelay: `${index * 0.2}s`,
                  '--accent-color': facility.color 
                }}
              >
                <div className="facility-icon-wrapper">
                  <span className="facility-icon">{facility.icon}</span>
                  <div className="icon-ring"></div>
                  <div className="icon-ring ring-2"></div>
                </div>
                <h3 className="facility-title">{facility.title}</h3>
                <p className="facility-description">{facility.description}</p>
                <div className="card-gradient"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="products-section animate-section" id="products">
        <div className={`products-container ${isVisible["products"] ? "visible" : ""}`}>
          <h2 className="section-title">Premium Granite Varieties</h2>
          <p className="section-description">
            Explore our extensive collection of premium granite stones, each selected for its unique beauty and
            durability. Perfect for countertops, flooring, and decorative applications.
          </p>

          <div className="products-grid">
            {granites.map((granite, index) => (
              <div
                key={granite.id}
                className="product-card"
                style={{ animationDelay: `${index * 0.08}s` }}
                onMouseEnter={() => setHoveredId(granite.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div
                  className={`product-image ${hoveredId === granite.id ? "hovered" : ""}`}
                  style={{
                    background: `linear-gradient(135deg, ${granite.color1} 0%, ${granite.color2} 100%)`,
                  }}
                >
                  <div className="product-placeholder">🪨</div>
                  <div className="shimmer-effect"></div>
                  <div className={`product-overlay ${hoveredId === granite.id ? "visible" : ""}`}>
                    <span className="view-icon">👁️</span>
                    <p className="overlay-text">View Details</p>
                  </div>
                </div>

                <div className="product-info">
                  <h3 className="product-name">{granite.name}</h3>
                  <p className="product-grade">Premium Grade</p>
                </div>
              </div>
            ))}
          </div>

          <div className="cta-section">
            <div className="cta-content">
              <p className="cta-text">Interested in bulk orders or custom processing?</p>
              <Link to="/request-quote" className="cta-button">
                <span>Request a Quote</span>
                <span className="btn-sparkle">✨</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="process-section">
        <div className="process-container">
          <h2 className="section-title">Our Process</h2>
          <div className="process-timeline">
            <div className="process-step">
              <div className="step-number">01</div>
              <div className="step-content">
                <h3>Quarrying</h3>
                <p>Premium stone extraction from finest quarries</p>
              </div>
              <div className="step-icon">⛏️</div>
            </div>
            <div className="process-connector"></div>
            <div className="process-step">
              <div className="step-number">02</div>
              <div className="step-content">
                <h3>Cutting</h3>
                <p>Precision cutting with advanced machinery</p>
              </div>
              <div className="step-icon">🔪</div>
            </div>
            <div className="process-connector"></div>
            <div className="process-step">
              <div className="step-number">03</div>
              <div className="step-content">
                <h3>Polishing</h3>
                <p>Multi-stage polishing for mirror finish</p>
              </div>
              <div className="step-icon">✨</div>
            </div>
            <div className="process-connector"></div>
            <div className="process-step">
              <div className="step-number">04</div>
              <div className="step-content">
                <h3>Delivery</h3>
                <p>Safe packaging and timely delivery</p>
              </div>
              <div className="step-icon">🚚</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
