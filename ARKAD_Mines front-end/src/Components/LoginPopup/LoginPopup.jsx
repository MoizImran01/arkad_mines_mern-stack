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
    const [successMsg, setSuccessMsg] = useState("")
    const [captchaToken, setCaptchaToken] = useState(null)
    const recaptchaRef = useRef(null)

    const [resetStep, setResetStep] = useState(null)
    const [resetEmail, setResetEmail] = useState("")
    const [resetCode, setResetCode] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")

    const { setToken } = useContext(StoreContext)

    const [formData, setFormData] = useState({
        companyName: "",
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

    const handleCaptchaChange = (token) => {
        setCaptchaToken(token)
        if (error) setError("")
    }

    const handleCaptchaExpired = () => {
        setCaptchaToken(null)
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!captchaToken) {
            setError("Please complete the CAPTCHA verification.");
            return;
        }
        setIsLoading(true);
        setError("");
        try {
            const endpoint = currentState === "Login" ? "/api/user/login" : "/api/user/register";
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
                    globalThis.location.href = import.meta.env.VITE_ADMIN_URL || "http://localhost:5174";
                } else {
                    globalThis.location.href = "/";
                }
                setShowLogin(false);
                setFormData({ companyName: "", name: "", email: "", password: "" });
            } else {
                setError(response.data.message || "An error occurred");
                recaptchaRef.current?.reset();
                setCaptchaToken(null);
            }
        } catch (err) {
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
                    setSuccessMsg(response.data.message);
                    setTimeout(() => {
                        setResetStep(null);
                        setResetEmail("");
                        setResetCode("");
                        setNewPassword("");
                        setConfirmPassword("");
                        setSuccessMsg("");
                        setCurrentState("Login");
                    }, 2000);
                } else {
                    setError(response.data.message);
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || "Network error. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleState = () => {
        setCurrentState(prev => prev === "Login" ? "Sign Up" : "Login")
        setError("")
        setSuccessMsg("")
        setFormData({ companyName: "", name: "", email: "", password: "" })
        recaptchaRef.current?.reset()
        setCaptchaToken(null)
        setResetStep(null)
    }

    const openForgotPassword = () => {
        setResetStep("email");
        setError("");
        setSuccessMsg("");
        setResetEmail("");
        setResetCode("");
        setNewPassword("");
        setConfirmPassword("");
    }

    const backToLogin = () => {
        setResetStep(null);
        setError("");
        setSuccessMsg("");
    }

    const submitButtonLabel = currentState === "Sign Up" ? "Create Business Account" : "Login to Dashboard";

    if (resetStep) {
        return (
            <dialog open className="login-overlay" aria-modal="true">
                <button type="button" className="login-backdrop" onClick={() => setShowLogin(false)} aria-label="Close" />
                <div className="login-modal">
                    <form onSubmit={handleForgotSubmit} className="login-form">
                        <div className="modal-header">
                            <div className="header-content">
                                <h2 className="modal-title">
                                    {resetStep === "email" ? "Forgot Password" : "Reset Password"}
                                </h2>
                                <p className="modal-subtitle">
                                    {resetStep === "email"
                                        ? "Enter your email to receive a reset code"
                                        : "Enter the code and your new password"}
                                </p>
                            </div>
                            <button type="button" className="close-btn" onClick={() => setShowLogin(false)} aria-label="Close">
                                <img className='cross-icon' src={crossicon} alt="Close" />
                            </button>
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

                        <div className="form-inputs">
                            {resetStep === "email" && (
                                <div className="input-group">
                                    <label htmlFor="reset-email">Business Email</label>
                                    <input
                                        id="reset-email"
                                        type="email"
                                        placeholder="your.company@email.com"
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
                            className={`submit-btn ${isLoading ? 'submitting' : ''}`}
                            disabled={isLoading}
                            style={{ height: '52px', minHeight: '52px', maxHeight: '52px' }}
                        >
                            <span className={`submit-btn-text ${isLoading ? 'hidden' : ''}`}>
                                {resetStep === "email" ? "Send Reset Code" : "Reset Password"}
                            </span>
                            {isLoading && <span className="submit-spinner" aria-hidden="true"></span>}
                        </button>

                        <div className="form-footer">
                            <div className="state-toggle">
                                <p><button type="button" onClick={backToLogin}>Back to Login</button></p>
                            </div>
                        </div>
                    </form>
                </div>
            </dialog>
        );
    }

    return (
        <dialog open className="login-overlay" aria-modal="true">
            <button type="button" className="login-backdrop" onClick={() => setShowLogin(false)} aria-label="Close" />
            <div className="login-modal">
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="modal-header">
                        <div className="header-content">
                            <h2 className="modal-title">
                                {currentState === "Login" ? "Client Portal Login" : "Create Business Account"}
                            </h2>
                            <p className="modal-subtitle">
                                {currentState === "Login"
                                    ? "Access your business dashboard"
                                    : "Register your company account"}
                            </p>
                        </div>
                        <button type="button" className="close-btn" onClick={() => setShowLogin(false)} aria-label="Close login modal">
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

                        {currentState === "Login" && (
                            <div className="forgot-password-link">
                                <button type="button" onClick={openForgotPassword}>Forgot your password?</button>
                            </div>
                        )}
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
                        className={`submit-btn ${isLoading ? 'submitting' : ''}`}
                        disabled={isLoading || !captchaToken}
                        style={{ height: '52px', minHeight: '52px', maxHeight: '52px' }}
                        aria-busy={isLoading}
                    >
                        <span className={`submit-btn-text ${isLoading ? 'hidden' : ''}`}>
                            {submitButtonLabel}
                        </span>
                        {isLoading && <span className="submit-spinner" aria-hidden="true"></span>}
                        {isLoading && <span className="sr-only">Loading</span>}
                    </button>

                    <div className="form-footer">
                        <div className="terms-agreement">
                            <input type='checkbox' id="terms" required disabled={isLoading} />
                            <label htmlFor="terms">
                                I agree to the <a href="/terms" target="_blank">Terms of Use</a> and <a href="/privacy" target="_blank">Privacy Policy</a>
                            </label>
                        </div>
                        <div className="state-toggle">
                            {currentState === "Login" ? (
                                <p>Don&apos;t have a business account? <button type="button" onClick={toggleState}>Register here</button></p>
                            ) : (
                                <p>Already have an account? <button type="button" onClick={toggleState}>Login here</button></p>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </dialog>
    );
}

LoginPopup.propTypes = {
    setShowLogin: PropTypes.func.isRequired,
};

export default LoginPopup