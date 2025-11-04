import Carousel from 'react-bootstrap/Carousel';
import 'bootstrap/dist/css/bootstrap.min.css';
import factory from '../../assets/factory.jpg';
import black from '../../assets/black-counter.jpg';
import light from '../../assets/light-counter.jpg';
import './ControlledCarousel.css';

function ControlledCarousel() {
  return (
    <div className="d-flex justify-content-center">
      <Carousel fade interval={2000} className="custom-carousel" style={{ maxWidth: '1530px' }}>
        <Carousel.Item>
          <img className="d-block w-100" src={black} alt="Crispy Roll" />
          <Carousel.Caption>
            <h2 className="header-text">Crispy Paratha Roll</h2>
            <p className="header-text1">Utmost Crispiness.</p>
          </Carousel.Caption>
        </Carousel.Item>

        <Carousel.Item>
          <img className="d-block w-100" src={factory} alt="Korean Noodles" />
          <Carousel.Caption>
            <h2 className="header-text">Korean Noodles</h2>
            <p className="header-text1">Noodles with a twist.</p>
          </Carousel.Caption>
        </Carousel.Item>

        <Carousel.Item>
          <img className="d-block w-100" src={light} alt="Alfredo Pasta" />
          <Carousel.Caption>
            <h2 className="header-text">Alfredo Pasta</h2>
            <p className="header-text1">Prepared with love.</p>
          </Carousel.Caption>
        </Carousel.Item>
      </Carousel>
    </div>
  );
}

export default ControlledCarousel;
