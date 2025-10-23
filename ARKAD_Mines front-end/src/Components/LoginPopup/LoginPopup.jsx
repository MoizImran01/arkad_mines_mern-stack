import React, { useContext, useState } from 'react'
import './LoginPopup.css'
import crossicon from '../../assets/cross_icon.png'
import axios from "axios";
import { StoreContext } from '../../context/StoreContext';

//main login/signup popup component that handles user authentication
const LoginPopup = ({ setShowLogin }) => {
    //tracks whether we're in login or signup mode
    const [currentState, setCurrentState] = useState("Login")
    // loading state for form submission
    const [isLoading, setIsLoading] = useState(false)
    //error message display
    const [error, setError] = useState("")
    //global token state from context
    const { setToken } = useContext(StoreContext)
    
    //form data state that handles both login and registration
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: ""
    })

    //backend API base URL - would need to be environment variable in production
    const url = "http://localhost:4000"

    //handles input changes for all form fields and clears any existing errors
    const handleInputChange = (event) => {
        const { name, value } = event.target
        setFormData(prevData => ({ ...prevData, [name]: value }))
        // clear error when user starts typing again
        if (error) setError("")
    }

//main form submission handler for both login and registration
const handleSubmit = async (event) => {
  //prevent default form submission behavior
  event.preventDefault();
  // show loading state and clear previous errors
  setIsLoading(true);
  setError("");

  try {
    //determine which endpoint to use based on current mode
    const endpoint = currentState === "Login" ? "/api/user/login" : "/api/user/register";
    //make API call to backend authentication service
    const response = await axios.post(`${url}${endpoint}`, formData);

    //check if the authentication was successful
    if (response.data.success) {
      const { token, user } = response.data;
      //update global token state and persist to localStorage
      setToken(token);
      localStorage.setItem("token", token);
      localStorage.setItem("userRole", user.role);

      //redirect users based on their role - admin goes to different portal
      if (user.role === "admin") {
        window.location.href = "http://localhost:5174"; 
      } else {
        window.location.href = "/dashboard"; 
      }

      //close the popup and reset form data
      setShowLogin(false);
      setFormData({ name: "", email: "", password: "" });
    } else {
      //display error message from server response
      setError(response.data.message || "An error occurred");
    }
  } catch (error) {
    //handle network errors or server errors with appropriate messaging
    console.error("Authentication error:", error);
    setError(error.response?.data?.message || "Network error. Please try again.");
  } finally {
    //always remove loading state regardless of success/failure
    setIsLoading(false);
  }
};


    //toggles between login and signup modes and resets form state
    const toggleState = () => {
        setCurrentState(prev => prev === "Login" ? "Sign Up" : "Login")
        //clear any errors and reset form when switching modes
        setError("")
        setFormData({ name: "", email: "", password: "" })
    }

    //handles clicking outside the modal to close it (backdrop click)
    const handleBackdropClick = (e) => {
        //only close if the actual overlay backdrop was clicked, not the modal content
        if (e.target === e.currentTarget) {
            setShowLogin(false)
        }
    }

    return (

        <div className='login-overlay' onClick={handleBackdropClick}>

            <div className='login-modal'>

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

                    <button 
                        type='submit' 
                        className={`submit-btn ${isLoading ? 'loading' : ''}`}
                        disabled={isLoading}
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

export default LoginPopup