"use client"

import { Link } from "react-router-dom"
import logoimg from "../../assets/logo.png"
import "./ContactUs.css"

export default function ContactUs() {
  const contactInfo = [
    {
      icon: "📍",
      title: "Address",
      placeholder: "[Your Address Here]",
    },
    {
      icon: "📞",
      title: "Phone",
      placeholder: "[Your Phone Number Here]",
    },
    {
      icon: "✉️",
      title: "Email",
      placeholder: "[Your Email Here]",
    },
    {
      icon: "⏰",
      title: "Business Hours",
      placeholder: "[Your Business Hours Here]",
    },
  ]

  return (
    <>
   

      {/* Hero Section */}
      <section className="contact-hero">
        <div className="contact-hero-content">
          <h1 className="contact-hero-title">Get In Touch</h1>
          <p className="contact-hero-subtitle">
            Reach out to us with any inquiries about our granite processing services.
          </p>
        </div>
        <div className="hero-animation">
          <div className="animated-shape shape-1"></div>
          <div className="animated-shape shape-2"></div>
          <div className="animated-shape shape-3"></div>
        </div>
      </section>

      {/* Contact Information Cards */}
      <section className="contact-info-section">
        <div className="contact-info-container">
          <h2 className="section-title">Contact Information</h2>
          <div className="contact-info-grid">
            {contactInfo.map((info, index) => (
              <div key={index} className="contact-info-card" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="info-icon">{info.icon}</div>
                <h3 className="info-title">{info.title}</h3>
                <p className="info-content">{info.placeholder}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
