import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Search, Bell, LogOut, Menu, Key, X } from 'lucide-react';

export default function TopBar({ title, onMenuClick }) {
    const { signOut, updatePassword } = useAuth();
    const { success, error: showError } = useToast();
    const [showChangePass, setShowChangePass] = useState(false);
    const [newPass, setNewPass] = useState('');
    const [loading, setLoading] = useState(false);

    async function handlePassUpdate(e) {
        e.preventDefault();
        setLoading(true);
        try {
            await updatePassword(newPass);
            success('Password successfully updated!');
            setShowChangePass(false);
            setNewPass('');
        } catch (err) {
            showError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="topbar">
            <div className="topbar-left">
                <button className="mobile-menu-btn" onClick={onMenuClick}>
                    <Menu size={18} />
                </button>
                <h2>{title}</h2>
            </div>
            <div className="topbar-right">
                <div className="topbar-search">
                    <Search />
                    <input type="text" placeholder="Search anything..." />
                </div>
                <button className="topbar-btn" title="Change Password" onClick={() => setShowChangePass(true)}>
                    <Key size={18} />
                </button>
                <button className="topbar-btn" onClick={signOut} title="Sign Out">
                    <LogOut size={18} />
                </button>
            </div>

            {showChangePass && (
                <div className="modal-overlay" onClick={() => setShowChangePass(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Change Password</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowChangePass(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handlePassUpdate}>
                            <div className="form-group">
                                <label className="form-label">New Password</label>
                                <input 
                                    className="form-input" 
                                    type="password" 
                                    value={newPass} 
                                    onChange={e => setNewPass(e.target.value)} 
                                    required minLength={6} 
                                    placeholder="Enter new password..."
                                />
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" type="button" onClick={() => setShowChangePass(false)}>Cancel</button>
                                <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Updating...' : 'Update Password'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
