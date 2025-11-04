import React, { useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation, EffectFade } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-fade';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import './ControlledCarousel.css';
import factory from '../../assets/factory.jpg';
import black from '../../assets/black-counter.jpg';
import light from '../../assets/light-counter.jpg';

function ControlledCarousel() {
  const progressCircle = useRef(null);
  const progressContent = useRef(null);

  const onAutoplayTimeLeft = (s, time, progress) => {
    if (progressCircle.current && progressContent.current) {
      progressCircle.current.style.setProperty('--progress', 1 - progress);
      progressContent.current.textContent = `${Math.ceil(time / 1000)}s`;
    }
  };

  const slides = [
    {
      src: factory,
      title: "Crispy Paratha Roll",
      description: "Utmost Crispiness."
    },
    {
      src: black,
      title: "Korean Noodles",
      description: "Noodles with a twist."
    },
    {
      src: light,
      title: "Alfredo Pasta",
      description: "Prepared with love."
    }
  ];

  return (
    <div className="swiper-container">
      <Swiper
        spaceBetween={0}
        centeredSlides={true}
        loop={true} // Enable continuous looping
        effect={'fade'} // Smooth fade effect
        fadeEffect={{
          crossFade: true // Smooth cross-fade between slides
        }}
        speed={1000} // Slower transition speed for smoother effect
        autoplay={{
          delay: 4000, // Slightly shorter delay for better flow
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
          dynamicBullets: true,
        }}
        navigation={true}
        modules={[Autoplay, Pagination, Navigation, EffectFade]}
        onAutoplayTimeLeft={onAutoplayTimeLeft}
        className="mySwiper"
      >
        {slides.map((slide, index) => (
          <SwiperSlide key={index}>
            <div className="slide-content">
              <img src={slide.src} alt={slide.title} />
              <div className="slide-overlay"></div>
              <div className="slide-caption">
                <h2 className="header-text">{slide.title}</h2>
                <p className="header-text1">{slide.description}</p>
              </div>
            </div>
          </SwiperSlide>
        ))}
        <div className="autoplay-progress" slot="container-end">
          <svg viewBox="0 0 48 48" ref={progressCircle}>
            <circle cx="24" cy="24" r="20"></circle>
          </svg>
          <span ref={progressContent}></span>
        </div>
      </Swiper>
    </div>
  );
}

export default ControlledCarousel;