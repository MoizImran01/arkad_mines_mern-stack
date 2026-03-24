import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { FiArrowLeft, FiSave, FiLoader } from "react-icons/fi";
import { StoreContext } from "../../context/StoreContext";
import "./EditProfile.css";

const EditProfile = () => {
  const { token, url } = useContext(StoreContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ companyName: "", email: "" });
  const [initialEmail, setInitialEmail] = useState("");
  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) return;
      try {
        setLoading(true);
        const response = await axios.get(`${url}/api/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.data?.success) {
          setInitialEmail(response.data.user?.email || "");
          setForm({
            companyName: response.data.user?.companyName || "",
            email: response.data.user?.email || "",
          });
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Unable to load profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token, url]);

  const saveChanges = async (e) => {
    e.preventDefault();
    const wantsPasswordChange = Boolean(
      securityForm.currentPassword || securityForm.newPassword || securityForm.confirmPassword
    );
    const wantsEmailChange = form.email.trim().toLowerCase() !== initialEmail.trim().toLowerCase();

    if (wantsPasswordChange) {
      if (!securityForm.currentPassword || !securityForm.newPassword || !securityForm.confirmPassword) {
        toast.error("Please fill all password fields to change password.");
        return;
      }
      if (securityForm.newPassword.length < 8) {
        toast.error("New password must be at least 8 characters long.");
        return;
      }
      if (securityForm.newPassword !== securityForm.confirmPassword) {
        toast.error("New password and confirm password do not match.");
        return;
      }
    }

    try {
      setSaving(true);
      let didEmailUpdate = false;
      let didPasswordUpdate = false;

      if (wantsEmailChange) {
        const profileResponse = await axios.put(
          `${url}/api/user/me`,
          { email: form.email },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!profileResponse.data?.success) {
          toast.error(profileResponse.data?.message || "Failed to update profile.");
          return;
        }
        didEmailUpdate = true;
      }

      if (wantsPasswordChange) {
        const passwordResponse = await axios.put(`${url}/api/user/me/password`, securityForm, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!passwordResponse.data?.success) {
          toast.error(passwordResponse.data?.message || "Failed to update password.");
          return;
        }
        didPasswordUpdate = true;
      }

      if (didEmailUpdate && didPasswordUpdate) {
        setInitialEmail(form.email);
        toast.success("Email and password updated successfully.");
        navigate("/");
        return;
      }

      if (didPasswordUpdate) {
        toast.success("Password updated successfully.");
        navigate("/");
        return;
      }

      if (didEmailUpdate) {
        setInitialEmail(form.email);
        toast.success("Email updated successfully.");
      } else {
        toast.info("No changes to save.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="edit-profile-page">
        <div className="edit-profile-loading">
          <FiLoader className="spin" size={24} />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-profile-page">
      <div className="edit-profile-wrap">
        <button className="back-profile-btn" onClick={() => navigate("/profile")}>
          <FiArrowLeft />
          Back to Profile
        </button>

        <form className="edit-profile-form" onSubmit={saveChanges}>
          <div className="edit-header">
            <h2>Edit Profile</h2>
            <p>Update your account information and security settings in one place.</p>
          </div>

          <div className="form-section full-width">
            <h3>Account Information</h3>
            <label htmlFor="companyName">Company Name</label>
            <input
              id="companyName"
              type="text"
              value={form.companyName}
              readOnly
              disabled
            />

            <label htmlFor="email">Business Email</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>

          <div className="form-section full-width">
            <h3>Update Password</h3>
            <p className="section-note">Leave password fields empty if you do not want to change your password.</p>
            <label htmlFor="currentPassword">Current Password</label>
            <input
              id="currentPassword"
              type="password"
              value={securityForm.currentPassword}
              onChange={(e) => setSecurityForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
            />

            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              minLength={8}
              value={securityForm.newPassword}
              onChange={(e) => setSecurityForm((prev) => ({ ...prev, newPassword: e.target.value }))}
            />

            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              minLength={8}
              value={securityForm.confirmPassword}
              onChange={(e) => setSecurityForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
            />
          </div>

          <button type="submit" className="save-btn" disabled={saving}>
            {saving ? <FiLoader className="spin" /> : <FiSave />}
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditProfile;
