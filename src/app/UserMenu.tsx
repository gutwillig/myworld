import { useState, useRef, useEffect } from "react";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AuthModal } from "./AuthModal";
import styles from "./auth.module.css";

export function UserMenu() {
  const { user, loading, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showDropdown]);

  // Show sign in even while loading (Supabase check is fast)
  if (loading && !user) {
    return (
      <>
        <button type="button" className={styles.signInButton} onClick={() => setShowAuth(true)}>
          <User size={16} strokeWidth={2.2} />
          Sign in
        </button>
        <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <button type="button" className={styles.signInButton} onClick={() => setShowAuth(true)}>
          <User size={16} strokeWidth={2.2} />
          Sign in
        </button>
        <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
      </>
    );
  }

  const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "You";
  const initial = displayName[0]?.toUpperCase() || "?";

  return (
    <div className={styles.userMenu} ref={dropdownRef}>
      <button
        type="button"
        className={styles.userButton}
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <span className={styles.avatar}>{initial}</span>
        {displayName}
      </button>

      {showDropdown && (
        <div className={styles.dropdown}>
          <button
            type="button"
            className={styles.dropdownItem}
            onClick={() => {
              signOut();
              setShowDropdown(false);
            }}
          >
            <LogOut size={16} strokeWidth={2} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
