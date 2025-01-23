import React from 'react';

const COLOR_CLASSES = {
  bg: {
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    fuchsia: 'bg-fuchsia-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500'
  },
  text: {
    blue: 'text-blue-500',
    red: 'text-red-500',
    green: 'text-green-500',
    purple: 'text-purple-500',
    fuchsia: 'text-fuchsia-500',
    orange: 'text-orange-500',
    yellow: 'text-yellow-500'
  },
  bgOpacity: {
    blue: 'bg-blue-500/90',
    red: 'bg-red-500/90',
    green: 'bg-green-500/90',
    purple: 'bg-purple-500/90',
    fuchsia: 'bg-fuchsia-500/90',
    orange: 'bg-orange-500/90',
    yellow: 'bg-yellow-500/90'
  }
};

export const getColorClass = (type, color) => {
  return COLOR_CLASSES[type]?.[color] || COLOR_CLASSES[type].blue;
};

const AccentElement = ({ 
  color, 
  children, 
  className = '', 
  type = 'bg',
  ...props // Spread operator to collect all other props
}) => (
  <div 
    className={`${getColorClass(type, color)} ${className}`}
    {...props} // Spread all other props onto the div
  >
    {children}
  </div>
);

export default AccentElement;