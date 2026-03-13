import React from "react";

interface VoiceEarIconProps {
  className?: string;
  size?: number;
}

const VoiceEarIcon: React.FC<VoiceEarIconProps> = ({ className = "", size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Outer ear */}
    <path d="M6 8.5C6 4.36 9.36 1 13.5 1S21 4.36 21 8.5c0 3.04-1.83 5.66-4.45 6.82" />
    {/* Inner ear canal */}
    <path d="M16.55 15.32C15.36 17.27 13.5 19 12 20.5c-1.5 1.5-3 2.5-4.5 2.5" />
    {/* Ear canal detail */}
    <path d="M10 8.5c0-1.93 1.57-3.5 3.5-3.5S17 6.57 17 8.5c0 1.4-.82 2.6-2 3.16" />
    {/* Inner bump */}
    <circle cx="13.5" cy="11" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export default VoiceEarIcon;
