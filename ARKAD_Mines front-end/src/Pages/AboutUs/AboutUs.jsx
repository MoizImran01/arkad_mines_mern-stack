"use client";

import { useMemo, useState } from "react";
import "./AboutUs.css";

export default function AboutUs() {
 
  const [hoveredId, setHoveredId] = useState(null);

  const facilities = [
    {
      title: "Advanced Cutting Equipment",
      description:
        "State-of-the-art precision cutting machines imported from Europe. Our equipment ensures perfect edges and dimensions for every stone slab.",
      icon: "⚙️",
    },
    {
      title: "Quality Polishing",
      description:
        "Multi-stage polishing process delivers mirror-like finishes. Premium abrasives and skilled craftsmen ensure the highest quality output.",
      icon: "✨",
    },
    {
      title: "Wholesale & Distribution",
      description:
        "Direct supply to shops and wholesalers across Pakistan. Competitive pricing with reliable delivery and excellent customer support.",
      icon: "📦",
    },
  ];

  const granites = [
    { id: 1, name: "Chatral" },
    { id: 2, name: "White Cheeta" },
    { id: 3, name: "White Pradeso" },
    { id: 4, name: "Golden Tiger" },
    { id: 5, name: "Grey Imperial" },
    { id: 6, name: "White Fantasy" },
    { id: 7, name: "Sado Pink" },
    { id: 8, name: "Jebrana" },
    { id: 9, name: "Grey Black" },
    { id: 10, name: "Sado Grey" },
    { id: 11, name: "Premium Black" },
    { id: 12, name: "Sunset Beige" },
  ];


  const graniteColors = useMemo(() => {
    const rand = () =>
      Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
    return Object.fromEntries(
      granites.map(g => [g.id, [rand(), rand()]])
    );
  }, []); 

  return (
    <>


      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">Premium Granite Processing</h1>
            <p className="hero-description">
              Located in Peshawar, our state-of-the-art granite factory specializes in stone cutting and processing
              services. We serve wholesalers and shops with the highest quality finished products, offering a diverse
              range of premium granite varieties.
            </p>
          </div>

          {/* Company Stats */}
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-number">15+</div>
              <p className="stat-label">Years Experience</p>
            </div>
            <div className="stat-item">
              <div className="stat-number">500+</div>
              <p className="stat-label">Regular Clients</p>
            </div>
            <div className="stat-item">
              <div className="stat-number">12+</div>
              <p className="stat-label">Stone Varieties</p>
            </div>
          </div>
        </div>
      </section>

      {/* Facilities Section */}
      <section className="facilities-section">
        <div className="facilities-container">
          <h2 className="section-title">Our Facilities & Services</h2>
          <p className="section-description">
            We combine cutting-edge technology with expert craftsmanship to deliver premium granite products for your
            projects.
          </p>

          <div className="facilities-grid">
            {facilities.map((facility, index) => (
              <div key={index} className="facility-card">
                <div className="facility-icon">{facility.icon}</div>
                <h3 className="facility-title">{facility.title}</h3>
                <p className="facility-description">{facility.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="products-section">
        <div className="products-container">
          <h2 className="section-title">Premium Granite Varieties</h2>
          <p className="section-description">
            Explore our extensive collection of premium granite stones, each selected for its unique beauty and
            durability. Perfect for countertops, flooring, and decorative applications.
          </p>

          <div className="products-grid">
            {granites.map((granite) => {
              const [c1, c2] = graniteColors[granite.id] || ["667eea", "764ba2"];
              return (
                <div
                  key={granite.id}
                  className="product-card"
                  onMouseEnter={() => setHoveredId(granite.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div
                    className={`product-image ${hoveredId === granite.id ? "hovered" : ""}`}
                    style={{
                      backgroundImage: `linear-gradient(135deg, #${c1} 0%, #${c2} 100%)`,
                    }}
                  >
                    <div className="product-placeholder">🪨</div>
                    <div className={`product-overlay ${hoveredId === granite.id ? "visible" : ""}`}>
                      <p className="overlay-text">Click to view</p>
                    </div>
                  </div>

                  <div className="product-info">
                    <h3 className="product-name">{granite.name}</h3>
                    <p className="product-grade">Premium Grade Granite</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cta-section">
            <p className="cta-text">Interested in bulk orders or custom processing?</p>
            <button className="cta-button">Request a Quote</button>
          </div>
        </div>
      </section>
    </>
  );
}