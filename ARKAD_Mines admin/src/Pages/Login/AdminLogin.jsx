import React, { useState, useContext, useRef } from 'react';
import './AdminLogin.css';
import { assets } from '../../assets/assets';
import axios from "axios";
import { AdminAuthContext } from '../../context/AdminAuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReCAPTCHA from "react-google-recaptcha";

const RECAPTCHA_SITE_KEY = "6LfIkB0sAAAAANTjmfzZnffj2xE1POMF-Tnl3jYC";

const AdminLogin = () => {

  const [isLoading, setIsLoading] = useState(false);
  

  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState(null);
  const recaptchaRef = useRef(null);
  

  const { setToken, setAdminUser, url } = useContext(AdminAuthContext);
  const navigate = useNavigate();
  

  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  // Handle CAPTCHA completion
  const handleCaptchaChange = (token) => {
    setCaptchaToken(token);
    if (error) setError("");
  };

  // Handle CAPTCHA expiration
  const handleCaptchaExpired = () => {
    setCaptchaToken(null);
  };


  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData(prevData => ({ ...prevData, [name]: value }));

    if (error) setError("");
  };

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
      const response = await axios.post(`${url}/api/user/login`, {
        ...formData,
        captchaToken
      });


      if (response.data.success) {
        const { token, user } = response.data;
        

        if (user.role !== "admin") {
          setError("Access denied. Only administrators can access this portal.");
          setIsLoading(false);
          // Reset CAPTCHA on error
          recaptchaRef.current?.reset();
          setCaptchaToken(null);
          return;
        }

        setToken(token);
        setAdminUser(user);
        localStorage.setItem("adminToken", token);
        localStorage.setItem("adminUserData", JSON.stringify(user));


        toast.success("Welcome back, Admin!");


        navigate("/add");
      } else {

        setError(response.data.message || "An error occurred");
        // Reset CAPTCHA on error
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
      }
    } catch (error) {

      console.error("Authentication error:", error);
      setError(error.response?.data?.message || "Network error. Please try again.");
      // Reset CAPTCHA on error
      recaptchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {

      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="login-header">
          <img src={assets.logo} alt="ARKAD Mines Logo" className="login-logo" />
          <h1 className="login-title">Admin Portal</h1>
          <p className="login-subtitle">Sign in to access the admin dashboard</p>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="form-inputs">
            <div className="input-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="admin@arkadmines.com"
                onChange={handleInputChange}
                value={formData.email}
                required
                disabled={isLoading}
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                onChange={handleInputChange}
                value={formData.password}
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
            type="submit"
            className={`submit-btn ${isLoading ? 'loading' : ''}`}
            disabled={isLoading || !captchaToken}
          >
            {isLoading ? (
              <div className="spinner"></div>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="login-footer">
          <p className="security-note">
            <span className="lock-icon">🔒</span>{' '}
            This portal is restricted to authorized administrators only
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;

