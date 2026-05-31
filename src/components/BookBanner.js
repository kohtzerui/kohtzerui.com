import React, { useState, useEffect } from "react";
import "../styles/book-banner.css";

export default function BookBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 20000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="book-banner">
      <a
        href="https://github.com/kohtzr"
        target="_blank"
        rel="noopener noreferrer"
      >
        Check out my HPC projects on GitHub 🚀
      </a>
    </div>
  );
}

