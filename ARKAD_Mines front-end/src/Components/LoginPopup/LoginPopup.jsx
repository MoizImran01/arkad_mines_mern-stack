import React, { useContext, useState, useRef } from 'react'
import PropTypes from 'prop-types';
import './LoginPopup.css'
import crossicon from '../../assets/cross_icon.png'
import axios from "axios";
import { StoreContext } from '../../context/StoreContext';
import ReCAPTCHA from "react-google-recaptcha";

const RECAPTCHA_SITE_KEY = "6LfIkB0sAAAAANTjmfzZnffj2xE1POMF-Tnl3jYC";

const LoginPopup = ({ setShowLogin }) => {
    
    const [currentState, setCurrentState] = useState("Login")
 
    const [isLoading, setIsLoading] = useState(false)
 
    const [error, setError] = useState("")
    const [captchaToken, setCaptchaToken] = useState(null)
    const recaptchaRef = useRef(null)

    const { setToken } = useContext(StoreContext)
    

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: ""
    })


    const url = import.meta.env.VITE_API_URL || "http://localhost:4000"


    const handleInputChange = (event) => {
        const { name, value } = event.target
        setFormData(prevData => ({ ...prevData, [name]: value }))

        if (error) setError("")
    }

    // Handle CAPTCHA completion
    const handleCaptchaChange = (token) => {
        setCaptchaToken(token)
        if (error) setError("")
    }

    // Handle CAPTCHA expiration
    const handleCaptchaExpired = () => {
        setCaptchaToken(null)
    }


const handleSubmit = async (event) => {
    event.preventDefault();

    // Check if CAPTCHA is completed
    if (!captchaToken) {
      setError("Please complete the CAPTCHA verification.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const endpoint = currentState === "Login" ? "/api/user/login" : "/api/user/register";

      // Include CAPTCHA token with the request
      const response = await axios.post(`${url}${endpoint}`, {
        ...formData,
        captchaToken
      });

      if (response.data.success) {
        const { token, user } = response.data;

        setToken(token);
        localStorage.setItem("token", token);
        localStorage.setItem("userRole", user.role);

      if (user.role === "admin") {
        window.location.href = import.meta.env.VITE_ADMIN_URL || "http://localhost:5174"; 
      } else {
          window.location.href = "/";
        }

        setShowLogin(false);
        setFormData({ name: "", email: "", password: "" });
      } else {
        setError(response.data.message || "An error occurred");
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
      }
    } catch (err) { 
      console.error("Authentication error:", err);
      const errorMessage = 
        err.response?.data?.error || 
        err.response?.data?.message || 
        err.response?.statusText || 
        "Network error. Please try again.";


      setError(errorMessage);

      recaptchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setIsLoading(false);
    }
  };


    const toggleState = () => {
        setCurrentState(prev => prev === "Login" ? "Sign Up" : "Login")

        setError("")
        setFormData({ name: "", email: "", password: "" })
        // Reset CAPTCHA when switching between login and signup
        recaptchaRef.current?.reset()
        setCaptchaToken(null)
    }

    return (

        <div 
            className='login-overlay' 
            role="dialog"
            aria-modal="true"
        >
            <button 
                type="button"
                className="modal-backdrop-btn" 
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
                onClick={() => setShowLogin(false)}
                aria-label="Close login modal"
            />

            <div className='login-modal' role="document">

                <form onSubmit={handleSubmit} className='login-form'>

                    <div className="modal-header">
                        <div className="header-content">
                            <h2 className="modal-title">

                                {currentState === "Login" ? "Client Portal Login" : "Create Business Account"}
                            </h2>
                            <p className="modal-subtitle">
                                {currentState === "Login" 
                                    ? "Access your business dashboard" 
                                    : "Register your company account"
                                }
                            </p>
                        </div>

                        <button 
                            type="button" 
                            className="close-btn"
                            onClick={() => setShowLogin(false)}
                            aria-label="Close login modal"
                        >
                            <img className='cross-icon' src={crossicon} alt="Close" />
                        </button>
                    </div>

                    {error && (
                        <div className="error-message">
                            <span className="error-icon">⚠</span>
                            {error}
                        </div>
                    )}

                <div className="form-inputs">
                {currentState === "Sign Up" && (
                    <div className="input-group">
                    <label htmlFor="companyName">Company Name</label>
                    <input 
                        id="companyName"
                        name="companyName" 
                        onChange={handleInputChange} 
                        value={formData.companyName} 
                        type="text" 
                        placeholder="Enter your company name" 
                        required
                        disabled={isLoading}
                    />
                    </div>
                )}
                
                <div className="input-group">
                    <label htmlFor="email">Business Email</label>
                    <input 
                    id="email"
                    name="email" 
                    onChange={handleInputChange} 
                    value={formData.email} 
                    type="email" 
                    placeholder="your.company@email.com" 
                    required
                    disabled={isLoading}
                    />
                </div>

                <div className="input-group">
                    <label htmlFor="password">Password</label>
                    <input 
                    id="password"
                    name="password" 
                    onChange={handleInputChange} 
                    value={formData.password} 
                    type="password" 
                    placeholder="Enter your password (min. 8 characters)" 
                    required
                    disabled={isLoading}
                    minLength="8"
                    />
                </div>
                </div>

                    <div className="captcha-container">
                        <ReCAPTCHA
                            ref={recaptchaRef}
                            sitekey={RECAPTCHA_SITE_KEY}
                            onChange={handleCaptchaChange}
                            onExpired={handleCaptchaExpired}
                            theme="light"
                        />
                    </div>

                    <button 
                        type='submit' 
                        className={`submit-btn ${isLoading ? 'loading' : ''}`}
                        disabled={isLoading || !captchaToken}
                    >

                        {isLoading ? (
                            <div className="spinner"></div>
                        ) : (
                            currentState === "Sign Up" ? "Create Business Account" : "Login to Dashboard"
                        )}
                    </button>

                    <div className="form-footer">
                        <div className="terms-agreement">
                            <input 
                                type='checkbox' 
                                id="terms"
                                required 
                                disabled={isLoading}
                            />
                            <label htmlFor="terms">
                                I agree to the <a href="/terms" target="_blank">Terms of Use</a> and <a href="/privacy" target="_blank">Privacy Policy</a>
                            </label>
                        </div>
                        
                        <div className="state-toggle">
                            {currentState === "Login" ? (
                                <p>Don't have a business account? <button type="button" onClick={toggleState}>Register here</button></p>
                            ) : (
                                <p>Already have an account? <button type="button" onClick={toggleState}>Login here</button></p>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}

LoginPopup.propTypes = {
  setShowLogin: PropTypes.func.isRequired,
};

export default LoginPopup