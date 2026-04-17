import React, { useState, useContext, useRef } from 'react';
import './AdminLogin.css';
import { assets } from '../../assets/assets';
import axios from "axios";
import { AdminAuthContext } from '../../context/AdminAuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReCAPTCHA from "react-google-recaptcha";
import usePasswordReset from '../../../../shared/usePasswordReset';
import ResetFormFields, { StatusMessages } from '../../../../shared/ResetFormFields';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6LfIkB0sAAAAANTjmfzZnffj2xE1POMF-Tnl3jYC";

const AdminLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [captchaToken, setCaptchaToken] = useState(null);
  const recaptchaRef = useRef(null);

  const { setToken, setAdminUser, url } = useContext(AdminAuthContext);
  const navigate = useNavigate();

  const {
    resetStep, resetEmail, setResetEmail, resetCode, setResetCode,
    newPassword, setNewPassword, confirmPassword, setConfirmPassword,
    openForgotPassword: openReset, backToLogin: backReset, submitForgotPassword,
  } = usePasswordReset(url);

  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  const handleCaptchaChange = (token) => {
    setCaptchaToken(token);
    if (error) setError("");
  };

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
          recaptchaRef.current?.reset();
          setCaptchaToken(null);
          return;
        }
        setToken(token);
        setAdminUser(user);
        localStorage.setItem("adminToken", token);
        localStorage.setItem("adminUserData", JSON.stringify(user));
        toast.success("Welcome back, Admin!");
        navigate("/dashboard");
      } else {
        setError(response.data.message || "An error occurred");
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Network error. Please try again.");
      recaptchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (event) => {
    event.preventDefault();
    await submitForgotPassword({
      setIsLoading, setError, setSuccessMsg,
      onNotFound: () => setError("No admin account found with this email address. Please contact your system administrator."),
      onResetSuccess: (email, pass) => setFormData({ email, password: pass }),
    });
  };

  const openForgotPassword = () => openReset(setError, setSuccessMsg);
  const backToLogin = () => backReset(setError, setSuccessMsg);

  if (resetStep) {
    return (
      <div className="admin-login-container">
        <div className="admin-login-card">
          <div className="login-header">
            <img src={assets.logo} alt="ARKAD Mines Logo" className="login-logo" />
            <h1 className="login-title">
              {resetStep === "email" ? "Forgot Password" : "Reset Password"}
            </h1>
            <p className="login-subtitle">
              {resetStep === "email"
                ? "Enter your admin email to receive a reset code"
                : "Enter the code and your new password"}
            </p>
          </div>

          <StatusMessages error={error} successMsg={successMsg} />

          <form onSubmit={handleForgotSubmit} className="admin-login-form">
            <ResetFormFields
              resetStep={resetStep} isLoading={isLoading}
              resetEmail={resetEmail} setResetEmail={setResetEmail}
              resetCode={resetCode} setResetCode={setResetCode}
              newPassword={newPassword} setNewPassword={setNewPassword}
              confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
              clearError={() => setError("")}
              emailLabel="Email Address"
              emailPlaceholder="admin@arkadmines.com"
            />

            <button
              type="submit"
              className={`submit-btn ${isLoading ? 'loading' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="spinner"></div>
              ) : (
                resetStep === "email" ? "Send Reset Code" : "Reset Password"
              )}
            </button>
          </form>

          <div className="login-footer">
            <p className="back-to-login">
              <button type="button" onClick={backToLogin}>Back to Login</button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="login-header">
          <img src={assets.logo} alt="ARKAD Mines Logo" className="login-logo" />
          <h1 className="login-title">Admin Portal</h1>
          <p className="login-subtitle">Sign in to access the admin dashboard</p>
        </div>

        <StatusMessages error={error} successMsg={null} />

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

            <div className="forgot-password-link">
              <button type="button" onClick={openForgotPassword}>Forgot your password?</button>
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
            <span className="lock-icon">&#128274;</span>{' '}
            This portal is restricted to authorized administrators only
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;

