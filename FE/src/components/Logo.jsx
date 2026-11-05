import { Link } from "react-router-dom";
import logo from "../assets/logo.svg";
import "./Logo.css";

export default function Logo({ to = "/documents", onClick, className = "" }) {
  const image = <img src={logo} alt="모두의 페이지" />;

  if (onClick) {
    return (
      <button
        type="button"
        className={`app-logo ${className}`}
        onClick={onClick}
        aria-label="모두의 페이지"
      >
        {image}
      </button>
    );
  }

  return (
    <Link to={to} className={`app-logo ${className}`}>
      {image}
    </Link>
  );
}