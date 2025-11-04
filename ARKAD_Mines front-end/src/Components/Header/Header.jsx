

import React from 'react';
import './Header.css';
import ControlledCarousel from '../ControlledCarousel/ControlledCarousel'; 

export const Header = () => {
  return (
    <div className='header-container'>
        <div className="carousel-slider">
      <ControlledCarousel />
      </div>
    </div>
  );
}
