"use client";

import { useState, useEffect, useRef } from "react";
import "./AboutUs.css";
import { Link } from "react-router-dom";
import { Mountain, Award, Users, Layers, Sparkles, Target, Shield, Zap, Scissors, Truck, ChevronRight } from "lucide-react";

export default function AboutUs() {
  const [hoveredId, setHoveredId] = useState(null);
  const [isVisible, setIsVisible] = useState({});
  const [counters, setCounters] = useState({ years: 0, clients: 0, varieties: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const statsRef = useRef(null);
  const heroRef = useRef(null);

  // Mouse parallax for hero
  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 30;
      const y = (e.clientY / window.innerHeight - 0.5) * 30;
      setMousePos({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
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

  const granites = [
    { id: 1, name: "Chatral", color1: "#8B7355", color2: "#A0522D", origin: "Pakistan" },
    { id: 2, name: "White Cheeta", color1: "#F5F5F5", color2: "#D3D3D3", origin: "Pakistan" },
    { id: 3, name: "White Pradeso", color1: "#FFFAF0", color2: "#F5DEB3", origin: "Pakistan" },
    { id: 4, name: "Golden Tiger", color1: "#DAA520", color2: "#B8860B", origin: "Pakistan" },
    { id: 5, name: "Grey Imperial", color1: "#708090", color2: "#2F4F4F", origin: "Pakistan" },
    { id: 6, name: "White Fantasy", color1: "#FFFFF0", color2: "#E6E6FA", origin: "Pakistan" },
    { id: 7, name: "Sado Pink", color1: "#FFB6C1", color2: "#DB7093", origin: "Pakistan" },
    { id: 8, name: "Jebrana", color1: "#8B4513", color2: "#A0522D", origin: "Pakistan" },
    { id: 9, name: "Grey Black", color1: "#2F2F2F", color2: "#1a1a1a", origin: "Pakistan" },
    { id: 10, name: "Sado Grey", color1: "#696969", color2: "#808080", origin: "Pakistan" },
    { id: 11, name: "Premium Black", color1: "#0d0d0d", color2: "#1a1a1a", origin: "Pakistan" },
    { id: 12, name: "Sunset Beige", color1: "#F5DEB3", color2: "#DEB887", origin: "Pakistan" },
  ];

  const values = [
    { icon: <Target size={28} />, title: "Precision", desc: "Every cut measured to perfection" },
    { icon: <Award size={28} />, title: "Quality", desc: "Only the finest granite materials" },
    { icon: <Shield size={28} />, title: "Trust", desc: "Building lasting relationships" },
    { icon: <Zap size={28} />, title: "Innovation", desc: "Leading with latest technology" },
  ];

  const process = [
    { step: "01", title: "Quarrying", desc: "Premium stone extraction", icon: <Mountain size={24} /> },
    { step: "02", title: "Cutting", desc: "Precision machinery", icon: <Scissors size={24} /> },
    { step: "03", title: "Polishing", desc: "Mirror-like finish", icon: <Sparkles size={24} /> },
    { step: "04", title: "Delivery", desc: "Safe & timely", icon: <Truck size={24} /> },
  ];

  return (
    <div className="about-page-new">
      {/* Hero Section */}
      <section className="hero-section-new" ref={heroRef}>
        <div className="hero-bg-layers">
          <div className="bg-gradient-layer"></div>
          <div className="bg-pattern-layer"></div>
          <div 
            className="bg-floating-shapes"
            style={{
              transform: `translate(${mousePos.x * 0.5}px, ${mousePos.y * 0.5}px)`
            }}
          >
            <div className="floating-shape shape-1"></div>
            <div className="floating-shape shape-2"></div>
            <div className="floating-shape shape-3"></div>
          </div>
        </div>

        <div className="hero-content-new">
          <div className="hero-text-side">
            <div className="hero-badge-new">
              <Mountain size={16} />
              <span>Established 2009</span>
            </div>
            
            <h1 className="hero-title-new">
              <span className="title-line-new">Crafting</span>
              <span className="title-line-new title-accent">Excellence</span>
              <span className="title-line-new">in Stone</span>
            </h1>
            
            <p className="hero-desc-new">
              From the heart of Peshawar, we deliver premium granite processing services 
              with state-of-the-art technology and masterful craftsmanship. Trusted by 
              wholesalers and retailers across Pakistan.
            </p>

            <div className="hero-buttons-new">
              <Link to="/products" className="btn-primary-new">
                Explore Collection
                <ChevronRight size={18} />
              </Link>
              <Link to="/contact" className="btn-secondary-new">
                Get in Touch
              </Link>
            </div>
          </div>

          <div className="hero-visual-side">
            <div className="cube-scene">
              {/* 3D Rotating Granite Cube */}
              <div className="granite-cube">
                <div className="cube-face cube-front"></div>
                <div className="cube-face cube-back"></div>
                <div className="cube-face cube-right"></div>
                <div className="cube-face cube-left"></div>
                <div className="cube-face cube-top"></div>
                <div className="cube-face cube-bottom"></div>
              </div>
              
              {/* Golden Sparkles Orbiting */}
              <div className="sparkle-orbit">
                <div className="golden-sparkle sparkle-1"></div>
                <div className="golden-sparkle sparkle-2"></div>
                <div className="golden-sparkle sparkle-3"></div>
                <div className="golden-sparkle sparkle-4"></div>
                <div className="golden-sparkle sparkle-5"></div>
                <div className="golden-sparkle sparkle-6"></div>
                <div className="golden-sparkle sparkle-7"></div>
                <div className="golden-sparkle sparkle-8"></div>
              </div>
              
              {/* Secondary orbit */}
              <div className="sparkle-orbit-2">
                <div className="golden-sparkle sparkle-a"></div>
                <div className="golden-sparkle sparkle-b"></div>
                <div className="golden-sparkle sparkle-c"></div>
                <div className="golden-sparkle sparkle-d"></div>
              </div>
              
              {/* Glow effect */}
              <div className="cube-glow"></div>
            </div>
          </div>
        </div>

        {/* Wave transition */}
        <div className="hero-wave">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,60 C360,120 720,0 1080,60 C1260,90 1380,90 1440,60 L1440,120 L0,120 Z" fill="#f9fafb"/>
          </svg>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section-new" ref={statsRef}>
        <div className="stats-container-new">
          <div className="stat-card-new">
            <div className="stat-icon-new">
              <Award size={32} />
            </div>
            <div className="stat-content-new">
              <span className="stat-number-new">{counters.years}+</span>
              <span className="stat-label-new">Years of Excellence</span>
            </div>
            <div className="stat-bar-new"><div className="stat-fill" style={{width: '100%'}}></div></div>
          </div>
          
          <div className="stat-card-new">
            <div className="stat-icon-new">
              <Users size={32} />
            </div>
            <div className="stat-content-new">
              <span className="stat-number-new">{counters.clients}+</span>
              <span className="stat-label-new">Satisfied Clients</span>
            </div>
            <div className="stat-bar-new"><div className="stat-fill" style={{width: '85%'}}></div></div>
          </div>
          
          <div className="stat-card-new highlight-stat">
            <div className="stat-icon-new">
              <Layers size={32} />
            </div>
            <div className="stat-content-new">
              <span className="stat-number-new">{counters.varieties}</span>
              <span className="stat-label-new">Stone Categories</span>
            </div>
            <div className="stat-bar-new"><div className="stat-fill" style={{width: '75%'}}></div></div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="values-section-new animate-section" id="values">
        <div className={`values-wrapper ${isVisible["values"] ? "visible" : ""}`}>
          <div className="section-header-new">
            <span className="section-tag">Our Philosophy</span>
            <h2 className="section-title-new">Core Values That Drive Us</h2>
            <p className="section-desc-new">Built on principles that ensure exceptional quality and service</p>
          </div>
          
          <div className="values-grid-new">
            {values.map((value) => (
              <div 
                key={value.title} 
                className="value-card-new"
              >
                <div className="value-icon-new">{value.icon}</div>
                <h3>{value.title}</h3>
                <p>{value.desc}</p>
                <div className="value-line"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wave transition */}
      <div className="wave-divider">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,40 C240,100 480,0 720,60 C960,120 1200,40 1440,80 L1440,120 L0,120 Z" fill="#ffffff"/>
        </svg>
      </div>

      {/* Products Showcase */}
      <section className="products-section-new animate-section" id="products">
        <div className={`products-wrapper ${isVisible["products"] ? "visible" : ""}`}>
          <div className="section-header-new">
            <span className="section-tag">Our Collection</span>
            <h2 className="section-title-new">12 Premium Granite Varieties</h2>
            <p className="section-desc-new">Handpicked selection of the finest stones from Pakistani quarries</p>
          </div>

          <div className="products-showcase">
            {granites.map((granite) => (
              <div
                key={granite.id}
                className={`product-tile ${hoveredId === granite.id ? 'active' : ''}`}
                onMouseEnter={() => setHoveredId(granite.id)}
                onMouseLeave={() => setHoveredId(null)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setHoveredId(granite.id)}
              >
                <div 
                  className="tile-visual"
                  style={{
                    background: `linear-gradient(145deg, ${granite.color1} 0%, ${granite.color2} 100%)`
                  }}
                >
                  <div className="tile-shine"></div>
                  <div className="tile-overlay">
                    <span className="tile-number">{String(granite.id).padStart(2, '0')}</span>
                  </div>
                </div>
                <div className="tile-info">
                  <h4>{granite.name}</h4>
                  <span>Premium Grade</span>
                </div>
              </div>
            ))}
          </div>

          <div className="products-cta-new">
            <Link to="/products" className="btn-view-all">
              View Full Catalog
              <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="process-section-new">
        {/* Animated Wave Top */}
        <div className="process-wave-animated">
          <svg viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="#ffffff">
              <animate
                attributeName="d"
                dur="8s"
                repeatCount="indefinite"
                values="
                  M0,60 C480,120 960,0 1440,60 C1920,120 2400,0 2880,60 L2880,120 L0,120 Z;
                  M0,90 C480,30 960,120 1440,60 C1920,0 2400,120 2880,60 L2880,120 L0,120 Z;
                  M0,60 C480,120 960,0 1440,60 C1920,120 2400,0 2880,60 L2880,120 L0,120 Z
                "
              />
            </path>
          </svg>
        </div>
        
        <div className="process-wrapper">
          <div className="section-header-new light">
            <span className="section-tag">How We Work</span>
            <h2 className="section-title-new">Our Process</h2>
            <p className="section-desc-new">From quarry to delivery, every step is precision-crafted</p>
          </div>

          <div className="process-timeline-new">
            {process.map((item) => (
              <div key={item.step} className="process-item-new">
                <div className="process-icon-new">{item.icon}</div>
                <div className="process-number-new">{item.step}</div>
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
                {item.step !== "04" && <div className="process-connector-new"></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section-new">
        {/* Animated Wave Top */}
        <div className="cta-wave-animated">
          <svg viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="#111827">
              <animate
                attributeName="d"
                dur="10s"
                repeatCount="indefinite"
                values="
                  M0,80 C480,20 960,100 1440,50 C1920,0 2400,80 2880,40 L2880,120 L0,120 Z;
                  M0,40 C480,100 960,20 1440,70 C1920,120 2400,40 2880,80 L2880,120 L0,120 Z;
                  M0,80 C480,20 960,100 1440,50 C1920,0 2400,80 2880,40 L2880,120 L0,120 Z
                "
              />
            </path>
          </svg>
        </div>
        
        <div className="cta-content-new">
          <h2>Ready to Transform Your Space?</h2>
          <p>Get premium quality granite at competitive prices. Request a personalized quote today.</p>
          <div className="cta-buttons-new">
            <Link to="/request-quote" className="cta-btn-primary">
              Request a Quote
            </Link>
            <Link to="/contact" className="cta-btn-secondary">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
