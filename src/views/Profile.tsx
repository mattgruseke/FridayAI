"use client";

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';

const Profile = () => {
    const { user, userProfile, isAdmin, fullName, refreshProfile } = useAuth();
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(fullName);
    const [nameSaving, setNameSaving] = useState(false);

    const displayName = fullName || user?.email?.split('@')[0] || 'user';
    const initials = displayName.slice(0, 2).toUpperCase();

    async function handleSaveName() {
        if (!user || !nameInput.trim()) return;
        setNameSaving(true);
        await api.profile.update({ full_name: nameInput.trim() });
        // Clears the "welcome" notification seeded at signup (supabase/schema.sql).
        await api.notifications.completeByType("welcome").catch(() => {});
        await refreshProfile();
        setNameSaving(false);
        setEditingName(false);
    }

    function handleEditName() {
        setNameInput(fullName);
        setEditingName(true);
    }

    return (
        <div className="profile-page">
            <div className="profile-card">
                <div className="profile-avatar">
                    {initials}
                </div>
                <h1 className="profile-name">{displayName}</h1>
                {isAdmin && <span className="profile-admin-badge">Admin</span>}

                <div className="profile-info">
                    <div className="profile-row">
                        <span className="profile-label">Name</span>
                        {editingName ? (
                            <div className="profile-name-edit">
                                <input
                                    className="profile-name-input"
                                    type="text"
                                    value={nameInput}
                                    onChange={(e) => setNameInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                                    autoFocus
                                />
                                <button className="profile-configure-btn" onClick={handleSaveName} disabled={nameSaving || !nameInput.trim()}>
                                    {nameSaving ? "Saving..." : "Save"}
                                </button>
                                <button className="profile-configure-btn" onClick={() => setEditingName(false)}>Cancel</button>
                            </div>
                        ) : (
                            <span className="profile-value profile-value--editable" onClick={handleEditName}>
                                {fullName || <span style={{ color: "#aaa", fontStyle: "italic" }}>Not set</span>}
                                <span className="profile-edit-hint">edit</span>
                            </span>
                        )}
                    </div>
                    <div className="profile-row">
                        <span className="profile-label">Email</span>
                        <span className="profile-value">{user?.email}</span>
                    </div>
                    <div className="profile-row">
                        <span className="profile-label">Member since</span>
                        <span className="profile-value">
                            {user?.created_at
                                ? new Date(user.created_at).toLocaleDateString()
                                : 'Unknown'}
                        </span>
                    </div>
                    {userProfile?.invite_code_used && (
                        <div className="profile-row">
                            <span className="profile-label">Invite code</span>
                            <span className="profile-value">{userProfile.invite_code_used}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Profile;