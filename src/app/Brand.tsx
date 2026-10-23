import { Link } from "react-router-dom";
import styles from "./chrome.module.css";

/** The myworld wordmark with its little mountain-and-sun mark. */
export function Brand() {
  return (
    <Link to="/" className={styles.brand} aria-label="myworld home">
      <svg className={styles.mark} viewBox="0 0 64 44" aria-hidden="true">
        <circle cx="40" cy="9" r="6" fill="#E5694F" />
        <path d="M2 40 L22 14 L34 28 L42 20 L62 40 Z" fill="#5E8A5A" />
        <path d="M22 14 L28 22 L20 40 L2 40 Z" fill="#3F6B4A" />
        <path d="M42 20 L48 27 L44 40 L34 40 L36 28 Z" fill="#7FA66E" />
      </svg>
      <span className={styles.brandText}>
        <span className={styles.wordmark}>myworld</span>
        <span className={styles.tagline}>Build in public like never before</span>
      </span>
    </Link>
  );
}
