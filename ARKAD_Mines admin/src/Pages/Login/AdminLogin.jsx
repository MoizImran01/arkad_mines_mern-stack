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
  const [successMsg, setSuccessMsg] = useState("");
  const [captchaToken, setCaptchaToken] = useState(null);
  const recaptchaRef = useRef(null);

  const [resetStep, setResetStep] = useState(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { setToken, setAdminUser, url } = useContext(AdminAuthContext);
  const navigate = useNavigate();

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
    setIsLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      if (resetStep === "email") {
        const response = await axios.post(`${url}/api/user/forgot-password`, { email: resetEmail });
        if (response.data.success) {
          setSuccessMsg("A 6-digit reset code has been sent to your email.");
          setResetStep("code");
        } else {
          setError(response.data.message);
        }
      } else if (resetStep === "code") {
        const response = await axios.post(`${url}/api/user/reset-password`, {
          email: resetEmail,
          code: resetCode,
          newPassword,
          confirmPassword,
        });
        if (response.data.success) {
          setSuccessMsg("Password reset successful! Redirecting to login...");
          const emailForLogin = resetEmail;
          const passForLogin = newPassword;
          setTimeout(() => {
            setResetStep(null);
            setResetEmail("");
            setResetCode("");
            setNewPassword("");
            setConfirmPassword("");
            setSuccessMsg("");
            setFormData({ email: emailForLogin, password: passForLogin });
          }, 2000);
        } else {
          setError(response.data.message);
        }
      }
    } catch (err) {
      if (err.response?.data?.notFound) {
        setError("No admin account found with this email address. Please contact your system administrator.");
      } else {
        setError(err.response?.data?.message || "Network error. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const openForgotPassword = () => {
    setResetStep("email");
    setError("");
    setSuccessMsg("");
    setResetEmail("");
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const backToLogin = () => {
    setResetStep(null);
    setError("");
    setSuccessMsg("");
  };

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

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠</span>
              {error}
            </div>
          )}

          {successMsg && (
            <div className="success-message">
              <span className="success-icon">&#10003;</span>
              {successMsg}
            </div>
          )}

          <form onSubmit={handleForgotSubmit} className="admin-login-form">
            <div className="form-inputs">
              {resetStep === "email" && (
                <div className="input-group">
                  <label htmlFor="reset-email">Email Address</label>
                  <input
                    id="reset-email"
                    type="email"
                    placeholder="admin@arkadmines.com"
                    value={resetEmail}
                    onChange={(e) => { setResetEmail(e.target.value); setError(""); }}
                    required
                    disabled={isLoading}
                  />
                </div>
              )}

              {resetStep === "code" && (
                <>
                  <div className="input-group">
                    <label htmlFor="reset-code">6-Digit Code</label>
                    <input
                      id="reset-code"
                      type="text"
                      placeholder="Enter the code from your email"
                      value={resetCode}
                      onChange={(e) => { setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(""); }}
                      required
                      disabled={isLoading}
                      maxLength={6}
                      pattern="\d{6}"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="input-group">
                    <label htmlFor="new-password">New Password</label>
                    <input
                      id="new-password"
                      type="password"
                      placeholder="Min. 8 characters"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                      required
                      disabled={isLoading}
                      minLength={8}
                    />
                  </div>
                  <div className="input-group">
                    <label htmlFor="confirm-password">Confirm Password</label>
                    <input
                      id="confirm-password"
                      type="password"
                      placeholder="Re-enter your new password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                      required
                      disabled={isLoading}
                      minLength={8}
                    />
                  </div>
                </>
              )}
            </div>

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

