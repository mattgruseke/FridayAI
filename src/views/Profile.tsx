"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import type { Intake } from '../api/client';
import { formatAnswer, HOME_MANAGER_AGENT, isAnswered, TIER_A, TIER_B } from '@/config/homeManagerIntake';
import type { Question } from '@/config/homeManagerIntake';

const Profile = () => {
    const { user, userProfile, isAdmin, fullName, refreshProfile } = useAuth();
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(fullName);
    const [nameSaving, setNameSaving] = useState(false);
    const [homeIntake, setHomeIntake] = useState<Intake | null | undefined>(undefined);

    useEffect(() => {
        api.intake.get(HOME_MANAGER_AGENT).then(setHomeIntake).catch(() => setHomeIntake(null));
    }, []);

    const answered = (q: Question) => isAnswered(q, homeIntake?.answers);

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

            <div className="profile-card profile-card--wide">
                <div className="profile-section-header">
                    <h2 className="profile-section-title">Home</h2>
                    <Link href="/intake" className="profile-configure-btn">
                        {homeIntake ? 'Edit answers' : 'Start intake'}
                    </Link>
                </div>

                {homeIntake === undefined ? (
                    <p className="profile-empty">Loading…</p>
                ) : homeIntake === null ? (
                    <p className="profile-empty">
                        You haven&apos;t filled in the Home Manager intake yet.
                    </p>
                ) : (
                    <div className="profile-info">
                        {TIER_A.slice(0, 5).filter(answered).map((q) => (
                            <div key={q.field} className="profile-row">
                                <span className="profile-label">{q.short}</span>
                                <span className="profile-value">
                                    {formatAnswer(q, homeIntake.answers)}
                                </span>
                            </div>
                        ))}
                        {homeIntake.known_providers.length > 0 && (
                            <div className="profile-row">
                                <span className="profile-label">Providers</span>
                                <span className="profile-value profile-value--list">
                                    {homeIntake.known_providers.map((p, i) => (
                                        <span key={i}>
                                            {p.name}
                                            {p.category && <span className="profile-sub"> · {p.category}</span>}
                                        </span>
                                    ))}
                                </span>
                            </div>
                        )}
                        {[...TIER_A.slice(5), ...TIER_B].filter(answered).map((q) => (
                            <div key={q.field} className="profile-row">
                                <span className="profile-label">{q.short}</span>
                                <span className="profile-value">
                                    {formatAnswer(q, homeIntake.answers)}
                                </span>
                            </div>
                        ))}
                        <p className="profile-footnote">
                            Last updated {new Date(homeIntake.updated_at).toLocaleString()}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Profile;