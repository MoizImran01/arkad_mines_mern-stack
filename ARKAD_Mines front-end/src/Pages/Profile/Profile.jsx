import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FiEdit3, FiMail, FiBriefcase, FiUserCheck, FiLoader } from "react-icons/fi";
import { StoreContext } from "../../context/StoreContext";
import "./Profile.css";

/** Read-only account summary for the signed-in buyer. */
const Profile = () => {
  const { token, url } = useContext(StoreContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) return;
      try {
        setLoading(true);
        setError("");
        const response = await axios.get(`${url}/api/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.data?.success) {
          setProfile(response.data.user);
        } else {
          setError("Unable to load profile.");
        }
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token, url]);

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <FiLoader className="spin" size={24} />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-header">
          <div>
            <h1>My Profile</h1>
            <p>Manage your company account details</p>
          </div>
          <button className="profile-edit-btn" onClick={() => navigate("/profile/edit")}>
            <FiEdit3 />
            Edit Profile
          </button>
        </div>

        {error ? <div className="profile-error">{error}</div> : null}

        <div className="profile-grid">
          <div className="profile-field">
            <span className="profile-label">
              <FiBriefcase />
              Company Name
            </span>
            <p>{profile?.companyName || "—"}</p>
          </div>
          <div className="profile-field">
            <span className="profile-label">
              <FiMail />
              Business Email
            </span>
            <p>{profile?.email || "—"}</p>
          </div>
          <div className="profile-field">
            <span className="profile-label">
              <FiUserCheck />
              Account Role
            </span>
            <p>{profile?.role || "customer"}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
