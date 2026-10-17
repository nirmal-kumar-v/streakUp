import React, { useState } from 'react';

interface InitialsAvatarProps {
  name: string;
  image?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export const InitialsAvatar: React.FC<InitialsAvatarProps> = ({
  name,
  image,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  // Compute initials from name or fallback
  const getInitials = (n: string) => {
    if (!n) return '?';
    const parts = n.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(name);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-24 h-24 text-2xl',
  }[size];

  // If valid image provided and hasn't errored
  if (image && !imageError) {
    return (
      <div
        className={`${sizeClasses} rounded-xl overflow-hidden border border-dark-border bg-dark-surface shrink-0 shadow-sm ${className}`}
      >
        <img
          src={image}
          alt={name}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Fallback: Initials with stylish flame-gradient accent
  return (
    <div
      className={`${sizeClasses} rounded-xl border border-flame-500/25 bg-gradient-to-br from-zinc-800 to-zinc-900 text-flame-400 font-bold flex items-center justify-center tracking-tight shrink-0 shadow-sm shadow-flame-500/10 select-none ${className}`}
      title={name}
    >
      <span>{initials}</span>
    </div>
  );
};
